import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/session";
import { GET as friendsGET, POST as friendsPOST, DELETE as friendsDELETE } from "@/app/api/user/friends/route";
import { GET as messagesGET, POST as messagesPOST } from "@/app/api/user/messages/route";
import { GET as rewardsGET, POST as rewardsPOST } from "@/app/api/user/rewards/route";
import { resetFriendsDbForTests } from "@/lib/friendsDb";
import { resetDirectMessagesDbForTests } from "@/lib/directMessagesDb";
import { resetRewardsDbForTests } from "@/lib/rewardsDb";

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
  });
});

