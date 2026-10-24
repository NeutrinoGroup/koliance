"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ExternalLink,
  Coins,
  UserPlus,
  Users,
  MessagesSquare,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  parseEther,
  formatEther,
  createPublicClient,
  encodeFunctionData,
  isAddress,
} from "viem";
import {
  monadTestnet,
  monadRpcTransport,
  KOL_TOKEN_ADDRESS,
  KOL_TOKEN_ABI,
} from "@/lib/contract";
import { getWalletSessionToken, getSessionToken, authHeaders } from "@/lib/sessionClient";
import type { FriendRecord } from "@/lib/friendsDb";
import { DirectMessageModal } from "@/components/DirectMessageModal";

export interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderAddress: string;
  balance: string; // Native MON balance
  initialCurrency?: "KOL" | "MON";
  defaultRecipient?: string;
  onSuccess?: (txHash: string) => void;
}

export function TransferModal({
  isOpen,
  onClose,
  senderAddress,
  balance,
  initialCurrency = "KOL",
  defaultRecipient,
  onSuccess,
}: TransferModalProps) {
  const [currency, setCurrency] = useState<"KOL" | "MON">(initialCurrency);
  const [kolBalance, setKolBalance] = useState<string>("0.00");
  const [recipient, setRecipient] = useState(defaultRecipient || "");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Friends & Contacts state
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendRecord | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [newFriendName, setNewFriendName] = useState("");
  const [showAddFriendInput, setShowAddFriendInput] = useState(false);

  // Direct Chat modal state
  const [chatPeer, setChatPeer] = useState<{ address: string; name?: string } | null>(null);

  const token = getWalletSessionToken(senderAddress) || getSessionToken();

  useEffect(() => {
    setCurrency(initialCurrency);
    if (defaultRecipient) {
      setRecipient(defaultRecipient);
    }
  }, [initialCurrency, defaultRecipient, isOpen]);

  // Fetch friends list from /api/user/friends
  const fetchFriends = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/user/friends", {
        headers: authHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.friends)) {
          setFriends(data.friends);
        }
      }
    } catch (e) {
      console.warn("[TransferModal] Friends fetch notice:", e);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen && senderAddress) {
      fetchFriends();
    }
  }, [isOpen, senderAddress, fetchFriends]);


  // Fetch user's KOL token balance on Monad
  useEffect(() => {
    if (!isOpen || !senderAddress) return;

    const fetchKolBalance = async () => {
      try {
        const publicClient = createPublicClient({
          chain: monadTestnet,
          transport: monadRpcTransport(),
        });

        const bal = await publicClient.readContract({
          address: KOL_TOKEN_ADDRESS,
          abi: KOL_TOKEN_ABI,
          functionName: "balanceOf",
          args: [senderAddress as `0x${string}`],
        });
        setKolBalance(parseFloat(formatEther(bal)).toFixed(4));
      } catch (err) {
        console.error("Failed to fetch KOL balance in modal:", err);
      }
    };

    fetchKolBalance();
  }, [isOpen, senderAddress]);

  if (!isOpen) return null;

  const currentAvailableBalance = currency === "KOL" ? kolBalance : balance;

  const handleSelectFriend = (friend: FriendRecord) => {
    setSelectedFriend(friend);
    setRecipient(friend.friend_wallet);
    setError(null);
  };

  const handleSaveAsFriend = async () => {
    const cleanRecipient = recipient.trim().toLowerCase();
    if (!isAddress(cleanRecipient)) {
      setError("请输入合法的 0x EVM 地址后再添加到通讯录");
      return;
    }
    if (!token) {
      setError("请先连接并对钱包签名以同步通讯录");
      return;
    }

    setIsAddingFriend(true);
    try {
      const res = await fetch("/api/user/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          friend_wallet: cleanRecipient,
          friend_name: newFriendName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.friend) {
        setFriends((prev) => [data.friend, ...prev]);
        setSelectedFriend(data.friend);
        setShowAddFriendInput(false);
        setNewFriendName("");
      } else {
        setError(data.error || "添加好友失败");
      }
    } catch (err) {
      console.error("Failed to add friend:", err);
      setError("网络异常，无法保存好友");
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTxHash(null);

    const cleanRecipient = recipient.trim();
    if (!isAddress(cleanRecipient)) {
      setError("请输入合法的 0x 开头 42 位 EVM 钱包地址");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("请输入大于 0 的有效转账金额");
      return;
    }

    if (numAmount > parseFloat(currentAvailableBalance || "0")) {
      setError(`转账金额超出可用余额 (${currentAvailableBalance} ${currency})`);
      return;
    }

    if (typeof window === "undefined" || !window.ethereum) {
      setError("未检测到 Web3 钱包 (如 MetaMask)");
      return;
    }

    setIsLoading(true);

    try {
      let hash: `0x${string}`;

      if (currency === "KOL") {
        // Transfer ERC-20 KOL Token directly via MetaMask
        const data = encodeFunctionData({
          abi: KOL_TOKEN_ABI,
          functionName: "transfer",
          args: [cleanRecipient as `0x${string}`, parseEther(amount.trim())],
        });

        hash = (await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: senderAddress,
              to: KOL_TOKEN_ADDRESS,
              data,
            },
          ],
        })) as `0x${string}`;
      } else {
        // Transfer Native MON
        const valueHex = "0x" + parseEther(amount.trim()).toString(16);
        hash = (await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: senderAddress,
              to: cleanRecipient,
              value: valueHex,
            },
          ],
        })) as `0x${string}`;
      }

      setTxHash(hash);
      onSuccess?.(hash);

      // Optimistically push a TRANSFER_RECEIPT to direct messages if token exists
      if (token) {
        fetch("/api/user/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({
            recipient: cleanRecipient,
            msg_type: "TRANSFER_RECEIPT",
            content: `Sent ${amount} ${currency} on Monad testnet.`,
            metadata: {
              txHash: hash,
              amount: amount.trim(),
              currency,
            },
          }),
        }).catch(() => {});
      }
    } catch (err: unknown) {
      console.error("Transfer error:", err);
      const errObj = err as { shortMessage?: string; message?: string };
      setError(errObj?.shortMessage || errObj?.message || "转账交易被拒绝或失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetMax = () => {
    if (currency === "KOL") {
      setAmount(kolBalance);
    } else {
      const balNum = parseFloat(balance || "0");
      const maxVal = Math.max(0, balNum - 0.005).toFixed(4);
      setAmount(maxVal);
    }
  };

  const isCurrentRecipientInFriends = friends.some(
    (f) => f.friend_wallet.toLowerCase() === recipient.trim().toLowerCase()
  );

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Window: Modern SaaS Rectangular micro-radii rounded-lg with gradient gray styling */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-lg rounded-lg bg-gradient-to-b from-[#1e2538] via-[#151a27] to-[#0f131f] border border-slate-600/40 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] text-white z-10 space-y-4 font-mono"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-gradient-to-b from-[#2a2254] to-[#1c163a] border border-purple-400/50 flex items-center justify-center text-[#836ef9] shadow-[0_0_10px_rgba(131,110,249,0.25)]">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Monad 链上极速转账 (Instant Transfer)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    去中心化零信任结算 · 自动匹配常用联系人通讯录
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resident Dual Balance Display Card */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-gradient-to-b from-[#252d40] to-[#1a2130] border border-slate-600/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">KOL Token Balance:</span>
                <span className="text-base font-bold text-[#836ef9]">
                  {kolBalance} <span className="text-xs text-purple-300">KOL</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">MON Native Balance:</span>
                <span className="text-base font-bold text-emerald-400">
                  {balance} <span className="text-xs text-emerald-300">MON</span>
                </span>
              </div>
            </div>

            {/* Tx Success Screen */}
            {txHash ? (
              <div className="p-4 rounded-md bg-emerald-500/10 border border-emerald-400/30 space-y-3 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-xs font-bold text-white">{currency} 转账交易已成功广播！</div>
                <p className="text-[11px] text-slate-300 break-all bg-black/40 p-2 rounded-md">
                  Tx: {txHash}
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <a
                    href={`${monadTestnet.blockExplorers.default.url}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>在区块浏览器中查看</span>
                  </a>
                  {recipient && (
                    <button
                      onClick={() =>
                        setChatPeer({
                          address: recipient,
                          name: selectedFriend?.friend_name,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#836ef9]/20 border border-purple-500/40 text-purple-200 text-xs font-medium transition hover:bg-[#836ef9]/30"
                    >
                      <MessagesSquare className="w-3.5 h-3.5 text-purple-300" />
                      <span>查看聊天凭据</span>
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs text-white transition"
                  >
                    关闭
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTransfer} className="space-y-4">
                {error && (
                  <div className="p-2.5 rounded-md bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-red-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Currency Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">选择转账币种 (Currency)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency("KOL");
                        setAmount("");
                      }}
                      className={`h-9 px-3 rounded-md border flex items-center justify-center gap-2 text-xs font-bold transition active:scale-[0.98] ${
                        currency === "KOL"
                          ? "bg-[#836ef9] border-[#836ef9] text-white shadow-md shadow-[#836ef9]/30"
                          : "bg-black/30 border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5 text-purple-200" />
                      <span>KOL Token ({kolBalance})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrency("MON");
                        setAmount("");
                      }}
                      className={`h-9 px-3 rounded-md border flex items-center justify-center gap-2 text-xs font-bold transition active:scale-[0.98] ${
                        currency === "MON"
                          ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30"
                          : "bg-black/30 border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      <Send className="w-3.5 h-3.5 text-emerald-200" />
                      <span>MON Native ({balance})</span>
                    </button>
                  </div>
                </div>

                {/* Friends Quick Drawer (Horizontal Quick Picker) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#00f2fe]" />
                      <span>常用联系人 / 好友通讯录 (Quick Contacts)</span>
                    </span>
                    {friends.length > 0 && (
                      <span className="text-[10px] text-slate-500">{friends.length} 位联系人</span>
                    )}
                  </div>

                  {friends.length > 0 ? (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                      {friends.map((f) => {
                        const isSelected =
                          selectedFriend?.id === f.id ||
                          recipient.toLowerCase() === f.friend_wallet.toLowerCase();

                        return (
                          <div
                            key={f.id}
                            onClick={() => handleSelectFriend(f)}
                            className={`shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-all active:scale-[0.97] ${
                              isSelected
                                ? "bg-[#836ef9]/25 border-[#836ef9] text-white"
                                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                            }`}
                          >
                            {/* Avatar Initials */}
                            <div className="w-5 h-5 rounded-sm bg-[#836ef9]/30 border border-[#836ef9]/50 flex items-center justify-center text-[10px] font-bold text-[#00f2fe]">
                              {f.friend_name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-[11px] leading-tight">
                                {f.friend_name}
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {f.friend_wallet.slice(0, 4)}...{f.friend_wallet.slice(-4)}
                              </span>
                            </div>
                            <span className="text-[8px] px-1 py-0.2 rounded-sm bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              [VERIFIED]
                            </span>

                            {/* Direct IM Trigger button inside card */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setChatPeer({
                                  address: f.friend_wallet,
                                  name: f.friend_name,
                                });
                              }}
                              className="p-1 rounded-sm bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 transition"
                              title="发起IM消息"
                            >
                              <MessagesSquare className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-md bg-white/[0.02] border border-white/10 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>暂未添加常用联系人，可直接输入地址并保存</span>
                    </div>
                  )}
                </div>

                {/* Recipient Address */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <label>接收方地址 (Recipient Address)</label>
                    {isAddress(recipient.trim()) && (
                      <div className="flex items-center gap-2">
                        {/* Direct Chat Shortcut */}
                        <button
                          type="button"
                          onClick={() =>
                            setChatPeer({
                              address: recipient.trim(),
                              name: selectedFriend?.friend_name,
                            })
                          }
                          className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <MessagesSquare className="w-2.5 h-2.5" />
                          <span>发起消息</span>
                        </button>

                        {/* Save Friend Button if not in list */}
                        {!isCurrentRecipientInFriends && (
                          <button
                            type="button"
                            onClick={() => setShowAddFriendInput(!showAddFriendInput)}
                            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <UserPlus className="w-2.5 h-2.5" />
                            <span>保存为常用好友</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedFriend ? (
                    <div className="flex items-center justify-between p-2.5 rounded-md bg-[#836ef9]/15 border border-[#836ef9]/40 text-xs font-mono">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-6 h-6 rounded-sm bg-[#836ef9]/30 border border-[#836ef9]/50 flex items-center justify-center text-[10px] font-bold text-[#00f2fe] shrink-0">
                          {selectedFriend.friend_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-xs truncate">{selectedFriend.friend_name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0">
                              <ShieldCheck className="w-2.5 h-2.5 text-[#00f2fe]" />
                              [LOCKED · 信用认证]
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate">{selectedFriend.friend_wallet}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFriend(null);
                          setRecipient("");
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 text-[10px] ml-2 shrink-0 transition"
                        title="解除锁定并重新输入"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="0x..."
                      value={recipient}
                      onChange={(e) => {
                        setRecipient(e.target.value);
                        setSelectedFriend(null);
                      }}
                      className="w-full h-9 px-3 rounded-md bg-black/40 border border-white/15 focus:border-[#836ef9] focus:outline-none text-xs text-white placeholder-slate-500 transition-all"
                      required
                    />
                  )}

                  {/* Add Friend Nickname Drawer */}
                  {showAddFriendInput && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="输入好友备注名称 (如: Alice)"
                        value={newFriendName}
                        onChange={(e) => setNewFriendName(e.target.value)}
                        className="flex-1 h-8 px-2.5 rounded-md bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveAsFriend}
                        disabled={isAddingFriend}
                        className="h-8 px-3 rounded-md border border-emerald-500/40 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-xs font-semibold flex items-center gap-1 transition-all"
                      >
                        {isAddingFriend ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                        <span>保存</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <label>转账数量 (Amount {currency})</label>
                    <button
                      type="button"
                      onClick={handleSetMax}
                      className="text-[10px] text-purple-300 hover:text-purple-200 underline"
                    >
                      最大 ({currentAvailableBalance} {currency})
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="0.0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full h-9 px-3 pr-14 rounded-md bg-black/40 border border-white/15 focus:border-[#836ef9] focus:outline-none text-xs text-white placeholder-slate-500 transition-all"
                      required
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold pointer-events-none">
                      {currency}
                    </span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 flex items-center justify-center gap-2 px-4 rounded-md bg-[#836ef9] hover:bg-[#725aeb] border border-purple-400/40 text-white text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>钱包确认中...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4" />
                      <span>确认发送 {currency} 转账</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Direct Chat Modal */}
      {chatPeer && (
        <DirectMessageModal
          isOpen={Boolean(chatPeer)}
          onClose={() => setChatPeer(null)}
          currentUserAddress={senderAddress}
          peerAddress={chatPeer.address}
          peerName={chatPeer.name}
          authToken={token}
          onSendTransfer={() => {
            setRecipient(chatPeer.address);
          }}
        />
      )}
    </>
  );
}
