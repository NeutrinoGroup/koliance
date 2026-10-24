package oracle

import (
	"context"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHermesUpdateData(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("ids[]"); got != hermesFeed {
			t.Errorf("ids[] = %q, want %q", got, hermesFeed)
		}
		if got := r.URL.Query().Get("encoding"); got != "hex" {
			t.Errorf("encoding = %q, want %q", got, "hex")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"binary":{"data":["0xdeadbeef"]},"parsed":[{"id":"` + hermesFeed + `","price":{"price":"8310629537408","conf":"1","expo":-8,"publish_time":1718671402}}]}`))
	}))
	defer srv.Close()

	f := NewHermesFeed(srv.URL, srv.Client())
	data, err := f.UpdateData(context.Background(), hermesFeed)
	if err != nil {
		t.Fatalf("UpdateData: %v", err)
	}
	if len(data) != 1 {
		t.Fatalf("len(data) = %d, want 1", len(data))
	}
	want, _ := hex.DecodeString("deadbeef")
	if string(data[0]) != string(want) {
		t.Errorf("data[0] = %x, want %x", data[0], want)
	}
}

func TestHermesUpdateDataErrors(t *testing.T) {
	for name, body := range map[string]string{
		"no binary":      `{"binary":{"data":[]},"parsed":[{"id":"` + hermesFeed + `","price":{"price":"1","expo":-8}}]}`,
		"bad hex":        `{"binary":{"data":["0xzzzz"]},"parsed":[{"id":"` + hermesFeed + `","price":{"price":"1","expo":-8}}]}`,
		"feed missing":   `{"binary":{"data":["0xdeadbeef"]},"parsed":[]}`,
		"no 0x prefix":   `{"binary":{"data":["deadbeef"]},"parsed":[{"id":"` + hermesFeed + `","price":{"price":"1","expo":-8}}]}`,
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(body))
		}))
		f := NewHermesFeed(srv.URL, srv.Client())
		data, err := f.UpdateData(context.Background(), hermesFeed)
		srv.Close()
		if name == "no 0x prefix" {
			if err != nil {
				t.Errorf("%s: UpdateData: %v", name, err)
			}
			if len(data) != 1 {
				t.Errorf("%s: len(data) = %d, want 1", name, len(data))
			}
			continue
		}
		if err == nil {
			t.Errorf("%s: UpdateData returned no error, data=%x", name, data)
		}
	}
}
