import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/session";
import { GET as friendsGET, POST as friendsPOST, DELETE as friendsDELETE } from "@/app/api/user/friends/route";
import { GET as messagesGET, POST as messagesPOST } from "@/app/api/user/messages/route";
import { GET as rewardsGET, POST as rewardsPOST } from "@/app/api/user/rewards/route";
import { GET as searchGET } from "@/app/api/user/search/route";
import { POST as emailAuthPOST } from "@/app/api/auth/email/route";
import { resetFriendsDbForTests } from "@/lib/friendsDb";
import { resetDirectMessagesDbForTests } from "@/lib/directMessagesDb";
import { resetRewardsDbForTests } from "@/lib/rewardsDb";
import { resetMemoryUsersForTests } from "@/lib/db";

describe("User API Routes: Friends, Messages & Rewards", () => {
  const testWallet = "0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7";
  const peerWallet = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
  const sessionToken = createSessionToken({
    userId: `did:koliance:wallet:${testWallet}`,
    walletAddress: testWallet,
  });

  const authHeader = { Authorization: `Bearer ${sessionToken}` };

    beforeEach(() => {
    resetFriendsDbForTests();
    resetDirectMessagesDbForTests();
    resetRewardsDbForTests();
    resetMemoryUsersForTests();
  });

  describe("/api/user/friends", () => {
    it("requires authentication", async () => {
      const res = await friendsGET(new NextRequest("http://localhost/api/user/friends"));
      expect(res.status).toBe(401);
    });

    it("adds, lists, and deletes a friend", async () => {
      // POST add friend
      const postReq = new NextRequest("http://localhost/api/user/friends", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ friend_wallet: peerWallet, friend_name: "Bob" }),
      });
      const postRes = await friendsPOST(postReq);
      expect(postRes.status).toBe(200);
      const postData = await postRes.json();
      expect(postData.success).toBe(true);
      expect(postData.friend.friend_wallet).toBe(peerWallet);
      expect(postData.friend.friend_name).toBe("Bob");

      // GET friends list
      const getReq = new NextRequest("http://localhost/api/user/friends", {
        headers: authHeader,
      });
      const getRes = await friendsGET(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.friends.length).toBe(1);

      // DELETE friend
      const delReq = new NextRequest(`http://localhost/api/user/friends?wallet=${peerWallet}`, {
        method: "DELETE",
        headers: authHeader,
      });
      const delRes = await friendsDELETE(delReq);
      expect(delRes.status).toBe(200);
      const delData = await delRes.json();
      expect(delData.success).toBe(true);

      // Check empty
      const afterRes = await friendsGET(getReq);
      const afterData = await afterRes.json();
      expect(afterData.friends.length).toBe(0);
    });

    it("rejects malformed wallet address in POST", async () => {
      const postReq = new NextRequest("http://localhost/api/user/friends", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ friend_wallet: "not-a-wallet" }),
      });
      const res = await friendsPOST(postReq);
      expect(res.status).toBe(400);
    });
  });

  describe("/api/user/messages", () => {
    it("sends and retrieves direct messages with optimistic polling support", async () => {
      // Send text message
      const postReq1 = new NextRequest("http://localhost/api/user/messages", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: peerWallet,
          msg_type: "TEXT",
          content: "See my project at https://koliance.space",
        }),
      });
      const res1 = await messagesPOST(postReq1);
      expect(res1.status).toBe(200);

      // Send transfer receipt message
      const postReq2 = new NextRequest("http://localhost/api/user/messages", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: peerWallet,
          msg_type: "TRANSFER_RECEIPT",
          content: "Transfer of 25 KOL completed",
          metadata: { txHash: "0x123", amount: "25", currency: "KOL" },
        }),
      });
      const res2 = await messagesPOST(postReq2);
      expect(res2.status).toBe(200);

      // Fetch messages with peer
      const getReq = new NextRequest(`http://localhost/api/user/messages?peer=${peerWallet}`, {
        headers: authHeader,
      });
      const getRes = await messagesGET(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.messages.length).toBe(2);
      expect(getData.messages[0].content).toContain("https://koliance.space");
      expect(getData.messages[1].msg_type).toBe("TRANSFER_RECEIPT");
    });
  });

  describe("/api/user/rewards", () => {
    it("claims action rewards and gets summary", async () => {
      // Claim first card reward (+150 KOL)
      const claimReq = new NextRequest("http://localhost/api/user/rewards", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLAIM_ACTION",
          action_type: "FIRST_CARD",
          amount_kol: 150,
        }),
      });
      const claimRes = await rewardsPOST(claimReq);
      expect(claimRes.status).toBe(200);
      const claimData = await claimRes.json();
      expect(claimData.success).toBe(true);
      expect(claimData.reward.amount_kol).toBe(150);

      // Duplicate claim should fail with 409
      const dupReq = new NextRequest("http://localhost/api/user/rewards", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLAIM_ACTION",
          action_type: "FIRST_CARD",
          amount_kol: 150,
        }),
      });
      const dupRes = await rewardsPOST(dupReq);
      expect(dupRes.status).toBe(409);

      // GET rewards summary
      const getReq = new NextRequest("http://localhost/api/user/rewards", {
        headers: authHeader,
      });
      const getRes = await rewardsGET(getReq);
      expect(getRes.status).toBe(200);
      const summary = await getRes.json();
      expect(summary.totalClaimableKol).toBe(150);
      expect(summary.totalEarnedKol).toBe(150);

      // Withdraw rewards
      const withdrawReq = new NextRequest("http://localhost/api/user/rewards", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "WITHDRAW",
          to_wallet: testWallet,
        }),
      });
      const withdrawRes = await rewardsPOST(withdrawReq);
      expect(withdrawRes.status).toBe(200);
      const withdrawData = await withdrawRes.json();
      expect(withdrawData.success).toBe(true);
      expect(withdrawData.withdrawnKol).toBe(150);
    });

    it("awards FIRST_API_KEY (+50 KOL) when user creates first API key", async () => {
      const { POST: apiKeysPOST } = await import("@/app/api/console/api-keys/route");
      const keyReq = new NextRequest("http://localhost/api/console/api-keys", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My First Key" }),
      });
      const keyRes = await apiKeysPOST(keyReq);
      expect(keyRes.status).toBe(201);
      const keyData = await keyRes.json();
      expect(keyData.success).toBe(true);
      expect(keyData.rewardGranted).toEqual({
        amount: 50,
        actionType: "FIRST_API_KEY",
      });
    });

    it("rejects direct forgery of GIFT tokens via CLAIM_ACTION", async () => {
      const fakeGiftReq = new NextRequest("http://localhost/api/user/rewards", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLAIM_ACTION",
          action_type: "GIFT",
          amount_kol: 500,
        }),
      });
      const res = await rewardsPOST(fakeGiftReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("GIFT cannot be claimed directly");
    });

    it("executes SEND_GIFT via API and updates both users and message thread", async () => {
      // First fund sender with FIRST_CARD (+150 KOL)
      await rewardsPOST(new NextRequest("http://localhost/api/user/rewards", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLAIM_ACTION", action_type: "FIRST_CARD" }),
      }));

      // Send 30 KOL gift to peer
      const sendGiftReq = new NextRequest("http://localhost/api/user/rewards", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SEND_GIFT",
          recipient: peerWallet,
          amount_kol: 30,
        }),
      });
      const sendRes = await rewardsPOST(sendGiftReq);
      expect(sendRes.status).toBe(200);
      const sendData = await sendRes.json();
      expect(sendData.success).toBe(true);
      expect(sendData.giftRecord.amount_kol).toBe(30);

      // Verify sender now has 120 claimable
      const senderSum = await rewardsGET(new NextRequest("http://localhost/api/user/rewards", { headers: authHeader }));
      const sData = await senderSum.json();
      expect(sData.totalClaimableKol).toBe(120);

      // Verify direct message contains the GIFT card
      const msgRes = await messagesGET(new NextRequest(`http://localhost/api/user/messages?peer=${peerWallet}`, { headers: authHeader }));
      const mData = await msgRes.json();
      const giftMsg = mData.messages.find((m: { msg_type: string }) => m.msg_type === "GIFT");
      expect(giftMsg).toBeDefined();
      expect(giftMsg.metadata.amount).toBe(30);
    });

    it("rejects sending message to oneself", async () => {
      const selfReq = new NextRequest("http://localhost/api/user/messages", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: testWallet,
          content: "Hello me",
        }),
      });
      const res = await messagesPOST(selfReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Cannot send a direct message to yourself");
    });
  });

  describe("/api/auth/email & /api/user/search", () => {
    it("registers/logs in user via email and returns valid session token", async () => {
      const emailReq = new NextRequest("http://localhost/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          email: "tester.charlie@monad.xyz",
          password: "password123",
          name: "Charlie",
        }),
      });
      const res = await emailAuthPOST(emailReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.sessionToken).toBeDefined();
      expect(data.profile.email).toBe("tester.charlie@monad.xyz");
      expect(data.profile.name).toBe("Charlie");

      // Verify login with correct password works
      const loginReq = new NextRequest("http://localhost/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: "tester.charlie@monad.xyz",
          password: "password123",
        }),
      });
      const loginRes = await emailAuthPOST(loginReq);
      expect(loginRes.status).toBe(200);

      // Verify login with wrong password fails
      const badPassReq = new NextRequest("http://localhost/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: "tester.charlie@monad.xyz",
          password: "wrongpassword",
        }),
      });
      const badPassRes = await emailAuthPOST(badPassReq);
      expect(badPassRes.status).toBe(401);
    });

    it("rejects invalid email in email auth", async () => {
      const badReq = new NextRequest("http://localhost/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid-email", password: "password123" }),
      });
      const res = await emailAuthPOST(badReq);
      expect(res.status).toBe(400);

      const shortPassReq = new NextRequest("http://localhost/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "valid@example.com", password: "123" }),
      });
      const shortRes = await emailAuthPOST(shortPassReq);
      expect(shortRes.status).toBe(400);
    });

    it("searches registered users by username and email", async () => {
      // First create two users via emailAuthPOST
      await emailAuthPOST(new NextRequest("http://localhost/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          email: "alice.search@example.com",
          password: "alicepassword",
          name: "Alice Searcher",
        }),
      }));
      await emailAuthPOST(new NextRequest("http://localhost/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          email: "bob.dev@example.com",
          password: "bobpassword",
          name: "Bob Developer",
        }),
      }));

      // Search by name "Searcher"
      const searchReq1 = new NextRequest("http://localhost/api/user/search?q=Searcher", {
        headers: authHeader,
      });
      const res1 = await searchGET(searchReq1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.users.some((u: { email: string }) => u.email === "alice.search@example.com")).toBe(true);

      // Search by email "bob.dev"
      const searchReq2 = new NextRequest("http://localhost/api/user/search?q=bob.dev", {
        headers: authHeader,
      });
      const res2 = await searchGET(searchReq2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.success).toBe(true);
      expect(data2.users.some((u: { email: string }) => u.email === "bob.dev@example.com")).toBe(true);

      // Auto-discovery with empty query
      const discReq = new NextRequest("http://localhost/api/user/search?q=", {
        headers: authHeader,
      });
      const discRes = await searchGET(discReq);
      expect(discRes.status).toBe(200);
      const discData = await discRes.json();
      expect(discData.success).toBe(true);
      expect(discData.users.length).toBeGreaterThan(0);
    });
  });
});

