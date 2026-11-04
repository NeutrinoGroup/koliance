package game

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type proofTransport struct {
	body   string
	status int
}

func (tr proofTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	return &http.Response{StatusCode: tr.status, Body: io.NopCloser(strings.NewReader(tr.body)), Header: make(http.Header)}, nil
}
func TestGameplayProofFailsClosed(t *testing.T) {
	for _, tr := range []proofTransport{
		{`{}`, 503}, {`invalid`, 200}, {`{"response":{"game_count":0,"games":[]}}`, 200},
	} {
		c := NewSteamClient("")
		c.SetHTTPClient(&http.Client{Transport: tr})
		proof, err := NewService(c, nil).GenerateGameplayProof("76561198000000000", "0x0000000000000000000000000000000000000001", 730)
		if err == nil || proof != nil {
			t.Fatalf("unverified proof: %+v %v", proof, err)
		}
	}
	c := NewSteamClient("")
	c.SetHTTPClient(&http.Client{Transport: proofTransport{`{"response":{"game_count":1,"games":[{"appid":730,"name":"Verified game","playtime_forever":60}]}}`, 200}})
	svc := NewService(c, nil)
	proof, err := svc.GenerateGameplayProof("76561198000000000", "0x0000000000000000000000000000000000000001", 730)
	if err != nil || proof == nil || proof.PlaytimeHours != 1 {
		t.Fatalf("verified game rejected: %+v %v", proof, err)
	}
	proof, err = svc.GenerateGameplayProof("76561198000000000", "0x0000000000000000000000000000000000000001", 570)
	if !errors.Is(err, ErrNoGameplay) || proof != nil {
		t.Fatalf("wrong game proof: %+v %v", proof, err)
	}
}

type routeTransport func(*http.Request) (*http.Response, error)

func (fn routeTransport) RoundTrip(r *http.Request) (*http.Response, error) { return fn(r) }
func TestAchievementsRequiredWhenAdvertised(t *testing.T) {
	c := NewSteamClient("")
	c.SetHTTPClient(&http.Client{Transport: routeTransport(func(r *http.Request) (*http.Response, error) {
		body := `{"response":{"game_count":1,"games":[{"appid":730,"playtime_forever":60,"has_community_visible_stats":true}]}}`
		if strings.Contains(r.URL.Path, "GetPlayerAchievements") {
			body = `{"playerstats":{"success":false}}`
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})})
	proof, err := NewService(c, nil).GenerateGameplayProof("76561198000000000", "0x0000000000000000000000000000000000000001", 730)
	if !errors.Is(err, ErrUpstreamUnavailable) || proof != nil {
		t.Fatalf("achievement failure produced proof: %+v %v", proof, err)
	}
}
func TestSteamSummaryRejectsWrongIdentity(t *testing.T) {
	c := NewSteamClient("")
	c.SetHTTPClient(&http.Client{Transport: proofTransport{`{"response":{"players":[{"steamid":"76561198000000001"}]}}`, 200}})
	if profile, err := c.GetPlayerSummary("76561198000000000"); err == nil || profile != nil {
		t.Fatalf("wrong identity accepted: %+v %v", profile, err)
	}
}
