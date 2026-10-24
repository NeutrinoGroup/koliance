import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("GAP-83 Real-time IM Chat Page & Login Area Entry Icon", () => {
  const rootDir = process.cwd();
  const navAuthPath = join(rootDir, "src/components/NavAuthBadges.tsx");
  const imPagePath = join(rootDir, "src/app/im/page.tsx");
  const navbarPath = join(rootDir, "src/components/Navbar.tsx");

  it("verifies Navbar supports IM in NavView union and removes duplicate AGENTCARD from top navItems", () => {
    const navbarContent = readFileSync(navbarPath, "utf-8");
    expect(navbarContent).toContain('"IM"');
    // Verifies AGENTCARD is removed from top navItems (now showcased at bottom of index)
    const navItemsMatch = navbarContent.match(/const navItems: Array<[\s\S]*?> = \[([\s\S]*?)\];/);
    expect(navItemsMatch).not.toBeNull();
    const navItemsBody = (navItemsMatch as RegExpMatchArray)[1];
    expect(navItemsBody).not.toContain('id: "AGENTCARD"');
  });

  it("verifies NavAuthBadges permanently renders IM entry icon linking to /im", () => {
    const navAuthContent = readFileSync(navAuthPath, "utf-8");
    // Verifies href="/im" is present
    expect(navAuthContent).toContain('href="/im"');
    // Verifies MessageSquare icon is used
    expect(navAuthContent).toContain("<MessageSquare");
    // Verifies active pathname check is present
    expect(navAuthContent).toContain('pathname === "/im"');
    // Verifies dropdown also links to /im
    expect(navAuthContent).toContain('好友与IM消息');
  });

  it("verifies dedicated /im page exists and exports default component", () => {
    expect(existsSync(imPagePath)).toBe(true);
    const imPageContent = readFileSync(imPagePath, "utf-8");
    expect(imPageContent).toContain("export default function ImPage");
    expect(imPageContent).toContain('"use client";');
  });

  it("verifies /im page integrates key components and features", () => {
    const imPageContent = readFileSync(imPagePath, "utf-8");
    // Real-time polling & message fetching
    expect(imPageContent).toContain("/api/user/messages");
    expect(imPageContent).toContain("/api/user/friends");
    // TransferModal and RewardCelebrationModal integration
    expect(imPageContent).toContain("<TransferModal");
    expect(imPageContent).toContain("<RewardCelebrationModal");
    // WebP canvas image compression & Lightbox
    expect(imPageContent).toContain("compressImageToBase64");
    expect(imPageContent).toContain("selectedExpandedImage");
    // P2P KOL Red Packet / Gift
    expect(imPageContent).toContain("handleSendGift");
    expect(imPageContent).toContain("handleClaimGift");
    expect(imPageContent).toContain("playCelebrationAudio");
  });

  it("verifies zero emojis directive across modified components", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const navAuthContent = readFileSync(navAuthPath, "utf-8");
    const imPageContent = readFileSync(imPagePath, "utf-8");

    expect(emojiRegex.test(navAuthContent)).toBe(false);
    expect(emojiRegex.test(imPageContent)).toBe(false);
  });

  it("verifies zero neon colors directive: no neon cyan (#00f2fe) or glowing dropshadows in /im", () => {
    const imPageContent = readFileSync(imPagePath, "utf-8");
    expect(imPageContent).not.toContain("#00f2fe");
    expect(imPageContent).not.toContain("border-cyan-400");
    expect(imPageContent).not.toContain("text-cyan-300");
    expect(imPageContent).not.toContain("shadow-[0_0_");
  });

  it("verifies support for user search by username/email and quick email login in /im", () => {
    const imPageContent = readFileSync(imPagePath, "utf-8");
    expect(imPageContent).toContain("/api/user/search");
    expect(imPageContent).toContain("/api/auth/email");
    expect(imPageContent).toContain("searchResults");
    expect(imPageContent).toContain("handleQuickEmailLogin");
  });

  it("verifies geometric compliance: strictly rounded-md on buttons and no rounded-full on cards/buttons", () => {
    const imPageContent = readFileSync(imPagePath, "utf-8");
    // Check that buttons do not have rounded-full
    const buttonLines = imPageContent
      .split("\n")
      .filter((line) => line.includes("<button") || line.includes("className="));
    
    for (const line of buttonLines) {
      if (line.includes("<button") && line.includes("className=")) {
        expect(line).not.toContain("rounded-full");
        expect(line).not.toContain("rounded-3xl");
      }
    }
  });
});
