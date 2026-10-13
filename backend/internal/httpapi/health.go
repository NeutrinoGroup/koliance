package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/market"
)

// This file is the antidote to the four hardcoded `true` values /health used to
// return for `steam`, `github`, `alpaca` and `pyth` (GAP-13).
//
// A hardcoded probe is worse than a missing one. Every one of those `true`s was
// an assertion that an integration worked, produced by a process that had never
// contacted it — and the frontend renders the result as an integration status
// badge. The rule here is narrow and absolute: a service key may only be `true`
// as the direct consequence of an upstream response that the process actually
// received, on this request.

// probeTimeout bounds each probe. Four probes run concurrently, so /health's
// latency is the slowest one, not their sum — which matters because Render's
// health check path is /healthz and it pings it continuously.
//
// 4s, not 3s: measured against the real endpoints from this machine, the Steam
// probe took 2.77s, i.e. 92% of a 3s budget. A probe that times out under
// normal conditions reports a healthy integration as broken, and a degraded
// list that flaps is one people learn to ignore.
const probeTimeout = 4 * time.Second

// probeTTL is how long an observation is reused before the upstream is asked
// again.
//
// Without it every /healthz ping costs four upstream requests. Render polls the
// health check path far more often than a human reads it, and GitHub's
// anonymous quota is 60 requests PER HOUR: a per-request probe would exhaust it
// and then break the app's own GitHub features (GAP-47), while reporting
// `github: false` for a service that is fine. Caching keeps the verdict
// evidence-based — it is still the outcome of a real call, just a recent one —
// and `ageMs` on each probe says how recent.
var probeTTL = 20 * time.Second

// ProbeResult is one upstream's verdict.
type ProbeResult struct {
	OK        bool   `json:"ok"`
	LatencyMS int64  `json:"latencyMs"`
	Error     string `json:"error,omitempty"`
	// Detail carries the evidence that made OK true (e.g. how many instruments
	// were read). Without it, a `true` is unauditable.
	Detail string `json:"detail,omitempty"`
	// Cached / AgeMS say this verdict was reused from an earlier observation
	// rather than made on this request. Absent means it was made just now.
	Cached bool  `json:"cached,omitempty"`
	AgeMS  int64 `json:"ageMs,omitempty"`
}

var reURLWithQuery = regexp.MustCompile(`(https?://[^\s?"'<>]*)(\?[^\s"'<>]*)`)

func sanitizeProbeError(err error) string {
	if err == nil {
		return ""
	}
	s := reURLWithQuery.ReplaceAllString(err.Error(), "${1}")
	for _, r := range []struct {
		re *regexp.Regexp
		to string
	}{
		{reGoStack, markStack},
		{reTruncatedAlpacaBody, "${1}" + markUpstream},
		{reDSN, "${1}" + markDSN},
		{reSQL, markSQL},
		{reEnvAssign, markEnv},
		// ADR-006 §3.5: Operator view (/healthz, /health) explicitly allows
		// environment variable names (e.g. ALPACA_API_KEY) so operators know what is missing.
		{reSecretValue, markSecret},
		{reFilePathURI, markPath},
		{reFilePathAbs, "${1}" + markPath},
		{reFilePathRel, "${1}" + markPath},
		{reHost, markHost},
		{reThirdPartyBody, markUpstream},
	} {
		s = r.re.ReplaceAllString(s, r.to)
	}
	return s
}

// runProbe executes fn under its own timeout and converts panic/error into a
// false verdict with the reason attached.
//
// The result travels over a buffered channel rather than a shared struct: on
// the timeout path the goroutine is still running, and letting it write into a
// struct the caller is already reading would be a data race that only shows up
// when an upstream hangs (i.e. exactly when /health matters). The buffer is 1
// so the abandoned goroutine can still complete its send and exit.
//
// The recover is not defensive padding either: a panic inside the probe
// goroutine would otherwise crash the process, taking down the one endpoint an
// operator needs when something is wrong.
func runProbe(ctx context.Context, fn func(context.Context) (string, error)) ProbeResult {
	start := time.Now()

	probeCtx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()

	type outcome struct {
		detail string
		err    error
	}

	ch := make(chan outcome, 1)

	go func() {
		var out outcome
		defer func() {
			if r := recover(); r != nil {
				out = outcome{err: errors.New("probe panicked")}
			}
			ch <- out
		}()
		out.detail, out.err = fn(probeCtx)
	}()

	result := ProbeResult{}
	select {
	case out := <-ch:
		if out.err != nil {
			result.Error = sanitizeProbeError(out.err)
		} else {
			result.OK = true
			result.Detail = out.detail
		}
	case <-probeCtx.Done():
		result.Error = "probe timed out after " + probeTimeout.String()
	}

	result.LatencyMS = time.Since(start).Milliseconds()
	return result
}

// HealthProbes is every openable integration's verdict for this request.
type HealthProbes struct {
	Steam  ProbeResult `json:"steam"`
	GitHub ProbeResult `json:"github"`
	Alpaca ProbeResult `json:"alpaca"`
	Pyth   ProbeResult `json:"pyth"`
}

