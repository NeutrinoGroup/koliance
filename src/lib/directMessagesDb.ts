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

const SAFE_ID_REGEX = /^[a-zA-Z0-9_.:\-@]{1,128}$/;

export function userAliases(id: string): string[] {
  const norm = id.toLowerCase().trim();
  const set = new Set<string>([norm]);
  if (norm.startsWith("did:koliance:email:")) {
    set.add(norm.replace("did:koliance:email:", ""));
  } else if (norm.includes("@") && !norm.startsWith("did:")) {
    set.add(`did:koliance:email:${norm}`);
  }
  if (norm.startsWith("did:koliance:wallet:")) {
    set.add(norm.replace("did:koliance:wallet:", ""));
  } else if (norm.startsWith("0x") && !norm.startsWith("did:")) {
    set.add(`did:koliance:wallet:${norm}`);
  }
  return Array.from(set);
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

  const aliases1 = userAliases(userId1);
  const aliases2 = userAliases(userId2);

  // Security Gate (Prevent PostgREST filter string injection via peer identifier)
  for (const a of [...aliases1, ...aliases2]) {
    if (!SAFE_ID_REGEX.test(a)) {
      console.warn("[DirectMessagesDb] Rejected conversation query with invalid peer ID pattern.");
      return [];
    }
  }

  try {
    // Generate or conditions across aliases
    const orConditions: string[] = [];
    for (const a1 of aliases1) {
      for (const a2 of aliases2) {
        orConditions.push(`and(sender_id.eq.${a1},recipient_id.eq.${a2})`);
        orConditions.push(`and(sender_id.eq.${a2},recipient_id.eq.${a1})`);
      }
    }

    const { data, error } = await supabaseServer()
      .from("direct_messages")
      .select("*")
      .or(orConditions.join(","))
      .order("created_at", { ascending: true })
      .limit(limit);

    if (!error && Array.isArray(data)) {
      return data as DirectMessageRecord[];
    }
  } catch (err) {
    console.warn("[DirectMessagesDb] Supabase query notice (falling back to memory store):", err);
  }

  // Memory fallback
  const set1 = new Set(aliases1);
  const set2 = new Set(aliases2);
  const results: DirectMessageRecord[] = [];

  memoryMessages.forEach((rec) => {
    const s = rec.sender_id.toLowerCase();
    const r = rec.recipient_id.toLowerCase();
    if ((set1.has(s) && set2.has(r)) || (set2.has(s) && set1.has(r))) {
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
