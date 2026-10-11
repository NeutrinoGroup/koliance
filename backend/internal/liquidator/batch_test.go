package liquidator

import (
	"math/big"
	"reflect"
	"testing"
)

func TestToBigIntIDs(t *testing.T) {
	got := toBigIntIDs([]uint64{1, 2, 42})
	want := []*big.Int{big.NewInt(1), big.NewInt(2), big.NewInt(42)}
	if len(got) != len(want) {
		t.Fatalf("len = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i].Cmp(want[i]) != 0 {
			t.Errorf("got[%d] = %s, want %s", i, got[i], want[i])
		}
	}

	// Fresh allocations: mutating the result must not touch a caller's slice.
	ids := []uint64{5}
	bigs := toBigIntIDs(ids)
	bigs[0].SetUint64(999)
	if ids[0] != 5 {
		t.Errorf("caller ids[0] mutated to %d", ids[0])
	}
}

func TestChunkIDs(t *testing.T) {
	bigs := func(ns ...int64) []*big.Int {
		out := make([]*big.Int, len(ns))
		for i, n := range ns {
			out[i] = big.NewInt(n)
		}
		return out
	}
	asInts := func(chunks [][]*big.Int) [][]int64 {
		out := make([][]int64, len(chunks))
		for i, c := range chunks {
			out[i] = make([]int64, len(c))
			for j, v := range c {
				out[i][j] = v.Int64()
			}
		}
		return out
	}

	got := chunkIDs(bigs(1, 2, 3, 4, 5), 2)
	want := [][]int64{{1, 2}, {3, 4}, {5}}
	if !reflect.DeepEqual(asInts(got), want) {
		t.Errorf("chunk(5,2) = %v, want %v", asInts(got), want)
	}

	got = chunkIDs(bigs(1, 2), 10)
	want = [][]int64{{1, 2}}
	if !reflect.DeepEqual(asInts(got), want) {
		t.Errorf("chunk(2,10) = %v, want %v", asInts(got), want)
	}

	if got := chunkIDs(nil, 5); got != nil {
		t.Errorf("chunk(nil,5) = %v, want nil", got)
	}
}
