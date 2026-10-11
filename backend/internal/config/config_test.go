package config

import (
	"strings"
	"testing"
)

func TestParseOrigins(t *testing.T) {
	got := ParseOrigins(" https://a.example/ ,*, http://localhost:3000,,")
	want := []string{"https://a.example", "http://localhost:3000"}
	if len(got) != len(want) {
		t.Fatalf("got %v want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v want %v", got, want)
		}
	}
}

func TestLoadDefaultsFailClosed(t *testing.T) {
	t.Setenv("KOLIANCE_API_TOKEN", "")
	t.Setenv("DEMO_PUBLIC_TRADING", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	c := Load()
	if c.APIToken != "" || c.DemoPublicTrading {
		t.Fatalf("defaults not fail-closed: token=%q public=%v", c.APIToken, c.DemoPublicTrading)
	}
	want := []string{"https://koliance.oodai.space", "http://localhost:3000", "http://127.0.0.1:3000"}
	if len(c.CORSAllowedOrigins) != len(want) {
		t.Fatalf("default origins %v", c.CORSAllowedOrigins)
	}
	for i := range want {
		if c.CORSAllowedOrigins[i] != want[i] {
			t.Fatalf("default origins %v", c.CORSAllowedOrigins)
		}
	}
}

// emptyReader stands in for an environment with nothing set, without going near
// the process environment or a developer's .env file.
func emptyReader(key, defaultVal string) string { return defaultVal }

func TestAlpacaCredentialsHaveNoCommittedDefault(t *testing.T) {
	c := loadFrom(emptyReader)

	if c.AlpacaAPIKey != "" || c.AlpacaAPISecret != "" {
		t.Fatalf("credentials fell back to a committed value: key=%q secret=%q", c.AlpacaAPIKey, c.AlpacaAPISecret)
	}
	if c.AlpacaConfigured() {
		t.Error("AlpacaConfigured() = true with no credentials set")
	}
}

func TestAlpacaConfiguredRequiresBothHalves(t *testing.T) {
	key := emptyReader
	key = func(k, d string) string {
		if k == "ALPACA_API_KEY" {
			return "  key-id  " // whitespace is trimmed, so this is a real value
		}
		return d
	}
	if loadFrom(key).AlpacaConfigured() {
		t.Error("AlpacaConfigured() = true with only ALPACA_API_KEY set")
	}

	secret := func(k, d string) string {
		if k == "ALPACA_API_SECRET" {
			return "secret"
		}
		return d
	}
	if loadFrom(secret).AlpacaConfigured() {
		t.Error("AlpacaConfigured() = true with only ALPACA_API_SECRET set")
	}
}

func TestAlpacaDataURLDefaultsToTheMarketDataHost(t *testing.T) {
	c := loadFrom(emptyReader)

	// The trading host and the data host are different services; a config that
	// pointed both at the same place would be a silent 404 on every quote.
	if c.AlpacaDataURL != "https://data.alpaca.markets" {
		t.Errorf("AlpacaDataURL = %q", c.AlpacaDataURL)
	}
	if c.AlpacaBaseURL != "https://paper-api.alpaca.markets/v2" {
		t.Errorf("AlpacaBaseURL = %q", c.AlpacaBaseURL)
	}
	if strings.Contains(c.AlpacaDataURL, "paper-api") {
		t.Error("the market data endpoint is pointed at the trading host")
	}
	if c.AlpacaDataFeed != "iex" {
		// `sip` requires a paid subscription; defaulting to it means every
		// request 403s on the tier this deployment uses.
		t.Errorf("AlpacaDataFeed = %q, want iex", c.AlpacaDataFeed)
	}
}

func TestAlpacaDataURLIsOverridable(t *testing.T) {
	read := func(k, d string) string {
		if k == "ALPACA_DATA_URL" {
			return "https://data.example.test/"
		}
		return d
	}
	if got := loadFrom(read).AlpacaDataURL; got != "https://data.example.test/" {
		t.Errorf("AlpacaDataURL = %q, want the override", got)
	}
}
