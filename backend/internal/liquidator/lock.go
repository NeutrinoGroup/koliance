package liquidator

// AcquireLock takes an exclusive advisory lock on path and returns a release
// function. When another process already holds the lock it returns an error
// immediately — never blocks — so the caller fails fast, which is ADR-005 §5.6's
// single-instance guarantee: two processes sharing the key would each seed a
// nonce.Manager from the same confirmed nonce and hand out colliding nonces.
//
// The lock is held for the process lifetime and is released by the OS even when
// the process dies without calling release (the file handle is closed), which
// is why this uses flock/LockFileEx rather than an O_EXCL marker file that a
// crash would leave behind and thereby wedge the supervisor's restart.
func AcquireLock(path string) (release func(), err error) {
	return acquireLock(path)
}
