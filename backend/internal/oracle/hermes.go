package oracle

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// HermesFeed reads the latest Pyth price from hermes.pyth.network and
// normalizes it to 18-decimal USD.
//
// This is the production narrative path, deliberately kept minimal so the demo
// is not blocked on it: it performs a per-call latest-price REST GET. The real
// production path — SSE/WS streaming ticks, a staleness bound mirroring
// PythOracleAdapter.getPriceNoOlderThan, and batch/confidence handling — is
// deferred (GAP-39).
type HermesFeed struct {
	baseURL string
	client  *http.Client
}

// NewHermesFeed builds a Hermes reader. baseURL defaults to
// https://hermes.pyth.network; client defaults to http.DefaultClient.
func NewHermesFeed(baseURL string, client *http.Client) *HermesFeed {
	if baseURL == "" {
		baseURL = "https://hermes.pyth.network"
	}
	if client == nil {
		client = http.DefaultClient
	}
	return &HermesFeed{baseURL: strings.TrimRight(baseURL, "/"), client: client}
}

// Price resolves a feed id to the latest normalized price.
func (f *HermesFeed) Price(ctx context.Context, feedID string) (*big.Int, bool) {
	price, err := f.latestPrice(ctx, feedID)
	if err != nil {
		return nil, false
	}
	return price, true
}

func (f *HermesFeed) latestPrice(ctx context.Context, feedID string) (*big.Int, error) {
	v := url.Values{}
	v.Add("ids[]", feedID)
	u := f.baseURL + "/v2/updates/price/latest?" + v.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("oracle: build hermes request: %w", err)
	}
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("oracle: hermes get: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("oracle: hermes status %d", resp.StatusCode)
	}

	var out hermesLatestResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("oracle: decode hermes response: %w", err)
	}
	for _, p := range out.Parsed {
		if !strings.EqualFold(p.ID, feedID) {
			continue
		}
		price, err := strconv.ParseInt(p.Price.Price, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("oracle: hermes feed %s price %q: %w", feedID, p.Price.Price, err)
		}
		return NormalizeHermesPrice(price, p.Price.Expo)
	}
	return nil, fmt.Errorf("oracle: hermes: feed %s not in response", feedID)
}

// hermesLatestResponse models the subset of the Hermes
// /v2/updates/price/latest response this package consumes.
type hermesLatestResponse struct {
	Parsed []struct {
		ID    string `json:"id"`
		Price struct {
			Price string `json:"price"`
			Expo  int32  `json:"expo"`
		} `json:"price"`
	} `json:"parsed"`
}

// NormalizeHermesPrice scales a Pyth (int64 price, int32 expo) pair to
// 18-decimal USD, mirroring PythOracleAdapter._normalize exactly:
//
//	shift = 18 + expo
//	if price <= 0            -> reject
//	if shift > 36 or < -36   -> reject (ExponentOutOfRange)
//	if shift >= 0            -> price * 10**shift
//	else                     -> price / 10**(-shift)
//
// The exponent is read from the response, never assumed — BTC/USD uses -8
// while Equity.US.NVDA/USD uses -5, so a hardcoded -8 would misprice equity
// feeds by three orders of magnitude (PythOracleAdapter.sol:182-191).
func NormalizeHermesPrice(price int64, expo int32) (*big.Int, error) {
	if price <= 0 {
		return nil, fmt.Errorf("oracle: non-positive pyth price %d", price)
	}
	const target = 18
	shift := int64(target) + int64(expo)
	if shift > 36 || shift < -36 {
		return nil, fmt.Errorf("oracle: pyth exponent %d out of range", expo)
	}
	magnitude := big.NewInt(price)
	if shift >= 0 {
		return new(big.Int).Mul(magnitude, pow10(shift)), nil
	}
	return new(big.Int).Quo(magnitude, pow10(-shift)), nil
}

func pow10(n int64) *big.Int {
	return new(big.Int).Exp(big.NewInt(10), big.NewInt(n), nil)
}
