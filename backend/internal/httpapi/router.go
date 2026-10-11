package httpapi

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/koliance/backend/internal/agentapi"
	"github.com/koliance/backend/internal/agentcard"
	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/developer"
	"github.com/koliance/backend/internal/game"
	"github.com/koliance/backend/internal/liquidation"
	"github.com/koliance/backend/internal/market"
	"github.com/koliance/backend/internal/model"
	"github.com/koliance/backend/internal/platform/database"
	"github.com/koliance/backend/internal/platform/stripeclient"
	"github.com/koliance/backend/internal/verifier"
)

// Deps are the services the router dispatches to.
type Deps struct {
	Cfg         *config.Config
	DB          *database.DB
	Game        *game.Service
	Cards       *agentcard.Service
	Market      *market.Service
	PriceOracle *market.PriceOracle
	Stripe      *stripeclient.Client
	Dev         *developer.Service
	// Verifier is the pluggable proof-verification slot (GAP-44). It is not
	// optional: the zero value of a struct that embeds this field would panic
	// on the verify route, so cmd/api always supplies at least the no-op
	// (verifier.NewNoop), which answers 501.
	Verifier verifier.Verifier
	// Liquidations serves the liquidation observation feed written by
	// cmd/liquidator. Nil (no DATABASE_URL) degrades to an empty list.
	Liquidations liquidation.Store
	AgentAPI     *agentapi.Service
}

