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
      hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C",
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
    meta:{ pack_id:"mini_v6", pack_version:"1.0", name:"GUNO V6 Mini Pack", description:"Built-in fallback" },
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

  renderBoard({ packData, mapState, players, lastHits, teidenPlayed, topCard });
  renderDiscardPile($("discard-pile"), topCard);
  renderDeckCount($("draw-pile-visual"), deck.length, waitingHuman && playableIndices.length === 0 && deck.length > 0);
  renderHands({
    container: $("players-area"),
    players, turnIndex, gameOver,
    playableIndices, isWaitingHuman: waitingHuman, autoPlay, mapState,
    onCardClick: handleCardClick,
  });
  // V5小指: statusBarにヒントを統合（hint-areaは山手符あれば使用）
  const statusEl = $("statusBar");
  if (statusEl) {
    if (gameOver) {
      statusEl.textContent = "対局終了";
      statusEl.classList.remove("is-warning", "is-danger", "is-paused");
    } else if (waitingHuman) {
      if (playableIndices.length > 0) {
        statusEl.textContent = "💡 出せるカードをタップ";
        statusEl.classList.remove("is-warning", "is-danger", "is-paused");
      } else if (deck.length > 0) {
        statusEl.textContent = "💡 DECKをタップして1枚引く";
        statusEl.classList.remove("is-warning", "is-danger", "is-paused");
      } else {
        statusEl.textContent = "💡 パス（出せるカードなし）";
        statusEl.classList.remove("is-warning", "is-danger", "is-paused");
      }
    } else {
      renderStatusBar(statusEl, { turnCount, deckCount: deck.length, direction, currentPlayer, gameOver });
    }
  }
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

  if (_isOnline && !_roomInfo?.isHost) {
    // ゲスト: アクションをホストに送信
    _transport?.sendAction({ type: "play_card", cardIndex: cardIdx, session_id: getSessionId() });
    return;
  }

  playCard(gameState, 0, cardIdx, emit);
  renderAll();
  if (!gameState.gameOver) {
    endTurn(gameState, emit);
    renderAll();
    if (_isOnline && _roomInfo?.isHost) broadcastState();
    scheduleNextTurn();
  }
}

function handleDrawClick() {
  if (!waitingHuman || gameState.gameOver) return;
  const topCard = gameState.discardPile.at(-1) ?? null;
  const playable = getPlayableIndices(gameState.players[0].hand, topCard);
  if (playable.length > 0) return;

  if (_isOnline && !_roomInfo?.isHost) {
    _transport?.sendAction({ type: "draw_card", session_id: getSessionId() });
    return;
  }

  waitingHuman = false;
  drawCard(gameState, 0, emit);
  renderAll();
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
    if (_isOnline && _roomInfo?.isHost) broadcastState();
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

  const delay = autoPlay ? 300 : 600;
  autoTimer = setTimeout(() => {
    if (paused || gameState.gameOver) return;
    runCpuTurn(gameState, emit);
    renderAll();
    if (!gameState.gameOver) {
      endTurn(gameState, emit);
      renderAll();
      if (_isOnline && _roomInfo?.isHost) broadcastState();
      scheduleNextTurn();
    }
  }, delay);
}

// ===== ゲーム開始（ローカル） =====

