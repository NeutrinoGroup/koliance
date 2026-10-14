package httpapi

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// GAP-70. qaRouteInventory drives TestQARouteInventoryIsComplete, which checks
// the inventory -> router direction only: every path listed must actually be
// registered. The reverse direction — every registered route must appear in the
// inventory — had no judge, so a new route was silently untested. The ledger
// closes with the receipt: /api/v1/developer/keys lived in exactly that gap
// until docs/changes/045.
//
// router_test.go's dbGatedRoutes comment had already conceded the same thing in
// prose ("the absence is registered as GAP-70"). This file is that absence,
// closed.
//
// The registration set is read by parsing router.go rather than by hitting a
// live mux, because the point is to catch a route that exists in source but was
// forgotten in the inventory — a mux dump would work too, but parsing keeps the
// check independent of whether a given route is reachable without a database.

// routeRegistrationPaths extracts the path literals passed to the router's
// registration helper in a Go source file.
//
// The helper is the `h := func(path string, fn http.HandlerFunc) { ... }` at the
// top of newRouter, and every route goes through it (there is exactly one
// mux.HandleFunc, inside that helper). Detection is by shape, not by the name
// "h": it finds the FuncLit *assignment* whose body registers onto a mux, and
// takes the name of the variable being assigned — that is the identifier the
// registration calls are made through.
//
// It is NOT the FuncLit's first parameter name: that is `path`, the argument the
// helper forwards to mux. Using the parameter name here finds zero call sites
// and would report "no routes", so the capture is on assign.Lhs, and the guard
// in TestQARouteInventoryCoversEveryRoute exists to keep that class of mistake
// loud rather than silent.
//
// If the helper cannot be found, this returns an error rather than an empty
// list — an empty list would look like "no routes", which would make the
// caller's assertion pass vacuously. That would be the very failure mode this
// item exists to remove.
func routeRegistrationPaths(src []byte) ([]string, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "router.go", src, 0)
	if err != nil {
		return nil, err
	}

	helperName := ""
	ast.Inspect(file, func(n ast.Node) bool {
		if helperName != "" {
			return false
		}
		assign, ok := n.(*ast.AssignStmt)
		if !ok || len(assign.Lhs) != 1 || len(assign.Rhs) != 1 {
			return true
		}
		name, ok := assign.Lhs[0].(*ast.Ident)
		if !ok {
			return true
		}
		fn, ok := assign.Rhs[0].(*ast.FuncLit)
		if !ok {
			return true
		}
		// A registration helper's body contains a mux call. Require that, so an
		// unrelated `x := func(a string) {...}` earlier in the file is not
		// mistaken for it.
		registersMux := false
		ast.Inspect(fn.Body, func(m ast.Node) bool {
			call, ok := m.(*ast.CallExpr)
			if !ok {
				return true
			}
			if sel, ok := call.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "HandleFunc" {
				registersMux = true
			}
			return true
		})
		if !registersMux {
			return true
		}
		helperName = name.Name
		return false
	})

	if helperName == "" {
		return nil, errNoRegistrationHelper
	}

	var paths []string
	ast.Inspect(file, func(n ast.Node) bool {
		call, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}
		id, ok := call.Fun.(*ast.Ident)
		if !ok || id.Name != helperName || len(call.Args) == 0 {
			return true
		}
		lit, ok := call.Args[0].(*ast.BasicLit)
		if !ok || lit.Kind != token.STRING {
			return true
		}
		p, err := strconv.Unquote(lit.Value)
		if err != nil {
			return true
		}
		paths = append(paths, normalizePath(p))
		return true
	})
	return paths, nil
}

type registrationHelperNotFound struct{}

func (registrationHelperNotFound) Error() string { return "router.go: registration helper not found" }

var errNoRegistrationHelper = registrationHelperNotFound{}

// normalizePath strips a query string so an inventory entry that carries one
// (several probes take ?id= or ?username=) is comparable to a registration
// literal, which never has one.
//
// A trailing slash is deliberately NOT stripped: in the router a trailing "/"
// marks a prefix route (net/http ServeMux semantics). /api/v1/agentcard/cards/
// is one such route, and it is covered by an inventory entry naming a concrete
// child (/api/v1/agentcard/cards/cX). Collapsing the slash would turn that
// genuine coverage into a false "unlisted route".
func normalizePath(p string) string {
	if i := strings.IndexAny(p, "?#"); i >= 0 {
		p = p[:i]
	}
	return p
}

