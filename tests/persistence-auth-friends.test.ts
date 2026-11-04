import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadPersistentCollection,
  savePersistentCollection,
  savePersistentRecord,
  deletePersistentRecord,
} from "@/lib/storagePersistence";
import {
  findUserByIdentifier,
  registerEmailPassword,
  verifyEmailPassword,
  syncUserToDatabase,
} from "@/lib/db";
import {
  addFriend,
  listFriends,
  removeFriend,
  resetFriendsDbForTests,
} from "@/lib/friendsDb";
import {
  createDirectMessage,
  listDirectMessages,
  resetDirectMessagesDbForTests,
} from "@/lib/directMessagesDb";
import {
  recordUserReward,
  getUserRewards,
  resetRewardsDbForTests,
} from "@/lib/rewardsDb";
import { isValidWalletAddress, createSessionToken } from "@/lib/session";
import { NextRequest } from "next/server";
import { POST as sessionPost, GET as sessionGet } from "@/app/api/auth/session/route";
import fs from "fs";
import path from "path";

describe("Persistence, Email Auth, and Friend Workflow Tests", () => {
  const testCollection = "test_persistence_suite";
  const testDir = path.resolve(process.cwd(), "data", "persistence");
  const testFilePath = path.join(testDir, `${testCollection}.json`);

  beforeEach(() => {
    resetFriendsDbForTests();
    resetDirectMessagesDbForTests();
    resetRewardsDbForTests();
    process.env.KOLIANCE_SESSION_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch {}
  });

  describe("1. Storage Persistence Engine", () => {
    it("atomically saves and loads records across simulated restarts", () => {
      // Force test disk write for this specific test
      process.env.PERSISTENCE_TEST_DISK = "true";
      try {
        const memoryMap = new Map<string, { id: string; name: string }>();
        savePersistentRecord(
          testCollection,
          "u1",
          { id: "u1", name: "Alice Developer" },
          memoryMap
        );
        savePersistentRecord(
          testCollection,
          "u2",
          { id: "u2", name: "Bob Trader" },
          memoryMap
        );

        // Simulate server restart: re-load from disk
        const loaded = loadPersistentCollection<{ id: string; name: string }>(testCollection);
        expect(loaded.size).toBe(2);
        expect(loaded.get("u1")?.name).toBe("Alice Developer");
        expect(loaded.get("u2")?.name).toBe("Bob Trader");

        // Delete record
        deletePersistentRecord(testCollection, "u1", loaded);
        const reloadedAfterDelete = loadPersistentCollection<{ id: string; name: string }>(testCollection);
        expect(reloadedAfterDelete.size).toBe(1);
        expect(reloadedAfterDelete.has("u1")).toBe(false);
        expect(reloadedAfterDelete.has("u2")).toBe(true);
      } finally {
        delete process.env.PERSISTENCE_TEST_DISK;
      }
    });
  });

  describe("2. Seed Accounts & User Resolution", () => {
    it("seed 2 has a valid 42-character EVM wallet address", async () => {
      const seed2 = await findUserByIdentifier("did:koliance:email:monad.trader@koliance.io");
      expect(seed2).not.toBeNull();
      expect(seed2?.wallet_address).toBe("0x6b6b83ff4e1f8009b9dbe6f46ad4e75f33f98a02");
      expect(isValidWalletAddress(seed2?.wallet_address)).toBe(true);
    });

    it("resolves user by name or username", async () => {
      const userByName = await findUserByIdentifier("Monad Alpha Trader");
      expect(userByName).not.toBeNull();
      expect(userByName?.id).toBe("did:koliance:email:monad.trader@koliance.io");

      const userByEmail = await findUserByIdentifier("monad.trader@koliance.io");
      expect(userByEmail).not.toBeNull();
      expect(userByEmail?.name).toBe("Monad Alpha Trader");
    });
  });

  describe("3. Email Registration & Password Authentication", () => {
    it("registers new email with password, rejects duplicates, and verifies login", () => {
      const testEmail = `user_${Date.now()}@test.io`;
      const reg = registerEmailPassword(testEmail, "SecurePassword123");
      expect(reg.success).toBe(true);

      // Duplicate registration attempt
      const dup = registerEmailPassword(testEmail, "AnotherPassword456");
      expect(dup.success).toBe(false);
      expect(dup.error).toContain("已被注册");

      // Wrong password
      const wrong = verifyEmailPassword(testEmail, "WrongPassword");
      expect(wrong.success).toBe(false);

      // Correct password
      const ok = verifyEmailPassword(testEmail, "SecurePassword123");
      expect(ok.success).toBe(true);
    });
  });

  describe("4. Adding Friends & Self-Addition Prevention", () => {
    it("adds a friend by valid 0x EVM address", async () => {
      const myId = "did:koliance:email:testuser@example.com";
      const friendAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const res = await addFriend(myId, friendAddress, "Carol Partner");
      expect(res.success).toBe(true);
      expect(res.friend?.friend_wallet).toBe(friendAddress.toLowerCase());

      const list = await listFriends(myId);
      expect(list.some((f) => f.friend_wallet === friendAddress.toLowerCase())).toBe(true);
    });

    it("adds seed user 2 as friend without invalid address error", async () => {
      const myId = "did:koliance:email:testuser@example.com";
      const seed2Wallet = "0x6b6b83ff4e1f8009b9dbe6f46ad4e75f33f98a02";
      const res = await addFriend(myId, seed2Wallet, "Monad Alpha Trader");
      expect(res.success).toBe(true);
      expect(res.friend?.friend_wallet).toBe(seed2Wallet.toLowerCase());
    });

    it("adds a friend by username using identifier resolution", async () => {
      const myId = "did:koliance:email:testuser@example.com";
      const res = await addFriend(myId, "Monad Alpha Trader");
      expect(res.success).toBe(true);
      expect(res.friend?.friend_wallet).toBe("0x6b6b83ff4e1f8009b9dbe6f46ad4e75f33f98a02");
    });

    it("prevents self-addition accurately without false positive substring rejections", async () => {
      const myEmail = "alexander@koliance.io";
      const myId = `did:koliance:email:${myEmail}`;

      // Adding exact self by DID or email
      const selfRes1 = await addFriend(myId, myId);
      expect(selfRes1.success).toBe(false);

      const selfRes2 = await addFriend(myId, myEmail);
      expect(selfRes2.success).toBe(false);

      // Adding another user whose email shares a substring (e.g. "alexander.co@other.com") MUST succeed
      const otherUserEmail = "alexander.co@other.com";
      const otherRes = await addFriend(myId, otherUserEmail);
      expect(otherRes.success).toBe(true);
    });
  });

  describe("5. Session Token Minting Route (/api/auth/session)", () => {
    it("issues a signed session token for a valid user profile and verifies it", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "did:privy:cm1234567890",
          email: "privyuser@example.com",
          name: "Privy User",
          walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        }),
      });

      const res = await sessionPost(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(typeof data.sessionToken).toBe("string");
      expect(data.sessionToken.length).toBeGreaterThan(20);

      // Verify the minted session token via GET /api/auth/session
      const getReq = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${data.sessionToken}`,
        },
      });
      const getRes = await sessionGet(getReq);
      const getData = await getRes.json();
      expect(getRes.status).toBe(200);
      expect(getData.success).toBe(true);
      expect(getData.identity.userId).toBe("did:privy:cm1234567890");
      expect(getData.identity.walletAddress).toBe("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc");
    });
  });

  describe("6. Direct Messaging & Rewards Data Layers", () => {
    it("creates, stores and retrieves direct messages between peers", async () => {
      const u1 = "did:koliance:email:user1@koliance.io";
      const u2 = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";

      const sendRes = await createDirectMessage({
        sender_id: u1,
        recipient_id: u2,
        msg_type: "TEXT",
        content: "Hello from test suite!",
      });
      expect(sendRes.success).toBe(true);
      expect(sendRes.message?.content).toBe("Hello from test suite!");

      const conv = await listDirectMessages(u1, u2);
      expect(conv.length).toBeGreaterThanOrEqual(1);
      expect(conv.some((m) => m.content === "Hello from test suite!")).toBe(true);
    });

    it("records rewards and queries user reward balance", async () => {
      const userId = "did:koliance:email:rewarduser@koliance.io";
      const r = await recordUserReward(userId, "WALLET_BIND");
      expect(r.reward).not.toBeNull();
      expect(r.alreadyClaimed).toBe(false);
      expect(r.reward?.amount_kol).toBe(100);

      const bal = await getUserRewards(userId);
      expect(bal.totalEarnedKol).toBe(100);
      expect(bal.totalClaimableKol).toBe(100);
    });
  });
});
