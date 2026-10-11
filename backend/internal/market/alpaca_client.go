package market

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ErrAlpacaCredentialsMissing is returned by every upstream call when
// ALPACA_API_KEY / ALPACA_API_SECRET are not configured.
//
// It exists so that "we cannot reach the market" is a distinct, testable state
// rather than something that quietly becomes a made-up number. Endpoints map it
// to 503 and the health probe reports it verbatim (issue #14, GAP-14).
var ErrAlpacaCredentialsMissing = errors.New(
	"alpaca credentials not configured: set ALPACA_API_KEY and ALPACA_API_SECRET (no synthetic market data is served)")

// CredentialState is the recorded outcome of the most recent upstream call.
// It is what /health reports instead of the hardcoded `true` it used to
// (GAP-13).
type CredentialState struct {
	// Observed is true only after at least one call has been attempted.
	Observed bool `json:"observed"`
	// OK is the outcome of the most recent completed call.
	OK bool `json:"ok"`
	// LastError is the most recent failure, cleared by a success.
	LastError string `json:"lastError,omitempty"`
	// LastSuccess is the last time a call succeeded (zero if never).
	LastSuccess time.Time `json:"lastSuccess,omitempty"`
}

type AlpacaClient struct {
	baseURL    string
	keyID      string
	secretKey  string
	httpClient *http.Client

	mu     sync.Mutex
	health CredentialState
}

