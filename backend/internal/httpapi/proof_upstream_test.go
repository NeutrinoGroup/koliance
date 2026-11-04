package httpapi

import (
	"errors"
	"github.com/koliance/backend/internal/developer"
	"github.com/koliance/backend/internal/game"
	"net/http"
	"strings"
	"testing"
)

type proofOfflineTransport struct{}

func (proofOfflineTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("private upstream failure")
}
func TestProofUpstreamFailureEnvelope(t *testing.T) {
	h := newTestRouter(t, func(d *Deps) {
		c := game.NewSteamClient("")
		c.SetHTTPClient(&http.Client{Transport: proofOfflineTransport{}})
		d.Game = game.NewService(c, nil)
		g := developer.NewGitHubClient("")
		g.SetHTTPClient(&http.Client{Transport: proofOfflineTransport{}})
		d.Dev = developer.NewService(g)
	})
	for _, tc := range []struct{ method, path, body string }{
		{"GET", "/api/v1/game/steam/profile?id=76561198000000000", ""},
		{"POST", "/api/v1/game/proof", `{"steamId":"76561198000000000","walletAddress":"0x0000000000000000000000000000000000000001","appId":730}`},
		{"GET", "/api/v1/developer/github/profile?username=alice", ""},
		{"POST", "/api/v1/developer/github/proof", `{"username":"alice","walletAddress":"0x0000000000000000000000000000000000000001"}`},
	} {
		rr := do(h, tc.method, tc.path, tc.body, nil)
		if rr.Code != 503 || !strings.Contains(rr.Body.String(), "UPSTREAM_UNAVAILABLE") || strings.Contains(rr.Body.String(), "private upstream") || strings.Contains(rr.Body.String(), "proofHash") {
			t.Fatalf("%s: %d %s", tc.path, rr.Code, rr.Body.String())
		}
	}
}
