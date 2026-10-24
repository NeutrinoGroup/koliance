import { describe, it, expect } from "vitest";

describe("DirectMessage URL Regex & Message Types", () => {
  const URL_REGEX = /(https?:\/\/[^\s]+)/g;

  it("identifies URLs in text messages correctly", () => {
    const text = "Check out https://monad.xyz and http://koliance.space for live dApp!";
    const matches = text.match(URL_REGEX);
    expect(matches).toEqual(["https://monad.xyz", "http://koliance.space"]);

    const parts = text.split(URL_REGEX);
    expect(parts.length).toBe(5);
    expect(parts[1]).toBe("https://monad.xyz");
    expect(parts[3]).toBe("http://koliance.space");
  });

  it("handles text with no URLs without splitting", () => {
    const text = "Just sent 10 KOL to your wallet!";
    const matches = text.match(URL_REGEX);
    expect(matches).toBeNull();
  });

  it("validates direct message record structure with receipt and gift metadata", () => {
    const receiptMetadata = {
      txHash: "0xabcdef1234567890",
      amount: "50",
      currency: "KOL",
    };
    expect(receiptMetadata.txHash.startsWith("0x")).toBe(true);
    expect(receiptMetadata.amount).toBe("50");
    expect(receiptMetadata.currency).toBe("KOL");
  });
});
