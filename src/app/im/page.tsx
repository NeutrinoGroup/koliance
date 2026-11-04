"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { GlobalFooter } from "@/components/GlobalFooter";
import { TransferModal } from "@/components/TransferModal";
import {
  RewardCelebrationModal,
  playCelebrationAudio,
} from "@/components/RewardCelebrationModal";
import {
  MessagesSquare,
  Send,
  Image as ImageIcon,
  ExternalLink,
  Coins,
  Gift,
  Check,
  User,
  UserPlus,
  Search,
  Trash2,
  Copy,
  ArrowLeft,
  Sparkles,
  X,
  Wallet,
  LogIn,
  Receipt,
  Loader2,
  Mail,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { isAddress, createPublicClient, formatEther } from "viem";
import { truncateAddress } from "@/lib/utils";
import { useKolianceAuth } from "@/components/Providers";
import { useKolianceAccount } from "@/components/KolianceAuthProvider";
import {
  effectiveWalletAddress,
  writeAccountState,
} from "@/lib/authState";
import {
  getSessionToken,
  getWalletSessionToken,
  setSessionToken,
  authHeaders,
} from "@/lib/sessionClient";
import {
  compressImageToBase64,
  getImageUrlFromContent,
} from "@/components/DirectMessageModal";
import type { FriendRecord } from "@/lib/friendsDb";
import type { DirectMessageRecord, DirectMessageType } from "@/lib/directMessagesDb";
import type { PublicUserSearchResult } from "@/lib/db";
import {
  monadTestnet,
  monadRpcTransport,
  KOL_TOKEN_ADDRESS,
  KOL_TOKEN_ABI,
} from "@/lib/contract";

// Regex for extracting and styling hyperlinks
const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ImPage() {
  const router = useRouter();
  const { authenticated, user, login, logout } = useKolianceAuth();
  const { state } = useKolianceAccount();

  // Active address resolution (Monad EVM wallet)
  const connectedWallet = (user?.wallet?.address as `0x${string}`) || null;
  const activeAddress = effectiveWalletAddress(state, connectedWallet);

  // Unified Web2.5 Identity Resolution (Email / Google / Wallet)
  const userEmail = state.google?.email || (user as any)?.email?.address || null;
  const userName = state.google?.name || (user as any)?.name || userEmail || null;
  const currentSenderId = (
    activeAddress ||
    state.google?.id ||
    userEmail ||
    user?.id ||
    ""
  ).toLowerCase();

  const isLoggedIn = Boolean(
    activeAddress ||
    state.google ||
    (authenticated && user) ||
    currentSenderId
  );

  // Balances
  const [monBalance, setMonBalance] = useState("0.00");
  const [kolBalance, setKolBalance] = useState("0.00");

  // Contacts / Friends State
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<FriendRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newFriendInput, setNewFriendInput] = useState("");
  const [newFriendName, setNewFriendName] = useState("");
  const [friendError, setFriendError] = useState<string | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  // Live User Search and Auto-Discovery
  const [searchResults, setSearchResults] = useState<PublicUserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [discoveredUsers, setDiscoveredUsers] = useState<PublicUserSearchResult[]>([]);
  const [isLoadingDiscovered, setIsLoadingDiscovered] = useState(false);

  // Messages & Chat Stream State
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [inputContent, setInputContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [selectedExpandedImage, setSelectedExpandedImage] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Red Packet & Dopamine Celebration State
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [giftAmountInput, setGiftAmountInput] = useState("10");
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [availableRewardsKol, setAvailableRewardsKol] = useState<number | null>(null);
  const [claimedGifts, setClaimedGifts] = useState<Set<string>>(new Set());

  // Modals
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState<string>("");
  const [transferCurrency, setTransferCurrency] = useState<"KOL" | "MON">("KOL");
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrationAmount, setCelebrationAmount] = useState("0");
  const [celebrationTitle, setCelebrationTitle] = useState("KOL 奖励已发放");

  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email Auth Modal states
  const [emailAuthModalOpen, setEmailAuthModalOpen] = useState(false);
  const [emailModalMode, setEmailModalMode] = useState<"register" | "login">("register");
  const [emailModalEmail, setEmailModalEmail] = useState("");
  const [emailModalPassword, setEmailModalPassword] = useState("");
  const [emailModalName, setEmailModalName] = useState("");
  const [emailModalError, setEmailModalError] = useState<string | null>(null);
  const [emailModalLoading, setEmailModalLoading] = useState(false);

  // Resolve auth token
  const authToken = activeAddress
    ? getWalletSessionToken(activeAddress) || getSessionToken()
    : getSessionToken();

  // Helper to ensure valid session token exists
  const ensureValidAuthToken = async (): Promise<string | null> => {
    const existing = activeAddress
      ? getWalletSessionToken(activeAddress) || getSessionToken()
      : getSessionToken();
    if (existing) return existing;
    if (!isLoggedIn) return null;

    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentSenderId,
          email: userEmail || undefined,
          name: userName || undefined,
          walletAddress: activeAddress || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.sessionToken) {
        setSessionToken(data.sessionToken);
        return data.sessionToken;
      }
    } catch (err) {
      console.warn("[IM] Auto session mint notice:", err);
    }
    return null;
  };

  const handleEmailModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailModalError(null);
    const cleanEmail = emailModalEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setEmailModalError("请输入有效的邮箱地址");
      return;
    }
    if (emailModalPassword.length < 6) {
      setEmailModalError("密码不得少于 6 位");
      return;
    }

    setEmailModalLoading(true);
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: emailModalMode,
          email: cleanEmail,
          password: emailModalPassword,
          name: emailModalName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.sessionToken) {
          setSessionToken(data.sessionToken);
        }
        if (data.profile) {
          writeAccountState("google", {
            googleId: data.profile.id,
            email: data.profile.email,
            emailVerified: true,
            name: data.profile.name,
            picture: data.profile.picture,
            bio: data.profile.bio,
            walletAddress: data.profile.walletAddress || null,
            trustTier: data.profile.trustTier,
            creditAllowanceUSD: data.profile.creditAllowanceUSD || 600,
          });
        }
        setEmailModalEmail("");
        setEmailModalPassword("");
        setEmailModalName("");
        setEmailAuthModalOpen(false);
        window.dispatchEvent(new Event("koliance:login"));
      } else {
        setEmailModalError(data.error || "认证失败，请重试");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEmailModalError(msg || "网络请求失败");
    } finally {
      setEmailModalLoading(false);
    }
  };

  const handleSelectView = (view: NavView) => {
    if (view === "IM") return;
    router.push(`/?view=${view}`);
  };

  const scrollToBottom = () => {
    if (chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
    }
  };

  // Copy to clipboard helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Fetch balances (only when activeAddress EVM wallet is connected)
  const fetchBalances = useCallback(async () => {
    if (!activeAddress) return;
    try {
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: monadRpcTransport(),
      });

      // MON Native balance
      const rawMon = await publicClient.getBalance({
        address: activeAddress as `0x${string}`,
      });
      setMonBalance(parseFloat(formatEther(rawMon)).toFixed(4));

      // KOL Token balance
      const rawKol = (await publicClient.readContract({
        address: KOL_TOKEN_ADDRESS,
        abi: KOL_TOKEN_ABI,
        functionName: "balanceOf",
        args: [activeAddress as `0x${string}`],
      })) as bigint;
      setKolBalance(parseFloat(formatEther(rawKol)).toFixed(2));
    } catch (err) {
      console.warn("[IM] Balance fetch notice:", err);
    }
  }, [activeAddress]);

  // Fetch claimable rewards balance for P2P gifting
  const fetchRewardsBalance = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch("/api/user/rewards", {
        headers: authHeaders(authToken),
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableRewardsKol(data.claimableKol ?? 0);
      }
    } catch (err) {
      console.warn("[IM] Rewards balance fetch notice:", err);
    }
  }, [authToken]);

  // Fetch Friends List
  const fetchFriends = useCallback(async () => {
    if (!authToken) return;
    setIsLoadingFriends(true);
    try {
      const res = await fetch("/api/user/friends", {
        headers: authHeaders(authToken),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.friends)) {
          setFriends(data.friends);
          // If no peer selected and friends exist, default to first friend
          setSelectedPeer((current) => {
            if (!current && data.friends.length > 0) {
              return data.friends[0];
            }
            return current;
          });
        }
      }
    } catch (err) {
      console.warn("[IM] Friends fetch notice:", err);
    } finally {
      setIsLoadingFriends(false);
    }
  }, [authToken]);

  const prevMsgCountRef = useRef(0);

  // Fetch Messages for active peer with stable identity diffing
  const fetchMessages = useCallback(async () => {
    if (!selectedPeer || !authToken) return;
    try {
      const res = await fetch(
        `/api/user/messages?peer=${encodeURIComponent(selectedPeer.friend_wallet)}&limit=60`,
        { headers: authHeaders(authToken) }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages((prev) => {
            if (prev.length === data.messages.length) {
              const prevLast = prev[prev.length - 1];
              const newLast = data.messages[data.messages.length - 1];
              if (prevLast?.id === newLast?.id && prevLast?.content === newLast?.content) {
                return prev;
              }
            }
            return data.messages;
          });
        }
      }
    } catch (err) {
      console.warn("[IM] Messages fetch notice:", err);
    }
  }, [selectedPeer, authToken]);

  // Polling setup: poll messages every 2.5 seconds when window is visible
  useEffect(() => {
    if (!selectedPeer || !authToken) return;
    fetchMessages();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchMessages();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedPeer, authToken, fetchMessages]);

  // Auto-discover registered platform users for discovery feed
  const fetchDiscoveredUsers = useCallback(async () => {
    if (!authToken) return;
    setIsLoadingDiscovered(true);
    try {
      const res = await fetch("/api/user/search?q=", {
        headers: authHeaders(authToken),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          const filtered = data.users.filter(
            (u: PublicUserSearchResult) =>
              u.id.toLowerCase() !== currentSenderId &&
              (!u.wallet_address || u.wallet_address.toLowerCase() !== currentSenderId) &&
              (!u.email || u.email.toLowerCase() !== currentSenderId)
          );
          setDiscoveredUsers(filtered);
        }
      }
    } catch (err) {
      console.warn("[IM] Discovered users fetch notice:", err);
    } finally {
      setIsLoadingDiscovered(false);
    }
  }, [authToken, currentSenderId]);

  // Initial loads on auth change
  useEffect(() => {
    if (isLoggedIn) {
      if (activeAddress) {
        fetchBalances();
      }
      fetchRewardsBalance();
      fetchFriends();
      fetchDiscoveredUsers();
    }
  }, [isLoggedIn, activeAddress, fetchBalances, fetchRewardsBalance, fetchFriends, fetchDiscoveredUsers]);

  // Reset scroll baseline on peer switch
  useEffect(() => {
    prevMsgCountRef.current = 0;
    scrollToBottom();
  }, [selectedPeer?.id]);

  // Smooth scroll to bottom only when new message count increases
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      scrollToBottom();
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  // Live platform user search debounce
  useEffect(() => {
    const q = newFriendInput.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`/api/user/search?q=${encodeURIComponent(q)}`, {
          headers: authHeaders(authToken),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.users)) {
            setSearchResults(data.users);
          }
        }
      } catch (err) {
        console.warn("[IM] User search error:", err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [newFriendInput, authToken]);

  // Say Hi greeting interaction with confetti animation
  const handleSayHi = async (targetUser: PublicUserSearchResult) => {
    const token = await ensureValidAuthToken();
    if (!token || !isLoggedIn) {
      setEmailModalMode("register");
      setEmailAuthModalOpen(true);
      return;
    }

    const targetId = targetUser.wallet_address || targetUser.email || targetUser.id;
    const targetName = targetUser.name || targetUser.email || "Koliance 用户";
    const greetingText = "你好！很高兴在 Koliance 与你打招呼！";

    // 1. Ensure peer is in friends list
    let peerRecord = friends.find(
      (f) =>
        f.friend_wallet.toLowerCase() === targetId.toLowerCase() ||
        (targetUser.wallet_address && f.friend_wallet.toLowerCase() === targetUser.wallet_address.toLowerCase()) ||
        (targetUser.email && f.friend_wallet.toLowerCase() === targetUser.email.toLowerCase())
    );

    if (!peerRecord) {
      try {
        const res = await fetch("/api/user/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({
            friend_wallet: targetId,
            friend_name: targetName,
          }),
        });
        const data = await res.json();
        if (res.ok && data.friend) {
          peerRecord = data.friend;
          setFriends((prev) => [data.friend, ...prev]);
        }
      } catch (err) {
        console.warn("[IM] Auto-friend on greeting notice:", err);
      }
    }

    // Set as active peer
    const activePeer = peerRecord || {
      id: `temp_${Date.now()}`,
      user_id: currentSenderId,
      friend_wallet: targetId,
      friend_name: targetName,
      created_at: new Date().toISOString(),
    };
    setSelectedPeer(activePeer);
    setShowAddFriend(false);

    // 2. Optimistic push greeting message
    const tempMsgId = `greeting_${Date.now()}`;
    const optimisticMsg: DirectMessageRecord = {
      id: tempMsgId,
      sender_id: currentSenderId,
      recipient_id: targetId.toLowerCase(),
      msg_type: "TEXT",
      content: greetingText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // 3. Send greeting to server
    try {
      const msgRes = await fetch("/api/user/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          recipient: targetId,
          msg_type: "TEXT",
          content: greetingText,
        }),
      });
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        if (msgData.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempMsgId ? msgData.message : m)));
        }
      }
    } catch (err) {
      console.warn("[IM] Send greeting error:", err);
    }

    // 4. Trigger confetti burst
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#836EF9", "#00F2FE", "#10B981"],
      });
    } catch (err) {
      console.warn("[IM] Confetti trigger notice:", err);
    }

    // 5. Dopamine audio feedback
    playCelebrationAudio();
    setTimeout(scrollToBottom, 120);
  };

  // Add friend execution helper
  const executeAddFriend = async (targetIdentifier: string, displayName?: string) => {
    setFriendError(null);
    const clean = targetIdentifier.trim();
    if (!clean) {
      setFriendError("请输入有效的用户名、邮箱或 0x 钱包地址");
      return;
    }

    const token = await ensureValidAuthToken();
    if (!token || !isLoggedIn) {
      setFriendError("请先登录账号后添加好友");
      return;
    }

    let resolvedTarget = clean;
    let resolvedDisplayName = displayName?.trim() || newFriendName.trim() || undefined;

    const isWallet = isAddress(clean);
    const isEmail = EMAIL_REGEX.test(clean);
    const isDid = clean.startsWith("did:");

    if (!isWallet && !isEmail && !isDid) {
      // Query search API to resolve username / nickname
      try {
        const searchRes = await fetch(`/api/user/search?q=${encodeURIComponent(clean)}`, {
          headers: authHeaders(token),
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (Array.isArray(searchData.users) && searchData.users.length > 0) {
            const matched = searchData.users[0];
            resolvedTarget = matched.wallet_address || matched.email || matched.id;
            if (!resolvedDisplayName) resolvedDisplayName = matched.name;
          } else {
            setFriendError("未找到该用户，请输入有效用户名、邮箱或 0x 钱包地址");
            return;
          }
        }
      } catch {
        setFriendError("未检索到匹配用户，请重试");
        return;
      }
    }

    const normTarget = resolvedTarget.toLowerCase();
    if (
      normTarget === currentSenderId.toLowerCase() ||
      (activeAddress && normTarget === activeAddress.toLowerCase()) ||
      (userEmail && normTarget === userEmail.toLowerCase())
    ) {
      setFriendError("无法将自己的钱包地址或当前账号添加为好友");
      return;
    }

    setIsAddingFriend(true);
    try {
      const res = await fetch("/api/user/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          friend_wallet: resolvedTarget,
          friend_name: resolvedDisplayName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.friend) {
        setFriends((prev) => {
          const exists = prev.some((f) => f.friend_wallet.toLowerCase() === data.friend.friend_wallet.toLowerCase());
          return exists ? prev : [data.friend, ...prev];
        });
        setSelectedPeer(data.friend);
        setShowAddFriend(false);
        setNewFriendInput("");
        setNewFriendName("");
        setSearchResults([]);
      } else {
        setFriendError(data.error || "添加好友失败");
      }
    } catch (err) {
      console.error("[IM] Add friend error:", err);
      setFriendError("网络通信异常，请重试");
    } finally {
      setIsAddingFriend(false);
    }
  };

  // Add friend form submit
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeAddFriend(newFriendInput, newFriendName);
  };

  // Delete friend handler
  const handleDeleteFriend = async (friendId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定将该联系人从常用好友中移除？")) return;

    try {
      const res = await fetch(`/api/user/friends?id=${encodeURIComponent(friendId)}`, {
        method: "DELETE",
        headers: authHeaders(authToken),
      });
      if (res.ok) {
        setFriends((prev) => prev.filter((f) => f.id !== friendId));
        if (selectedPeer?.id === friendId) {
          const remaining = friends.filter((f) => f.id !== friendId);
          setSelectedPeer(remaining.length > 0 ? remaining[0] : null);
        }
      }
    } catch (err) {
      console.error("[IM] Delete friend error:", err);
    }
  };

  // Image file select handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setImagePreview(compressed);
    } catch (err) {
      console.error("[IM] Image compression error:", err);
    }
  };

  // Clipboard paste listener for direct screenshot paste
  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const compressed = await compressImageToBase64(file);
          setImagePreview(compressed);
          break;
        }
      }
    }
  };

  // Send message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPeer || !currentSenderId || !authToken) return;

    const text = inputContent.trim();
    if (!text && !imagePreview) return;

    setIsSending(true);
    const msgType: DirectMessageType = imagePreview ? "IMAGE" : "TEXT";

    // Optimistic local push
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: DirectMessageRecord = {
      id: tempId,
      sender_id: currentSenderId,
      recipient_id: selectedPeer.friend_wallet.toLowerCase(),
      msg_type: msgType,
      content: text,
      attachment_url: imagePreview,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputContent("");
    setImagePreview(null);

    try {
      const res = await fetch("/api/user/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(authToken) },
        body: JSON.stringify({
          recipient: selectedPeer.friend_wallet,
          msg_type: msgType,
          content: text,
          attachment_url: optimisticMsg.attachment_url,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
        }
      }
    } catch (err) {
      console.error("[IM] Send message error:", err);
    } finally {
      setIsSending(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  // Send P2P Red Packet Gift
  const handleSendGift = async () => {
    if (!selectedPeer || !currentSenderId || !authToken) return;
    const amountNum = parseFloat(giftAmountInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("请输入有效的赠送 KOL 数量");
      return;
    }

    if (availableRewardsKol !== null && amountNum > availableRewardsKol) {
      alert(`超出当前可赠送 KOL 余额 (当前可用: ${availableRewardsKol} KOL)`);
      return;
    }

    setIsSendingGift(true);
    try {
      const res = await fetch("/api/user/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(authToken) },
        body: JSON.stringify({
          action: "SEND_GIFT",
          recipient: selectedPeer.friend_wallet,
          amount_kol: amountNum,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowGiftDrawer(false);
        fetchRewardsBalance();
        fetchMessages();
        setCelebrationAmount(amountNum.toString());
        setCelebrationTitle("KOL 社交红包已发送");
        setCelebrationOpen(true);
        playCelebrationAudio();
      } else {
        alert(data.error || "发送红包失败");
      }
    } catch (err) {
      console.error("[IM] Send gift error:", err);
      alert("网络异常，无法发送红包");
    } finally {
      setIsSendingGift(false);
    }
  };

  // Unwrap / Claim Red Packet Gift
  const handleClaimGift = (msg: DirectMessageRecord) => {
    if (claimedGifts.has(msg.id)) return;
    setClaimedGifts((prev) => new Set(prev).add(msg.id));

    const metaAmount = msg.metadata?.amount_kol || msg.metadata?.amount || "10";
    setCelebrationAmount(String(metaAmount));
    setCelebrationTitle("恭喜拆开 KOL 社交红包");
    setCelebrationOpen(true);
    playCelebrationAudio();
    fetchRewardsBalance();
  };

  // Filtered contacts list
  const filteredFriends = friends.filter((f) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      f.friend_name.toLowerCase().includes(q) ||
      f.friend_wallet.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-blue-600 selection:text-white bg-[#18191c] text-zinc-100 relative">
      <CursorTrail />

      {/* Top Fixed Navigation */}
      <Navbar
        currentView={"IM" as NavView}
        onSelectView={handleSelectView}
        account={activeAddress ? (activeAddress as `0x${string}`) : null}
        balance={monBalance}
        onConnect={() => login()}
        onDisconnect={() => logout()}
      />

      {/* Main Container */}
      <main className="flex-1 w-full pt-18 sm:pt-20 max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col relative z-10">
        {/* Top Status & Identity Bar (Slack / Feishu Dark Header) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#2b2d31] border border-[#3e4147] text-zinc-300 flex items-center justify-center">
              <MessagesSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>实时通讯录与企业级即时消息</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#2b2d31] border border-[#3e4147] text-zinc-300">
                  [LIVE]
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-sans">
                支持邮箱与用户名搜索 · 实时通信 · 0x 地址防误转 · 链上凭证直达
              </div>
            </div>
          </div>

          {/* Quick Identity, Balances & Action Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeAddress ? (
              <>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2b2d31] border border-[#3e4147] text-xs font-mono">
                  <span className="text-zinc-400">可用 KOL:</span>
                  <span className="text-zinc-100 font-bold">{kolBalance}</span>
                  <Coins className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2b2d31] border border-[#3e4147] text-xs font-mono">
                  <span className="text-zinc-400">MON:</span>
                  <span className="text-emerald-400 font-bold">{monBalance}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTransferRecipient(selectedPeer?.friend_wallet || "");
                    setTransferCurrency("KOL");
                    setTransferModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>发起转账</span>
                </button>
              </>
            ) : isLoggedIn ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2b2d31] border border-[#3e4147] text-xs font-mono text-zinc-300">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{userName || userEmail || "已登录用户"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => login()}
                  className="px-2.5 py-1.5 rounded-md bg-[#2b2d31] hover:bg-[#35373c] border border-[#3e4147] text-zinc-300 text-xs font-mono transition flex items-center gap-1 cursor-pointer"
                  title="绑定钱包以启用转账"
                >
                  <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                  <span>连接钱包转账</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmailModalMode("register");
                    setEmailAuthModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>邮箱注册</span>
                </button>
                <button
                  type="button"
                  onClick={() => login()}
                  className="px-3 py-1.5 rounded-md bg-[#2b2d31] hover:bg-[#35373c] border border-[#3e4147] text-zinc-300 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>第三方登录</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main IM Workspace Console (Feishu / Slack / Discord Architecture) */}
        <div className="w-full h-[740px] max-h-[80vh] flex rounded-lg border border-[#383a40] overflow-hidden shadow-xl bg-[#2b2d31]">
          {/* Left Column: Contacts & Friends Directory */}
          <div
            className={`w-full md:w-80 lg:w-96 shrink-0 border-r border-[#383a40] flex flex-col bg-[#232529] ${
              selectedPeer ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Contacts Header */}
            <div className="p-3.5 border-b border-[#383a40] bg-[#2b2d31] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-zinc-300" />
                <span className="text-xs font-bold text-zinc-100 font-mono">
                  常用联系人 ({friends.length})
                </span>
              </div>
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => setShowAddFriend(!showAddFriend)}
                  className="px-2.5 py-1 rounded-md bg-[#35373c] hover:bg-[#404249] text-zinc-200 text-xs font-mono font-medium transition flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showAddFriend ? "收起" : "添加"}</span>
                </button>
              )}
            </div>

            {/* Add Friend & Platform User Search Drawer */}
            {showAddFriend && (
              <div className="p-3 border-b border-[#383a40] bg-[#2b2d31] space-y-2.5 shadow-sm">
                <div className="text-[11px] font-mono text-zinc-300 font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Search className="w-3 h-3 text-blue-400" />
                    <span>{newFriendInput.trim() ? "平台用户检索" : "发现已注册平台用户"}</span>
                  </span>
                  {(isSearchingUsers || isLoadingDiscovered) && (
                    <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                  )}
                </div>

                <form onSubmit={handleAddFriend} className="space-y-2">
                  <input
                    type="text"
                    placeholder="输入用户名、邮箱或 0x 钱包地址..."
                    value={newFriendInput}
                    onChange={(e) => setNewFriendInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#1e1f22] border border-[#3e4147] text-xs font-mono text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500"
                  />

                  {/* Discovered Users / Search Results List */}
                  {newFriendInput.trim().length > 0 ? (
                    searchResults.length > 0 ? (
                      <div className="rounded-md border border-[#3e4147] bg-[#1e1f22] divide-y divide-[#35373c] max-h-48 overflow-y-auto">
                        <div className="px-2 py-1 text-[10px] font-mono text-zinc-400 bg-[#25272c] flex items-center justify-between">
                          <span>平台检索匹配 ({searchResults.length})</span>
                          <span className="text-[9px] text-zinc-400">点击打招呼即可互动</span>
                        </div>
                        {searchResults.map((usr) => (
                          <div
                            key={usr.id}
                            className="p-2 flex items-center justify-between hover:bg-[#2b2d31] transition text-xs gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                                <span>{usr.name || usr.email}</span>
                                {usr.wallet_address && (
                                  <span className="text-[9px] px-1 py-0.2 rounded-sm bg-[#35373c] text-zinc-300 font-mono">
                                    {truncateAddress(usr.wallet_address)}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono truncate">
                                {usr.email}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleSayHi(usr)}
                                className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-mono font-medium transition active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm"
                                title="发送问候并触发彩带动画"
                              >
                                <Sparkles className="w-3 h-3 text-blue-400" />
                                <span>打招呼</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  executeAddFriend(
                                    usr.wallet_address || usr.email || usr.id,
                                    usr.name || usr.email
                                  )
                                }
                                className="px-2 py-1 rounded-md bg-[#35373c] hover:bg-[#404249] text-zinc-300 text-[11px] font-mono transition cursor-pointer"
                              >
                                添加
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !isSearchingUsers ? (
                      <div className="p-2 rounded-md bg-[#1e1f22] border border-[#3e4147] text-[11px] text-zinc-400 font-mono text-center">
                        未检索到匹配用户，可直接输入 0x 地址或邮箱并点击保存添加
                      </div>
                    ) : null
                  ) : discoveredUsers.length > 0 ? (
                    <div className="rounded-md border border-[#3e4147] bg-[#1e1f22] divide-y divide-[#35373c] max-h-48 overflow-y-auto">
                      <div className="px-2 py-1 text-[10px] font-mono text-zinc-400 bg-[#25272c] flex items-center justify-between">
                        <span>自动发现推荐用户 ({discoveredUsers.length})</span>
                        <span className="text-[9px] text-zinc-400">点击打招呼即可互动</span>
                      </div>
                      {discoveredUsers.map((usr) => (
                        <div
                          key={usr.id}
                          className="p-2 flex items-center justify-between hover:bg-[#2b2d31] transition text-xs gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                              <span>{usr.name || usr.email}</span>
                              {usr.wallet_address && (
                                <span className="text-[9px] px-1 py-0.2 rounded-sm bg-[#35373c] text-zinc-300 font-mono">
                                  {truncateAddress(usr.wallet_address)}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono truncate">
                              {usr.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSayHi(usr)}
                              className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-mono font-medium transition active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm"
                              title="发送问候并触发彩带动画"
                            >
                              <Sparkles className="w-3 h-3 text-blue-400" />
                              <span>打招呼</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                executeAddFriend(
                                  usr.wallet_address || usr.email || usr.id,
                                  usr.name || usr.email
                                )
                              }
                              className="px-2 py-1 rounded-md bg-[#35373c] hover:bg-[#404249] text-zinc-300 text-[11px] font-mono transition cursor-pointer"
                            >
                              添加
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <input
                    type="text"
                    placeholder="自定义备注名称 (选填)"
                    value={newFriendName}
                    onChange={(e) => setNewFriendName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#1e1f22] border border-[#3e4147] text-xs font-mono text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500"
                  />

                  {friendError && (
                    <div className="text-[10px] text-red-400 font-mono bg-red-950/40 p-1.5 rounded-md border border-red-800/40">
                      {friendError}
                    </div>
                  )}

                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddFriend(false);
                        setFriendError(null);
                        setSearchResults([]);
                      }}
                      className="px-2.5 py-1 rounded-md bg-[#1e1f22] text-zinc-400 text-xs font-mono hover:text-white transition cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isAddingFriend || !newFriendInput.trim()}
                      className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium transition disabled:opacity-50 flex items-center gap-1 active:scale-95 cursor-pointer"
                    >
                      {isAddingFriend ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      <span>保存好友</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Contacts Local Filter Box */}
            <div className="p-2.5 border-b border-[#383a40] bg-[#232529]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="筛选好友列表..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-[#1e1f22] border border-[#3e4147] text-xs font-mono text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Contacts Scroll List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#2e3136]">
              {!isLoggedIn ? (
                <div className="p-6 text-center text-zinc-400 space-y-3">
                  <User className="w-8 h-8 text-zinc-500 mx-auto opacity-70" />
                  <div className="text-xs font-sans text-zinc-200 font-semibold">即时通讯仅对注册用户开放</div>
                  <div className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                    请先注册或登录 Koliance 账号后开启畅聊与好友发现
                  </div>
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailModalMode("register");
                        setEmailAuthModalOpen(true);
                      }}
                      className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>邮箱注册 / 登录</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => login()}
                      className="w-full py-2 rounded-md bg-[#35373c] hover:bg-[#404249] border border-[#44474f] text-zinc-200 text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Google / GitHub 登录</span>
                    </button>
                  </div>
                </div>
              ) : isLoadingFriends ? (
                <div className="p-6 text-center text-zinc-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                  <span className="text-xs font-mono">加载通讯录...</span>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 space-y-2">
                  <User className="w-8 h-8 text-zinc-500 mx-auto opacity-60" />
                  <div className="text-xs font-sans">
                    {searchQuery ? "无匹配的好友" : "暂无常用联系人"}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    点击上方「添加」输入用户名、邮箱或 0x 地址
                  </div>
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedPeer?.id === friend.id;
                  const isEVM = isAddress(friend.friend_wallet);
                  return (
                    <div
                      key={friend.id}
                      onClick={() => setSelectedPeer(friend)}
                      className={`p-3 transition flex items-center justify-between cursor-pointer group ${
                        isSelected
                          ? "bg-[#35373c] border-l-2 border-blue-500"
                          : "hover:bg-[#2b2d31]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-[#313338] text-zinc-300 border border-[#3e4147]"
                          }`}
                        >
                          {friend.friend_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 truncate flex items-center gap-1.5">
                            <span className="truncate">{friend.friend_name}</span>
                            {isEVM ? (
                              <span className="text-[9px] font-mono px-1 rounded-sm bg-[#2b2d31] border border-[#3e4147] text-zinc-300 shrink-0">
                                [WALLET]
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono px-1 rounded-sm bg-[#2b2d31] border border-[#3e4147] text-blue-300 shrink-0">
                                [EMAIL]
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400 truncate">
                            {isEVM ? truncateAddress(friend.friend_wallet) : friend.friend_wallet}
                          </div>
                        </div>
                      </div>

                      {/* Quick Delete Contact */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFriend(friend.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition"
                        title="移除联系人"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Live Conversation Window (Feishu / Discord Stream) */}
          <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0">
            {selectedPeer ? (
              <>
                {/* Active Chat Header */}
                <div className="px-4 py-3 border-b border-[#383a40] bg-[#2b2d31] flex items-center justify-between gap-3 shrink-0 shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Mobile Back Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedPeer(null)}
                      className="md:hidden p-1 rounded-md text-zinc-400 hover:text-white"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {selectedPeer.friend_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5 truncate">
                        <span className="truncate">{selectedPeer.friend_name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-sm bg-[#35373c] border border-[#44474f] text-zinc-300 shrink-0">
                          {isAddress(selectedPeer.friend_wallet) ? "[0x VERIFIED]" : "[EMAIL CONTACT]"}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5 truncate">
                        <span>
                          {isAddress(selectedPeer.friend_wallet)
                            ? truncateAddress(selectedPeer.friend_wallet)
                            : selectedPeer.friend_wallet}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedPeer.friend_wallet)}
                          className="hover:text-zinc-200 transition"
                          title="复制完整地址 / 标识"
                        >
                          {copiedAddress === selectedPeer.friend_wallet ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        {isAddress(selectedPeer.friend_wallet) && (
                          <a
                            href={`https://testnet.monadexplorer.com/address/${selectedPeer.friend_wallet}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-400 flex items-center gap-0.5 transition"
                            title="在 Monad 浏览器中查看"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header Quick Actions */}
                  <div className="flex items-center gap-2">
                    {isAddress(selectedPeer.friend_wallet) && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransferRecipient(selectedPeer.friend_wallet);
                          setTransferCurrency("KOL");
                          setTransferModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-md bg-[#35373c] hover:bg-[#404249] border border-[#44474f] text-zinc-200 text-xs font-mono font-medium transition flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Coins className="w-3.5 h-3.5 text-zinc-300" />
                        <span className="hidden sm:inline">转账 KOL</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowGiftDrawer(!showGiftDrawer)}
                      className="px-2.5 py-1.5 rounded-md bg-[#35373c] hover:bg-[#404249] border border-[#44474f] text-zinc-200 text-xs font-mono font-medium transition flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Gift className="w-3.5 h-3.5 text-zinc-300" />
                      <span className="hidden sm:inline">发红包</span>
                    </button>
                  </div>
                </div>

                {/* Inline P2P Red Packet Gift Drawer */}
                {showGiftDrawer && (
                  <div className="p-3 border-b border-[#383a40] bg-[#2b2d31] flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-zinc-100">
                          发送 KOL 社交红包给 {selectedPeer.friend_name}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400">
                          扣除链下金库行为奖励余额 (可用: {availableRewardsKol ?? 0} KOL)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {["10", "50", "100"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setGiftAmountInput(preset)}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition ${
                              giftAmountInput === preset
                                ? "bg-blue-600 text-white"
                                : "bg-[#1e1f22] text-zinc-300 border border-[#3e4147] hover:text-white"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={giftAmountInput}
                        onChange={(e) => setGiftAmountInput(e.target.value)}
                        className="w-18 px-2 py-1 rounded-md bg-[#1e1f22] border border-[#3e4147] text-xs font-mono text-zinc-100 text-center focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSendGift}
                        disabled={isSendingGift}
                        className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium transition disabled:opacity-50 active:scale-95 cursor-pointer"
                      >
                        {isSendingGift ? "发送中..." : "确认发送"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGiftDrawer(false)}
                        className="p-1 rounded-md text-zinc-400 hover:text-white transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Stream Area */}
                <div ref={chatScrollContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-2">
                      <MessagesSquare className="w-10 h-10 text-zinc-500 opacity-60" />
                      <div className="text-xs font-sans text-zinc-300">
                        暂无会话记录，向 {selectedPeer.friend_name} 发送第一条打招呼消息吧
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        支持文本超链接、截图粘贴、Canvas 压缩图文、转账凭据与社交红包
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe =
                        currentSenderId &&
                        msg.sender_id.toLowerCase() === currentSenderId.toLowerCase();
                      const detectedImageUrl = getImageUrlFromContent(msg.content);

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div className="text-[10px] font-mono text-zinc-400 mb-1 px-1">
                            {isMe ? "我" : selectedPeer.friend_name} ·{" "}
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>

                          {/* Message Bubble Body (Feishu/Slack high-contrast clean dark) */}
                          <div
                            className={`p-3 rounded-md text-xs font-sans max-w-[85%] sm:max-w-[70%] break-words shadow-sm ${
                              isMe
                                ? "bg-blue-600 text-white"
                                : "bg-[#2b2d31] border border-[#3e4147] text-zinc-100"
                            }`}
                          >
                            {/* Render Text with Clickable Links */}
                            {msg.content && (
                              <p className="whitespace-pre-wrap leading-relaxed">
                                {msg.content.split(URL_REGEX).map((chunk, idx) => {
                                  if (chunk.match(URL_REGEX)) {
                                    return (
                                      <a
                                        key={idx}
                                        href={chunk}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`${
                                          isMe ? "text-blue-100 underline hover:text-white" : "text-blue-400 underline hover:text-blue-300"
                                        } inline-flex items-center gap-0.5 mx-0.5 font-mono`}
                                      >
                                        <span>{chunk}</span>
                                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                      </a>
                                    );
                                  }
                                  return chunk;
                                })}
                              </p>
                            )}

                            {/* Render Attachment Image (Base64 WebP) */}
                            {msg.attachment_url && (
                              <div className="mt-2 rounded-md overflow-hidden border border-black/20 max-w-[260px] bg-black/40">
                                <img
                                  src={msg.attachment_url}
                                  alt="Attachment"
                                  className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition"
                                  onClick={() => setSelectedExpandedImage(msg.attachment_url || null)}
                                />
                              </div>
                            )}

                            {/* External Image Preview */}
                            {detectedImageUrl && !msg.attachment_url && (
                              <div className="mt-2 rounded-md overflow-hidden border border-black/20 max-w-[240px] bg-black/40">
                                <img
                                  src={detectedImageUrl}
                                  alt="External link preview"
                                  className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition"
                                  onClick={() => setSelectedExpandedImage(detectedImageUrl)}
                                />
                              </div>
                            )}

                            {/* Onchain Transfer Receipt Card */}
                            {msg.msg_type === "TRANSFER_RECEIPT" && (
                              <div className="mt-2 p-2.5 rounded-md bg-[#1f2227] border border-[#3e4147] space-y-1.5 font-mono text-[11px]">
                                <div className="flex items-center justify-between text-emerald-400 font-bold">
                                  <span className="flex items-center gap-1">
                                    <Receipt className="w-3.5 h-3.5" />
                                    <span>链上转账凭证</span>
                                  </span>
                                  <span className="text-[9px] bg-emerald-950 px-1.5 py-0.2 rounded-sm border border-emerald-500/30">
                                    [SUCCESS]
                                  </span>
                                </div>
                                <div className="text-zinc-200 flex items-center justify-between">
                                  <span className="text-zinc-400">转账金额:</span>
                                  <span className="font-bold text-emerald-300">
                                    {String(msg.metadata?.amount || "0")}{" "}
                                    {String(msg.metadata?.currency || "KOL")}
                                  </span>
                                </div>
                                {Boolean(msg.metadata?.txHash) && (
                                  <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px]">
                                    <span className="text-zinc-400">交易哈希:</span>
                                    <a
                                      href={`https://testnet.monadexplorer.com/tx/${String(msg.metadata?.txHash)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:underline flex items-center gap-0.5"
                                    >
                                      <span>{truncateAddress(String(msg.metadata?.txHash))}</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* P2P KOL Red Packet Gift Card */}
                            {msg.msg_type === "GIFT" && (
                              <div className="mt-2 p-2.5 rounded-md bg-[#23272e] border border-[#3e4147] space-y-2 font-mono">
                                <div className="flex items-center justify-between text-zinc-100 font-bold text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <Gift className="w-4 h-4 text-rose-400" />
                                    <span>KOL 社交红包</span>
                                  </span>
                                  <span className="text-zinc-200 font-bold">
                                    {String(msg.metadata?.amount_kol || msg.metadata?.amount || "10")} KOL
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-400">
                                  &ldquo;恭喜发财，大吉大利&rdquo;
                                </div>
                                {!isMe && (
                                  <button
                                    type="button"
                                    onClick={() => handleClaimGift(msg)}
                                    disabled={claimedGifts.has(msg.id)}
                                    className={`w-full py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer ${
                                      claimedGifts.has(msg.id)
                                        ? "bg-[#1e1f22] text-zinc-500 border border-[#383a40]"
                                        : "bg-blue-600 hover:bg-blue-500 text-white"
                                    }`}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>{claimedGifts.has(msg.id) ? "已拆开" : "拆开红包"}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div className="h-1" />
                </div>

                {/* Bottom Input Area */}
                <div className="p-3 border-t border-[#383a40] bg-[#2b2d31]">
                  {/* Selected Image Preview Pill */}
                  {imagePreview && (
                    <div className="mb-2 relative inline-block rounded-md overflow-hidden border border-blue-500 max-h-24 bg-black">
                      <img src={imagePreview} alt="Upload preview" className="h-20 w-auto object-cover" />
                      <button
                        type="button"
                        onClick={() => setImagePreview(null)}
                        className="absolute top-1 right-1 p-0.5 rounded-md bg-black/80 text-white hover:text-red-400 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    {/* Hidden Image File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Image Attachment Trigger */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-md bg-[#35373c] hover:bg-[#404249] text-zinc-300 transition cursor-pointer"
                      title="上传图片 (自动压缩 WebP <50KB)"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>

                    {/* Red Packet Trigger */}
                    <button
                      type="button"
                      onClick={() => setShowGiftDrawer(!showGiftDrawer)}
                      className="p-2 rounded-md bg-[#35373c] hover:bg-[#404249] text-zinc-300 transition cursor-pointer"
                      title="发送红包"
                    >
                      <Gift className="w-4 h-4" />
                    </button>

                    {/* Input Field */}
                    <input
                      type="text"
                      disabled={!isLoggedIn}
                      placeholder={isLoggedIn ? "发送消息... (支持粘贴截图，按 Enter 发送)" : "请先登录账号后发送消息"}
                      value={inputContent}
                      onChange={(e) => setInputContent(e.target.value)}
                      onPaste={handlePaste}
                      className="flex-1 px-3 py-2 rounded-md bg-[#383a40] border border-[#44474f] text-xs font-sans text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={!isLoggedIn || isSending || (!inputContent.trim() && !imagePreview)}
                      className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium transition disabled:opacity-40 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      {isSending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">发送</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              /* No Peer Selected or Guest State */
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-lg bg-[#2b2d31] border border-[#3e4147] text-zinc-300 flex items-center justify-center">
                  <MessagesSquare className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-md">
                  <div className="text-base font-bold text-zinc-100 font-mono">
                    企业级端到端即时通讯与链上交互终端
                  </div>
                  <div className="text-xs text-zinc-400 leading-relaxed font-sans">
                    支持邮箱与用户名搜索、富文本、图文通信、超链接识别、转账凭据与社交红包。
                  </div>
                </div>

                {!isLoggedIn ? (
                  <div className="pt-2 flex items-center gap-2.5 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailModalMode("register");
                        setEmailAuthModalOpen(true);
                      }}
                      className="px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium transition active:scale-95 flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Mail className="w-4 h-4" />
                      <span>邮箱注册 / 登录账号</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => login()}
                      className="px-4 py-2.5 rounded-md bg-[#35373c] hover:bg-[#404249] border border-[#44474f] text-zinc-200 text-xs font-mono font-medium transition active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>第三方登录</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddFriend(true)}
                      className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>添加常用联系人</span>
                    </button>
                    {activeAddress && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransferCurrency("KOL");
                          setTransferModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-md bg-[#35373c] hover:bg-[#404249] border border-[#44474f] text-zinc-200 text-xs font-mono font-medium transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Send className="w-4 h-4" />
                        <span>发起快速转账</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Global Footer */}
      <GlobalFooter />

      {/* Transfer Modal Integration */}
      <TransferModal
        isOpen={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false);
          fetchBalances();
          fetchMessages();
        }}
        initialCurrency={transferCurrency}
        defaultRecipient={transferRecipient}
        senderAddress={activeAddress || ""}
        balance={monBalance}
        onSuccess={() => {
          fetchBalances();
          fetchMessages();
        }}
      />

      {/* Reward & Dopamine Celebration Modal */}
      <RewardCelebrationModal
        isOpen={celebrationOpen}
        onClose={() => setCelebrationOpen(false)}
        rewardAmount={parseFloat(celebrationAmount) || 0}
        title={celebrationTitle}
        rewardCurrency="KOL"
      />

      {/* Lightbox Modal for Expanded Image Preview */}
      {selectedExpandedImage && (
        <div
          onClick={() => setSelectedExpandedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[90vh] rounded-lg overflow-hidden border border-[#383a40] bg-[#2b2d31] shadow-2xl">
            <img
              src={selectedExpandedImage}
              alt="Expanded preview"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
            <button
              type="button"
              onClick={() => setSelectedExpandedImage(null)}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-black/70 text-white hover:text-red-400 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Email Registration & Login Modal */}
      {emailAuthModalOpen && (
        <div
          onClick={() => setEmailAuthModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-[#383a40] bg-[#1c1d22] p-5 shadow-2xl space-y-4 text-white"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-bold font-mono text-zinc-100">
                  {emailModalMode === "register" ? "注册 Koliance 账号" : "邮箱登录 Koliance"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEmailAuthModalOpen(false)}
                className="text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-0.5 rounded-md bg-[#141519] border border-white/10 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setEmailModalMode("register");
                  setEmailModalError(null);
                }}
                className={`py-1 rounded text-center transition font-medium cursor-pointer ${
                  emailModalMode === "register"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                注册新账号
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailModalMode("login");
                  setEmailModalError(null);
                }}
                className={`py-1 rounded text-center transition font-medium cursor-pointer ${
                  emailModalMode === "login"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                已有账号登录
              </button>
            </div>

            {emailModalError && (
              <div className="p-2 rounded-md bg-red-950/70 border border-red-500/50 text-[11px] text-red-300 font-mono">
                {emailModalError}
              </div>
            )}

            <form onSubmit={handleEmailModalSubmit} className="space-y-3">
              {emailModalMode === "register" && (
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    用户昵称 (选填)
                  </label>
                  <input
                    type="text"
                    value={emailModalName}
                    onChange={(e) => setEmailModalName(e.target.value)}
                    placeholder="输入您的昵称"
                    className="w-full px-3 py-2 rounded-md bg-[#141519] border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-400 font-sans"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  邮箱地址
                </label>
                <input
                  type="email"
                  required
                  value={emailModalEmail}
                  onChange={(e) => setEmailModalEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 rounded-md bg-[#141519] border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-400 font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  密码 (至少 6 位)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={emailModalPassword}
                  onChange={(e) => setEmailModalPassword(e.target.value)}
                  placeholder="输入密码"
                  className="w-full px-3 py-2 rounded-md bg-[#141519] border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-400 font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={emailModalLoading}
                className="w-full py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
              >
                {emailModalLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>
                  {emailModalLoading
                    ? "处理中..."
                    : emailModalMode === "register"
                    ? "立即创建账号并登录"
                    : "登录"}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
