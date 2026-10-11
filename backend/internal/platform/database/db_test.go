package database

import (
	"context"
	"testing"
)

func TestSystemConfigMemoryFallback(t *testing.T) {
	db := New("")
	ctx := context.Background()

	cfg, err := db.GetSystemConfig(ctx, "maintenance_mode")
	if err != nil {
		t.Fatalf("expected maintenance_mode config, got err: %v", err)
	}
	if string(cfg.Value) != `{"enabled":false}` {
		t.Errorf("unexpected value: %s", string(cfg.Value))
	}

	// Update config
	newVal := []byte(`{"enabled":true}`)
	if err := db.SetSystemConfig(ctx, "maintenance_mode", newVal, "Test override"); err != nil {
		t.Fatalf("failed to set config: %v", err)
	}

	updated, err := db.GetSystemConfig(ctx, "maintenance_mode")
	if err != nil {
		t.Fatalf("failed to get updated config: %v", err)
	}
	if string(updated.Value) != `{"enabled":true}` {
		t.Errorf("expected updated value, got %s", string(updated.Value))
	}

	// Missing key
	if _, err := db.GetSystemConfig(ctx, "non_existent_key"); err == nil {
		t.Errorf("expected error for non_existent_key, got nil")
	}
}
