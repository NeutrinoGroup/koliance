package liquidator

import (
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
)

// testPrivateKeyHex is a well-formed, non-zero test key (do not use for funds).
const testPrivateKeyHex = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

func envGet(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func validEnv() map[string]string {
	return map[string]string{
		"LIQUIDATOR_RPC":              "http://localhost:8545",
		"LIQUIDATOR_WS":               "ws://localhost:8546",
		"LIQUIDATOR_CHAIN_ID":         "10143",
		"LIQUIDATOR_POSITION_MANAGER": "0x1111111111111111111111111111111111111111",
		"LIQUIDATOR_DEMO_ORACLE":      "0x2222222222222222222222222222222222222222",
		"LIQUIDATOR_FEED":             "demo",
		"LIQUIDATOR_PRIVATE_KEY":      testPrivateKeyHex,
	}
}

func TestLoadConfigValid(t *testing.T) {
	cfg, err := LoadConfig(envGet(validEnv()))
	if err != nil {
		t.Fatalf("valid env rejected: %v", err)
	}
	if cfg.ChainID.Cmp(big.NewInt(10143)) != 0 {
		t.Errorf("ChainID = %s, want 10143", cfg.ChainID)
	}
	if cfg.TickInterval != time.Second {
		t.Errorf("TickInterval = %s, want 1s", cfg.TickInterval)
	}
	if cfg.MaxPositionsPerCall != 50 {
		t.Errorf("MaxPositionsPerCall = %d, want 50", cfg.MaxPositionsPerCall)
	}
	if cfg.Feed != "demo" {
		t.Errorf("Feed = %s, want demo", cfg.Feed)
	}
}

func TestLoadConfigMissingFieldFailsFast(t *testing.T) {
	cases := []struct {
		name    string
		drop    string
		wantErr string
	}{
		{"rpc", "LIQUIDATOR_RPC", "LIQUIDATOR_RPC"},
		{"ws", "LIQUIDATOR_WS", "LIQUIDATOR_WS"},
		{"chain id", "LIQUIDATOR_CHAIN_ID", "LIQUIDATOR_CHAIN_ID"},
		{"position manager", "LIQUIDATOR_POSITION_MANAGER", "LIQUIDATOR_POSITION_MANAGER"},
		{"private key", "LIQUIDATOR_PRIVATE_KEY", "LIQUIDATOR_PRIVATE_KEY"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			env := validEnv()
			delete(env, tc.drop)
			_, err := LoadConfig(envGet(env))
			if err == nil {
				t.Fatalf("missing %s did not fail", tc.drop)
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Errorf("error %q does not mention %q", err, tc.wantErr)
			}
		})
	}
}

func TestLoadConfigBadValues(t *testing.T) {
	cases := []struct {
		name string
		set  map[string]string
	}{
		{"negative chain id", map[string]string{"LIQUIDATOR_CHAIN_ID": "-1"}},
		{"non-numeric chain id", map[string]string{"LIQUIDATOR_CHAIN_ID": "abc"}},
		{"malformed address", map[string]string{"LIQUIDATOR_POSITION_MANAGER": "0x123"}},
		{"unknown feed", map[string]string{"LIQUIDATOR_FEED": "oracle"}},
		{"demo without oracle", map[string]string{"LIQUIDATOR_DEMO_ORACLE": ""}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			env := validEnv()
			for k, v := range tc.set {
				env[k] = v
			}
			if _, err := LoadConfig(envGet(env)); err == nil {
				t.Errorf("bad config %s did not fail", tc.name)
			}
		})
	}
}

func TestLoadPrivateKey(t *testing.T) {
	if _, err := loadPrivateKey(""); err == nil {
		t.Error("empty key did not fail")
	}
	if _, err := loadPrivateKey("0xzz"); err == nil {
		t.Error("malformed hex did not fail")
	}
	if _, err := loadPrivateKey("   "); err == nil {
		t.Error("whitespace-only key did not fail")
	}

	key, err := loadPrivateKey(testPrivateKeyHex)
	if err != nil {
		t.Fatalf("valid key rejected: %v", err)
	}
	if key == nil {
		t.Fatal("valid key returned nil")
	}
	addr := crypto.PubkeyToAddress(key.PublicKey)
	if addr.Hex() == "0x0000000000000000000000000000000000000000" {
		t.Error("key derived the zero address")
	}
}
