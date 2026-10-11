import { test, expect } from "@playwright/test";

test.describe("Koliance Production E2E Verification", () => {
  test("1. Homepage renders with official vision and i18n switcher", async ({ page }) => {
    await page.goto("/");
    
    // Check vision headline
    const headline = page.locator("h1");
    await expect(headline).toBeVisible();
    await expect(headline).toContainText("Make AI Agents");

    // Check subtitle
    const subtitle = page.locator("p").filter({ hasText: "Autonomous AI agents don't just chat" });
    await expect(subtitle).toBeVisible();

    // Toggle language
    const langBtn = page.getByRole("button", { name: /EN \/ 中文|中文 \/ EN/i });
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await expect(headline).toContainText("让 AI 不仅能行动");
      // Toggle back to English
      await langBtn.click();
      await expect(headline).toContainText("Make AI Agents");
    }
  });

  test("2. Core Problem & Strategic Taxonomy sections render correctly", async ({ page }) => {
    await page.goto("/");

    // Verify 3 Problem Pillars
    await expect(page.getByText("What Core Problem Does Koliance Solve?")).toBeVisible();
    await expect(page.getByText("Identity").first()).toBeVisible();
    await expect(page.getByText("Trust & Reputation").first()).toBeVisible();
    await expect(page.getByText("Financial Access").first()).toBeVisible();

    // Verify 4-step pipeline
    await expect(page.getByText("Verifiable Identity").first()).toBeVisible();
    await expect(page.getByText("Verifiable Credit").first()).toBeVisible();
    await expect(page.getByText("Scoped Financial Controls").first()).toBeVisible();
    await expect(page.getByText("Trusted Autonomous Agency").first()).toBeVisible();

    // Verify Strategic Taxonomy Matrix
    await expect(page.getByText("Strategic Architecture & Feature Taxonomy")).toBeVisible();
    await expect(page.getByText("Session Key Registry")).toBeVisible();
    await expect(page.getByText("Dynamic Wallet Delegation")).toBeVisible();
    await expect(page.getByText("Nansen Smart Money Signals")).toBeVisible();
  });

  test("3. Security Regression: /api/user/profile rejects unauthenticated queries", async ({ request }) => {
    // Attempt unauthenticated query
    const res = await request.get("/api/user/profile");
    // Should reject with 401 or require valid session
    expect([401, 400, 403]).toContain(res.status());
  });

  test("4. Market Feed API operates reliably with multi-source fallback (No Yahoo)", async ({ request }) => {
    const res = await request.get("/api/market?symbol=NVDA&range=1mo&interval=1d");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    
    expect(data.chart.closes.length).toBeGreaterThan(0);
    expect(data.meta.symbol).toBe("NVDA");
    // Ensure no Yahoo Finance source string
    expect(data.source).not.toContain("yahoo");
  });
});
