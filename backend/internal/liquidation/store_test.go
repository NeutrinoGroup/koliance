package liquidation

import (
	"encoding/json"
	"testing"
	"time"
)

// TestEventJSONShape pins the wire contract the frontend dashboard consumes:
// camelCase keys, null for the not-yet-known reward / blockNumber, and the
// 18-decimal exit price as a decimal string (lossless for big.Int).
func TestEventJSONShape(t *testing.T) {
	at := time.Date(2026, 10, 11, 12, 34, 56, 0, time.UTC)
	e := Event{
		ID:         7,
		PositionID: 12,
		FeedID:     "0xabcd",
		ExitPrice:  "163600000000000000000",
		TxHash:     "0x1234",
		CreatedAt:  at,
	}

	b, err := json.Marshal(e)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got map[string]interface{}
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got["positionId"] != float64(12) {
		t.Errorf("positionId = %v, want 12", got["positionId"])
	}
	if got["exitPrice"] != "163600000000000000000" {
		t.Errorf("exitPrice = %v, want the raw 18-decimal string", got["exitPrice"])
	}
	if got["feedId"] != "0xabcd" {
		t.Errorf("feedId = %v", got["feedId"])
	}
	if got["txHash"] != "0x1234" {
		t.Errorf("txHash = %v", got["txHash"])
	}
	if got["reward"] != nil {
		t.Errorf("reward = %v, want null", got["reward"])
	}
	if got["blockNumber"] != nil {
		t.Errorf("blockNumber = %v, want null", got["blockNumber"])
	}
	if got["createdAt"] != "2026-10-11T12:34:56Z" {
		t.Errorf("createdAt = %v, want RFC3339 UTC", got["createdAt"])
	}
}
