// Package verifier is the pluggable proof-verification slot.
//
// Why the package exists: ADR-004 D1 kept exactly one thing from the RFC's ZK
// layer - "only the interface". The RFC planned
// internal/verifier/zk_interface.go and a "Pluggable Verifier" abstraction;
// the commitment this repository makes is the seam, not an implementation.
//
// A seam with no caller is a narrative prop, so the slot is wired end to end:
// internal/httpapi exposes POST /api/v1/verifier/verify, Deps carries a
// Verifier, and cmd/api injects the no-op. With the no-op in place that route
// answers 501 to every request - honestly, because nothing verifies anything
// yet - and swapping the no-op for a real implementation is the only change
// needed to turn it into a working endpoint. httpapi/verifier_test.go proves
// the endpoint is not a hard-coded 200 by driving a stub through it.
//
// Design rule for every implementation, including the no-op: never report
// success without doing the work. A verifier that answers "valid" when it
// cannot verify is worse than no verifier, because callers cannot tell the
// difference - that is the failure mode the framework's own progress hook had
// (AGENTS.md: fail-closed guards look identical to dead code).
package verifier

import (
	"context"
	"errors"
	"fmt"
)

// ErrNotImplemented is returned by a verifier that is present but not wired to
// a real proof system.
var ErrNotImplemented = errors.New("verifier: no proof system is wired to this slot")

// ErrInvalidProof is returned when a verifier has examined a proof and found
// it does not check out. It is deliberately distinct from a technical failure:
// "this proof is wrong" and "I could not verify anything" must not be reported
// with the same signal.
var ErrInvalidProof = errors.New("verifier: proof is invalid")

// Scheme names the proof system a verifier speaks. It is carried explicitly so
// a caller routing by scheme does not have to type-assert the implementation.
type Scheme string

const (
	// SchemeNone is the no-op: it accepts no proof and approves none.
	SchemeNone Scheme = "NONE"
	// SchemeZK is reserved for a zero-knowledge proof system.
	SchemeZK Scheme = "ZK"
	// SchemeEIP712 is the signature scheme the delegation path uses. The
	// existing off-chain guard still verifies bearer session keys; moving it to
	// EIP-712 is GAP-24 and needs a dependency decision first, so declaring the
	// scheme here does not mean it is implemented.
	SchemeEIP712 Scheme = "EIP712"
)

// Request is one proof to check.
type Request struct {
	// Scheme selects the proof system. Empty means "let the verifier decide".
	Scheme Scheme
	// Subject is what the proof is about - an agent id, a wallet address, an
	// intent id. The verifier must bind the proof to it, otherwise a valid
	// proof can be replayed against a different subject.
	Subject string
	// Proof is the opaque payload. The slot does not constrain the encoding;
	// each scheme does.
	Proof []byte
	// PublicInputs are the values a ZK verifier needs alongside the proof.
	// Unused by the no-op.
	PublicInputs []byte
}

// Verifier decides whether a proof is valid.
//
// Contract for implementations:
//   - return nil only after the proof has actually been checked against
//     Subject;
//   - return an error wrapping ErrInvalidProof when the check ran and failed;
//   - return ErrNotImplemented (or wrap it) when there is nothing to check;
//   - honour ctx cancellation.
type Verifier interface {
	// Scheme reports the proof system this verifier handles.
	Scheme() Scheme
	// Verify checks one proof. A nil error means "valid".
	Verify(ctx context.Context, req Request) error
}

// Noop is the placeholder the API is wired with until a proof system exists.
// It approves nothing.
type Noop struct{}

// NewNoop returns the no-op verifier.
func NewNoop() *Noop { return &Noop{} }

// Scheme implements Verifier.
func (*Noop) Scheme() Scheme { return SchemeNone }

// Verify always fails. It intentionally does not return nil for an empty proof
// or for a "well-formed" one: with no verification logic there is no input for
// which approval would be meaningful, and a slot that approves everything
// cannot be distinguished from a working one.
func (*Noop) Verify(_ context.Context, req Request) error {
	return fmt.Errorf("%w (scheme %q, subject %q)", ErrNotImplemented, req.Scheme, req.Subject)
}
