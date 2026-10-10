package liquidator

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// LoadWatermark reads the persisted lastProcessedBlock.
//
// A missing file is "no watermark" — reported as (0, nil), NOT an error —
// because that is the cold-start case the caller maps to its configured
// StartBlock. A file that exists but does not hold a plain decimal uint64
// fails loud: silently treating a corrupt watermark as zero would re-scan from
// the deployment block and mask the corruption (ADR-005 §5.3, D3: a corrupt
// watermark must not degrade to "everything is fine").
func LoadWatermark(path string) (uint64, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("liquidator: read watermark %s: %w", path, err)
	}
	s := strings.TrimSpace(string(b))
	if s == "" {
		return 0, fmt.Errorf("liquidator: watermark %s is empty", path)
	}
	n, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("liquidator: watermark %s is corrupt: %q: %w", path, s, err)
	}
	return n, nil
}

// SaveWatermark atomically persists the watermark via a temp-file + rename, so
// a crash mid-write cannot leave a truncated value behind. The parent directory
// is created when missing.
func SaveWatermark(path string, block uint64) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("liquidator: mkdir for watermark: %w", err)
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".tmp-*")
	if err != nil {
		return fmt.Errorf("liquidator: create watermark tmp: %w", err)
	}
	tmpName := tmp.Name()

	if _, err := tmp.WriteString(strconv.FormatUint(block, 10) + "\n"); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return fmt.Errorf("liquidator: write watermark: %w", err)
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return fmt.Errorf("liquidator: close watermark tmp: %w", err)
	}
	if err := os.Rename(tmpName, path); err != nil {
		os.Remove(tmpName)
		return fmt.Errorf("liquidator: rename watermark: %w", err)
	}
	return nil
}
