import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Issue #40 - the desktop nav silently swallowed its own items.
 *
 * The defect, measured in a browser rather than inferred (see `docs/changes/057`
 * for the raw table):
 *
 *   - the eight nav items were **1000px** wide (with their badges), but the
 *     header caps at `max-w-7xl` (1280px) and hands the nav at most **805px**,
 *     so the nav's share stops growing however wide the window is;
 *   - at `md` (768px) the nav got **229px** and clipped six of the eight items;
 *     at `lg` (1024px) it got 485px and clipped four; even at 1600px it got
 *     805px and still clipped PERP and AGENTCARD;
 *   - `no-scrollbar` (`globals.css:51-59`, `scrollbar-width: none !important`)
 *     removed the only signal that anything was cut. The items were reachable
 *     only by a gesture nobody could see was available.
 *
 * What can be checked without a browser is the part that decides all of that:
 * **which breakpoint the desktop nav switches on**, and that it is not paired
 * with a scrollbar-hiding utility. The rendered widths cannot be checked here
 * and are registered as a gap; they were measured once, by hand, and the numbers
 * are in the comment above the element.
 *
 * Why this file reads the source rather than the DOM: the repo's vitest is
 * `environment: "node"` with no jsdom, and CI runs `vitest run` but **not**
 * Playwright - so a browser assertion here would be a test that only runs on
 * whoever's laptop remembers, which is the class of test the CI workflow was
 * written to eliminate. A source-level assertion runs in CI today.
 *
 * Bound, stated rather than left to be discovered: this proves the two
 * class strings, not the layout they produce. A Tailwind theme change that
 * redefined `xl`, or a new sibling competing for the row, would not be caught.
 * That half is what the browser measurement covers, and it is manual.
 */

const SRC_ROOT = resolve(import.meta.dirname, "../src");
const NAVBAR = readFileSync(join(SRC_ROOT, "components", "Navbar.tsx"), "utf8");

/** The desktop nav's own class string. */
function desktopNavClasses(): string {
  const match = NAVBAR.match(/<nav className="([^"]+)"/);
  expect(match, "the desktop nav element was not found by its tag").not.toBeNull();
  return (match as RegExpMatchArray)[1];
}

/**
 * The classes on the element that decides where the desktop nav appears.
 *
 * `NavAuthBadges` carries `rounded-2xl` too, so the search is anchored on the
 * responsive-display prefix - the nav is the only element in this component
 * whose visibility is a breakpoint (`hidden <bp>:flex`).
 */
function navBreakpoint(): { hiddenAt: string; flexAtPrefix: string } {
  const classes = desktopNavClasses();
  const hidden = classes.match(/\bhidden\b/);
  const flex = classes.match(/\b(sm|md|lg|xl|2xl):flex\b/);
  expect(hidden, "the desktop nav is no longer hidden below its breakpoint").not.toBeNull();
  expect(flex, "the desktop nav has no responsive `flex` breakpoint").not.toBeNull();
  return { hiddenAt: "hidden", flexAtPrefix: (flex as RegExpMatchArray)[1] };
}

describe("issue #40 - the desktop nav does not hide its own items", () => {
  it("switches on at xl, the width the measured item set needs", () => {
    // The number is not a preference: 706px of items need 741px of nav, and the
    // nav only gets that at `xl`. Below it the drawer carries all eight items,
    // which the next case pins.
    expect(navBreakpoint().flexAtPrefix).toBe("xl");
  });

  it("does not hide the scrollbar that would reveal a clipped item", () => {
    // The second half of the defect, and the half that made it *silent*.
    // `overflow-x-auto` may stay - it is the guarantee of reachability - but
    // hiding the scrollbar while items overflow is what turned "there is more
    // over here" into "there is nothing more".
    const classes = desktopNavClasses();
    expect(classes, "the desktop nav lost its reachability fallback").toContain("overflow-x-auto");
    for (const hider of ["no-scrollbar", "scrollbar-width:none", "[&::-webkit-scrollbar]:hidden"]) {
      expect(
        classes,
        `the desktop nav hides its scrollbar again ("${hider}"): a clipped item goes back to being invisible`
      ).not.toContain(hider);
    }
  });

  it("keeps every nav item out of the desktop bar's decoration", () => {
    // The badges are what pushed the measured width from 706px to 1000px. They
    // are not asserted to be absent from the file - the drawer still renders
    // them - only absent from the desktop bar's item markup.
    const start = NAVBAR.indexOf("<nav className=");
    const end = NAVBAR.indexOf("</nav>", start);
    const desktopBar = NAVBAR.slice(start, end);
    expect(desktopBar, "the desktop nav markup was not found").not.toBe("");
    expect(
      desktopBar,
      "the desktop nav carries per-item badges again, which is what pushed it past the header's ceiling"
    ).not.toContain("item.badge");
  });

  it("declares how many items the nav renders, so the count can be asserted against it", () => {
    // `navItems.length` is the declaration; a test (here or in a browser) can
    // compare it with what actually rendered. A hard-coded 8 in the assertion
    // would go stale the moment a ninth item is added, and would then be
    // asserting the test's own memory rather than the component's.
    expect(NAVBAR).toContain('data-testid="desktop-nav-item-count"');
    const declared = NAVBAR.match(/data-testid="desktop-nav-item-count"[\s\S]{0,80}?\{navItems\.length\}/);
    expect(declared, "the declared item count is no longer navItems.length").not.toBeNull();
  });

  it("has teeth on each of the three ways the defect could come back", () => {
    // Negative control for the helpers, not for the component. Without it a typo
    // in the regexes would report "clean" forever - indistinguishable from a
    // fixed tree.
    const at = (classes: string) => {
      const flex = classes.match(/\b(sm|md|lg|xl|2xl):flex\b/);
      return flex ? flex[1] : null;
    };
    expect(at("hidden md:flex items-center")).toBe("md");
    expect(at("hidden lg:flex items-center")).toBe("lg");
    expect(at("hidden xl:flex items-center")).toBe("xl");
    expect(at("flex items-center")).toBeNull();
    // And the absence assertions are not vacuous: the shapes they forbid do
    // occur in this repository, in the components that are allowed to scroll
    // horizontally on purpose.
    const consoleTabs = readFileSync(join(SRC_ROOT, "components", "DeveloperConsole.tsx"), "utf8");
    expect(consoleTabs).toContain("no-scrollbar");
  });
});
