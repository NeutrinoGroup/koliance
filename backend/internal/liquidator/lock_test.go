package liquidator

import (
	"path/filepath"
	"testing"
)

func TestAcquireLockExclusiveAndReusable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "liquidator.lock")

	release, err := AcquireLock(path)
	if err != nil {
		t.Fatalf("first acquire: %v", err)
	}

	// A second acquire of the same path must fail immediately (single-instance).
	if _, err := AcquireLock(path); err == nil {
		t.Error("second acquire of a held lock did not fail")
	}

	// Releasing lets the lock be reacquired (supervisor restart path).
	release()
	release2, err := AcquireLock(path)
	if err != nil {
		t.Fatalf("reacquire after release: %v", err)
	}
	release2()
}