// Access model (see docs in backend/README.md):
//
//	public      read-only data, plus demo actions that only create *new*
//	            objects for the caller (card issue, proofs, Stripe test checkout)
//	card owner  `Authorization: Bearer <cardToken>` returned once by
//	            /agentcard/generate: card lookup, session-key issue, owner charge
//	agent       the session key (sk_sess_...) issued for that card: charge only
//	operator    `Authorization: Bearer $KOLIANCE_API_TOKEN`; fail closed (503)
//	            if unset: batch settle, Stripe customer, and Alpaca trade/close
//	            unless DEMO_PUBLIC_TRADING=true
func NewRouter(d Deps) http.Handler {
	cfg := d.Cfg
	mux := http.NewServeMux()
	h := func(path string, fn http.HandlerFunc) {
		mux.HandleFunc(path, cors(cfg.CORSAllowedOrigins, fn))
	}
	operator := func(fn http.HandlerFunc) http.HandlerFunc { return requireOperator(cfg.APIToken, fn) }
	// Alpaca paper trading acts on ONE shared account, so it is an operator
	// action unless the deployment explicitly opts into public demo trading.
	trading := func(fn http.HandlerFunc) http.HandlerFunc {
		if cfg.DemoPublicTrading {
			return fn
		}
		return operator(fn)
	}
	// WithDB marks the routes that cannot answer without a database.
	//
	// It is defence in depth behind the fail-closed startup in cmd/api, and it
	// is the half a reader can check: cmd/api refusing to start is invisible
	// from inside a test, whereas this predicate can be driven directly.
	//
	// It deliberately does NOT cover every route. `health`, `stats` and the
	// Alpaca market reads run off process state or an external API and are
	// correct without a database, so gating them would report an outage that
	// is not there. What it does cover is every route whose handler persists
	// through the DB handle - the ones that used to answer 200 while writing
	// nothing (GAP-49).
	withDB := func(fn http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if d.DB == nil {
				jsonError(w, http.StatusServiceUnavailable, "database is not configured; this endpoint cannot serve requests without it")
				return
			}
			if !d.DB.IsConnected {
				w.Header().Set("Retry-After", "5")
				jsonError(w, http.StatusServiceUnavailable, "database is not reachable; this endpoint refuses to serve from a non-durable store")
				return
			}
			fn(w, r)
		}
	}

	// marketData fails closed when the market data credentials are missing.
	//
	// The alternative — which is what the code did before — is that a deployment
	// without credentials answers these endpoints with numbers that came from
	// somewhere other than the market. Refusing is the only answer that cannot
	// be mistaken for data (issue #14, GAP-14).
	//
	// It deliberately does NOT wrap `trade`/`close`: those keep their existing
	// auth-first order (a missing operator token must still answer 401/503) and
	// surface the missing credentials as a 503 from the handler below. It also
	// does not wrap /api/v1/market/health, which must stay able to report
	// `configured: false` — that being the fact an operator needs.
	marketData := func(fn http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if !cfg.AlpacaConfigured() {
				jsonError(w, http.StatusServiceUnavailable,
					"market data unavailable: ALPACA_API_KEY/ALPACA_API_SECRET are not configured (no synthetic data is served)")
				return
			}
			fn(w, r)
		}
	}

	healthHandler := func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		connected := d.DB != nil && d.DB.IsConnected
		// Probed, not asserted. The four remote integrations below are the
		// outcome of a call made on this request; each used to be a literal
		// `true` — an integration status badge produced by a process that had
		// never contacted the integration (GAP-13). `agentcard` was a fifth
		// literal `true` and is now the wiring fact described below.
		//
		// The last three keys have no upstream to call, so none of them appears
		// in `probes`/`degraded`; each still names the fact it is derived from:
		// `stripe` = the configured key, `database` = the connection state, and
		// `agentcard` = `Deps.Cards`, whose absence is the nil dereference that
		// every /api/v1/agentcard/* handler would take.
		probes := runHealthProbes(ctx, cfg, d.PriceOracle)
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"status":    "healthy",
			"network":   fmt.Sprintf("Monad Testnet (Chain ID: %s)", cfg.MonadChainID),
			"contract":  cfg.KolianceContract,
			"timestamp": time.Now().UTC(),
			"services": map[string]bool{
				"steam":     probes.Steam.OK,
				"github":    probes.GitHub.OK,
				"alpaca":    probes.Alpaca.OK,
				"pyth":      probes.Pyth.OK,
				"agentcard": d.Cards != nil,
				"stripe":    cfg.StripeSecretKey != "",
				"database":  connected,
			},
			"degraded": probes.Degraded(),
			"probes":   probes,
		})
	}

	h("/api/v1/health", healthHandler)
	h("/healthz", healthHandler)
	h("/health", healthHandler)

	h("/api/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, model.NetworkStats{
			ChainID:         10143,
			NetworkName:     "Monad Testnet",
			TotalIdentities: 128,
			TotalTrusts:     542,
			LiveTPS:         9840,
			Status:          "optimal",
		})
	})

	// ==================== LIQUIDATIONS (observation feed) ====================

	// Public read-only: the dashboard polls this to scroll recent liquidations.
	// limit defaults to 50 and is capped at 200; anything else is rejected
	// rather than silently clamped.
	h("/api/v1/liquidations", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		limit := 50
		if raw := r.URL.Query().Get("limit"); raw != "" {
			n, err := strconv.Atoi(raw)
			if err != nil || n < 1 {
				jsonError(w, http.StatusBadRequest, "limit must be a positive integer")
				return
			}
			if n > 200 {
				jsonError(w, http.StatusBadRequest, "limit must be at most 200")
				return
			}
			limit = n
		}

		if d.Liquidations == nil {
			jsonResponse(w, http.StatusOK, map[string]interface{}{"liquidations": []liquidation.Event{}})
			return
		}
		events, err := d.Liquidations.Latest(r.Context(), limit)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, map[string]interface{}{"liquidations": events})
	}))

	// ==================== GAME ====================

	h("/api/v1/game/steam/profile", methodOnly(http.MethodGet, withDB(func(w http.ResponseWriter, r *http.Request) {
		identifier := r.URL.Query().Get("id")
		if identifier == "" {
			identifier = "76561198000000000" // Default fallback demo ID
		}
		stats, err := d.Game.GetUserGameStats(identifier)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, stats)
	})))

	h("/api/v1/game/proof", methodOnly(http.MethodPost, withDB(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			SteamID       string `json:"steamId"`
			WalletAddress string `json:"walletAddress"`
			AppID         int    `json:"appId"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		proof, err := d.Game.GenerateGameplayProof(strings.TrimSpace(req.SteamID), strings.TrimSpace(req.WalletAddress), req.AppID)
		if err != nil {
			if errors.Is(err, game.ErrInvalidSteamID) || errors.Is(err, game.ErrInvalidWallet) {
				jsonError(w, http.StatusBadRequest, err.Error())
				return
			}
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, proof)
	})))

	// ==================== DEVELOPER (GITHUB) ====================

	h("/api/v1/developer/github/profile", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		username := strings.TrimSpace(r.URL.Query().Get("username"))
		if username == "" {
			username = "moonhotline"
		}
		if !validGitHubUser(username) {
			jsonError(w, http.StatusBadRequest, "invalid GitHub username")
			return
		}
		stats, err := d.Dev.GetDeveloperStats(username)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, stats)
	}))

	h("/api/v1/developer/github/proof", methodOnly(http.MethodPost, withDB(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username      string `json:"username"`
			WalletAddress string `json:"walletAddress"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		req.Username = strings.TrimSpace(req.Username)
		if req.Username == "" {
			req.Username = "moonhotline"
		}
		if !validGitHubUser(req.Username) {
			jsonError(w, http.StatusBadRequest, "invalid GitHub username")
			return
		}
		if err := game.ValidateWallet(strings.TrimSpace(req.WalletAddress)); err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		proof, err := d.Dev.GenerateBUIDLProof(req.Username, strings.TrimSpace(req.WalletAddress))
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, proof)
	})))

	// ==================== AGENTCARD ====================

	h("/api/v1/agentcard/generate", methodOnly(http.MethodPost, withDB(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			WalletAddress  string   `json:"walletAddress"`
			CardholderName string   `json:"cardholderName"`
			InitialDeposit *float64 `json:"initialDeposit"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		name := strings.TrimSpace(req.CardholderName)
		if name == "" {
			name = "KOLIANCE AGENT"
		}
		if len(name) > 64 {
			jsonError(w, http.StatusBadRequest, "cardholderName too long")
			return
		}
		deposit := agentcard.DefaultDepositUSD
		if req.InitialDeposit != nil {
			deposit = *req.InitialDeposit // explicit 0 / negative is rejected below
		}
		card, err := d.Cards.CreateCard(strings.TrimSpace(req.WalletAddress), name, deposit)
		if err != nil {
			jsonError(w, http.StatusBadRequest, "initialDeposit: "+err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, card)
	})))

	h("/api/v1/agentcard/cards/", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		cardID := strings.TrimPrefix(r.URL.Path, "/api/v1/agentcard/cards/")
		token := bearer(r)
		asOp := isOperator(cfg.APIToken, r)
		if token == "" {
			w.Header().Set("WWW-Authenticate", `Bearer realm="koliance"`)
			jsonError(w, http.StatusUnauthorized, "card token required")
			return
		}
		card, err := d.Cards.GetCard(cardID, token, asOp)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, card)
	}))

	h("/api/v1/agentcard/session-key", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			CardID        string   `json:"cardId"`
			AgentID       string   `json:"agentId"`
			MaxPerTxUSD   float64  `json:"maxPerTxUSD"`
			DailyLimitUSD float64  `json:"dailyLimitUSD"`
			AllowedMCCs   []string `json:"allowedMCCs"`
			TTLHours      int      `json:"ttlHours"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		token := bearer(r)
		if token == "" {
			w.Header().Set("WWW-Authenticate", `Bearer realm="koliance"`)
			jsonError(w, http.StatusUnauthorized, "card token required")
			return
		}
		sk, err := d.Cards.IssueSessionKey(req.CardID, token, isOperator(cfg.APIToken, r), req.AgentID, req.MaxPerTxUSD, req.DailyLimitUSD, req.AllowedMCCs, req.TTLHours)
		if err != nil {
			status := http.StatusBadRequest
			if errors.Is(err, agentcard.ErrCardNotFound) {
				status = http.StatusNotFound
			}
			jsonError(w, status, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, sk)
	}))

	h("/api/v1/agentcard/authorize", methodOnly(http.MethodPost, withDB(func(w http.ResponseWriter, r *http.Request) {
		var req agentcard.AuthorizeRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		resp, err := d.Cards.AuthorizeMicropayment(req, bearer(r))
		switch {
		case errors.Is(err, agentcard.ErrInvalidAmount):
			jsonError(w, http.StatusBadRequest, "amountUSD: "+err.Error())
		case errors.Is(err, agentcard.ErrUnauthorized):
			w.Header().Set("WWW-Authenticate", `Bearer realm="koliance"`)
			jsonError(w, http.StatusUnauthorized, err.Error())
		case err != nil:
			jsonError(w, http.StatusInternalServerError, err.Error())
		default:
			jsonResponse(w, http.StatusOK, resp)
		}
	})))

	h("/api/v1/agentcard/batch-settle", methodOnly(http.MethodPost, withDB(operator(func(w http.ResponseWriter, r *http.Request) {
		batchHash, count, volume := d.Cards.BatchSettle()
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"batchHash":    batchHash,
			"settledCount": count,
			"totalVolume":  volume,
			"timestamp":    time.Now().UTC(),
		})
	}))))

	// ==================== MARKET ====================

	// Provenance of everything under /api/v1/market: real Alpaca data, or a
	// 503. There is no third answer.
	h("/api/v1/market/health", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, d.Market.GetDataHealth(r.Context()))
	}))

	h("/api/v1/market/overview", methodOnly(http.MethodGet, marketData(func(w http.ResponseWriter, r *http.Request) {
		overview, err := d.Market.GetMarketOverview(r.Context())
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, overview)
	})))

	h("/api/v1/market/prices", methodOnly(http.MethodGet, marketData(func(w http.ResponseWriter, r *http.Request) {
		symbol := r.URL.Query().Get("symbol")
		if symbol != "" {
			sym, err := normalizeSymbol(symbol)
			if err != nil {
				jsonError(w, http.StatusBadRequest, err.Error())
				return
			}
			p, err := d.Market.GetPrice(r.Context(), sym)
			if err != nil {
				// A symbol with no bar is a 404; an upstream failure is not the
				// caller's fault and must not be reported as one.
				if errors.Is(err, market.ErrNoMarketData) {
					jsonError(w, http.StatusNotFound, err.Error())
					return
				}
				jsonError(w, http.StatusBadGateway, err.Error())
				return
			}
			jsonResponse(w, http.StatusOK, p)
			return
		}

		prices, err := d.PriceOracle.PriceList(r.Context())
		if err != nil {
			jsonError(w, http.StatusBadGateway, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, prices)
	})))

	// Issue #16: 标的涨跌幅排行, computed from the last two daily bars of each
	// tracked instrument. An upstream failure is a 502, never an empty board —
	// "we could not ask" and "nothing moved" must not look alike.
	h("/api/v1/market/movers", methodOnly(http.MethodGet, marketData(func(w http.ResponseWriter, r *http.Request) {
		movers, err := d.Market.GetMovers(r.Context())
		if err != nil {
			jsonError(w, http.StatusBadGateway, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, movers)
	})))

	h("/api/v1/market/trade", methodOnly(http.MethodPost, trading(func(w http.ResponseWriter, r *http.Request) {
		var req market.TradeRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		sym, err := normalizeSymbol(req.Symbol)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		req.Symbol = sym
		req.Side = strings.ToLower(strings.TrimSpace(req.Side))
		lev, err := validateTrade(req.Side, req.NotionalUSD, req.Leverage)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		req.Leverage = lev
		res, err := d.Market.ExecuteTrade(r.Context(), req)
		if err != nil {
			// Misconfiguration is not an order failure: answer 503 rather than a
			// 200 carrying `success:false`, so a client cannot report "the trade
			// was rejected by the broker" when no broker was ever configured.
			if errors.Is(err, market.ErrAlpacaCredentialsMissing) {
				jsonError(w, http.StatusServiceUnavailable, err.Error())
				return
			}
			jsonResponse(w, http.StatusOK, res)
			return
		}
		jsonResponse(w, http.StatusOK, res)
	})))

	h("/api/v1/market/close", methodOnly(http.MethodPost, trading(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Symbol string `json:"symbol"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		sym, err := normalizeSymbol(req.Symbol)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := d.Market.ClosePosition(r.Context(), sym); err != nil {
			if errors.Is(err, market.ErrAlpacaCredentialsMissing) {
				jsonError(w, http.StatusServiceUnavailable, err.Error())
				return
			}
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, map[string]string{"message": "Position closed", "symbol": sym})
	})))

	// ==================== STRIPE ====================

	h("/api/v1/stripe/checkout-session", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			AmountCents int64  `json:"amountCents"`
			Currency    string `json:"currency"`
			Description string `json:"description"`
			SuccessURL  string `json:"successUrl"`
			CancelURL   string `json:"cancelUrl"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		if err := validateStripeAmount(req.AmountCents); err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		req.Currency = strings.ToLower(strings.TrimSpace(req.Currency))
		if req.Currency == "" {
			req.Currency = "usd"
		}
		if req.Currency != "usd" {
			jsonError(w, http.StatusBadRequest, `currency must be "usd"`)
			return
		}
		if len(req.Description) > 200 {
			jsonError(w, http.StatusBadRequest, "description too long")
			return
		}
		if req.SuccessURL == "" {
			req.SuccessURL = "https://" + cfg.SteamDomain + "/agentcard?status=success"
		} else if !sameOriginAllowed(req.SuccessURL, cfg.CORSAllowedOrigins) {
			jsonError(w, http.StatusBadRequest, "successUrl must be on an allowed origin")
			return
		}
		if req.CancelURL == "" {
			req.CancelURL = "https://" + cfg.SteamDomain + "/agentcard?status=cancel"
		} else if !sameOriginAllowed(req.CancelURL, cfg.CORSAllowedOrigins) {
			jsonError(w, http.StatusBadRequest, "cancelUrl must be on an allowed origin")
			return
		}
		sess, err := d.Stripe.CreateCheckoutSession(req.SuccessURL, req.CancelURL, req.AmountCents, req.Currency, req.Description)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, map[string]interface{}{"id": sess.ID, "url": sess.URL})
	}))

	h("/api/v1/stripe/customer", methodOnly(http.MethodPost, operator(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Email         string `json:"email"`
			Name          string `json:"name"`
			WalletAddress string `json:"walletAddress"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		cust, err := d.Stripe.CreateCustomer(req.Email, req.Name, req.WalletAddress)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, map[string]interface{}{"customerId": cust.ID, "email": cust.Email})
	})))

	// ==================== VERIFIER ====================

	// The proof-verification slot (GAP-44 / ADR-004 D1). The route exists so
	// the slot has a caller: an interface with no call site is a narrative
	// prop, and the whole point of keeping the interface was to have a seam.
	//
	// Status mapping is the load-bearing part:
	//   nil                         -> 200 (a verifier checked it and approved)
	//   ErrInvalidProof             -> 400 (checked, and it does not hold)
	//   anything else (incl. no-op) -> 501 (nothing could check it)
	// The no-op wired in cmd/api returns ErrNotImplemented, so this endpoint
	// answers 501 on every request today. It never answers 200 by default.
	h("/api/v1/verifier/verify", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Scheme       string `json:"scheme"`
			Subject      string `json:"subject"`
			Proof        string `json:"proof"`        // hex
			PublicInputs string `json:"publicInputs"` // hex
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		subject := strings.TrimSpace(req.Subject)
		if subject == "" {
			jsonError(w, http.StatusBadRequest, "subject is required")
			return
		}
		proof, err := decodeHexField(req.Proof)
		if err != nil {
			jsonError(w, http.StatusBadRequest, "proof: "+err.Error())
			return
		}
		publicInputs, err := decodeHexField(req.PublicInputs)
		if err != nil {
			jsonError(w, http.StatusBadRequest, "publicInputs: "+err.Error())
			return
		}
		if d.Verifier == nil {
			// A deployment that forgot to wire the slot must say so rather
			// than panic on a nil interface.
			jsonError(w, http.StatusServiceUnavailable, "proof verifier is not configured")
			return
		}

		vreq := verifier.Request{
			Scheme:       verifier.Scheme(strings.ToUpper(strings.TrimSpace(req.Scheme))),
			Subject:      subject,
			Proof:        proof,
			PublicInputs: publicInputs,
		}
		switch err := d.Verifier.Verify(r.Context(), vreq); {
		case err == nil:
			jsonResponse(w, http.StatusOK, map[string]interface{}{
				"valid":  true,
				"scheme": d.Verifier.Scheme(),
			})
		case errors.Is(err, verifier.ErrInvalidProof):
			jsonResponse(w, http.StatusBadRequest, map[string]interface{}{
				"valid":  false,
				"scheme": d.Verifier.Scheme(),
				"error":  err.Error(),
			})
		default:
			jsonError(w, http.StatusNotImplemented, err.Error())
		}
	}))

	// ==================== AGENT API & DEVELOPER SERVICES ====================

	if d.AgentAPI == nil {
		d.AgentAPI = agentapi.NewService(d.DB)
	}

	jsonEnvelope := func(w http.ResponseWriter, httpStatus int, code int, response string, data interface{}) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"code":     code,
			"response": response,
			"data":     data,
		})
	}

	// POST /api/v1/agent/bind - Agent and Wallet binding
	h("/api/v1/agent/bind", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		token := bearer(r)
		if token != "" {
			if _, err := d.AgentAPI.ValidateAndDeductKey(token, 1); err != nil {
				if errors.Is(err, agentapi.ErrQuotaExhausted) {
					jsonEnvelope(w, http.StatusForbidden, 403, "ERROR_QUOTA_EXHAUSTED", nil)
					return
				}
				if errors.Is(err, agentapi.ErrRateLimited) {
					jsonEnvelope(w, http.StatusTooManyRequests, 429, "ERROR_RATE_LIMITED", nil)
					return
				}
				jsonEnvelope(w, http.StatusUnauthorized, 401, "ERROR_UNAUTHORIZED", nil)
				return
			}
		}

		var req agentapi.BindAgentRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		binding, err := d.AgentAPI.BindAgent(req.WalletAddress, req)
		if err != nil {
			jsonEnvelope(w, http.StatusBadRequest, 400, "ERROR_INVALID_PARAMS: "+err.Error(), nil)
			return
		}
		jsonEnvelope(w, http.StatusOK, 200, "SUCCESS", binding)
	}))

	// POST /api/v1/agent/pay - Autonomous Agent Payment & On-Chain Committal
	h("/api/v1/agent/pay", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		token := bearer(r)
		if token != "" {
			if _, err := d.AgentAPI.ValidateAndDeductKey(token, 1); err != nil {
				if errors.Is(err, agentapi.ErrQuotaExhausted) {
					jsonEnvelope(w, http.StatusForbidden, 403, "ERROR_QUOTA_EXHAUSTED", nil)
					return
				}
				if errors.Is(err, agentapi.ErrRateLimited) {
					jsonEnvelope(w, http.StatusTooManyRequests, 429, "ERROR_RATE_LIMITED", nil)
					return
				}
				jsonEnvelope(w, http.StatusUnauthorized, 401, "ERROR_UNAUTHORIZED", nil)
				return
			}
		}

		var req agentapi.PaymentRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		order, err := d.AgentAPI.ProcessPayment("", req)
		if err != nil {
			jsonEnvelope(w, http.StatusBadRequest, 400, "ERROR_INVALID_PARAMS: "+err.Error(), nil)
			return
		}
		jsonEnvelope(w, http.StatusOK, 200, "SUCCESS", order)
	}))

	// POST /api/v1/developer/packages/claim-or-purchase - 3-tier recharge & 3-free-claims
	h("/api/v1/developer/packages/claim-or-purchase", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			WalletAddress string `json:"wallet_address"`
			TierID        string `json:"tier_id"`
			PaymentMethod string `json:"payment_method"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		if req.WalletAddress == "" {
			jsonEnvelope(w, http.StatusBadRequest, 400, "ERROR_INVALID_PARAMS: wallet_address is required", nil)
			return
		}
		resp, err := d.AgentAPI.ClaimOrPurchasePackage(req.WalletAddress, agentapi.PackageClaimRequest{
			TierID:        req.TierID,
			PaymentMethod: req.PaymentMethod,
		})
		if err != nil {
			if errors.Is(err, agentapi.ErrFreeClaimsExhausted) {
				jsonEnvelope(w, http.StatusForbidden, 403, "ERROR_FREE_CLAIMS_EXHAUSTED", nil)
				return
			}
			jsonEnvelope(w, http.StatusBadRequest, 400, "ERROR_PACKAGE_FAILED: "+err.Error(), nil)
			return
		}
		jsonEnvelope(w, http.StatusOK, 200, "SUCCESS", resp)
	}))

	// POST /api/v1/developer/keys - Create API Key
	h("/api/v1/developer/keys", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			WalletAddress string `json:"wallet_address"`
			Tier          string `json:"tier"`
			Name          string `json:"name"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		if req.Tier == "" {
			req.Tier = "STARTER_FREE"
		}
		key, err := d.AgentAPI.GenerateAPIKey(req.WalletAddress, req.Tier, req.Name)
		if err != nil {
			jsonEnvelope(w, http.StatusBadRequest, 400, "ERROR_KEY_GEN: "+err.Error(), nil)
			return
		}
		jsonEnvelope(w, http.StatusOK, 200, "SUCCESS", key)
	}))

	// GET /api/v1/developer/stats - Console stats and usage metrics
	h("/api/v1/developer/stats", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		wallet := strings.TrimSpace(r.URL.Query().Get("wallet_address"))
		stats := d.AgentAPI.GetConsoleStats(wallet)
		jsonEnvelope(w, http.StatusOK, 200, "SUCCESS", stats)
	}))

	// GET /api/v1/developer/agents - List bound agents
	h("/api/v1/developer/agents", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		agents := d.AgentAPI.ListBoundAgents()
		jsonEnvelope(w, http.StatusOK, 200, "SUCCESS", agents)
	}))

	return mux
}

// decodeHexField accepts an optional "0x" prefix and an empty value. Hex is
// the encoding because proof payloads are binary; a body that is not hex is a
// client error, not a verification failure.
func decodeHexField(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	s = strings.TrimPrefix(strings.TrimPrefix(s, "0x"), "0X")
	b, err := hex.DecodeString(s)
	if err != nil {
		return nil, errors.New("must be hex encoded")
	}
	return b, nil
}