async function startGame() {
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  waitingHuman = false;
  paused = false;
  _isOnline = false;
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

function toggleAuto() {
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

function togglePause() {
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

// ===== 新規ゲーム確認 =====

function confirmNewGame() {
  if (gameState && !gameState.gameOver && gameState.turnCount > 0) {
    if (!confirm("新しいゲームを始めますか？\n現在のゲームは終了します。")) return;
  }
  startGame();
}

// ===== オンラインルームパネルを開く =====

function openOnlineRoom() {
  const container = $("room-panel-container");
  if (!container) return;
  // トグル: 既に開いている場合は閉じる
  if (container.style.display === "block") {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }
  injectRoomPanelStyles();
  container.style.display = "block";
  mountRoomPanel({
    container,
    supabase: _supabase,
    onGameStart: handleOnlineGameStart,
  });
}

// ===== Phase 6: オンライン対戦 =====

/**
 * ルームパネルからゲーム開始コールバック。
 * @param {{ room, sessionId, playerIndex, isHost, players }} info
 */
async function handleOnlineGameStart(info) {
  _roomInfo = info;
  _isOnline = true;
  const { room, sessionId, playerIndex, isHost, players } = info;

  // ルームパネルを閉じる
  const container = $("room-panel-container");
  if (container) {
    container.innerHTML = "";
    container.style.display = "none";
  }

  // パックを読み込む
  if (!packData) await loadPack();

  // トランスポートを接続
  _transport = await createTransport(_supabase, room.id, {
    isHost,
    playerName: players[playerIndex]?.name ?? "Player",
    playerIcon: players[playerIndex]?.icon ?? "🌊",
  });

  if (isHost) {
    // ホスト: ゲームを初期化して Supabase に保存
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    waitingHuman = false;
    paused = false;
    hideResult($("result-overlay"));
    clearLog($("log"));

    const playerConfigs = players.map(p => ({
      name: p.name,
      icon: p.icon,
      color: p.color ?? "#174a7c",
      isHuman: p.session_id === sessionId,
    }));

    gameState = initGame({ packData, playerConfigs });
    const serialized = serializeState(gameState);
    const record = await saveInitialGameState(_supabase, room.id, serialized);
    _gameStateId = record.id;
    _version = record.version;

    // ゲストのアクションを受け取って処理する
    _transport.onGuestAction = handleGuestAction;

    renderAll();
    scheduleNextTurn();
  } else {
    // ゲスト: Realtime でホストの状態更新を待つ
    _transport.onStateUpdate = (state) => {
      gameState = deserializeState(state);
      _version = state._version ?? _version;
      _gameStateId = state._gameStateId ?? _gameStateId;
      renderAll();
    };

    // 既存の状態を取得（ゲーム開始済みの場合）
    const existing = await fetchGameState(_supabase, room.id);
    if (existing?.state_json) {
      const s = typeof existing.state_json === "string"
        ? JSON.parse(existing.state_json) : existing.state_json;
      gameState = deserializeState(s);
      _gameStateId = existing.id;
      _version = existing.version;
      renderAll();
    }
  }
}

/**
 * ホストがゲストのアクションを受け取って処理する。
 */
function handleGuestAction(action) {
  if (!gameState || gameState.gameOver) return;
  const { players } = gameState;
  const pIdx = players.findIndex(p => p.sessionId === action.session_id);
  if (pIdx < 0 || pIdx !== gameState.turnIndex) return;

  if (action.type === "play_card" && action.cardIndex != null) {
    playCard(gameState, pIdx, action.cardIndex, emit);
  } else if (action.type === "draw_card") {
    drawCard(gameState, pIdx, emit);
  } else if (action.type === "pass_turn") {
    passTurn(gameState, pIdx, emit);
  }

  endTurn(gameState, emit);
  broadcastState();
  renderAll();
  scheduleNextTurn();
}

/**
 * ホストがゲーム状態を Supabase に保存してブロードキャストする。
 */
async function broadcastState() {
  if (!_gameStateId || !_roomInfo?.isHost) return;
  try {
    const serialized = serializeState(gameState);
    const record = await updateGameState(
      _supabase, _gameStateId, serialized, _version, "turn"
    );
    _version = record.version;
  } catch (e) {
    console.warn("[V6] broadcastState error:", e.message);
  }
}

// ===== DOMContentLoaded: 全UIイベントをaddEventListenerで登録 =====

document.addEventListener("DOMContentLoaded", () => {
  // デッキ（山札）クリック → カードを引く
  const drawPileEl = $("draw-pile-visual");
  if (drawPileEl) drawPileEl.addEventListener("click", handleDrawClick);

  // ログボタン
  const btnLog = $("btn-log");
  if (btnLog) btnLog.addEventListener("click", () => toggleLog());

  // ログを閉じるボタン
  const btnCloseLog = $("btn-close-log");
  if (btnCloseLog) btnCloseLog.addEventListener("click", () => toggleLog());

  // 新規ゲームボタン
  const btnNew = $("btn-new");
  if (btnNew) btnNew.addEventListener("click", confirmNewGame);

  // オートプレイ切り替えボタン
  const btnMode = $("btn-mode");
  if (btnMode) btnMode.addEventListener("click", toggleAuto);

  // 一時停止ボタン
  const btnPause = $("btn-pause");
  if (btnPause) btnPause.addEventListener("click", togglePause);

  // 結果オーバーレイ: もう一度遊ぶ
  const btnRestart = $("btn-restart");
  if (btnRestart) btnRestart.addEventListener("click", startGame);

  // 結果オーバーレイ: 閉じる
  const btnCloseResult = $("btn-close-result");
  if (btnCloseResult) btnCloseResult.addEventListener("click", () => hideResult($("result-overlay")));

  // V6追加: オンラインボタン
  const btnOnline = $("btn-online");
  if (btnOnline) btnOnline.addEventListener("click", openOnlineRoom);

  // ゲーム開始
  startGame();
});
