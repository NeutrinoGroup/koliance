import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

describe("Public Evaluation & Transparency Audit Suite (GAP-81)", () => {
  it("verifies physical LICENSE exists at repository root with valid MIT license", () => {
    const licensePath = join(ROOT, "LICENSE");
    expect(existsSync(licensePath), "LICENSE file must exist in repository root").toBe(true);
    const content = readFileSync(licensePath, "utf8");
    expect(content).toContain("MIT License");
    expect(content).toContain("Copyright (c) 2026 Koliance Contributors");
  });

  it("verifies package.json explicitly defines license as MIT", () => {
    const pkgPath = join(ROOT, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    expect(pkg.license, "package.json must declare MIT license").toBe("MIT");
  });

  it("verifies sitemap includes all public pricing, docs, and compliance routes", () => {
    const sitemapPath = join(ROOT, "src", "app", "sitemap.ts");
    expect(existsSync(sitemapPath)).toBe(true);
    const content = readFileSync(sitemapPath, "utf8");
    expect(content).toContain('url: `${baseUrl}/pricing`');
    expect(content).toContain('url: `${baseUrl}/docs`');
    expect(content).toContain('url: `${baseUrl}/terms`');
    expect(content).toContain('url: `${baseUrl}/privacy`');
    expect(content).toContain('url: `${baseUrl}/refund`');
  });

  it("verifies public/llms.txt indexes core capabilities, pricing tiers, and legal policies", () => {
    const llmsPath = join(ROOT, "public", "llms.txt");
    expect(existsSync(llmsPath)).toBe(true);
    const content = readFileSync(llmsPath, "utf8");
    expect(content).toContain("https://koliance.vercel.app/pricing");
    expect(content).toContain("https://koliance.vercel.app/docs");
    expect(content).toContain("https://koliance.vercel.app/terms");
    expect(content).toContain("https://koliance.vercel.app/privacy");
    expect(content).toContain("https://koliance.vercel.app/refund");
    expect(content).toContain("$0.00");
    expect(content).toContain("$19.90");
    expect(content).toContain("$149.00");
    expect(content).toContain("MIT Open Source License");
  });

  it("verifies Pricing page is implemented with transparent tiers and free starter trial", () => {
    const pricingPath = join(ROOT, "src", "app", "pricing", "page.tsx");
    expect(existsSync(pricingPath)).toBe(true);
    const content = readFileSync(pricingPath, "utf8");
    expect(content).toContain("STARTER PACK");
    expect(content).toContain("$0.00");
    expect(content).toContain("GROWTH PRO");
    expect(content).toContain("$19.90");
    expect(content).toContain("ENTERPRISE SCALE");
    expect(content).toContain("$149.00");
    expect(content).toContain("3 free Starter packs");
  });

  it("verifies Documentation page is implemented with Quickstart, Session Keys, and Contract Addresses", () => {
    const docsPath = join(ROOT, "src", "app", "docs", "page.tsx");
    expect(existsSync(docsPath)).toBe(true);
    const content = readFileSync(docsPath, "utf8");
    expect(content).toContain("Quickstart & Sandbox Testing");
    expect(content).toContain("EIP-712 Session Key Delegation");
    expect(content).toContain("0x6291C790dbB41198c69781B2B7a01d674843b0C5");
    expect(content).toContain("0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D");
    expect(content).toContain("0x3fCeD0662657e0C3a2aF8A80e3A4cDb8A7d1d2C4");
    expect(content).toContain("ADR-006");
  });

  it("verifies Terms of Service, Privacy Policy, and Refund & Security pages exist", () => {
    const termsPath = join(ROOT, "src", "app", "terms", "page.tsx");
    const privacyPath = join(ROOT, "src", "app", "privacy", "page.tsx");
    const refundPath = join(ROOT, "src", "app", "refund", "page.tsx");

    expect(existsSync(termsPath), "Terms page must exist").toBe(true);
    expect(existsSync(privacyPath), "Privacy page must exist").toBe(true);
    expect(existsSync(refundPath), "Refund page must exist").toBe(true);

    const terms = readFileSync(termsPath, "utf8");
    const privacy = readFileSync(privacyPath, "utf8");
    const refund = readFileSync(refundPath, "utf8");

    expect(terms).toContain("Terms of Service");
    expect(privacy).toContain("Privacy Policy");
    expect(privacy).toContain("Zero Private Keys");
    expect(refund).toContain("Refund & Security Policy");
    expect(refund).toContain("14-Day Unused Quota Refund Window");
    expect(refund).toContain("Safe Harbor");
  });

  it("verifies GlobalFooter is adopted across the application", () => {
    const footerPath = join(ROOT, "src", "components", "GlobalFooter.tsx");
    expect(existsSync(footerPath)).toBe(true);
    const footer = readFileSync(footerPath, "utf8");
    expect(footer).toContain('href="/pricing"');
    expect(footer).toContain('href="/docs"');
    expect(footer).toContain('href="/terms"');
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/refund"');

    const pagePath = join(ROOT, "src", "app", "page.tsx");
    const mainPage = readFileSync(pagePath, "utf8");
    expect(mainPage).toContain("<GlobalFooter");
  });

  it("verifies layout.tsx JSON-LD structured data contains pricing offers and GitHub repo link", () => {
    const layoutPath = join(ROOT, "src", "app", "layout.tsx");
    const layout = readFileSync(layoutPath, "utf8");
    expect(layout).toContain("https://github.com/NeutrinoGroup/koliance");
    expect(layout).toContain('name: "Starter Free Trial"');
    expect(layout).toContain('price: "0"');
    expect(layout).toContain('name: "Growth Pro"');
    expect(layout).toContain('price: "19.90"');
    expect(layout).toContain('name: "Enterprise Scale"');
    expect(layout).toContain('price: "149.00"');
  });
});
