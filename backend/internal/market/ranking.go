package market

import (
	"sort"
	"time"
)

// InstrumentChange is one instrument's move over the most recent session.
//
// Every field is either sourced from a real bar or explicitly flagged as
// unknown — there is no default that could be mistaken for an observation.
type InstrumentChange struct {
	Symbol        string    `json:"symbol"`
	Price         float64   `json:"price"`
	PreviousClose float64   `json:"previousClose"`
	Change        float64   `json:"change"`
	ChangePercent float64   `json:"changePercent"`
	AsOf          time.Time `json:"asOf"`
	Currency      string    `json:"currency"`
	Source        string    `json:"source"`
	Synthetic     bool      `json:"synthetic"`
	// Unranked marks an instrument whose change is unknown (no previous close).
	// Such a row is counted but sorted into no bucket: "did not move" and "we
	// cannot tell whether it moved" are different facts, and collapsing them is
	// how a ranking starts lying.
	Unranked bool `json:"unranked"`
}

// Movers is the ranked view the market page renders (issue #16: 标的涨跌幅排行).
type Movers struct {
	Gainers   []InstrumentChange `json:"gainers"`
	Losers    []InstrumentChange `json:"losers"`
	Unchanged []InstrumentChange `json:"unchanged"`
	// Unranked counts instruments that could not be ranked. It is a count, not
	// a list, because the rankable set is what callers act on.
	UnrankedCount int       `json:"unrankedCount"`
	AsOf          time.Time `json:"asOf"`
	Source        string    `json:"source"`
	Synthetic     bool      `json:"synthetic"`
}

// RankMovers splits changes into gainers (descending), losers (ascending) and
// unchanged.
//
// Total ordering matters more than it looks. The upstream payload is a JSON
// object keyed by symbol, so its Go representation is a map and map iteration
// is randomised: without a symbol tie-break, two instruments with the same move
// swap places between two identical requests, and a "ranking" that reshuffles
// itself on refresh is not a ranking. Every comparison below therefore ends in
// the symbol.
//
// The slices are always non-nil so the JSON is `[]` rather than `null`; a
// caller that maps over them should never have to special-case a null.
func RankMovers(changes []InstrumentChange) Movers {
	movers := Movers{
		Gainers:   []InstrumentChange{},
		Losers:    []InstrumentChange{},
		Unchanged: []InstrumentChange{},
		Source:    SourceAlpacaBars,
		Synthetic: false,
	}

	var ranked []InstrumentChange
	for _, c := range changes {
		if c.Unranked || c.PreviousClose <= 0 {
			movers.UnrankedCount++
			continue
		}
		ranked = append(ranked, c)
		if c.AsOf.After(movers.AsOf) {
			movers.AsOf = c.AsOf
		}
	}

	sort.Slice(ranked, func(i, j int) bool {
		a, b := ranked[i], ranked[j]
		if a.ChangePercent != b.ChangePercent {
			// Descending percent, so the biggest gain leads and the biggest loss
			// trails — one ordering serves both ends.
			return a.ChangePercent > b.ChangePercent
		}
		return a.Symbol < b.Symbol
	})

	for _, c := range ranked {
		switch {
		case c.ChangePercent > 0:
			movers.Gainers = append(movers.Gainers, c)
		case c.ChangePercent < 0:
			movers.Losers = append(movers.Losers, c)
		default:
			movers.Unchanged = append(movers.Unchanged, c)
		}
	}

	// Losers were appended in gainers order (best first); a loss board reads the
	// other way round, so reverse it. Reversing a fully-ordered slice keeps the
	// symbol tie-break deterministic (it just flips it), so no second sort.
	for i, j := 0, len(movers.Losers)-1; i < j; i, j = i+1, j-1 {
		movers.Losers[i], movers.Losers[j] = movers.Losers[j], movers.Losers[i]
	}

	return movers
}

// MoversFromPrices ranks an already-fetched price list. The market overview
// uses it so the ranking costs no extra upstream request: the change fields are
// carried by the same rows that feed `realtimePrices`.
func MoversFromPrices(prices []PythPriceData) Movers {
	changes := make([]InstrumentChange, 0, len(prices))
	for _, p := range prices {
		changes = append(changes, InstrumentChange{
			Symbol:        p.Symbol,
			Price:         p.Price,
			PreviousClose: p.PreviousClose,
			Change:        p.Change,
			ChangePercent: p.ChangePercent,
			AsOf:          p.UpdatedAt,
			Currency:      "USD",
			Source:        p.Source,
			Synthetic:     p.Synthetic,
			Unranked:      p.PreviousClose <= 0,
		})
	}
	return RankMovers(changes)
}

// SortBySymbol orders a change slice by symbol, ascending.
func SortBySymbol(changes []InstrumentChange) {
	sort.Slice(changes, func(i, j int) bool { return changes[i].Symbol < changes[j].Symbol })
}
