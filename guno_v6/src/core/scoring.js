// guno_v6/src/core/scoring.js
// GUNO V6 Scoring Module
//
// Responsibility:
//   - Calculate each player's score from a GameState
//   - Provide a breakdown of score components for display/logging
//
// Scoring policy (from spec):
//   - Base score: number of stations owned on the map
//   - GUNO bonus: GUNO_POINT per completed route
//   - Hub bonus (deck): hub_bonus_deck per owned hub station (game balance value)
//   - Hub global: stored for statistics/future use only — NOT used in game score
//
// Rules:
//   - No DOM dependency
//   - Pure functions only

"use strict";

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

/** Points awarded per GUNO (route completion). */
export const GUNO_POINT = 10;

// ─────────────────────────────────────────
// Core scoring
// ─────────────────────────────────────────

/**
 * Calculate the score breakdown for a single player.
 *
 * @param {import("./game_engine.js").GameState} state
 * @param {number} playerIndex
 * @param {import("../data/pack_loader.js").LoadedPack} loadedPack - Used to look up hub values
 * @returns {ScoreBreakdown}
 */
export function calculateScore(state, playerIndex, loadedPack) {
  const player = state.players[playerIndex];

  // 1. Station ownership count
  let stationCount = 0;
  const ownedKeys = [];
  for (const [key, owner] of Object.entries(state.mapState)) {
    if (owner === playerIndex) {
      stationCount++;
      ownedKeys.push(key);
    }
  }

  // 2. GUNO bonus
  const gunoCount = player.guno || 0;
  const gunoPoints = gunoCount * GUNO_POINT;

  // 3. Hub bonus (deck-based) — game balance value
  let hubBonusDeck = 0;
  let hubBonusGlobal = 0; // stored for stats only
  if (loadedPack) {
    for (const key of ownedKeys) {
      const [lc, orderStr] = key.split("-");
      const order = parseInt(orderStr, 10);
      const station = loadedPack.stations.find((s) => s.lc === lc && s.order === order);
      if (station) {
        hubBonusDeck += station.hub_bonus_deck || 0;
        hubBonusGlobal += station.hub_bonus_global || 0; // stats only
      }
    }
  }

  const total = stationCount + gunoPoints + hubBonusDeck;

  return {
    playerIndex,
    playerName: player.name,
    stationCount,
    gunoCount,
    gunoPoints,
    hubBonusDeck,
    hubBonusGlobal, // for display/stats — not included in total
    total,
  };
}

/**
 * Calculate scores for all players and return them sorted by total (descending).
 *
 * @param {import("./game_engine.js").GameState} state
 * @param {import("../data/pack_loader.js").LoadedPack} loadedPack
 * @returns {ScoreBreakdown[]} Sorted by total score descending; active players ranked above eliminated
 */
export function calculateAllScores(state, loadedPack) {
  const scores = state.players.map((_, i) => calculateScore(state, i, loadedPack));

  return scores.sort((a, b) => {
    const aAlive = state.players[a.playerIndex].status === "active";
    const bAlive = state.players[b.playerIndex].status === "active";
    if (aAlive !== bAlive) return bAlive ? 1 : -1;
    return b.total - a.total;
  });
}

/**
 * Get the winner(s) from a sorted score list.
 * In case of a tie, all tied players at the top are returned.
 *
 * @param {ScoreBreakdown[]} sortedScores - Output of calculateAllScores()
 * @returns {ScoreBreakdown[]}
 */
export function getWinners(sortedScores) {
  if (!sortedScores.length) return [];
  const topScore = sortedScores[0].total;
  return sortedScores.filter((s) => s.total === topScore);
}

// ─────────────────────────────────────────
// JSDoc type definitions
// ─────────────────────────────────────────

/**
 * @typedef {object} ScoreBreakdown
 * @property {number} playerIndex
 * @property {string} playerName
 * @property {number} stationCount    - Number of stations owned
 * @property {number} gunoCount       - Number of GUNOs achieved
 * @property {number} gunoPoints      - gunoCount * GUNO_POINT
 * @property {number} hubBonusDeck    - Hub bonus from deck lines (used in score)
 * @property {number} hubBonusGlobal  - Hub bonus from all lines (stats only, NOT in total)
 * @property {number} total           - stationCount + gunoPoints + hubBonusDeck
 */
