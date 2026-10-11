package liquidator

import "math/big"

// toBigIntIDs converts position ids into the []*big.Int the abigen Liquidate
// binding expects. The values are fresh allocations, never aliases of the
// caller's slice elements.
func toBigIntIDs(ids []uint64) []*big.Int {
	out := make([]*big.Int, len(ids))
	for i, id := range ids {
		out[i] = new(big.Int).SetUint64(id)
	}
	return out
}

// chunkIDs splits a batch into sub-batches of at most maxPerCall positions,
// preserving order. Chunking never mixes feeds: position.Scan already groups by
// feed, and each chunk carries the same feed's single price snapshot, which is
// the invariant ADR-005 §5.6 requires of any gas-driven split.
//
// The returned chunks alias the input slice's backing array; the caller must
// not mutate elements while chunks are in flight.
func chunkIDs(ids []*big.Int, maxPerCall int) [][]*big.Int {
	if len(ids) == 0 {
		return nil
	}
	if maxPerCall <= 0 {
		return [][]*big.Int{ids}
	}

	var out [][]*big.Int
	for len(ids) > maxPerCall {
		out = append(out, ids[:maxPerCall])
		ids = ids[maxPerCall:]
	}
	out = append(out, ids)
	return out
}
