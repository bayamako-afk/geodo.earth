// guno_v6/src/ui/board.js
// GUNO V6 Board UI Component
//
// Responsibility:
//   - Render the game board (discard pile, deck, direction, route slots)
//   - Receive GameState and render it to DOM elements
//   - Emit user actions via callbacks (no direct state mutation)

"use strict";

// ─────────────────────────────────────────
// Board renderer
// ─────────────────────────────────────────

/**
 * Render the top card of the discard pile.
 * @param {HTMLElement} el
 * @param {import("../core/game_engine.js").Card|undefined} topCard
 */
export function renderDiscardPile(el, topCard) {
  if (!el) return;
  if (!topCard) {
    el.innerHTML = `<div class="card card--empty">-</div>`;
    return;
  }
  if (topCard.type === "teiden") {
    el.innerHTML = `
      <div class="card card--teiden" data-line="${topCard.lc}">
        <div class="card__teiden-icon">⚡</div>
        <div class="card__teiden-label">停電</div>
        <div class="card__teiden-en">Blackout</div>
        <div class="card__route-code">${topCard.lc}</div>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="card card--station" data-line="${topCard.lc}">
      <div class="card__corner card__corner--tl">${topCard.order}</div>
      <div class="card__center">
        <div class="card__name-ja">${topCard.name_ja || ""}</div>
        <div class="card__name-en">${topCard.name_en || ""}</div>
      </div>
      <div class="card__route-code">${topCard.lc}</div>
      <div class="card__corner card__corner--br">${topCard.order}</div>
    </div>`;
}

/**
 * Render the deck count display.
 * @param {HTMLElement} el
 * @param {number} deckSize
 * @param {boolean} canDraw - Whether the current human player can draw
 */
export function renderDeck(el, deckSize, canDraw) {
  if (!el) return;
  el.textContent = String(deckSize);
  el.className = canDraw ? "deck-count deck-count--drawable" : "deck-count";
}

/**
 * Render the turn direction indicator.
 * @param {HTMLElement} el
 * @param {1|-1} direction
 */
export function renderDirection(el, direction) {
  if (!el) return;
  el.textContent = direction === 1 ? "↻" : "↺";
}

/**
 * Render the route slot grid for a single line.
 * @param {HTMLElement} gridEl
 * @param {HTMLElement} headerEl
 * @param {string} lc - Line code
 * @param {RouteInfo} routeInfo - { name_ja, name_en, color }
 * @param {import("../core/game_engine.js").GameState} state
 * @param {import("../core/game_engine.js").Player[]} players
 * @param {import("../data/pack_loader.js").Station[]} stations
 */
export function renderRouteSlots(gridEl, headerEl, lc, routeInfo, state, players, stations) {
  if (!gridEl || !routeInfo) return;

  if (headerEl) {
    headerEl.textContent = `[${lc}] ${routeInfo.name_ja}`;
    headerEl.style.backgroundColor = routeInfo.color;
  }

  let html = "";
  for (let order = 1; order <= 10; order++) {
    const owner = state.mapState[`${lc}-${order}`];
    const station = stations.find((s) => s.lc === lc && s.order === order);
    const nameJa = station?.name_ja || `${lc}-${order}`;

    if (owner !== undefined && owner !== -1) {
      const p = players[owner];
      html += `
        <div class="slot slot--owned" style="border-color:${p.color};" title="${nameJa}">
          <div class="slot__order">${order}</div>
          <div class="slot__name">${nameJa.replace("★", '<span class="star">★</span>')}</div>
          <div class="slot__owner" style="background:${p.color};">${p.icon}</div>
        </div>`;
    } else {
      html += `
        <div class="slot slot--empty" title="${nameJa}">
          <div class="slot__order">${order}</div>
          <div class="slot__name">${nameJa.replace("★", '<span class="star">★</span>')}</div>
        </div>`;
    }
  }
  gridEl.innerHTML = html;
}
