"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Image as ImageIcon,
  ExternalLink,
  Coins,
  Receipt,
  Gift,
  Loader2,
  Check,
  User,
} from "lucide-react";
import type { DirectMessageRecord, DirectMessageType } from "@/lib/directMessagesDb";

export interface DirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserAddress: string;
  peerAddress: string;
  peerName?: string;
  authToken?: string | null;
  onSendTransfer?: () => void;
}

// Regex to detect HTTP/HTTPS hyperlinks
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Client-side Canvas Image Compression:
 * Scales image to max 600px width and compresses to WebP Base64 (<50KB payload)
 */
export async function compressImageToBase64(
  file: File,
  maxWidth = 600,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Unable to initialize canvas context"));
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Fallback to jpeg if browser doesn't support webp export
        let base64 = canvas.toDataURL("image/webp", quality);
        if (!base64.startsWith("data:image/webp")) {
          base64 = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(base64);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function DirectMessageModal({
  isOpen,
  onClose,
  currentUserAddress,
  peerAddress,
  peerName,
  authToken,
  onSendTransfer,
}: DirectMessageModalProps) {
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [inputContent, setInputContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedExpandedImage, setSelectedExpandedImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch messages between currentUser and peerAddress
  const fetchMessages = React.useCallback(async () => {
    if (!peerAddress) return;
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const res = await fetch(`/api/user/messages?peer=${encodeURIComponent(peerAddress)}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      }
    } catch (e) {
      console.warn("[DirectChat] Message fetch notice:", e);
    }
  }, [peerAddress, authToken]);

  // Initial load
  useEffect(() => {
    if (!isOpen || !peerAddress) return;
    setIsLoadingHistory(true);
    fetchMessages().finally(() => {
      setIsLoadingHistory(false);
      setTimeout(scrollToBottom, 100);
    });
  }, [isOpen, peerAddress, fetchMessages]);

  // Optimistic Polling: 3 seconds lightweight polling while active
  useEffect(() => {
    if (!isOpen || !peerAddress) return;
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, peerAddress, fetchMessages]);


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle local image file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setImagePreview(compressed);
    } catch (err) {
      console.error("Image compression error:", err);
    }
  };

  // Handle clipboard paste (e.g. screenshot paste)
  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
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

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputContent.trim();
    if (!text && !imagePreview) return;

    setIsSending(true);
    const msgType: DirectMessageType = imagePreview ? "IMAGE" : "TEXT";

    // Optimistic local append
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: DirectMessageRecord = {
      id: tempId,
      sender_id: currentUserAddress.toLowerCase(),
      recipient_id: peerAddress.toLowerCase(),
      msg_type: msgType,
      content: text,
      attachment_url: imagePreview,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputContent("");
    setImagePreview(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const res = await fetch("/api/user/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({
          recipient: peerAddress,
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
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const displayName = peerName || `Contact (${peerAddress.slice(0, 6)}...${peerAddress.slice(-4)})`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg h-[600px] flex flex-col rounded-xl border border-purple-500/30 bg-[#0c0d14] shadow-2xl z-10 overflow-hidden font-mono"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-[#836ef9]/20 border border-[#836ef9]/40 flex items-center justify-center text-[#836ef9]">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{displayName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    [ONLINE]
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">{peerAddress}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onSendTransfer && (
                <button
                  onClick={() => {
                    onClose();
                    onSendTransfer();
                  }}
                  className="h-7 px-2.5 rounded-md border border-purple-500/30 bg-[#836ef9]/15 hover:bg-[#836ef9]/25 text-[#00f2fe] text-[11px] font-medium flex items-center gap-1 transition-all"
                  title="Direct Transfer"
                >
                  <Coins className="w-3 h-3 text-[#00f2fe]" />
                  <span>Transfer</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/30">
            {isLoadingHistory && (
              <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#836ef9]" />
                <span>Loading conversation...</span>
              </div>
            )}

            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 text-xs">
                <Receipt className="w-8 h-8 text-slate-600 mb-2" />
                <span>No messages yet. Send a note, link, screenshot, or transfer.</span>
              </div>
            )}

            {messages.map((m) => {
              const isMe = m.sender_id.toLowerCase() === currentUserAddress.toLowerCase();

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 text-xs leading-relaxed ${
                      isMe
                        ? "bg-[#836ef9]/20 border border-[#836ef9]/40 text-purple-100"
                        : "bg-white/5 border border-white/10 text-slate-200"
                    }`}
                  >
                    {/* Render Image Attachment */}
                    {m.attachment_url && (
                      <div className="mb-2 overflow-hidden rounded-md border border-white/10 bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.attachment_url}
                          alt="Attachment"
                          className="max-h-48 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedExpandedImage(m.attachment_url || null)}
                        />
                      </div>
                    )}

                    {/* Render TRANSFER_RECEIPT card */}
                    {m.msg_type === "TRANSFER_RECEIPT" && (
                      <div className="mb-2 p-2.5 rounded-md bg-emerald-950/30 border border-emerald-500/30 text-emerald-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold flex items-center gap-1 text-[11px]">
                            <Coins className="w-3 h-3 text-emerald-400" />
                            <span>Transfer Receipt</span>
                          </span>
                          <span className="text-[10px] text-emerald-400">[CONFIRMED]</span>
                        </div>
                        {m.metadata && (
                          <div className="text-[10px] space-y-0.5 text-emerald-300/80">
                            <div>Amount: {String(m.metadata.amount)} {String(m.metadata.currency || "KOL")}</div>
                            {typeof m.metadata.txHash === "string" && (
                              <div className="truncate">TX: {m.metadata.txHash}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Render GIFT card */}
                    {m.msg_type === "GIFT" && (
                      <div className="mb-2 p-2.5 rounded-md bg-purple-950/40 border border-purple-500/40 text-purple-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold flex items-center gap-1 text-[11px]">
                            <Gift className="w-3 h-3 text-[#00f2fe]" />
                            <span>KOL Red Packet</span>
                          </span>
                          <span className="text-[10px] text-[#00f2fe]">[TOKEN GIFT]</span>
                        </div>
                        <div className="text-[10px] text-purple-300">
                          P2P Gift Card for {String(m.metadata?.amount || "10")} KOL
                        </div>
                      </div>
                    )}

                    {/* Text content with URL auto-linking */}
                    {m.content && (
                      <div className="break-words">
                        {m.content.split(URL_REGEX).map((part, i) => {
                          if (part.match(URL_REGEX)) {
                            return (
                              <a
                                key={i}
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#00f2fe] hover:underline inline-flex items-center gap-0.5 break-all"
                              >
                                <span>{part}</span>
                                <ExternalLink className="w-2.5 h-2.5 inline" />
                              </a>
                            );
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-[9px] text-slate-500 mt-1 px-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview Staging */}
          {imagePreview && (
            <div className="px-4 py-2 bg-black/60 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" className="w-10 h-10 object-cover rounded-md border border-white/20" />
                <span className="text-[11px] text-slate-300">Compressed WebP &lt; 50KB ready</span>
              </div>
              <button
                onClick={() => setImagePreview(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Footer Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-white/10 bg-[#0c0d14] flex items-center gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-9 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              title="Attach screenshot or image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type message or paste screenshot... Enter to send"
              className="flex-1 h-9 px-3 rounded-md border border-white/10 bg-white/5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#836ef9] transition-all"
            />

            <button
              type="submit"
              disabled={isSending || (!inputContent.trim() && !imagePreview)}
              className="h-9 px-3.5 rounded-md border border-purple-500/30 bg-[#836ef9] hover:bg-[#725aeb] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98]"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Send</span>
            </button>
          </form>

          {/* Image Expansion Lightbox */}
          {selectedExpandedImage && (
            <div
              className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4"
              onClick={() => setSelectedExpandedImage(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedExpandedImage}
                alt="Enlarged"
                className="max-w-full max-h-[90vh] object-contain rounded-lg border border-white/20"
              />
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
