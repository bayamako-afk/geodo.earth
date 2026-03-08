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

/** @type {object|null} パックデータ */
let packData = null;

/** @type {boolean} オートプレイモード */
let autoPlay = false;

/** @type {boolean} 一時停止中 */
let paused = false;

/** @type {number|null} オートプレイタイマー */
let autoTimer = null;

/** @type {boolean} 人間プレイヤーの入力待ち */
let waitingHuman = false;

// ===== グローバル状態（オンライン） =====

/** @type {object|null} Realtime トランスポート */
let _transport = null;

/** @type {object|null} ルーム情報 */
let _roomInfo = null;

/** @type {string|null} game_states レコード ID */
let _gameStateId = null;

/** @type {number} 楽観的ロック用バージョン */
let _version = 1;

/** @type {boolean} オンラインモード中かどうか */
let _isOnline = false;

// ===== DOM ヘルパー =====

const $ = (id) => document.getElementById(id);

// ===== パック読み込み =====

const PACK_URL = "../../assets/guno/routes_guno.json";

async function loadPack() {
  try {
    packData = await loadPackFromUrl(PACK_URL);
    console.log("[V6] Pack loaded:", packData.meta?.name ?? "unknown");
  } catch (e) {
    console.warn("[V6] Pack load failed, using built-in mini pack:", e.message);
    packData = buildMiniPack();
  }
}

function buildMiniPack() {
  const routes = [
    { lc:"JY", name_ja:"山手線",   name_en:"Yamanote",   color:"#00AA00", size:10 },
    { lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", color:"#E60012", size:10 },
    { lc:"G",  name_ja:"銀座線",   name_en:"Ginza",      color:"#F39700", size:10 },
    { lc:"T",  name_ja:"東西線",   name_en:"Tozai",      color:"#009BBF", size:10 },
  ];
  const NAMES = {
    JY: ["渋谷","恵比寿","目黒","五反田","大崎","品川","田町","浜松町","新橋","有楽町"],
    M:  ["池袋","新大塚","茗荷谷","後楽園","本郷三丁目","御茶ノ水","淡路町","大手町","東京","銀座"],
    G:  ["渋谷","表参道","外苑前","青山一丁目","赤坂見附","溜池山王","虎ノ門","新橋","銀座","京橋"],
    T:  ["中野","落合","高田馬場","早稲田","神楽坂","飯田橋","九段下","竹橋","大手町","日本橋"],
  };
  const HUB = {
    JY:[0,0,0,0,0,0,0,0,0,0],
    M: [2,0,0,2,0,0,0,2,2,2],
    G: [2,2,0,0,2,0,0,0,2,0],
    T: [0,0,2,0,0,0,0,0,2,0],
  };
  for (const r of routes) {
    r.members = NAMES[r.lc].map((name, i) => ({
      order:i+1, id:`${r.lc.toLowerCase()}-${i+1}`,
      name_ja:name, name_en:name,
      isHub: HUB[r.lc][i] > 0,
      hub_degree_deck:HUB[r.lc][i], hub_bonus_deck:HUB[r.lc][i], hub_rank_deck:HUB[r.lc][i]>0?"B":"C",
