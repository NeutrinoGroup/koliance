package game

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// offlineService never reaches Steam: every request fails at the transport,
// which drives GetUserGameStats into its fallback branch deterministically.
func offlineService() *Service {
	c := NewSteamClient("")
	c.httpClient = &http.Client{Transport: failTransport{}}
	return NewService(c, nil)
}

type failTransport struct{}

func (failTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("offline")
}

func TestValidateSteamIdentifier(t *testing.T) {
	ok := []string{"76561198000000000", "gaben", "abc", "some_name-1"}
	bad := []string{"", "a", "ab", "ab1!", "123", "7656119800000000", "../etc", "name?x=1", "abc def"}
	for _, id := range ok {
		if err := ValidateSteamIdentifier(id); err != nil {
			t.Errorf("%q rejected: %v", id, err)
		}
	}
	for _, id := range bad {
		if ValidateSteamIdentifier(id) == nil {
			t.Errorf("%q accepted", id)
		}
	}
}

// Regression: GET /game/steam/profile?id=ab panicked with
// "slice bounds out of range [-2:]" in the fallback branch.
func TestGetUserGameStatsShortIDDoesNotPanic(t *testing.T) {
	s := offlineService()
	for _, id := range []string{"ab", "a", "1", "!!"} {
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("panic for %q: %v", id, r)
				}
			}()
			if _, err := s.GetUserGameStats(id); !errors.Is(err, ErrInvalidSteamID) {
				t.Errorf("%q: want ErrInvalidSteamID, got %v", id, err)
			}
		}()
	}
}

// A valid-but-short vanity name that Steam cannot resolve falls back to demo
// data; the fallback must not panic either.
func TestFallbackWithShortVanity(t *testing.T) {
	st, err := offlineService().GetUserGameStats("abc")
	if err != nil || st.PersonaName != "SteamOperative_abc" {
		t.Fatalf("got %+v, %v", st, err)
	}
}

func TestIDSuffix(t *testing.T) {
	for in, want := range map[string]string{"": "", "ab": "ab", "abcd": "abcd", "abcdef": "cdef"} {
		if got := idSuffix(in); got != want {
			t.Errorf("idSuffix(%q)=%q want %q", in, got, want)
		}
	}
}

func TestGenerateGameplayProofValidatesInput(t *testing.T) {
	s := offlineService()
	if _, err := s.GenerateGameplayProof("ab", "0x0000000000000000000000000000000000000001", 730); !errors.Is(err, ErrInvalidSteamID) {
		t.Errorf("bad steam id: %v", err)
	}
	if _, err := s.GenerateGameplayProof("76561198000000000", "nope", 730); !errors.Is(err, ErrInvalidWallet) {
		t.Errorf("bad wallet: %v", err)
	}
}

func TestVerifySteamOpenID_Success(t *testing.T) {
	expectedSteamID := "76561198034202275"

	// Mock Steam OpenID Provider server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("failed to parse form: %v", err)
		}
		if r.FormValue("openid.mode") != "check_authentication" {
			t.Errorf("expected mode check_authentication, got %s", r.FormValue("openid.mode"))
		}
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprintln(w, "ns:http://specs.openid.net/auth/2.0")
		_, _ = fmt.Fprintln(w, "is_valid:true")
	}))
	defer mockServer.Close()

	svc := NewService(nil, nil)
	svc.SetOpenIDEndpoint(mockServer.URL)
	svc.SetHTTPClient(mockServer.Client())

	params := map[string]string{
		"openid.ns":         "http://specs.openid.net/auth/2.0",
		"openid.mode":       "id_res",
		"openid.op_endpoint": "https://steamcommunity.com/openid/login",
		"openid.claimed_id": fmt.Sprintf("https://steamcommunity.com/openid/id/%s", expectedSteamID),
		"openid.identity":   fmt.Sprintf("https://steamcommunity.com/openid/id/%s", expectedSteamID),
		"openid.return_to":  "https://koliance.oodai.space/agentcard",
		"openid.sig":        "test_sig_12345",
		"openid.signed":     "signed,op_endpoint,claimed_id,identity,return_to",
	}

	result, err := svc.VerifySteamOpenID(params)
	if err != nil {
		t.Fatalf("expected successful verification, got error: %v", err)
	}
	if !result.Valid {
		t.Errorf("expected valid to be true")
	}
	if result.SteamID != expectedSteamID {
		t.Errorf("expected steamID %s, got %s", expectedSteamID, result.SteamID)
	}
}

