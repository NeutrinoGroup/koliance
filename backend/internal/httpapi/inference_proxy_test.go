package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/koliance/backend/internal/agentapi"
	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/platform/stripeclient"
	"github.com/koliance/backend/internal/trust"
)

func setupTestRouterWithDeps(t *testing.T) (http.Handler, *agentapi.Service, *trust.Engine, string, string) {
	t.Helper()
	cfg := &config.Config{
		APIToken: "op_secret_token",
	}
	agentSvc := agentapi.NewService(nil)
	trustEng := trust.NewEngine()
	stripeCli := stripeclient.New("")

	// Create test API key
	wallet := "0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2"
	createdKey, err := agentSvc.GenerateAPIKey(wallet, "STARTER_FREE", "Test Key")
	if err != nil {
		t.Fatalf("failed to create api key: %v", err)
	}

	handler := NewRouter(Deps{
		Cfg:         cfg,
		AgentAPI:    agentSvc,
		TrustEngine: trustEng,
		Stripe:      stripeCli,
	})

	return handler, agentSvc, trustEng, wallet, createdKey.RawKey
}

func TestTrustScoreEndpoints(t *testing.T) {
	handler, _, _, wallet, _ := setupTestRouterWithDeps(t)

	// 1. GET /api/v1/trust/score without wallet
	req := httptest.NewRequest(http.MethodGet, "/api/v1/trust/score", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing wallet, got %d", rr.Code)
	}

	// 2. GET /api/v1/trust/score with valid wallet
	req = httptest.NewRequest(http.MethodGet, "/api/v1/trust/score?wallet="+wallet, nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid wallet, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp struct {
		Code int              `json:"code"`
		Data trust.Evaluation `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal trust score response: %v", err)
	}
	if resp.Data.WalletAddress != wallet || resp.Data.TotalScore <= 0 {
		t.Fatalf("unexpected trust evaluation data: %+v", resp.Data)
	}

	// 3. POST /api/v1/trust/evaluate
	evalPayload, _ := json.Marshal(map[string]interface{}{
		"wallet": wallet,
		"metrics": map[string]interface{}{
			"success_rate": 0.98,
			"trade_count":  60,
			"asset_usd":    2500.0,
			"rating":       4.9,
		},
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/trust/evaluate", bytes.NewReader(evalPayload))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for trust evaluate, got %d: %s", rr.Code, rr.Body.String())
	}
	var evalResp struct {
		Code int              `json:"code"`
		Data trust.Evaluation `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &evalResp); err != nil {
		t.Fatalf("failed to unmarshal evaluate resp: %v", err)
	}
	if evalResp.Data.TotalScore < 90.0 || evalResp.Data.Tier != trust.TierPrime {
		t.Fatalf("expected PRIME tier for top metrics, got tier=%s score=%v", evalResp.Data.Tier, evalResp.Data.TotalScore)
	}
}

func TestDepositEndpoints(t *testing.T) {
	handler, _, _, wallet, _ := setupTestRouterWithDeps(t)

	// 1. POST /api/v1/deposit/checkout
	checkoutPayload, _ := json.Marshal(map[string]interface{}{
		"wallet_address": wallet,
		"amount_cny":     10.0,
		"currency":       "cny",
		"payment_method": "wechat_pay",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/deposit/checkout", bytes.NewReader(checkoutPayload))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for deposit checkout, got %d: %s", rr.Code, rr.Body.String())
	}

	// 2. POST /api/v1/deposit/webhook
	webhookPayload, _ := json.Marshal(map[string]interface{}{
		"type":           "checkout.session.completed",
		"wallet_address": wallet,
		"amount_cny":     10.0,
		"amount_usd":     1.4,
		"tx_id":          "tx_stripe_mock_123",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/deposit/webhook", bytes.NewReader(webhookPayload))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for deposit webhook, got %d: %s", rr.Code, rr.Body.String())
	}

	// 3. POST /api/v1/deposit/web3-verify
	web3Payload, _ := json.Marshal(map[string]interface{}{
		"wallet_address": wallet,
		"tx_hash":        "0x1111111111111111111111111111111111111111111111111111111111111111",
		"amount":         1.0,
		"currency":       "MON",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/deposit/web3-verify", bytes.NewReader(web3Payload))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for web3-verify, got %d: %s", rr.Code, rr.Body.String())
	}

	// 4. GET /api/v1/inference/vault
	req = httptest.NewRequest(http.MethodGet, "/api/v1/inference/vault?wallet="+wallet, nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for inference vault, got %d: %s", rr.Code, rr.Body.String())
	}
	var vaultResp struct {
		Code int                    `json:"code"`
		Data agentapi.InferenceVault `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &vaultResp); err != nil {
		t.Fatalf("failed to unmarshal vault resp: %v", err)
	}
	if vaultResp.Data.BalanceCNY < 20.0 {
		t.Fatalf("expected credited balance >= 20.0 CNY, got %v", vaultResp.Data.BalanceCNY)
	}
}

func TestCardBindAndSetupIntent(t *testing.T) {
	handler, _, _, wallet, _ := setupTestRouterWithDeps(t)

	// 1. POST /api/v1/card/setup-intent
	req := httptest.NewRequest(http.MethodPost, "/api/v1/card/setup-intent", bytes.NewReader([]byte(`{"customer_id":"cus_123"}`)))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for setup-intent, got %d: %s", rr.Code, rr.Body.String())
	}

	// 2. POST /api/v1/card/bind
	bindPayload, _ := json.Marshal(map[string]interface{}{
		"wallet_address":        wallet,
		"customer_id":           "cus_123",
		"payment_method_id":     "pm_card_visa4242",
		"card_last4":            "4242",
		"card_brand":            "visa",
		"auto_recharge_enabled": true,
		"daily_limit_usd":       50.0,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/card/bind", bytes.NewReader(bindPayload))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for card/bind, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestProxyChatCompletions(t *testing.T) {
	handler, agentSvc, _, wallet, rawKey := setupTestRouterWithDeps(t)

	// 1. Unauthorized when missing Bearer token
	chatPayload, _ := json.Marshal(map[string]interface{}{
		"model": "deepseek-chat",
		"messages": []map[string]string{
			{"role": "user", "content": "What is the optimal trading leverage?"},
		},
		"max_tokens": 100,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/proxy/chat/completions", bytes.NewReader(chatPayload))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing auth token, got %d", rr.Code)
	}

	// 2. Authorized call with valid API Key
	req = httptest.NewRequest(http.MethodPost, "/api/v1/proxy/chat/completions", bytes.NewReader(chatPayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+rawKey)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for authorized chat completions, got %d: %s", rr.Code, rr.Body.String())
	}

	var chatResp map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &chatResp); err != nil {
		t.Fatalf("failed to decode chat response: %v", err)
	}
	if chatResp["object"] != "chat.completion" {
		t.Fatalf("expected chat.completion object, got %v", chatResp["object"])
	}

	// Verify metering log was recorded
	logs := agentSvc.GetInferenceLogs(wallet, 10)
	if len(logs) == 0 {
		t.Fatalf("expected metering log to be recorded")
	}
	if logs[0].CostCNY != 0.10 {
		t.Fatalf("expected 0.10 CNY deducted, got %v", logs[0].CostCNY)
	}

	// 3. Test 402 Payment Required when balance is 0 and auto-recharge is disabled
	v := agentSvc.GetOrCreateVault(wallet)
	v.BalanceCNY = 0.01 // below 0.10 CNY
	v.BalanceUSD = 0.001
	v.AutoRechargeEnabled = false

	req = httptest.NewRequest(http.MethodPost, "/api/v1/proxy/chat/completions", bytes.NewReader(chatPayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+rawKey)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusPaymentRequired {
		t.Fatalf("expected 402 Payment Required when balance exhausted, got %d: %s", rr.Code, rr.Body.String())
	}
}
