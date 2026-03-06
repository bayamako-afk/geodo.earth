// guno_v6/src/core/rules.js
// GUNO V6 Rule Definitions
//
// Responsibility:
//   - Define card playability rules (what can be played on what)
//   - Define GUNO (route completion) detection
//   - Define game-end conditions
//
// Rules:
//   - No DOM dependency (no document, window, alert)
//   - Pure functions only — no side effects, no state mutation

"use strict";

// ─────────────────────────────────────────
// Card playability
// ─────────────────────────────────────────

/**
 * Normalize a station name for comparison (strip leading ★).
 * @param {string} name
 * @returns {string}
 */
export function normalizeName(name) {
  return (name || "").replace(/^★/, "");
}

/**
 * Determine whether a card can be played on top of the current discard pile top.
 * Rules:
 *   - A teiden (blackout) card can be played if:
 *       - The player has more than 1 card in hand, AND
 *       - The top card is also a teiden, OR the teiden card shares the same line code (lc)
 *   - A station card can be played if any of the following match the top card:
 *       - Same line code (lc)
 *       - Same station name (normalized, ignoring ★)
 *       - Same order number (and top is a station card)
 *
 * @param {Card} card       - The card being considered for play
 * @param {Card} topCard    - The current top of the discard pile
 * @param {number} handSize - Number of cards in the player's hand
 * @returns {boolean}
 */
export function isPlayable(card, topCard, handSize) {
  if (!topCard) return false;

  if (card.type === "teiden") {
    return handSize > 1 && (topCard.type === "teiden" || card.lc === topCard.lc);
  }

  // station card
  if (card.lc === topCard.lc) return true;
  if (normalizeName(card.name_ja) === normalizeName(topCard.name_ja)) return true;
  if (topCard.type === "station" && card.order === topCard.order) return true;

  return false;
}

/**
 * Get the indices of all playable cards in a hand.
 * @param {Card[]} hand
 * @param {Card} topCard
 * @returns {number[]}
 */
export function getPlayableIndices(hand, topCard) {
  if (!topCard) return [];
  return hand.reduce((acc, card, i) => {
    if (isPlayable(card, topCard, hand.length)) acc.push(i);
    return acc;
  }, []);
}

// ─────────────────────────────────────────
// GUNO (route completion) detection
// ─────────────────────────────────────────

/**
 * Check whether a given line has been fully completed (all 10 stations owned).
 * A station is "owned" if its mapState value is a player index (not -1 or undefined).
 *
 * @param {string} lc       - Line code (e.g. "JY")
 * @param {MapState} mapState - { "LC-order": playerIndex | -1 }
 * @returns {boolean}
 */
export function isLineComplete(lc, mapState) {
  for (let order = 1; order <= 10; order++) {
    const owner = mapState[`${lc}-${order}`];
    if (owner === undefined || owner === -1) return false;
  }
  return true;
}

// ─────────────────────────────────────────
// Game-end conditions
// ─────────────────────────────────────────

/**
 * Check whether the game should end due to all routes being completed.
 * The game ends when the total number of GUNO completions across all players
 * equals the number of routes in the deck.
 *
 * @param {Player[]} players
 * @param {number} routeCount - Total number of routes in the deck
 * @returns {boolean}
 */
export function isGameEndByGuno(players, routeCount) {
  const totalGuno = players.reduce((sum, p) => sum + (p.guno || 0), 0);
  return totalGuno >= routeCount;
}

/**
 * Check whether the game should end because only one (or zero) active players remain.
 * @param {Player[]} players
 * @returns {boolean}
 */
export function isGameEndByElimination(players) {
  const active = players.filter((p) => p.status === "active");
  return active.length <= 1;
}

/**
 * Check whether the game should end because all players have passed consecutively
 * with no playable cards (stalemate).
 *
 * @param {number} consecutivePasses
 * @param {Player[]} players
 * @returns {boolean}
 */
export function isGameEndByStalemate(consecutivePasses, players) {
  const active = players.filter((p) => p.status === "active");
  return consecutivePasses >= active.length * 2;
}

// ─────────────────────────────────────────
// Direction reversal
// ─────────────────────────────────────────

/**
 * Determine whether playing a station card should reverse the turn direction.
 * Reversal occurs when the played card's station name matches the top card's name.
 *
 * @param {Card} playedCard
 * @param {Card} topCard
 * @returns {boolean}
 */
export function shouldReverse(playedCard, topCard) {
  if (!topCard || playedCard.type !== "station" || topCard.type !== "station") return false;
  return normalizeName(playedCard.name_ja) === normalizeName(topCard.name_ja);
}

// ─────────────────────────────────────────
// JSDoc type definitions
// ─────────────────────────────────────────

/**
 * @typedef {object} Card
 * @property {"station"|"teiden"} type
 * @property {string} lc
 * @property {string} [name_ja]
 * @property {string} [name_en]
 * @property {number} [order]
 * @property {string} id
 */

/**
 * @typedef {{ [key: string]: number }} MapState
 * Key format: "LC-order" (e.g. "JY-3")
 * Value: player index (0-based), or -1 for "placed but unowned" (initial discard)
 */

/**
 * @typedef {object} Player
 * @property {string} name
 * @property {"active"|"eliminated"} status
 * @property {number} guno
 * @property {Card[]} hand
 */
