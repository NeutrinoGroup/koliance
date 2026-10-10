//go:build windows

package liquidator

import (
	"fmt"
	"os"

	"golang.org/x/sys/windows"
)

// acquireLock holds an exclusive, non-blocking byte-range lock on path via
// LockFileEx. It fails immediately when another process holds the lock.
func acquireLock(path string) (func(), error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("liquidator: open lock %s: %w", path, err)
	}

	var ol windows.Overlapped
	h := windows.Handle(f.Fd())
	err = windows.LockFileEx(h, windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, &ol)
	if err != nil {
		f.Close()
		return nil, fmt.Errorf("liquidator: lock %s is held: %w", path, err)
	}

	return func() {
		var ol windows.Overlapped
		_ = windows.UnlockFileEx(windows.Handle(f.Fd()), 0, 1, 0, &ol)
		_ = f.Close()
	}, nil
}
