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
  MessageSquare,
  Send,
  Image as ImageIcon,
  ExternalLink,
  Coins,
  Gift,
  Check,
  CheckCircle2,
  User,
  UserPlus,
  Search,
  Trash2,
  Copy,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  X,
  Wallet,
  LogIn,
  Receipt,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { isAddress, createPublicClient, formatEther } from "viem";
import { truncateAddress } from "@/lib/utils";
import { useKolianceAuth } from "@/components/Providers";
import { useKolianceAccount } from "@/components/KolianceAuthProvider";
import {
  AccountIdentity,
  effectiveWalletAddress,
} from "@/lib/authState";
import {
  getSessionToken,
  getWalletSessionToken,
  authHeaders,
} from "@/lib/sessionClient";
import {
  compressImageToBase64,
  getImageUrlFromContent,
} from "@/components/DirectMessageModal";
import type { FriendRecord } from "@/lib/friendsDb";
import type { DirectMessageRecord, DirectMessageType } from "@/lib/directMessagesDb";
import {
  monadTestnet,
  monadRpcTransport,
  KOL_TOKEN_ADDRESS,
  KOL_TOKEN_ABI,
} from "@/lib/contract";

// Regex for extracting and styling hyperlinks
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export default function ImPage() {
  const router = useRouter();
  const { authenticated, user, login, logout, isPrivyEnabled } = useKolianceAuth();
  const { state } = useKolianceAccount();

  // Active address resolution
  const connectedWallet = (user?.wallet?.address as `0x${string}`) || null;
  const activeAddress = effectiveWalletAddress(state, connectedWallet);
  const currentSenderId = activeAddress ? activeAddress.toLowerCase() : "";

  // Balances
  const [monBalance, setMonBalance] = useState("0.00");
  const [kolBalance, setKolBalance] = useState("0.00");

  // Contacts / Friends State
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<FriendRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newFriendAddress, setNewFriendAddress] = useState("");
  const [newFriendName, setNewFriendName] = useState("");
  const [friendError, setFriendError] = useState<string | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  // Messages & Chat Stream State
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve auth token
  const authToken = activeAddress
    ? getWalletSessionToken(activeAddress) || getSessionToken()
    : getSessionToken();

  const handleSelectView = (view: NavView) => {
    if (view === "IM") return;
    router.push(`/?view=${view}`);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Copy to clipboard helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Fetch balances
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
    if (!activeAddress || !authToken) return;
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
  }, [activeAddress, authToken]);

  // Fetch Messages for active peer
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
          setMessages(data.messages);
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

  // Initial loads on auth or address change
  useEffect(() => {
    if (activeAddress) {
      fetchBalances();
      fetchRewardsBalance();
      fetchFriends();
    }
  }, [activeAddress, fetchBalances, fetchRewardsBalance, fetchFriends]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add friend handler
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFriendError(null);

    const cleanAddress = newFriendAddress.trim();
    if (!isAddress(cleanAddress)) {
      setFriendError("请输入有效的 0x 开头 42 位 EVM 钱包地址");
      return;
    }

    if (activeAddress && cleanAddress.toLowerCase() === activeAddress.toLowerCase()) {
      setFriendError("无法将自己的钱包地址添加为好友");
      return;
    }

    setIsAddingFriend(true);
    try {
      const res = await fetch("/api/user/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(authToken) },
        body: JSON.stringify({
          friend_wallet: cleanAddress,
          friend_name: newFriendName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.friend) {
        setFriends((prev) => [data.friend, ...prev]);
        setSelectedPeer(data.friend);
        setShowAddFriend(false);
        setNewFriendAddress("");
        setNewFriendName("");
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
    if (!selectedPeer || !activeAddress) return;

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
    if (!selectedPeer || !activeAddress) return;
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
    <div className="min-h-screen flex flex-col justify-between selection:bg-purple-500 selection:text-white bg-gradient-to-b from-[#181d28] via-[#121620] to-[#0c0f16] text-white relative bg-digital-grid">
      {/* Ambient Radial Depth Lighting (Luxury Slate/Gray Gradient) */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(131,110,249,0.14),transparent_65%)]" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_50%_40%_at_85%_25%,rgba(0,242,254,0.07),transparent_55%)]" />
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
        {/* Top Breadcrumb & Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-gradient-to-b from-[#242c3d] via-[#1b2232] to-[#141926] border border-cyan-400/50 text-cyan-300 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_14px_rgba(0,242,254,0.2)]">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>实时通讯录与去中心化即时会话</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gradient-to-r from-cyan-950/80 to-slate-900 border border-cyan-400/50 text-cyan-300 shadow-[inset_0_1px_0_rgba(0,242,254,0.15)]">
                  [LIVE · MONAD TESTNET]
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Web2.5 常用好友通讯录 · 实时图文通信 · 0x 地址防误转 · 链上凭证直达
              </div>
            </div>
          </div>

          {/* Quick Balance & Action Pills */}
          {activeAddress && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-b from-[#222838] to-[#161b26] border border-slate-600/40 text-xs font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <span className="text-slate-400">可用 KOL:</span>
                <span className="text-purple-300 font-bold">{kolBalance}</span>
                <Coins className="w-3.5 h-3.5 text-purple-400 ml-0.5" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-b from-[#222838] to-[#161b26] border border-slate-600/40 text-xs font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <span className="text-slate-400">MON:</span>
                <span className="text-emerald-400 font-bold">{monBalance}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTransferRecipient(selectedPeer?.friend_wallet || "");
                  setTransferCurrency("KOL");
                  setTransferModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-md bg-gradient-to-b from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border border-purple-400/60 text-white text-xs font-mono font-semibold transition shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_12px_rgba(131,110,249,0.3)] active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-purple-200" />
                <span>发起转账</span>
              </button>
            </div>
          )}
        </div>

        {/* Main IM Console Body (Gradient Gray Architectural Container) */}
        <div className="w-full h-[740px] max-h-[80vh] flex rounded-xl border border-slate-600/40 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-b from-[#1e2536] via-[#151a26] to-[#0f131f] backdrop-blur-md">
          {/* Left Column: Contacts & Friends Directory */}
          <div
            className={`w-full md:w-80 lg:w-92 shrink-0 border-r border-slate-700/50 flex flex-col bg-gradient-to-b from-[#1b212f] to-[#121622] ${
              selectedPeer ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Contacts Header */}
            <div className="p-3.5 border-b border-slate-700/50 bg-gradient-to-b from-[#242c3e] to-[#19202e] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white font-mono">
                  常用联系人 ({friends.length})
                </span>
              </div>
              {activeAddress && (
                <button
                  type="button"
                  onClick={() => setShowAddFriend(!showAddFriend)}
                  className="px-2.5 py-1 rounded-md bg-gradient-to-b from-[#222a3d] to-[#171d2b] hover:from-[#2a344c] hover:to-[#1d2537] border border-cyan-400/40 text-cyan-300 text-xs font-mono font-medium transition flex items-center gap-1 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showAddFriend ? "收起" : "添加"}</span>
                </button>
              )}
            </div>

            {/* Add Friend Form (Toggleable) */}
            {showAddFriend && (
              <form
                onSubmit={handleAddFriend}
                className="p-3 border-b border-cyan-500/30 bg-gradient-to-b from-[#1e273b] to-[#151c2a] space-y-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <div className="text-[11px] font-mono text-cyan-300 font-semibold flex items-center gap-1">
                  <UserPlus className="w-3 h-3" />
                  <span>添加 Monad 常用好友</span>
                </div>
                <input
                  type="text"
                  placeholder="0x 钱包地址 (42位)"
                  value={newFriendAddress}
                  onChange={(e) => setNewFriendAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md bg-gradient-to-b from-[#121622] to-[#0d101a] border border-slate-600/50 text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                />
                <input
                  type="text"
                  placeholder="好友备注 / 昵称 (选填)"
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md bg-gradient-to-b from-[#121622] to-[#0d101a] border border-slate-600/50 text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                />
                {friendError && (
                  <div className="text-[10px] text-red-300 font-mono bg-red-950/60 p-1.5 rounded-md border border-red-500/40">
                    {friendError}
                  </div>
                )}
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddFriend(false);
                      setFriendError(null);
                    }}
                    className="px-2.5 py-1 rounded-md bg-gradient-to-b from-[#222938] to-[#171c26] text-slate-300 text-xs font-mono border border-slate-700/50 hover:text-white transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingFriend}
                    className="px-3 py-1 rounded-md bg-gradient-to-b from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 text-xs font-mono font-bold transition disabled:opacity-50 flex items-center gap-1 border border-cyan-300/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] active:scale-95"
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
            )}

            {/* Search Filter Input */}
            <div className="p-2.5 border-b border-slate-700/50 bg-gradient-to-b from-[#1b212f] to-[#141926]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜索好友昵称或 0x 地址..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-gradient-to-b from-[#111520] to-[#0c0f18] border border-slate-700/60 text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Contacts Scroll List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {!activeAddress ? (
                <div className="p-6 text-center text-slate-400 space-y-3">
                  <Wallet className="w-8 h-8 text-purple-400 mx-auto opacity-70" />
                  <div className="text-xs font-mono">连接 Monad 钱包以同步通讯录</div>
                  <button
                    type="button"
                    onClick={() => login()}
                    className="px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-semibold transition"
                  >
                    立即连接
                  </button>
                </div>
              ) : isLoadingFriends ? (
                <div className="p-6 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                  <span className="text-xs font-mono">加载好友通讯录...</span>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="p-6 text-center text-slate-400 space-y-2">
                  <User className="w-8 h-8 text-slate-500 mx-auto opacity-60" />
                  <div className="text-xs font-mono">
                    {searchQuery ? "无匹配的好友" : "暂无常用联系人"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    点击上方「添加」输入 0x 地址即可一键归集
                  </div>
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedPeer?.id === friend.id;
                  return (
                    <div
                      key={friend.id}
                      onClick={() => setSelectedPeer(friend)}
                      className={`p-3 transition flex items-center justify-between cursor-pointer group ${
                        isSelected
                          ? "bg-gradient-to-r from-[#222e44] via-[#1a2436] to-[#141c2b] border-l-2 border-cyan-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "hover:bg-gradient-to-r hover:from-[#212838] hover:to-[#171d2a]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? "bg-gradient-to-b from-[#1b2d42] to-[#111f30] text-cyan-300 border border-cyan-400/60 shadow-[0_0_10px_rgba(0,242,254,0.3)]"
                              : "bg-gradient-to-b from-[#262e3e] to-[#1a202c] text-slate-300 border border-slate-600/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          }`}
                        >
                          {friend.friend_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            <span className="truncate">{friend.friend_name}</span>
                            <span className="text-[9px] font-mono px-1 rounded-sm bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 shrink-0">
                              [LOCKED]
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {truncateAddress(friend.friend_wallet)}
                          </div>
                        </div>
                      </div>

                      {/* Quick Delete Contact */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFriend(friend.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition"
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

          {/* Right Column: Live Conversation Window */}
          <div className="flex-1 flex flex-col bg-gradient-to-b from-[#161c28] via-[#111520] to-[#0c0f18] relative min-w-0">
            {selectedPeer ? (
              <>
                {/* Active Chat Header */}
                <div className="px-4 py-3 border-b border-slate-700/50 bg-gradient-to-b from-[#202738] to-[#171d2b] flex items-center justify-between gap-3 shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Mobile Back Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedPeer(null)}
                      className="md:hidden p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="w-8 h-8 rounded-md bg-gradient-to-b from-[#1c2d42] to-[#121f30] text-cyan-300 border border-cyan-400/60 flex items-center justify-center font-bold text-xs shrink-0 shadow-[0_0_8px_rgba(0,242,254,0.25)]">
                      {selectedPeer.friend_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                        <span className="truncate">{selectedPeer.friend_name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-sm bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 shrink-0">
                          [LOCKED · 信用认证]
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 truncate">
                        <span>{truncateAddress(selectedPeer.friend_wallet)}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedPeer.friend_wallet)}
                          className="hover:text-cyan-300 transition"
                          title="复制完整 0x 地址"
                        >
                          {copiedAddress === selectedPeer.friend_wallet ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <a
                          href={`https://testnet.monadexplorer.com/address/${selectedPeer.friend_wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-cyan-300 flex items-center gap-0.5 transition"
                          title="在 Monad 浏览器中查看"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Header Quick Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTransferRecipient(selectedPeer.friend_wallet);
                        setTransferCurrency("KOL");
                        setTransferModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-md bg-gradient-to-b from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border border-purple-400/50 text-white text-xs font-mono font-medium transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                    >
                      <Coins className="w-3.5 h-3.5 text-purple-200" />
                      <span className="hidden sm:inline">转账 KOL</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGiftDrawer(!showGiftDrawer)}
                      className="px-2.5 py-1.5 rounded-md bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 border border-rose-400/50 text-white text-xs font-mono font-medium transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                    >
                      <Gift className="w-3.5 h-3.5 text-rose-200" />
                      <span className="hidden sm:inline">发红包</span>
                    </button>
                  </div>
                </div>

                {/* Inline P2P Red Packet Gift Drawer */}
                {showGiftDrawer && (
                  <div className="p-3 border-b border-rose-500/30 bg-gradient-to-b from-[#28151f] to-[#1c0e16] flex flex-wrap items-center justify-between gap-3 animate-in fade-in shadow-inner">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-red-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white">
                          发送 KOL 社交红包给 {selectedPeer.friend_name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          扣除链下金库行为奖励余额 · 好友拆开即刻入账并触发视听动效
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
                                ? "bg-rose-600 text-white border border-rose-400 shadow-[0_0_8px_rgba(225,29,72,0.4)]"
                                : "bg-gradient-to-b from-[#20121a] to-[#150a10] text-slate-300 border border-slate-700/50 hover:text-white"
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
                        className="w-18 px-2 py-1 rounded-md bg-gradient-to-b from-[#14080f] to-[#0c0409] border border-rose-500/40 text-xs font-mono text-white text-center focus:outline-none focus:border-rose-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                      />
                      <button
                        type="button"
                        onClick={handleSendGift}
                        disabled={isSendingGift}
                        className="px-3 py-1 rounded-md bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-mono font-semibold transition disabled:opacity-50 border border-rose-400/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-95"
                      >
                        {isSendingGift ? "发送中..." : "确认塞币"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGiftDrawer(false)}
                        className="p-1 rounded-md text-slate-400 hover:text-white transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Scroll Area */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                      <MessageSquare className="w-10 h-10 text-slate-500 opacity-60" />
                      <div className="text-xs font-mono text-slate-300">
                        暂无会话记录，向 {selectedPeer.friend_name} 发送第一条打招呼消息吧
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        支持文本超链接高亮、截图粘贴、Canvas 压缩图文、转账凭据与社交红包
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
                          <div className="text-[10px] font-mono text-slate-400 mb-1 px-1">
                            {isMe ? "我" : selectedPeer.friend_name} ·{" "}
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>

                          {/* Message Bubble Body */}
                          <div
                            className={`p-3 rounded-md text-xs font-sans max-w-[85%] sm:max-w-[70%] break-words shadow-md ${
                              isMe
                                ? "bg-gradient-to-b from-[#382b6e] via-[#2a2055] to-[#201844] border border-purple-400/50 text-purple-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_8px_rgba(131,110,249,0.25)]"
                                : "bg-gradient-to-b from-[#242c3e] to-[#1a2130] border border-slate-600/50 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.3)]"
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
                                        className="text-[#00f2fe] underline hover:text-cyan-200 inline-flex items-center gap-0.5 mx-0.5 font-mono"
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
                              <div className="mt-2 rounded-md overflow-hidden border border-white/20 max-w-[260px] bg-black/40">
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
                              <div className="mt-2 rounded-md overflow-hidden border border-white/20 max-w-[240px] bg-black/40">
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
                              <div className="mt-2 p-2.5 rounded-md bg-gradient-to-b from-[#152322] to-[#0e1919] border border-emerald-500/50 space-y-1.5 font-mono text-[11px] shadow-[inset_0_1px_0_rgba(16,185,129,0.12)]">
                                <div className="flex items-center justify-between text-emerald-400 font-bold">
                                  <span className="flex items-center gap-1">
                                    <Receipt className="w-3.5 h-3.5" />
                                    <span>链上转账凭证</span>
                                  </span>
                                  <span className="text-[9px] bg-emerald-950 px-1.5 py-0.2 rounded-sm border border-emerald-500/30">
                                    [SUCCESS]
                                  </span>
                                </div>
                                <div className="text-white flex items-center justify-between">
                                  <span className="text-slate-400">转账金额:</span>
                                  <span className="font-bold text-emerald-300">
                                    {String(msg.metadata?.amount || "0")}{" "}
                                    {String(msg.metadata?.currency || "KOL")}
                                  </span>
                                </div>
                                {Boolean(msg.metadata?.txHash) && (
                                  <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400">交易哈希:</span>
                                    <a
                                      href={`https://testnet.monadexplorer.com/tx/${String(msg.metadata?.txHash)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-cyan-400 hover:underline flex items-center gap-0.5"
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
                              <div className="mt-2 p-2.5 rounded-md bg-gradient-to-br from-[#301622] via-[#240f1a] to-[#180a11] border border-rose-500/50 space-y-2 font-mono shadow-[0_4px_14px_rgba(225,29,72,0.25)]">
                                <div className="flex items-center justify-between text-red-300 font-bold text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <Gift className="w-4 h-4 text-red-400" />
                                    <span>KOL 社交红包</span>
                                  </span>
                                  <span className="text-white font-bold">
                                    {String(msg.metadata?.amount_kol || msg.metadata?.amount || "10")} KOL
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-300 italic">
                                  &ldquo;恭喜发财，大吉大利&rdquo;
                                </div>
                                {!isMe && (
                                  <button
                                    type="button"
                                    onClick={() => handleClaimGift(msg)}
                                    disabled={claimedGifts.has(msg.id)}
                                    className={`w-full py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer ${
                                      claimedGifts.has(msg.id)
                                        ? "bg-[#20151a] text-slate-500 border border-white/10"
                                        : "bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)] border border-rose-400/50"
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
                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input Area */}
                <div className="p-3 border-t border-slate-700/50 bg-gradient-to-b from-[#1c2232] to-[#141926] shadow-[0_-4px_16px_rgba(0,0,0,0.2)]">
                  {/* Selected Image Preview Pill */}
                  {imagePreview && (
                    <div className="mb-2 relative inline-block rounded-md overflow-hidden border border-cyan-400 max-h-24 bg-black">
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
                      className="p-2 rounded-md bg-gradient-to-b from-[#242c3e] to-[#1a2130] hover:from-[#2c364c] hover:to-[#20283a] border border-slate-600/50 text-slate-200 hover:text-cyan-300 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] cursor-pointer"
                      title="上传图片 (自动压缩 WebP <50KB)"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>

                    {/* Red Packet Trigger */}
                    <button
                      type="button"
                      onClick={() => setShowGiftDrawer(!showGiftDrawer)}
                      className="p-2 rounded-md bg-gradient-to-b from-[#281522] to-[#1e0e18] hover:from-[#341b2c] hover:to-[#251220] border border-rose-500/40 text-rose-300 hover:text-rose-200 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] cursor-pointer"
                      title="发送红包"
                    >
                      <Gift className="w-4 h-4" />
                    </button>

                    {/* Input Field */}
                    <input
                      type="text"
                      placeholder="发送消息... (支持粘贴截图，按 Enter 发送)"
                      value={inputContent}
                      onChange={(e) => setInputContent(e.target.value)}
                      onPaste={handlePaste}
                      className="flex-1 px-3 py-2 rounded-md bg-gradient-to-b from-[#111522] to-[#0c0f18] border border-slate-600/50 text-xs font-sans text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]"
                    />

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={isSending || (!inputContent.trim() && !imagePreview)}
                      className="px-4 py-2 rounded-md bg-gradient-to-b from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 text-xs font-mono font-bold transition disabled:opacity-40 flex items-center gap-1.5 border border-cyan-300/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_8px_rgba(0,242,254,0.35)] active:scale-95 cursor-pointer"
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
                <div className="w-14 h-14 rounded-xl bg-gradient-to-b from-[#242f44] to-[#171f2e] border border-cyan-400/50 text-cyan-300 flex items-center justify-center shadow-[0_0_24px_rgba(0,242,254,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-md">
                  <div className="text-base font-bold text-white font-mono">
                    去中心化端到端通信与链上交互终端
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed font-sans">
                    将常用 0x 钱包地址存储为联系人，彻底告别繁琐的手动复制。支持富文本、Canvas 压缩图文、超链接识别、Monad 链上转账凭据与社交红包。
                  </div>
                </div>

                {!activeAddress ? (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => login()}
                      className="px-5 py-2.5 rounded-md bg-gradient-to-b from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border border-purple-400/50 text-white text-xs font-mono font-bold transition shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>连接 Monad 钱包 / 登录</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddFriend(true)}
                      className="px-4 py-2 rounded-md bg-gradient-to-b from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 border border-cyan-300/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_8px_rgba(0,242,254,0.35)]"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>添加常用联系人</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTransferCurrency("KOL");
                        setTransferModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-md bg-gradient-to-b from-[#242c3e] to-[#192130] hover:from-[#2d374d] hover:to-[#1f283a] border border-slate-600/50 text-slate-200 text-xs font-mono font-semibold transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    >
                      <Send className="w-4 h-4 text-purple-400" />
                      <span>发起快速转账</span>
                    </button>
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
          <div className="relative max-w-3xl max-h-[90vh] rounded-lg overflow-hidden border border-slate-600/50 bg-gradient-to-b from-[#1d2332] to-[#10141e] shadow-2xl">
            <img
              src={selectedExpandedImage}
              alt="Expanded preview"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
            <button
              type="button"
              onClick={() => setSelectedExpandedImage(null)}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-black/70 text-white hover:text-red-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
