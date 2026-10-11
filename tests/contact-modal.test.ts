import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ContactModal } from "../src/components/ContactModal";

describe("ContactModal & AI Builders Network Verification", () => {
  it("does not render when isOpen is false", () => {
    const html = renderToString(
      React.createElement(ContactModal, {
        isOpen: false,
        onClose: vi.fn(),
      })
    );
    expect(html).toBe("");
  });

  it("renders updated team members and email addresses accurately", () => {
    const html = renderToString(
      React.createElement(ContactModal, {
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    // Verify moonhotline
    expect(html).toContain("moonhotline");
    expect(html).toContain("moonhotline@outlook.com");
    expect(html).toContain("[AI PROTOCOL BUILDER]");

    // Verify Yotoha Lin updated email
    expect(html).toContain("Yotoha Lin");
    expect(html).toContain("player159263@gmail.com");
    expect(html).toContain("[AI CONTRACT BUILDER]");

    // Verify iasi777 updated email
    expect(html).toContain("iasi777");
    expect(html).toContain("iasi777work@gmail.com");
    expect(html).toContain("[AI SECURITY BUILDER]");

    // Ecosystem developer email
    expect(html).toContain("developer@koliance.io");

    // Modal headers and AI builder network badge
    expect(html).toContain("Koliance Team &amp; Contacts");
    expect(html).toContain("[AI BUILDERS NETWORK]");
  });

  it("strictly ensures no internal scrollbar classes are added", () => {
    const html = renderToString(
      React.createElement(ContactModal, {
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    expect(html).not.toContain("overflow-y-auto");
    expect(html).not.toContain("overflow-y-scroll");
    expect(html).not.toContain("overflow-scroll");
  });

  it("strictly enforces zero unicode emojis policy in markup", () => {
    const html = renderToString(
      React.createElement(ContactModal, {
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    // Regex checking for common Unicode emoji ranges
    const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}]/u;
    expect(emojiRegex.test(html)).toBe(false);
  });

  it("strictly enforces rectangular geometry directive (no rounded-full / rounded-2xl / rounded-3xl)", () => {
    const html = renderToString(
      React.createElement(ContactModal, {
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    expect(html).not.toContain("rounded-full");
    expect(html).not.toContain("rounded-2xl");
    expect(html).not.toContain("rounded-3xl");
  });
});
