import { describe, it, expect, beforeEach } from "vitest";
import { addFriend, listFriends, removeFriend, resetFriendsDbForTests } from "@/lib/friendsDb";
import { createDirectMessage, listDirectMessages, resetDirectMessagesDbForTests } from "@/lib/directMessagesDb";
import { recordUserReward, getUserRewards, withdrawRewards, resetRewardsDbForTests, MIN_WITHDRAW_THRESHOLD_KOL } from "@/lib/rewardsDb";

describe("Data Layer Tests: Friends, Direct Messages & User Rewards", () => {
  beforeEach(() => {
    resetFriendsDbForTests();
    resetDirectMessagesDbForTests();
    resetRewardsDbForTests();
  });

  describe("Friends Address Book", () => {
    const userId = "did:koliance:wallet:0x1111111111111111111111111111111111111111";
    const friendWallet = "0x2222222222222222222222222222222222222222";

    it("adds a friend and lists it", async () => {
      const res = await addFriend(userId, friendWallet, "Alice");
      expect(res.success).toBe(true);
      expect(res.friend?.friend_name).toBe("Alice");
      expect(res.friend?.friend_wallet).toBe(friendWallet.toLowerCase());

      const friends = await listFriends(userId);
      expect(friends.length).toBe(1);
      expect(friends[0].friend_wallet).toBe(friendWallet.toLowerCase());
    });

    it("rejects invalid wallet address", async () => {
      const res = await addFriend(userId, "invalid_address");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid 0x EVM wallet address");
    });

    it("rejects duplicate friend in address book", async () => {
      await addFriend(userId, friendWallet, "Alice");
      const res = await addFriend(userId, friendWallet, "Alice 2");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Friend already in address book");
    });

    it("removes a friend", async () => {
      await addFriend(userId, friendWallet, "Alice");
      const ok = await removeFriend(userId, friendWallet);
      expect(ok).toBe(true);

      const friends = await listFriends(userId);
      expect(friends.length).toBe(0);
    });
  });

  describe("Direct Messages", () => {
    const userA = "0x1111111111111111111111111111111111111111";
    const userB = "0x2222222222222222222222222222222222222222";

    it("creates and retrieves direct messages between two peers", async () => {
      const msg1 = await createDirectMessage({
        sender_id: userA,
        recipient_id: userB,
        msg_type: "TEXT",
        content: "Hello from Alice!",
      });
      expect(msg1.success).toBe(true);

      const msg2 = await createDirectMessage({
        sender_id: userB,
        recipient_id: userA,
        msg_type: "TEXT",
        content: "Hi Alice, received!",
      });
      expect(msg2.success).toBe(true);

      const history = await listDirectMessages(userA, userB);
      expect(history.length).toBe(2);
      expect(history[0].content).toBe("Hello from Alice!");
      expect(history[1].content).toBe("Hi Alice, received!");
    });

    it("supports image attachments and receipts", async () => {
      const imgMsg = await createDirectMessage({
        sender_id: userA,
        recipient_id: userB,
        msg_type: "IMAGE",
        content: "Screenshot",
        attachment_url: "data:image/webp;base64,mockbase64content",
      });
      expect(imgMsg.success).toBe(true);
      expect(imgMsg.message?.attachment_url).toBe("data:image/webp;base64,mockbase64content");

      const receiptMsg = await createDirectMessage({
        sender_id: userA,
        recipient_id: userB,
        msg_type: "TRANSFER_RECEIPT",
        content: "Transfer completed",
        metadata: {
          txHash: "0x1234567890abcdef",
          amount: "10.5",
          currency: "KOL",
        },
      });
      expect(receiptMsg.success).toBe(true);
      expect(receiptMsg.message?.metadata?.amount).toBe("10.5");
    });
  });

  describe("User Rewards & Anti-Sybil Ledger", () => {
    const userId = "did:koliance:wallet:0x1111111111111111111111111111111111111111";

    it("grants wallet bind reward (+100 KOL) only once (anti-sybil)", async () => {
      const first = await recordUserReward(userId, "WALLET_BIND");
      expect(first.alreadyClaimed).toBe(false);
      expect(first.reward?.amount_kol).toBe(100);

      // Attempt second claim
      const second = await recordUserReward(userId, "WALLET_BIND");
      expect(second.alreadyClaimed).toBe(true);
      expect(second.reward).toBeNull();

      const summary = await getUserRewards(userId);
      expect(summary.totalClaimableKol).toBe(100);
      expect(summary.rewards.length).toBe(1);
    });

    it("grants first card (+150 KOL) and first API key (+50 KOL)", async () => {
      await recordUserReward(userId, "FIRST_CARD");
      await recordUserReward(userId, "FIRST_API_KEY");

      const summary = await getUserRewards(userId);
      expect(summary.totalClaimableKol).toBe(200);
      expect(summary.totalEarnedKol).toBe(200);
    });

    it("handles 10% card cashback and multi-grant accumulation", async () => {
      // 10% of $25 USD = 2.5 KOL
      await recordUserReward(userId, "CARD_CASHBACK_10", 2.5);
      // Stripe topup 1 USD : 10 KOL, say 5 USD -> 50 KOL
      await recordUserReward(userId, "STRIPE_TOPUP", 50);

      const summary = await getUserRewards(userId);
      expect(summary.totalClaimableKol).toBe(52.5);
    });

    it("enforces minimum threshold (50 KOL) on withdrawal", async () => {
      await recordUserReward(userId, "CARD_CASHBACK_10", 10);
      // Only 10 KOL, should fail withdrawal
      const failRes = await withdrawRewards(userId, "0x1111111111111111111111111111111111111111");
      expect(failRes.success).toBe(false);
      expect(failRes.error).toContain(`Minimum withdrawal threshold is ${MIN_WITHDRAW_THRESHOLD_KOL} KOL`);

      // Add more to pass threshold
      await recordUserReward(userId, "WALLET_BIND"); // +100
      const okRes = await withdrawRewards(userId, "0x1111111111111111111111111111111111111111");
      expect(okRes.success).toBe(true);
      expect(okRes.withdrawnKol).toBe(110);

      const updated = await getUserRewards(userId);
      expect(updated.totalClaimableKol).toBe(0);
      expect(updated.totalEarnedKol).toBe(110);
    });
  });
});
