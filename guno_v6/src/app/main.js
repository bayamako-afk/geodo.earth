/**
 * guno_v6/src/app/main.js
 * GUNO V6 エントリーポイント（Phase 5: ローカル対戦プロトタイプ）
 *
 * アーキテクチャ（単方向データフロー）:
 *   User Action → Engine → State → UI Render
 *
 * Phase 6 以降で net/room_client.js を統合してオンライン対戦に拡張する。
 */

import GUNO_V6_CONFIG from "../../config.js";
import { loadPackFromUrl } from "../data/pack_loader.js";
import {
  initGame, playCard, drawCard, passTurn, endTurn, runCpuTurn,
} from "../core/game_engine.js";
import { getPlayableIndices } from "../core/rules.js";
import { renderHands, renderDiscardPile, renderDeckCount } from "../ui/hand.js";
import { renderBoard, renderStatusBar, renderHint } from "../ui/board.js";
import { logEvent, clearLog, toggleLog } from "../ui/log.js";
import { showResult, hideResult } from "../ui/result.js";

// ===== グローバル状態 =====

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

// ===== DOM 要素 =====

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

/**
 * フォールバック用ミニパックを生成する。
 */
function buildMiniPack() {
  const routes = [
    { lc:"JY", name_ja:"山手線", name_en:"Yamanote", color:"#00AA00", size:10 },
    { lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", color:"#E60012", size:10 },
    { lc:"G",  name_ja:"銀座線", name_en:"Ginza", color:"#F39700", size:10 },
    { lc:"T",  name_ja:"東西線", name_en:"Tozai", color:"#009BBF", size:10 },
  ];

  const NAMES = {
    JY: ["渋谷","恵比寿","目黒","五反田","大崎","品川","田町","浜松町","新橋","有楽町"],
    M:  ["池袋","新大塚","茗荷谷","後楽園","本郷三丁目","御茶ノ水","淡路町","大手町","東京","銀座"],
    G:  ["渋谷","表参道","外苑前","青山一丁目","赤坂見附","溜池山王","虎ノ門","新橋","銀座","京橋"],
    T:  ["中野","落合","高田馬場","早稲田","神楽坂","飯田橋","九段下","竹橋","大手町","日本橋"],
  };

  const HUB = { JY:[0,0,0,0,0,0,0,0,0,0], M:[2,0,0,2,0,0,0,2,2,2], G:[2,2,0,0,2,0,0,0,2,0], T:[0,0,2,0,0,0,0,0,2,0] };

  for (const r of routes) {
    r.members = NAMES[r.lc].map((name, i) => ({
      order: i+1, id:`${r.lc.toLowerCase()}-${i+1}`,
      name_ja: name, name_en: name,
      isHub: HUB[r.lc][i] > 0,
      hub_degree_deck: HUB[r.lc][i], hub_bonus_deck: HUB[r.lc][i], hub_rank_deck: HUB[r.lc][i] > 0 ? "B" : "C",
      hub_degree_global: 1, hub_bonus_global: 0, hub_rank_global: "C",
    }));
  }

  const stations = [];
  for (const r of routes) {
    for (const s of r.members) {
      stations.push({ lc:r.lc, name_ja:r.name_ja, name_en:r.name_en, color:r.color,
        order:s.order, st_ja:s.name_ja, st_en:s.name_en, file:`${r.lc}_${s.order}`, ...s });
    }
  }

  const teidenMap = Object.fromEntries(routes.map(r => [r.lc, `${r.lc}_TEIDEN`]));

  return {
    meta: { pack_id:"mini_v6", pack_version:"1.0", name:"GUNO V6 Mini Pack", description:"Built-in fallback pack" },
    routes, stations, teidenMap, raw:{},
  };
}

// ===== UI 全体更新 =====

function renderAll() {
  if (!gameState || !packData) return;

  const { players, turnIndex, deck, discardPile, mapState, lastHits, teidenPlayed, direction, turnCount, gameOver } = gameState;
  const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const currentPlayer = players[turnIndex];
  const playableIndices = (!gameOver && waitingHuman)
    ? getPlayableIndices(players[0].hand, topCard)
    : [];

  // ボード
  renderBoard({ packData, mapState, players, lastHits, teidenPlayed, topCard });

  // 捨て札・デッキ
  renderDiscardPile($("discard-pile"), topCard);
  renderDeckCount($("draw-pile-visual"), deck.length, waitingHuman && playableIndices.length === 0 && deck.length > 0);

  // 手札
  renderHands({
    container: $("players-area"),
    players, turnIndex, gameOver,
    playableIndices, isWaitingHuman: waitingHuman, autoPlay, mapState,
    onCardClick: handleCardClick,
  });

  // ステータス・ヒント
  renderStatusBar($("statusBar"), { turnCount, deckCount: deck.length, direction, currentPlayer, gameOver });
  renderHint($("hint-area"), { gameOver, isWaitingHuman: waitingHuman, playableIndices, deckCount: deck.length, currentPlayer });
}

// ===== ゲームイベントハンドラ =====

function emit(event) {
  logEvent($("log"), event);
  if (event.type === "game_over") {
    renderAll();
    showResult({
      overlayEl: $("result-overlay"),
      tableEl:   $("result-table"),
      players:   gameState.players,
      mapState:  gameState.mapState,
      stationsDB: packData.stations ?? [],
      onRestart: startGame,
    });
  }
}

// ===== 人間プレイヤーの操作 =====

function handleCardClick(cardIdx) {
  if (!waitingHuman || gameState.gameOver) return;
  waitingHuman = false;
  playCard(gameState, 0, cardIdx, emit);
  renderAll();
  if (!gameState.gameOver) {
    endTurn(gameState, emit);
    renderAll();
    scheduleNextTurn();
  }
}

function handleDrawClick() {
  if (!waitingHuman || gameState.gameOver) return;
  const topCard = gameState.discardPile.at(-1) ?? null;
  const playable = getPlayableIndices(gameState.players[0].hand, topCard);
  if (playable.length > 0) return; // 出せるカードがある場合はドロー不可
  waitingHuman = false;
  drawCard(gameState, 0, emit);
  renderAll();
  // ドロー後に出せるカードがあれば再度待機
  const newTopCard = gameState.discardPile.at(-1) ?? null;
  const newPlayable = getPlayableIndices(gameState.players[0].hand, newTopCard);
  if (newPlayable.length > 0) {
    waitingHuman = true;
    renderAll();
    return;
  }
  passTurn(gameState, 0, emit);
  renderAll();
  if (!gameState.gameOver) {
    endTurn(gameState, emit);
    renderAll();
    scheduleNextTurn();
  }
}

// ===== ターン進行 =====

function scheduleNextTurn() {
  if (gameState.gameOver) return;
  const { players, turnIndex } = gameState;
  const current = players[turnIndex];

  if (current.isHuman && !autoPlay) {
    waitingHuman = true;
    renderAll();
    return;
  }

  // CPU ターン
  const delay = autoPlay ? 300 : 600;
  autoTimer = setTimeout(() => {
    if (paused || gameState.gameOver) return;
    runCpuTurn(gameState, emit);
    renderAll();
    if (!gameState.gameOver) {
      endTurn(gameState, emit);
      renderAll();
      scheduleNextTurn();
    }
  }, delay);
}

// ===== ゲーム開始 =====

export async function startGame() {
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  waitingHuman = false;
  paused = false;
  hideResult($("result-overlay"));
  clearLog($("log"));

  if (!packData) await loadPack();

  const playerConfigs = [
    { name:"あなた", icon:"🌊", color:"#174a7c", isHuman:true  },
    { name:"CPU-1",  icon:"🌸", color:"#b52942", isHuman:false },
    { name:"CPU-2",  icon:"🌙", color:"#e6b422", isHuman:false },
    { name:"CPU-3",  icon:"🏯", color:"#745399", isHuman:false },
  ];

  gameState = initGame({ packData, playerConfigs });
  renderAll();
  scheduleNextTurn();
}

// ===== オートプレイ切り替え =====

export function toggleAuto() {
  autoPlay = !autoPlay;
  const btn = $("btn-mode");
  if (btn) {
    btn.textContent = `▶ AUTO: ${autoPlay ? "ON" : "OFF"}`;
    btn.className = autoPlay ? "btn-auto-on" : "btn-auto-off";
  }
  if (autoPlay && waitingHuman) {
    waitingHuman = false;
    scheduleNextTurn();
  }
}

// ===== 一時停止 =====

export function togglePause() {
  paused = !paused;
  const btn = $("btn-pause");
  if (btn) {
    btn.textContent = paused ? "▶ 再開" : "⏸ 停止";
    btn.className = paused ? "btn-pause-paused" : "btn-pause-active";
  }
  if (!paused && !waitingHuman && gameState && !gameState.gameOver) {
    scheduleNextTurn();
  }
}

// ===== グローバル公開（HTML の onclick から呼ぶ） =====

window.startGame    = startGame;
window.toggleAuto   = toggleAuto;
window.togglePause  = togglePause;
window.toggleLog    = toggleLog;
window.confirmNewGame = () => {
  if (gameState && !gameState.gameOver && gameState.turnCount > 0) {
    if (!confirm("新しいゲームを始めますか？\n現在のゲームは終了します。")) return;
  }
  startGame();
};

// ===== デッキクリックイベント =====

document.addEventListener("DOMContentLoaded", () => {
  const drawPileEl = $("draw-pile-visual");
  if (drawPileEl) {
    drawPileEl.addEventListener("click", handleDrawClick);
  }
  startGame();
});

// ===== Phase 6 統合ポイント =====
// TODO: import { RoomClient } from "../net/room_client.js";
// TODO: import { TransportSupabase } from "../net/transport_supabase.js";
// TODO: import { RoomPanel } from "../ui/room_panel.js";
