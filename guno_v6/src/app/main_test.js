/**
 * guno_v6/src/app/main.js
 * GUNO V6 エントリーポイント（Phase 6: オンライン対戦統合版）
 *
 * アーキテクチャ（単方向データフロー）:
 *   User Action → Engine → State → UI Render
 *
 * イベント登録方針:
 *   - インラインonclickは一切使用しない
 *   - 全てのUIイベントはDOMContentLoaded内でaddEventListenerにより登録する
 *   - window._gunoAppブリッジパターンは使用しない
 *
 * オンライン対戦（host-authoritative）:
 *   Host: game_states テーブルを更新 → Realtime で全員に配信
 *   Guest: Broadcast でアクションを Host に送信
 */

// ===== Import =====

import GUNO_V6_CONFIG from "../../config.js";
import { loadPackFromUrl } from "../data/pack_loader.js";
import {
  initGame, playCard, drawCard, passTurn, endTurn, runCpuTurn,
} from "../core/game_engine.js";
import { getPlayableIndices } from "../core/rules.js";
import { serializeState, deserializeState } from "../core/serializers.js";
import { renderHands, renderDiscardPile, renderDeckCount } from "../ui/hand.js";
import { renderBoard, renderStatusBar } from "../ui/board.js";
import { logEvent, clearLog, toggleLog } from "../ui/log.js";
import { showResult, hideResult } from "../ui/result.js";
import { mountRoomPanel, injectRoomPanelStyles } from "../ui/room_panel.js";
import { createTransport } from "../net/transport_supabase.js";
import {
  saveInitialGameState, updateGameState, fetchGameState,
  getSessionId,
} from "../net/room_client.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ===== Supabase クライアント =====

const _supabase = createClient(
  GUNO_V6_CONFIG.supabase.url,
  GUNO_V6_CONFIG.supabase.anonKey
);

// ===== グローバル状態（ローカル） =====

/** @type {object|null} ゲーム状態 */
let gameState = null;