func NewAlpacaClient(baseURL, keyID, secretKey string) *AlpacaClient {
	return &AlpacaClient{
		baseURL:   baseURL,
		keyID:     strings.TrimSpace(keyID),
		secretKey: strings.TrimSpace(secretKey),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SetHTTPClient replaces the HTTP client (tests point it at an httptest server,
// the same injection idiom game.Service uses).
func (c *AlpacaClient) SetHTTPClient(hc *http.Client) {
	if hc != nil {
		c.httpClient = hc
	}
}

// Configured reports whether credentials are present. Every call fails closed
// without them; nothing is fabricated in their absence.
func (c *AlpacaClient) Configured() bool {
	return c.keyID != "" && c.secretKey != ""
}

// Health returns the last observed upstream outcome. It performs no I/O: it is
// the request-path evidence, so /health stays cheap and cannot itself hang.
func (c *AlpacaClient) Health() CredentialState {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.health
}

func (c *AlpacaClient) recordOK() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.health = CredentialState{Observed: true, OK: true, LastSuccess: time.Now().UTC()}
}

func (c *AlpacaClient) recordErr(err error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	prev := c.health
	c.health = CredentialState{Observed: true, OK: false, LastError: err.Error(), LastSuccess: prev.LastSuccess}
}

type AlpacaAccount struct {
	ID                string `json:"id"`
	AccountNumber     string `json:"account_number"`
	Status            string `json:"status"`
	Currency          string `json:"currency"`
	BuyingPower       string `json:"buying_power"`
	Cash              string `json:"cash"`
	PortfolioValue    string `json:"portfolio_value"`
	Equity            string `json:"equity"`
	Multiplier        string `json:"multiplier"` // 4 for day trading leverage
	ShortingEnabled   bool   `json:"shorting_enabled"`
	LongMarketValue   string `json:"long_market_value"`
	ShortMarketValue  string `json:"short_market_value"`
	InitialMargin     string `json:"initial_margin"`
	MaintenanceMargin string `json:"maintenance_margin"`
}

type AlpacaPosition struct {
	AssetID        string `json:"asset_id"`
	Symbol         string `json:"symbol"`
	Exchange       string `json:"exchange"`
	Qty            string `json:"qty"`
	AvgEntryPrice  string `json:"avg_entry_price"`
	Side           string `json:"side"` // "long" or "short"
	MarketValue    string `json:"market_value"`
	CostBasis      string `json:"cost_basis"`
	UnrealizedPL   string `json:"unrealized_pl"`
	UnrealizedPLPC string `json:"unrealized_plpc"`
	CurrentPrice   string `json:"current_price"`
	ChangeToday    string `json:"change_today"`
}

type OrderRequest struct {
	Symbol      string `json:"symbol"`
	Qty         string `json:"qty,omitempty"`
	Notional    string `json:"notional,omitempty"` // USD amount
	Side        string `json:"side"`               // "buy" (Long) or "sell" (Short)
	Type        string `json:"type"`               // "market" or "limit"
	TimeInForce string `json:"time_in_force"`      // "day" or "gtc"
	LimitPrice  string `json:"limit_price,omitempty"`
}

type AlpacaOrder struct {
	ID            string    `json:"id"`
	ClientOrderID string    `json:"client_order_id"`
	CreatedAt     time.Time `json:"created_at"`
	Symbol        string    `json:"symbol"`
	Qty           string    `json:"qty"`
	FilledQty     string    `json:"filled_qty"`
	Side          string    `json:"side"`
	Type          string    `json:"type"`
	Status        string    `json:"status"` // "new", "filled", "partially_filled"
}

// doRequest issues an authenticated call. ctx is honoured end to end: the
// previous version used http.NewRequest, so a disconnected browser left the
// upstream request running to completion.
func (c *AlpacaClient) doRequest(ctx context.Context, method, endpoint string, body interface{}) ([]byte, error) {
	if !c.Configured() {
		c.recordErr(ErrAlpacaCredentialsMissing)
		return nil, ErrAlpacaCredentialsMissing
	}

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			c.recordErr(err)
			return nil, err
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+endpoint, bodyReader)
	if err != nil {
		c.recordErr(err)
		return nil, err
	}

	req.Header.Set("APCA-API-KEY-ID", c.keyID)
	req.Header.Set("APCA-API-SECRET-KEY", c.secretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.recordErr(err)
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		c.recordErr(err)
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		err := fmt.Errorf("alpaca API error [%d]: %s", resp.StatusCode, truncate(string(respBytes), 256))
		c.recordErr(err)
		return nil, err
	}

	c.recordOK()
	return respBytes, nil
}

// GetAccount fetches account balance, buying power, and leverage stats
func (c *AlpacaClient) GetAccount(ctx context.Context) (*AlpacaAccount, error) {
	raw, err := c.doRequest(ctx, http.MethodGet, "/account", nil)
	if err != nil {
		return nil, err
	}

	var acc AlpacaAccount
	if err := json.Unmarshal(raw, &acc); err != nil {
		return nil, err
	}
	return &acc, nil
}

// GetPositions retrieves current open positions
func (c *AlpacaClient) GetPositions(ctx context.Context) ([]AlpacaPosition, error) {
	raw, err := c.doRequest(ctx, http.MethodGet, "/positions", nil)
	if err != nil {
		return nil, err
	}

	var positions []AlpacaPosition
	if err := json.Unmarshal(raw, &positions); err != nil {
		return nil, err
	}
	return positions, nil
}

// CreateOrder submits a market or limit order (supporting buy/sell and margin leverage)
func (c *AlpacaClient) CreateOrder(ctx context.Context, req OrderRequest) (*AlpacaOrder, error) {
	if req.TimeInForce == "" {
		req.TimeInForce = "day"
	}
	if req.Type == "" {
		req.Type = "market"
	}

	raw, err := c.doRequest(ctx, http.MethodPost, "/orders", req)
	if err != nil {
		return nil, err
	}

	var order AlpacaOrder
	if err := json.Unmarshal(raw, &order); err != nil {
		return nil, err
	}
	return &order, nil
}

// ClosePosition closes an existing Long or Short position
func (c *AlpacaClient) ClosePosition(ctx context.Context, symbol string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/positions/%s", symbol), nil)
	return err
}

// truncate bounds upstream error bodies so a stray HTML error page cannot be
// echoed into a JSON response verbatim.
func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
