import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { generateDeveloperProof } from "../src/lib/api";
afterEach(() => vi.unstubAllGlobals());
describe("developer proof source boundary", () => {
 it("does not invent credit after network failure",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));
  expect(await generateDeveloperProof("alice","0x1")).toBeNull();
 });
 it("does not invent credit after upstream refusal",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:503}));
  expect(await generateDeveloperProof("alice","0x1")).toBeNull();
 });
 it("returns verified server proof",async()=>{
  const proof={proofHash:"verified",creditUnlockUSD:500};
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>proof}));
  expect(await generateDeveloperProof("alice","0x1")).toEqual(proof);
 });
 it("does not bundle a shared card session bearer",()=>{
  const source=readFileSync("src/components/AgentCardTerminal.tsx","utf8");
  expect(/sk_sess_[a-zA-Z0-9_-]{12,}/.test(source)).toBe(false);
  expect(source).not.toContain("本地模拟微支付成功");
 });
});
