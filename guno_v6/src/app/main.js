/**
 * guno_v6/src/app/main.js
 * GUNO V6 アプリケーション エントリーポイント
 *
 * Phase 1: v6-foundation
 * - Supabase 接続の確認
 * - rooms / game_states テーブルへの疎通確認
 * - Realtime 接続の確認
 * - 今後のモジュール（core, data, net, ui）の初期化ポイント
 */

import GUNO_V6_CONFIG from "../../config.js";

// ===== DOM ヘルパー =====
const $ = (id) => document.getElementById(id);

function setStatus(html) {
  const el = $("status-message");
  if (el) el.innerHTML = html;
}

function setBadge(id, ok, label) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = ok
    ? `<span class="badge-ok">✓ ${label}</span>`
    : `<span class="badge-pending">⚠ ${label}</span>`;
}

// ===== Supabase クライアント初期化 =====
let supabase = null;

function initSupabase() {
  const { url, anonKey } = GUNO_V6_CONFIG.supabase;
  // グローバルに読み込まれた supabase-js UMD を使用
  if (typeof window.supabase === "undefined") {
    throw new Error("Supabase JS SDK が読み込まれていません");
  }
  supabase = window.supabase.createClient(url, anonKey);
  $("info-url").textContent = url.replace("https://", "").replace(".supabase.co", "…");
  return supabase;
}

// ===== テーブル疎通確認 =====
async function checkTable(tableName) {
  const { error } = await supabase
    .from(tableName)
    .select("id", { count: "exact", head: true });
  return !error;
}

// ===== Realtime 接続確認 =====
async function checkRealtime() {
  return new Promise((resolve) => {
    const channel = supabase
      .channel("v6_foundation_check")
      .on("system", { event: "connected" }, () => {
        supabase.removeChannel(channel);
        resolve(true);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          supabase.removeChannel(channel);
          resolve(true);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          supabase.removeChannel(channel);
          resolve(false);
        }
      });

    // タイムアウト: 5秒
    setTimeout(() => {
      supabase.removeChannel(channel);
      resolve(false);
    }, 5000);
  });
}

// ===== メイン初期化 =====
async function main() {
  setStatus("Supabase に接続中...");

  try {
    // 1. Supabase クライアント初期化
    initSupabase();

    // 2. テーブル疎通確認（並列）
    const [roomsOk, gameStatesOk] = await Promise.all([
      checkTable(GUNO_V6_CONFIG.tables.rooms),
      checkTable(GUNO_V6_CONFIG.tables.gameStates),
    ]);

    setBadge("info-rooms", roomsOk, roomsOk ? "OK" : "エラー");
    setBadge("info-game-states", gameStatesOk, gameStatesOk ? "OK" : "エラー");

    // 3. Realtime 接続確認
    const realtimeOk = await checkRealtime();
    setBadge("info-realtime", realtimeOk, realtimeOk ? "OK" : "エラー");

    // 4. 総合ステータス表示
    const allOk = roomsOk && gameStatesOk && realtimeOk;

    if (allOk) {
      setStatus(
        `<span class="ok">✓ Supabase 接続成功</span><br>` +
        `<span style="color:#888; font-size:0.9rem;">rooms / game_states テーブルおよび Realtime が正常に動作しています。</span><br><br>` +
        `<span class="highlight">GUNO V6</span> の基盤が整いました。<br>` +
        `<span style="color:#888; font-size:0.85rem;">次のステップ: Phase 2 — Pack v1.0 ローダーの実装</span>`
      );
    } else {
      const issues = [];
      if (!roomsOk) issues.push("rooms テーブル");
      if (!gameStatesOk) issues.push("game_states テーブル");
      if (!realtimeOk) issues.push("Realtime");
      setStatus(
        `<span class="error">⚠ 一部の接続に問題があります</span><br>` +
        `<span style="color:#888; font-size:0.9rem;">問題: ${issues.join(", ")}</span>`
      );
    }

  } catch (err) {
    console.error("[GUNO V6] 初期化エラー:", err);
    setStatus(
      `<span class="error">✗ 初期化に失敗しました</span><br>` +
      `<span style="color:#888; font-size:0.85rem;">${err.message}</span>`
    );
  }
}

// ===== エントリーポイント =====
// DOM 読み込み完了後に main() を実行
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

/**
 * 今後のモジュール統合ポイント（Phase 2〜6 で順次実装）
 *
 * Phase 2: import { loadPack } from "../data/pack_loader.js";
 * Phase 3: import { initGame, playCard, drawCard } from "../core/game_engine.js";
 * Phase 4: import { calculateScore } from "../core/scoring.js";
 * Phase 5: import { renderHand, renderBoard } from "../ui/hand.js";
 * Phase 6: import { createRoom, joinRoom } from "../net/room_client.js";
 *          import { connect } from "../net/transport_supabase.js";
 */