// probeCache holds the last observation per upstream.
//
// Deliberately per-process and in-memory: a shared cache (Redis, a table) would
// make /health depend on the thing it is supposed to be reporting on.
var probeCache = struct {
	sync.Mutex
	entries map[string]cachedProbe
}{entries: map[string]cachedProbe{}}

type cachedProbe struct {
	result ProbeResult
	at     time.Time
}

// runHealthProbes returns each upstream's verdict, reusing an observation
// younger than probeTTL.
func runHealthProbes(ctx context.Context, cfg *config.Config, oracle *market.PriceOracle) HealthProbes {
	now := time.Now()

	type task struct {
		key string
		fn  func(context.Context) ProbeResult
	}
	tasks := []task{
		{"steam", func(ctx context.Context) ProbeResult { return probeSteam(ctx, cfg) }},
		{"github", probeGitHub},
		{"alpaca", func(ctx context.Context) ProbeResult { return probeAlpaca(ctx, oracle) }},
		{"pyth", func(ctx context.Context) ProbeResult { return probePyth(ctx, cfg) }},
	}

	results := make([]ProbeResult, len(tasks))
	var wg sync.WaitGroup
	// Each goroutine writes exactly one distinct slice element (indexed writes
	// into a pre-sized slice do not race), and the WaitGroup gives the
	// happens-before edge before any element is read.
	for i, t := range tasks {
		if cached, ok := readCachedProbe(t.key, now); ok {
			results[i] = cached
			continue
		}
		wg.Add(1)
		go func(i int, fn func(context.Context) ProbeResult) {
			defer wg.Done()
			results[i] = fn(ctx)
		}(i, t.fn)
	}
	wg.Wait()

	for i, t := range tasks {
		if !results[i].Cached {
			writeCachedProbe(t.key, results[i], now)
		}
	}

	return HealthProbes{
		Steam:  results[0],
		GitHub: results[1],
		Alpaca: results[2],
		Pyth:   results[3],
	}
}

func readCachedProbe(key string, now time.Time) (ProbeResult, bool) {
	probeCache.Lock()
	defer probeCache.Unlock()
	entry, ok := probeCache.entries[key]
	if !ok || now.Sub(entry.at) >= probeTTL {
		return ProbeResult{}, false
	}
	entry.result.Cached = true
	entry.result.AgeMS = now.Sub(entry.at).Milliseconds()
	return entry.result, true
}

func writeCachedProbe(key string, result ProbeResult, now time.Time) {
	probeCache.Lock()
	defer probeCache.Unlock()
	probeCache.entries[key] = cachedProbe{result: result, at: now}
}

// Degraded lists the service keys that are not OK, in a stable order.
func (p HealthProbes) Degraded() []string {
	out := []string{}
	for _, e := range []struct {
		key string
		res ProbeResult
	}{
		{"steam", p.Steam},
		{"github", p.GitHub},
		{"alpaca", p.Alpaca},
		{"pyth", p.Pyth},
	} {
		if !e.res.OK {
			out = append(out, e.key)
		}
	}
	return out
}

// probeAlpaca asserts the stronger proposition: not "the data host answered"
// but "we can read a bar with the credentials we hold". A 200 with an empty
// bars object is a failure — it is precisely the case where a naive probe says
// healthy and the page shows nothing.
func probeAlpaca(ctx context.Context, oracle *market.PriceOracle) ProbeResult {
	return runProbe(ctx, func(ctx context.Context) (string, error) {
		if oracle == nil {
			return "", fmt.Errorf("price oracle not wired")
		}
		if !oracle.Configured() {
			return "", fmt.Errorf("ALPACA_API_KEY/ALPACA_API_SECRET not set")
		}
		changes, err := oracle.PriceChange(ctx, nil)
		if err != nil {
			return "", err
		}
		quoted := 0
		var newest time.Time
		for _, c := range changes {
			if c.Price > 0 {
				quoted++
				if c.AsOf.After(newest) {
					newest = c.AsOf
				}
			}
		}
		if quoted == 0 {
			return "", fmt.Errorf("alpaca returned no bars for the configured symbols")
		}
		return fmt.Sprintf("%d/%d instruments quoted, latest bar %s", quoted, len(changes), newest.UTC().Format(time.RFC3339)), nil
	})
}