// pathCovered reports whether an inventory entry accounts for a registration.
//
// A prefix registration (trailing "/") is covered when some inventory path sits
// under it; an exact registration is covered only by an exact match.
func pathCovered(registered string, covered []string) bool {
	if strings.HasSuffix(registered, "/") {
		for _, ip := range covered {
			if strings.HasPrefix(ip, registered) {
				return true
			}
		}
		return false
	}
	for _, ip := range covered {
		if ip == registered {
			return true
		}
	}
	return false
}

// unlistedRoutes returns the registered paths with no inventory coverage.
// Extracted so the negative controls below can drive it with synthetic
// registrations without touching the real router.
func unlistedRoutes(registered, covered []string) []string {
	var orphans []string
	for _, p := range registered {
		if !pathCovered(p, covered) {
			orphans = append(orphans, p)
		}
	}
	sort.Strings(orphans)
	return orphans
}

// TestQARouteInventoryCoversEveryRoute is the reverse check GAP-70 asked for:
// every path registered in router.go must have an entry in qaRouteInventory.
func TestQARouteInventoryCoversEveryRoute(t *testing.T) {
	src, err := os.ReadFile("router.go")
	if err != nil {
		t.Fatalf("cannot read router.go: %v", err)
	}
	registered, err := routeRegistrationPaths(src)
	if err != nil {
		t.Fatalf("route extraction failed (the detector, not the router, is broken): %v", err)
	}

	// Detector sanity: router.go has ~30 routes today. A near-empty result means
	// extraction broke, and a broken extractor would make this test pass
	// vacuously — the exact silent-green shape GAP-70 is about.
	if len(registered) < 20 {
		t.Fatalf("route extraction found only %d paths — the detector likely broke, and a broken detector makes this check silently pass", len(registered))
	}

	covered := make([]string, 0, len(qaRouteInventory))
	for _, e := range qaRouteInventory {
		covered = append(covered, normalizePath(e.path))
	}

	if orphans := unlistedRoutes(registered, covered); len(orphans) > 0 {
		t.Fatalf("router.go registers %d path(s) absent from qaRouteInventory — a new route is silently untested (GAP-70). Add each to qaRouteInventory with its expected status, or register an exemption:\n  %s",
			len(orphans), strings.Join(orphans, "\n  "))
	}
}

// TestRouteRegistrationPaths_DetectsARegistration is the negative control
// (AGENTS.md D3) on the detector itself: a probe registration in a synthetic
// source must be found. Without this, a detector that returned nothing would
// satisfy TestQARouteInventoryCoversEveryRoute forever.
func TestRouteRegistrationPaths_DetectsARegistration(t *testing.T) {
	const synthetic = `package httpapi

func newRouter() {
	register := func(path string, fn any) {
		mux.HandleFunc(path, nil)
	}
	register("/api/v1/health", nil)
	register("/api/v1/synthetic-probe", nil)
}
`
	got, err := routeRegistrationPaths([]byte(synthetic))
	if err != nil {
		t.Fatalf("extraction on synthetic source failed: %v", err)
	}
	found := false
	for _, p := range got {
		if p == "/api/v1/synthetic-probe" {
			found = true
		}
	}
	if !found {
		t.Fatalf("detector missed a registration; extracted %v", got)
	}
}

// TestUnlistedRoutes_FlagsANewRoute proves the check as a whole would actually
// go red for an unlisted route, and — in the other direction — does not flag a
// route that is listed, nor a prefix route covered by a concrete child.
func TestUnlistedRoutes_FlagsANewRoute(t *testing.T) {
	covered := make([]string, 0, len(qaRouteInventory))
	for _, e := range qaRouteInventory {
		covered = append(covered, normalizePath(e.path))
	}
	if orphans := unlistedRoutes([]string{"/api/v1/synthetic-probe"}, covered); len(orphans) != 1 {
		t.Fatalf("reverse check did not flag an unlisted route; got %v", orphans)
	}
	// A route that IS listed must not be flagged — otherwise the check would be
	// satisfied by flagging everything.
	if orphans := unlistedRoutes([]string{"/api/v1/health"}, covered); len(orphans) != 0 {
		t.Fatalf("reverse check flagged a listed route %v — it flags indiscriminately", orphans)
	}
	// The prefix case that produced a false positive during development: the
	// cards route is a trailing-slash registration, covered by a concrete child
	// entry. It must NOT be flagged.
	if orphans := unlistedRoutes([]string{"/api/v1/agentcard/cards/"}, covered); len(orphans) != 0 {
		t.Fatalf("reverse check flagged a prefix route with a covered child %v — false positive", orphans)
	}
}
