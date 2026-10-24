import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Database Schema, Indexes & RLS Unification", () => {
  const migrationPath = path.resolve(process.cwd(), "backend/migrations/001_init_and_composite_indexes.sql");
  const rlsMigrationPath = path.resolve(process.cwd(), "backend/migrations/002_enable_rls.sql");

  it("001_init_and_composite_indexes.sql should define all 7 core tables and required composite indexes", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Tables
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS cards");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS card_transactions");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS session_keys");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS game_proofs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS market_orders");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS google_accounts");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS users");

    // Composite indexes
    expect(sql).toContain("idx_cards_wallet_status");
    expect(sql).toContain("idx_card_transactions_card_created");
    expect(sql).toContain("idx_card_transactions_card_status");
    expect(sql).toContain("idx_session_keys_card_frozen_expires");
    expect(sql).toContain("idx_game_proofs_steam_app");
    expect(sql).toContain("idx_google_accounts_email_wallet");
    expect(sql).toContain("idx_users_email_wallet");
  });

  it("002_enable_rls.sql should lock down table access and enable RLS", () => {
    if (fs.existsSync(rlsMigrationPath)) {
      const sql = fs.readFileSync(rlsMigrationPath, "utf-8");
      expect(sql).toContain("ROW LEVEL SECURITY");
      expect(sql).toContain("users");
    }
  });

  it("006_friends_messages_rewards.sql should define friends, direct_messages, and user_rewards with indexes and RLS", () => {
    const migration006Path = path.resolve(process.cwd(), "backend/migrations/006_friends_messages_rewards.sql");
    expect(fs.existsSync(migration006Path)).toBe(true);
    const sql = fs.readFileSync(migration006Path, "utf-8");

    // Tables
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS friends");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS direct_messages");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS user_rewards");

    // Indexes & Unique constraints
    expect(sql).toContain("uq_user_friend UNIQUE(user_id, friend_wallet)");
    expect(sql).toContain("idx_friends_user");
    expect(sql).toContain("idx_messages_pair");
    expect(sql).toContain("idx_rewards_user_status");

    // RLS
    expect(sql).toContain("ROW LEVEL SECURITY");
  });
});