// probePyth checks the Pyth Hermes endpoint the same way: a parseable price or
// nothing. A bare HTTP 200 is not enough — an empty `parsed` array is how this
// feed fails when an id is wrong.
func probePyth(ctx context.Context, cfg *config.Config) ProbeResult {
	return runProbe(ctx, func(ctx context.Context) (string, error) {
		base := strings.TrimRight(strings.TrimSpace(cfg.PythHermesURL), "/")
		if base == "" {
			return "", fmt.Errorf("PYTH_HERMES_URL not set")
		}
		// The BTC/USD feed id, the same one `src/lib/perpConfig.ts` uses — kept
		// identical on purpose so the probe and the perp module cannot drift.
		url := base + "/v2/updates/price/latest?ids%5B%5D=" + pythBTCFeedID
		status, body, err := getJSON(ctx, url, nil)
		if err != nil {
			return "", err
		}
		if status != http.StatusOK {
			return "", fmt.Errorf("hermes status %d", status)
		}
		var out struct {
			Parsed []struct {
				Price struct {
					Price string `json:"price"`
					Expo  int32  `json:"expo"`
				} `json:"price"`
			} `json:"parsed"`
		}
		if err := json.Unmarshal(body, &out); err != nil {
			return "", fmt.Errorf("hermes decode: %w", err)
		}
		if len(out.Parsed) == 0 || out.Parsed[0].Price.Price == "" {
			return "", fmt.Errorf("hermes returned no parsed price")
		}
		return fmt.Sprintf("BTC/USD = %s e%d", out.Parsed[0].Price.Price, out.Parsed[0].Price.Expo), nil
	})
}

// pythBTCFeedID is the BTC/USD feed, identical to `src/lib/perpConfig.ts:148`.
const pythBTCFeedID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"

// Overridable so tests can point the probes at a local stub and the unit suite
// never depends on the network. The values are the real public endpoints.
var (
	steamProbeBaseURL  = "https://api.steampowered.com"
	githubProbeBaseURL = "https://api.github.com"
)

// probeSteam requires the configured API key to be accepted. 403 is Steam's
// answer to a bad key, so "reachable" alone would be a false positive.
func probeSteam(ctx context.Context, cfg *config.Config) ProbeResult {
	return runProbe(ctx, func(ctx context.Context) (string, error) {
		if strings.TrimSpace(cfg.SteamAPIKey) == "" {
			return "", fmt.Errorf("STEAM_API_KEY not set")
		}
		// A fixed, public, always-present profile: the probe tests the key, not
		// the caller's data.
		url := strings.TrimRight(steamProbeBaseURL, "/") + "/ISteamUser/GetPlayerSummaries/v0002/?key=" +
			cfg.SteamAPIKey + "&steamids=76561197960435530"
		status, body, err := getJSON(ctx, url, nil)
		if err != nil {
			return "", err
		}
		// Steam answers 403 when the key is not valid, and its error body is not
		// JSON, so both shapes are accepted and inspected.
		var out struct {
			Response struct {
				Players []struct {
					SteamID string `json:"steamid"`
				} `json:"players"`
			} `json:"response"`
		}
		_ = json.Unmarshal(body, &out)
		if status != http.StatusOK || len(out.Response.Players) == 0 {
			return "", fmt.Errorf("steam profile probe failed: status %d, %d players (key rejected?)",
				status, len(out.Response.Players))
		}
		return "profile " + out.Response.Players[0].SteamID + " read", nil
	})
}

// probeGitHub reports OK only when the API is reachable AND the shared
// anonymous quota has budget left. The old `true` would have been true with the
// quota exhausted, which is exactly when every GitHub-backed feature fails.
func probeGitHub(ctx context.Context) ProbeResult {
	return runProbe(ctx, func(ctx context.Context) (string, error) {
		status, body, err := getJSON(ctx, strings.TrimRight(githubProbeBaseURL, "/")+"/rate_limit", map[string]string{
			// GitHub rejects requests without a User-Agent, and that 403 is not
			// distinguishable from a real outage without this header.
			"User-Agent": "Koliance-Agent/1.0 (Monad Testnet)",
			"Accept":     "application/vnd.github.v3+json",
		})
		if err != nil {
			return "", err
		}
		if status != http.StatusOK {
			return "", fmt.Errorf("github status %d", status)
		}
		var out struct {
			Resources struct {
				Core struct {
					Limit     int `json:"limit"`
					Remaining int `json:"remaining"`
				} `json:"core"`
			} `json:"resources"`
		}
		if err := json.Unmarshal(body, &out); err != nil {
			return "", fmt.Errorf("github decode: %w", err)
		}
		if out.Resources.Core.Remaining <= 0 {
			return "", fmt.Errorf("github rate limit exhausted (%d/%d)", out.Resources.Core.Remaining, out.Resources.Core.Limit)
		}
		return fmt.Sprintf("rate limit %d/%d remaining", out.Resources.Core.Remaining, out.Resources.Core.Limit), nil
	})
}

// getJSON performs a bounded GET and returns the status and raw body. The body
// is read even on a non-200 so the error can name the upstream's own reason.
func getJSON(ctx context.Context, url string, headers map[string]string) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, fmt.Errorf("build request: %w", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := healthHTTPClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	// 256 KiB is ample for the payloads above and stops a hostile/broken
	// upstream from being read into memory unbounded.
	body, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if err != nil {
		return resp.StatusCode, nil, err
	}
	return resp.StatusCode, body, nil
}

var healthHTTPClient = &http.Client{Timeout: probeTimeout}
