package developer

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

type responseTransport struct {
	profile, repos string
	status         int
}

func (tr responseTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	body := tr.profile
	if strings.Contains(r.URL.Path, "/repos") {
		body = tr.repos
	}
	return &http.Response{StatusCode: tr.status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
}
func TestProofRequiresUpstreamData(t *testing.T) {
	for _, tr := range []responseTransport{
		{`{}`, `[]`, 503}, {`{}`, `[]`, 200},
		{`{"login":"alice","id":1}`, `null`, 200},
		{`{"login":"alice","id":1}`, `invalid`, 200},
	} {
		c := NewGitHubClient("")
		c.SetHTTPClient(&http.Client{Transport: tr})
		proof, err := NewService(c).GenerateBUIDLProof("alice", "0x0000000000000000000000000000000000000001")
		if err == nil || proof != nil {
			t.Fatalf("unverified proof: %+v, %v", proof, err)
		}
	}
	c := NewGitHubClient("")
	c.SetHTTPClient(&http.Client{Transport: responseTransport{`{"login":"alice","id":1}`, `[]`, 200}})
	proof, err := NewService(c).GenerateBUIDLProof("alice", "0x0000000000000000000000000000000000000001")
	if err != nil || proof == nil || proof.Username != "alice" {
		t.Fatalf("valid source rejected: %+v %v", proof, err)
	}
}
