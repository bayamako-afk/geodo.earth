// guno_v6/src/app/main.js
// GUNO V6 Main Entry Point
//
// Responsibility:
//   - Bootstrap the application
//   - Load GUNO Pack (built-in inline pack for local demo)
//   - Wire the game engine to the UI components
//   - Manage the game loop (human input / CPU auto-play)
//
// Architecture: Unidirectional data flow
//   User action → engine function → new State → renderAll()

import { loadPack } from "../data/pack_loader.js";
import {
  initGame,
  playCard,
  drawCard,
  passTurn,
  getPlayableForCurrentPlayer,
  getCurrentPlayer,
  getTopCard,
} from "../core/game_engine.js";
import { calculateAllScores } from "../core/scoring.js";
import { renderDiscardPile, renderDeck, renderDirection, renderRouteSlots } from "../ui/board.js";
import { renderPlayers } from "../ui/hand.js";
import { renderLog } from "../ui/log.js";
import { LINE_INFO, CPU_TURN_DELAY_MS, PASS_ADVANCE_DELAY_MS } from "../shared/constants.js";
import { BUILT_IN_PACK } from "../data/packs/tokyo4.js";

// ─────────────────────────────────────────
// App state (mutable, local to this module)
// ─────────────────────────────────────────

let gameState = null;
let loadedPack = null;
let isWaitingHuman = false;
let isAutoPlay = false;
let cpuTimer = null;

// ─────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function setHint(msg) {
  const el = $("hint-area");
  if (el) el.textContent = msg;
}

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

function renderAll() {
  if (!gameState || !loadedPack) return;

  const topCard = getTopCard(gameState);
  const scores = calculateAllScores(gameState, loadedPack);
  const playableIndices = isWaitingHuman ? getPlayableForCurrentPlayer(gameState) : [];

  // Hint
  if (gameState.gameOver) {
    setHint("🏁 ゲーム終了！");
  } else if (isWaitingHuman) {
    if (playableIndices.length > 0) setHint("💡 出せるカードをタップ");
    else if (gameState.deck.length > 0) setHint("💡 DECKをタップして1枚引く");
    else setHint("💡 パス");
  } else {
    setHint(`待ち: ${getCurrentPlayer(gameState).name} の番`);
  }

  // Board
  renderDiscardPile($("discard-pile"), topCard);
  renderDeck(
    $("deck-count"),
    gameState.deck.length,
    isWaitingHuman && playableIndices.length === 0 && gameState.deck.length > 0
  );
  renderDirection($("direction-arrow"), gameState.direction);

  // Route slots
  for (const lc of Object.keys(LINE_INFO)) {
    renderRouteSlots(
      $(`slots-${lc.toLowerCase()}`),
      $(`header-${lc.toLowerCase()}`),
      lc,
      LINE_INFO[lc],
      gameState,
      gameState.players,
      loadedPack.stations
    );
  }

  // Players / hands
  renderPlayers(
    $("players-area"),
    gameState,
    playableIndices,
    isWaitingHuman,
    isAutoPlay,
    scores,
    onHumanPlay
  );

  // Log
  renderLog($("game-log"), gameState.log);

  // Result overlay
  if (gameState.gameOver) {
    showResultOverlay(scores);
  }
}

// ─────────────────────────────────────────
// Result overlay
// ─────────────────────────────────────────

