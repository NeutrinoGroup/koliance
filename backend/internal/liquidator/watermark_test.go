package liquidator

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWatermarkRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "watermark")
	if err := SaveWatermark(path, 12345); err != nil {
		t.Fatalf("save: %v", err)
	}
	got, err := LoadWatermark(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if got != 12345 {
		t.Errorf("watermark = %d, want 12345", got)
	}

	// Overwrite (breakpoint resume advances it).
	if err := SaveWatermark(path, 999); err != nil {
		t.Fatalf("save overwrite: %v", err)
	}
	if got, _ = LoadWatermark(path); got != 999 {
		t.Errorf("overwritten watermark = %d, want 999", got)
	}
}

func TestLoadWatermarkMissingIsColdStart(t *testing.T) {
	got, err := LoadWatermark(filepath.Join(t.TempDir(), "nope"))
	if err != nil {
		t.Fatalf("missing file should be (0, nil), got err %v", err)
	}
	if got != 0 {
		t.Errorf("missing file watermark = %d, want 0", got)
	}
}

func TestLoadWatermarkCorruptFailsLoud(t *testing.T) {
	dir := t.TempDir()
	corrupt := filepath.Join(dir, "corrupt")
	if err := os.WriteFile(corrupt, []byte("not-a-number"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadWatermark(corrupt); err == nil {
		t.Error("corrupt watermark did not fail")
	}

	empty := filepath.Join(dir, "empty")
	if err := os.WriteFile(empty, []byte("  \n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadWatermark(empty); err == nil {
		t.Error("empty watermark did not fail")
	}
}

func TestSaveWatermarkCreatesParent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "dir", "watermark")
	if err := SaveWatermark(path, 7); err != nil {
		t.Fatalf("save nested: %v", err)
	}
	if got, err := LoadWatermark(path); err != nil || got != 7 {
		t.Errorf("nested watermark = %d, %v; want 7, nil", got, err)
	}
}
