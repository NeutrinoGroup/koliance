package liquidator

import (
	"context"
	"testing"
	"time"
)

func TestNextBackoff(t *testing.T) {
	base := time.Second
	max := 8 * time.Second

	got := []time.Duration{base}
	for i := 0; i < 5; i++ {
		got = append(got, nextBackoff(got[len(got)-1], max))
	}
	want := []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 8 * time.Second, 8 * time.Second}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("backoff[%d] = %s, want %s (full: %v)", i, got[i], want[i], got)
		}
	}
}

func TestNextBackoffZeroNormalized(t *testing.T) {
	if got := nextBackoff(0, 10*time.Second); got != time.Second {
		t.Errorf("nextBackoff(0) = %s, want 1s", got)
	}
}

func TestSleepCtx(t *testing.T) {
	// Cancelled before the sleep returns false immediately.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if sleepCtx(ctx, time.Hour) {
		t.Error("sleepCtx on a cancelled ctx returned true")
	}

	// A short sleep completes normally.
	if !sleepCtx(context.Background(), time.Millisecond) {
		t.Error("sleepCtx on a live ctx returned false")
	}
}