function showResultOverlay(scores) {
  const overlay = $("result-overlay");
  if (!overlay) return;
  overlay.style.display = "flex";

  const table = $("result-table");
  if (!table) return;

  let rows = "";
  scores.forEach((s, rank) => {
    const style = rank === 0 ? 'style="color:gold; font-weight:bold;"' : "";
    const p = gameState.players[s.playerIndex];
    rows += `<tr ${style}>
      <td>${rank + 1}</td>
      <td>${p.icon} ${p.name}</td>
      <td>${s.total}</td>
      <td>${s.stationCount}</td>
      <td>${s.gunoCount}</td>
      <td>${s.gunoPoints}</td>
      <td>${s.hubBonusDeck}</td>
    </tr>`;
  });

  table.innerHTML = `
    <thead>
      <tr>
        <th>順位</th><th>Player</th><th>Total</th>
        <th>Stations</th><th>GUNO</th><th>GUNO pts</th><th>Hub Bonus</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}

// ─────────────────────────────────────────
// Game loop
// ─────────────────────────────────────────

function nextTurn() {
  if (!gameState || gameState.gameOver) return;

  const player = getCurrentPlayer(gameState);
  if (player.status !== "active") {
    // Skip eliminated player
    const { state } = passTurn(gameState, gameState.turnIndex);
    gameState = state;
    nextTurn();
    return;
  }

  renderAll();

  const playable = getPlayableForCurrentPlayer(gameState);
  const hasDeck = gameState.deck.length > 0;

  if (player.isHuman && !isAutoPlay) {
    isWaitingHuman = true;
    renderAll();
  } else {
    isWaitingHuman = false;
    cpuTimer = setTimeout(playCPUTurn, CPU_TURN_DELAY_MS);
  }
}

function playCPUTurn() {
  if (!gameState || gameState.gameOver) return;

  const playable = getPlayableForCurrentPlayer(gameState);

  if (playable.length > 0) {
    const { state, events } = playCard(gameState, gameState.turnIndex, playable[0]);
    gameState = state;
  } else if (gameState.deck.length > 0) {
    const { state, events, turnPassed } = drawCard(gameState, gameState.turnIndex);
    gameState = state;
    if (turnPassed) {
      renderAll();
      setTimeout(nextTurn, PASS_ADVANCE_DELAY_MS);
      return;
    }
    // Try to play after draw
    const playableAfter = getPlayableForCurrentPlayer(gameState);
    if (playableAfter.length > 0) {
      const { state: s2 } = playCard(gameState, gameState.turnIndex, playableAfter[0]);
      gameState = s2;
    }
  } else {
    const { state } = passTurn(gameState, gameState.turnIndex);
    gameState = state;
  }

  renderAll();
  if (!gameState.gameOver) {
    setTimeout(nextTurn, PASS_ADVANCE_DELAY_MS);
  }
}

// ─────────────────────────────────────────
// Human actions
// ─────────────────────────────────────────

function onHumanPlay(cardIndex) {
  if (!isWaitingHuman || gameState.turnIndex !== 0) return;
  isWaitingHuman = false;

  const { state, events } = playCard(gameState, 0, cardIndex);
  gameState = state;

  renderAll();
  if (!gameState.gameOver) {
    setTimeout(nextTurn, PASS_ADVANCE_DELAY_MS);
  }
}

window.humanDraw = function () {
  if (!isWaitingHuman || gameState.turnIndex !== 0) return;
  const playable = getPlayableForCurrentPlayer(gameState);
  if (playable.length > 0) return; // must play if possible
  if (!gameState.deck.length) return;

  isWaitingHuman = false;
  const { state, events, turnPassed } = drawCard(gameState, 0);
  gameState = state;

  renderAll();
  if (!gameState.gameOver) {
    if (turnPassed) {
      setTimeout(nextTurn, PASS_ADVANCE_DELAY_MS);
    } else {
      // Human can now play after draw
      isWaitingHuman = true;
      renderAll();
    }
  }
};

// ─────────────────────────────────────────
// Game controls (exposed to HTML)
// ─────────────────────────────────────────

window.startGame = function () {
  if (cpuTimer) clearTimeout(cpuTimer);
  isWaitingHuman = false;

  const overlay = $("result-overlay");
  if (overlay) overlay.style.display = "none";

  const playerCount = parseInt($("player-count")?.value || "4", 10);
  gameState = initGame(loadedPack, playerCount);

  // Mark P1 as human
  gameState.players[0].isHuman = !isAutoPlay;

  $("game-log").innerHTML = "";
  nextTurn();
};

window.toggleAuto = function () {
  isAutoPlay = !isAutoPlay;
  if (gameState) gameState.players[0].isHuman = !isAutoPlay;
  const btn = $("btn-mode");
  if (btn) btn.textContent = isAutoPlay ? "⏸️ AUTO: ON" : "▶️ AUTO: OFF";
  if (cpuTimer) clearTimeout(cpuTimer);
  if (gameState && !gameState.gameOver) {
    isWaitingHuman = gameState.turnIndex === 0 && !isAutoPlay;
    renderAll();
    if (isAutoPlay) nextTurn();
  }
};

window.toggleLog = function () {
  document.body.classList.toggle("show-log");
};

// ─────────────────────────────────────────
// Boot
// ─────────────────────────────────────────

window.addEventListener("load", () => {
  loadedPack = loadPack(BUILT_IN_PACK);
  window.startGame();
});