func TestVerifySteamOpenID_NegativeCases(t *testing.T) {
	svc := NewService(nil, nil)

	// 1. Missing params
	if _, err := svc.VerifySteamOpenID(nil); err == nil {
		t.Error("expected error for nil params")
	}

	// 2. User cancelled
	if _, err := svc.VerifySteamOpenID(map[string]string{"openid.mode": "cancel"}); err == nil {
		t.Error("expected error for mode=cancel")
	}

	// 3. Invalid mode
	if _, err := svc.VerifySteamOpenID(map[string]string{"openid.mode": "checkid_setup"}); err == nil {
		t.Error("expected error for non-id_res mode")
	}

	// 4. Invalid openid namespace
	if _, err := svc.VerifySteamOpenID(map[string]string{
		"openid.mode": "id_res",
		"openid.ns":   "http://specs.openid.net/auth/1.0",
	}); err == nil {
		t.Error("expected error for unsupported openid.ns")
	}

	// 5. Missing claimed_id or identity
	if _, err := svc.VerifySteamOpenID(map[string]string{
		"openid.mode":       "id_res",
		"openid.ns":         "http://specs.openid.net/auth/2.0",
		"openid.claimed_id": "https://steamcommunity.com/openid/id/76561198034202275",
	}); err == nil {
		t.Error("expected error when identity is missing")
	}

	// 6. Mismatched claimed_id and identity (spoofing attempt)
	if _, err := svc.VerifySteamOpenID(map[string]string{
		"openid.mode":       "id_res",
		"openid.ns":         "http://specs.openid.net/auth/2.0",
		"openid.claimed_id": "https://steamcommunity.com/openid/id/76561198034202275",
		"openid.identity":   "https://steamcommunity.com/openid/id/76561198099999999",
	}); err == nil {
		t.Error("expected error when claimed_id != identity")
	}

	// 7. Malformed steam ID (not 17 digits)
	if _, err := svc.VerifySteamOpenID(map[string]string{
		"openid.mode":       "id_res",
		"openid.ns":         "http://specs.openid.net/auth/2.0",
		"openid.claimed_id": "https://steamcommunity.com/openid/id/not_a_valid_id",
		"openid.identity":   "https://steamcommunity.com/openid/id/not_a_valid_id",
	}); err == nil {
		t.Error("expected error for malformed steam ID")
	}

	// 8. Untrusted op_endpoint (SSRF attempt)
	if _, err := svc.VerifySteamOpenID(map[string]string{
		"openid.mode":       "id_res",
		"openid.ns":         "http://specs.openid.net/auth/2.0",
		"openid.claimed_id": "https://steamcommunity.com/openid/id/76561198034202275",
		"openid.identity":   "https://steamcommunity.com/openid/id/76561198034202275",
		"openid.op_endpoint": "https://attacker.com/evil/login",
	}); err == nil {
		t.Error("expected error for untrusted openid.op_endpoint")
	}

	// 9. Missing signatures
	if _, err := svc.VerifySteamOpenID(map[string]string{
		"openid.mode":       "id_res",
		"openid.ns":         "http://specs.openid.net/auth/2.0",
		"openid.claimed_id": "https://steamcommunity.com/openid/id/76561198034202275",
		"openid.identity":   "https://steamcommunity.com/openid/id/76561198034202275",
	}); err == nil {
		t.Error("expected error for missing signatures")
	}
}

func TestVerifySteamOpenID_RejectedByValveServer(t *testing.T) {
	// Mock Valve server rejecting the assertion (is_valid:false)
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprintln(w, "ns:http://specs.openid.net/auth/2.0")
		_, _ = fmt.Fprintln(w, "is_valid:false")
	}))
	defer mockServer.Close()

	svc := NewService(nil, nil)
	svc.SetOpenIDEndpoint(mockServer.URL)
	svc.SetHTTPClient(mockServer.Client())

	params := map[string]string{
		"openid.ns":         "http://specs.openid.net/auth/2.0",
		"openid.mode":       "id_res",
		"openid.claimed_id": "https://steamcommunity.com/openid/id/76561198034202275",
		"openid.identity":   "https://steamcommunity.com/openid/id/76561198034202275",
		"openid.sig":        "forged_sig",
		"openid.signed":     "signed,claimed_id,identity",
	}

	result, err := svc.VerifySteamOpenID(params)
	if err == nil {
		t.Error("expected error when Valve server returns is_valid:false")
	}
	if result != nil {
		t.Errorf("expected nil result on rejection, got %+v", result)
	}
}
