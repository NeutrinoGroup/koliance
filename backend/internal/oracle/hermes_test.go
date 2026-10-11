package oracle

import (
	"context"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNormalizeHermesPrice(t *testing.T) {
	cases := []struct {
		name  string
		price int64
		expo  int32
		want  string
		err   bool
	}{
		// BTC at 8310629537408 with expo -8 is $83106.29537408.
		{"btc expo -8", 8310629537408, -8, "83106295374080000000000", false},
		// Equity feed at 178123456 with expo -5 is $1781.23456.
		{"equity expo -5", 178123456, -5, "1781234560000000000000", false},
		// A feed already in 18 decimals stays put.
		{"already 18-dec", 1, -18, "1", false},
		// expo 0 scales up by the full 18.
		{"expo 0", 1, 0, "1000000000000000000", false},
		// Negative shift divides (and truncates): 12345 * 10^-20 -> 123.45 -> 123.
		{"negative shift truncates", 12345, -20, "123", false},
		{"zero price", 0, -8, "", true},
		{"negative price", -5, -8, "", true},
		{"expo too high", 1, 100, "", true},
		{"expo too low", 1, -100, "", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := NormalizeHermesPrice(c.price, c.expo)
			if c.err {
				if err == nil {
					t.Fatalf("NormalizeHermesPrice(%d, %d) = %v, want error", c.price, c.expo, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("NormalizeHermesPrice(%d, %d): %v", c.price, c.expo, err)
			}
			want, _ := new(big.Int).SetString(c.want, 10)
			if got.Cmp(want) != 0 {
				t.Errorf("got %s, want %s", got, want)
			}
		})
	}
}

const hermesFeed = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"

func TestHermesPrice(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("ids[]"); got != hermesFeed {
			t.Errorf("ids[] = %q, want %q", got, hermesFeed)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"parsed":[{"id":"` + hermesFeed + `","price":{"price":"8310629537408","conf":"1","expo":-8,"publish_time":1718671402}}]}`))
	}))
	defer srv.Close()

	f := NewHermesFeed(srv.URL, srv.Client())
	got, ok := f.Price(context.Background(), hermesFeed)
	if !ok {
		t.Fatal("Price ok=false")
	}
	want, _ := new(big.Int).SetString("83106295374080000000000", 10)
	if got.Cmp(want) != 0 {
		t.Errorf("got %s, want %s", got, want)
	}
}

func TestHermesPriceErrors(t *testing.T) {
	for name, handler := range map[string]http.HandlerFunc{
		"feed missing": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"parsed":[]}`))
		},
		"http error": func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "boom", http.StatusBadGateway)
		},
		"bad json": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{`))
		},
		"non-positive price": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"parsed":[{"id":"0xfeed","price":{"price":"0","expo":-8}}]}`))
		},
	} {
		srv := httptest.NewServer(handler)
		f := NewHermesFeed(srv.URL, srv.Client())
		if _, ok := f.Price(context.Background(), "0xfeed"); ok {
			t.Errorf("%s: Price returned ok=true", name)
		}
		srv.Close()
	}
}
