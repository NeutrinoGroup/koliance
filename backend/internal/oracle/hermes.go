package oracle

import (
	"context"
	"encoding/hex"
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
// UpdateData closes GAP-39 for the liquidator: it returns the signed
// binary price update for one feed, which is what PositionManager needs
// as pythUpdateData on a PythOracleAdapter deployment. The REST latest
// price alone is not enough on chain, because the adapter only trusts
// prices pushed through updatePriceFeeds.
//
// What is still deferred: SSE/WS streaming ticks, a staleness bound
// mirroring PythOracleAdapter.getPriceNoOlderThan, and confidence
// handling. Callers must fetch an update immediately before submitting
// a transaction, and must not submit when UpdateData fails.
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
	out, err := f.latestUpdate(ctx, feedID, "")
	if err != nil {
		return nil, err
	}
	for _, p := range out.Parsed {
		if normalizeFeedID(p.ID) != normalizeFeedID(feedID) {
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

// UpdateData returns the signed binary price updates for one feed, in
// the form PositionManager.liquidate and openPosition expect as
// pythUpdateData. The feed id is treated as an opaque key: this
// function never hardcodes BTC, ETH, or any other symbol.
//
// A failure must be treated by the caller as "do not submit": on a
// Pyth deployment an empty or stale update reverts on chain, so
// submitting anyway only burns gas and a nonce.
func (f *HermesFeed) UpdateData(ctx context.Context, feedID string) ([][]byte, error) {
	out, err := f.latestUpdate(ctx, feedID, "hex")
	if err != nil {
		return nil, err
	}
	found := false
	for _, p := range out.Parsed {
		if normalizeFeedID(p.ID) == normalizeFeedID(feedID) {
			found = true
			break
		}
	}
	if !found {
		return nil, fmt.Errorf("oracle: hermes: feed %s not in response", feedID)
	}
	if len(out.Binary.Data) == 0 {
		return nil, fmt.Errorf("oracle: hermes: no update data for feed %s", feedID)
	}
	data := make([][]byte, 0, len(out.Binary.Data))
	for _, s := range out.Binary.Data {
		hexStr := strings.TrimSpace(s)
		hexStr = strings.TrimPrefix(hexStr, "0x")
		hexStr = strings.TrimPrefix(hexStr, "0X")
		if hexStr == "" {
			return nil, fmt.Errorf("oracle: hermes: empty update data for feed %s", feedID)
		}
		b, err := hex.DecodeString(hexStr)
		if err != nil {
			return nil, fmt.Errorf("oracle: decode hermes update data for feed %s: %w", feedID, err)
		}
		if len(b) == 0 {
			return nil, fmt.Errorf("oracle: hermes: empty update data for feed %s", feedID)
		}
		data = append(data, b)
	}
	return data, nil
}

func (f *HermesFeed) latestUpdate(ctx context.Context, feedID string, encoding string) (*hermesLatestResponse, error) {
	v := url.Values{}
	v.Add("ids[]", feedID)
	if encoding != "" {
		v.Add("encoding", encoding)
	}
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
	return &out, nil
}

func normalizeFeedID(id string) string {
	id = strings.TrimSpace(id)
	id = strings.TrimPrefix(id, "0x")
	id = strings.TrimPrefix(id, "0X")
	return strings.ToLower(id)
}

// hermesLatestResponse models the subset of the Hermes
// /v2/updates/price/latest response this package consumes.
type hermesLatestResponse struct {
	Binary struct {
		Data []string `json:"data"`
	} `json:"binary"`
	Parsed []struct {
		ID    string `json:"id"`
		Price struct {
			Price       string `json:"price"`
			Expo        int32  `json:"expo"`
			PublishTime int64  `json:"publish_time"`
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
