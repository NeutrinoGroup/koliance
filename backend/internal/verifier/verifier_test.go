package verifier

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// The no-op must approve nothing. If this ever returns nil, the slot has
// started lying and every caller downstream is affected.
func TestNoopApprovesNothing(t *testing.T) {
	cases := []Request{
		{},
		{Scheme: SchemeZK, Subject: "agent-1", Proof: []byte{0x01}},
		{Scheme: SchemeZK, Subject: "agent-1", Proof: []byte{}, PublicInputs: []byte{0x02}},
		{Scheme: SchemeEIP712, Subject: "0x0000000000000000000000000000000000000001", Proof: []byte("deadbeef")},
		{Scheme: SchemeNone, Subject: "anything", Proof: []byte(strings.Repeat("a", 1024))},
	}
	n := NewNoop()
	for i, req := range cases {
		err := n.Verify(context.Background(), req)
		if err == nil {
			t.Fatalf("case %d: no-op approved a proof", i)
		}
		if !errors.Is(err, ErrNotImplemented) {
			t.Errorf("case %d: err = %v, want ErrNotImplemented", i, err)
		}
	}
}

// A cancelled context must not turn into approval either.
func TestNoopIgnoresCancellationButStillRefuses(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := NewNoop().Verify(ctx, Request{Scheme: SchemeZK, Proof: []byte{0x01}}); err == nil {
		t.Fatal("no-op approved a proof under a cancelled context")
	}
}

func TestNoopScheme(t *testing.T) {
	if got := NewNoop().Scheme(); got != SchemeNone {
		t.Errorf("Scheme() = %q, want %q", got, SchemeNone)
	}
}

// The interface is the deliverable, so assert the no-op actually satisfies it.
func TestNoopSatisfiesVerifier(t *testing.T) {
	var v Verifier = NewNoop()
	if v == nil {
		t.Fatal("no-op is not a Verifier")
	}
}

func TestErrorMessagesCarryContext(t *testing.T) {
	err := NewNoop().Verify(context.Background(), Request{Scheme: SchemeZK, Subject: "agent-42"})
	msg := err.Error()
	for _, want := range []string{"ZK", "agent-42"} {
		if !strings.Contains(msg, want) {
			t.Errorf("error %q does not mention %q", msg, want)
		}
	}
}
