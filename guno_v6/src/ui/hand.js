// guno_v6/src/ui/hand.js
// GUNO V6 Hand UI Component
//
// Responsibility:
//   - Render each player's hand and status panel
//   - Highlight playable cards for the human player
//   - Emit card-play events via onCardPlay callback

"use strict";

// ─────────────────────────────────────────
// Card HTML builders
// ─────────────────────────────────────────

/**
 * Build HTML for a single card in hand.
 * @param {import("../core/game_engine.js").Card} card
 * @param {boolean} canPlay
 * @param {boolean} showFace - If false, render card back
 * @param {number} cardIndex
 * @returns {string}
 */
function buildCardHTML(card, canPlay, showFace, cardIndex) {
  if (!showFace) {
    return `<div class="card card--back" data-index="${cardIndex}">🂠</div>`;
  }

  const playableClass = canPlay ? "card--playable" : "card--unplayable";
  const clickAttr = canPlay ? `data-play-index="${cardIndex}"` : "";

  if (card.type === "teiden") {
    return `
      <div class="card card--teiden ${playableClass}" data-line="${card.lc}" ${clickAttr}>
        <div class="card__teiden-icon">⚡</div>
        <div class="card__teiden-label">停電</div>
        <div class="card__teiden-en">Blackout</div>
        <div class="card__route-code">${card.lc}</div>
      </div>`;
  }

  return `
    <div class="card card--station ${playableClass}" data-line="${card.lc}" ${clickAttr}>
      <div class="card__corner card__corner--tl">${card.order}</div>
      <div class="card__center">
        <div class="card__name-ja">${card.name_ja || ""}</div>
        <div class="card__name-en">${card.name_en || ""}</div>
      </div>
      <div class="card__route-code">${card.lc}</div>
      <div class="card__corner card__corner--br">${card.order}</div>
    </div>`;
}

// ─────────────────────────────────────────
// Players area renderer
// ─────────────────────────────────────────

/**
 * Render all players' panels into the given container element.
 *
 * @param {HTMLElement} container
 * @param {import("../core/game_engine.js").GameState} state
 * @param {number[]} playableIndices - Playable card indices for the human player (index 0)
 * @param {boolean} isWaitingHuman
 * @param {boolean} isAutoPlay
 * @param {ScoreBreakdown[]} scores - From scoring module
 * @param {function(number): void} onCardPlay - Called with cardIndex when human plays a card
 */
export function renderPlayers(container, state, playableIndices, isWaitingHuman, isAutoPlay, scores, onCardPlay) {
  if (!container) return;

  const scoreMap = {};
  if (scores) {
    for (const s of scores) scoreMap[s.playerIndex] = s;
  }

  container.innerHTML = state.players.map((player, i) => {
    const isTurn = i === state.turnIndex && !state.gameOver && player.status === "active";
    const score = scoreMap[i];
    const totalScore = score ? score.total : 0;
    const stCount = score ? score.stationCount : 0;

    const showFace = player.isHuman !== false || isAutoPlay;
    const cardsHtml = player.hand.map((card, ci) => {
      const canPlay = isWaitingHuman && i === 0 && playableIndices.includes(ci);
      return buildCardHTML(card, canPlay, showFace, ci);
    }).join("");

    return `
      <div class="player-panel ${isTurn ? "player-panel--active" : ""} ${player.status === "eliminated" ? "player-panel--eliminated" : ""}"
           style="border-left-color:${player.color};"
           data-player-index="${i}">
        <div class="player-panel__header">
          <span class="player-panel__icon">${player.icon}</span>
          <span class="player-panel__name">${player.name}</span>
          <span class="player-panel__stats">Stations:${stCount} | GUNO:${player.guno} | Score:${totalScore}</span>
        </div>
        <div class="player-panel__hand">${cardsHtml}</div>
      </div>`;
  }).join("");

  // Attach click listeners for human card plays
  if (isWaitingHuman) {
    container.querySelectorAll("[data-play-index]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.dataset.playIndex, 10);
        onCardPlay(idx);
      }, { once: true });
    });
  }
}

/**
 * @typedef {import("../core/scoring.js").ScoreBreakdown} ScoreBreakdown
 */
