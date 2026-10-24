import { supabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

export type DirectMessageType = "TEXT" | "IMAGE" | "TRANSFER_RECEIPT" | "GIFT";

export interface DirectMessageRecord {
  id: string;
  sender_id: string;
  recipient_id: string;
  msg_type: DirectMessageType;
  content: string;
  attachment_url?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// In-memory fallback cache when Supabase database is offline or in local test environment
const memoryMessages = new Map<string, DirectMessageRecord>();

export function resetDirectMessagesDbForTests(): void {
  memoryMessages.clear();
}

/**
 * List conversation messages between two users / peers
 */
export async function listDirectMessages(
  userId1: string,
  userId2: string,
  limit: number = 50
): Promise<DirectMessageRecord[]> {
  if (!userId1 || !userId2) return [];

  const norm1 = userId1.toLowerCase();
  const norm2 = userId2.toLowerCase();

  try {
    // Check messages where (sender = norm1 AND recipient = norm2) OR (sender = norm2 AND recipient = norm1)
    const { data, error } = await supabaseServer()
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${norm1},recipient_id.eq.${norm2}),and(sender_id.eq.${norm2},recipient_id.eq.${norm1})`
      )
      .order("created_at", { ascending: true })
      .limit(limit);

    if (!error && Array.isArray(data)) {
      return data as DirectMessageRecord[];
    }
  } catch (err) {
    console.warn("[DirectMessagesDb] Supabase query notice (falling back to memory store):", err);
  }

  // Memory fallback
  const results: DirectMessageRecord[] = [];
  memoryMessages.forEach((rec) => {
    const s = rec.sender_id.toLowerCase();
    const r = rec.recipient_id.toLowerCase();
    if ((s === norm1 && r === norm2) || (s === norm2 && r === norm1)) {
      results.push(rec);
    }
  });

  return results
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-limit);
}

/**
 * Send a new direct message
 */
export async function createDirectMessage(params: {
  sender_id: string;
  recipient_id: string;
  msg_type?: DirectMessageType;
  content: string;
  attachment_url?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; message?: DirectMessageRecord; error?: string }> {
  const { sender_id, recipient_id, msg_type = "TEXT", content, attachment_url, metadata = {} } = params;

  if (!sender_id || !recipient_id) {
    return { success: false, error: "Sender and recipient are required" };
  }
  if (!content && !attachment_url && msg_type !== "GIFT") {
    return { success: false, error: "Content or attachment is required" };
  }

  const id = `msg_${crypto.randomBytes(12).toString("hex")}`;
  const now = new Date().toISOString();

  const record: DirectMessageRecord = {
    id,
    sender_id: sender_id.toLowerCase(),
    recipient_id: recipient_id.toLowerCase(),
    msg_type,
    content: content || "",
    attachment_url: attachment_url || null,
    metadata,
    created_at: now,
  };

  try {
    const { data, error } = await supabaseServer()
      .from("direct_messages")
      .insert(record)
      .select()
      .single();

    if (!error && data) {
      return { success: true, message: data as DirectMessageRecord };
    }
  } catch (err) {
    console.warn("[DirectMessagesDb] Supabase insert notice (falling back to memory store):", err);
  }

  memoryMessages.set(id, record);
  return { success: true, message: record };
}
