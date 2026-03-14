/**
 * game_session.js — GUNOS V1 Game Session Manager
 *
 * Manages a single local game session for GUNOS V1.
 * Bridges the GUNOS V1 city layer with the guno_v6 play engine.
 *
 * Phase 3: local session, 2 players (P1 vs P2 auto-play)
 * Phase 4: stationGraph exposed via getStationGraph() for map_panel.js
 * Phase 5: live score computation via guno_v6 scoring engines (sync, preloaded data)
 */

import {
  createInitialGameState,
  playTurn,
} from '../../../guno_v6/src/core/play_engine.js';

import { generateDeck } from '../../../guno_v6/src/generators/deck_generator.js';

import {
  computeFinalScoreSync,
} from '../../../guno_v6/src/scoring/final_score_engine.js';

// ── Session state ─────────────────────────────────────────────────────────────

let _session = null;   // { cityId, profile, stationGraph, stationLines, playerList, scoringData }
let _state   = null;   // current play_engine game state
let _log     = [];     // string[]

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize a new game session for the given city.
 *
 * @param {Object} opts
 * @param {string}  opts.cityId      — Active city ID
 * @param {Object}  opts.profile     — Loaded city profile
 * @param {Object}  opts.datasets    — { station_metrics, station_lines, station_graph, lines_master, ... }
 * @param {string}  opts.guno6Base   — Base URL for guno_v6 root (for deck_generator)
 * @param {Array}   [opts.players]   — Player list (default: [{id:'P1'},{id:'P2'}])
 * @returns {Promise<Object>} Initial game state
 */
export async function initSession({ cityId, profile, datasets, guno6Base, players }) {
  _session = null;
  _state   = null;
  _log     = [];

  _log.push(`[GUNOS V1] Starting session — ${cityId.toUpperCase()}`);

  // ── Step 1: Generate city-aware deck ──────────────────────────────────────
  let deckResult;
  try {
    deckResult = await generateDeck({
      baseUrl: guno6Base,
      cityId,
    });
    _log.push(`[DECK] ${deckResult.cards.length} cards generated for ${cityId}`);
  } catch (err) {
    throw new Error(`Deck generation failed for "${cityId}": ${err.message}`);
  }

  const deck = deckResult.cards;

  // ── Step 2: Resolve play engine graph/lines data ──────────────────────────
  const stationGraph = datasets?.station_graph || null;
  const stationLines = _normalizeStationLines(datasets?.station_lines);

  // ── Step 3: Create initial game state ────────────────────────────────────
  const playerList = players || [{ id: 'P1' }, { id: 'P2' }];

  try {
    _state = createInitialGameState(deck, playerList);
  } catch (err) {
    throw new Error(`Game state initialization failed: ${err.message}`);
  }

  _log.push(`[GAME] Game started — ${playerList.length} players, deck: ${deck.length}`);
  _log.push(`[CARD] Opening card: ${_cardLabel(_state.currentCard)}`);
  _log.push(`[TURN] ${_turnLabel(_state)}`);

  // ── Step 4: Prepare scoring data (Phase 5) ────────────────────────────────
  const scoringData = {
    stationMetrics: _normalizeMetrics(datasets?.station_metrics),
    stationLines:   stationLines,
    linesMaster:    _normalizeLinesMaster(datasets?.lines_master),
  };

  // ── Step 5: Store session ─────────────────────────────────────────────────
  _session = { cityId, profile, stationGraph, stationLines, playerList, scoringData };

  return _state;
}

/**
 * Execute one turn using the real play engine.
 * @returns {Object} Updated game state
 */
export function playOneTurn() {
  if (!_session || !_state) throw new Error('[GUNOS V1] No active session.');
  if (_state.gameOver) {
    _log.push('[GAME] Already over.');
    return _state;
  }

  const prevPlayer = _state.players[_state.turnIndex];
  const prevCardId = _state.currentCard?.card_id;

  _state = playTurn(_state, {
    stationGraph: _session.stationGraph,
    stationLines: _session.stationLines,
  });

  const cardChanged = _state.currentCard?.card_id !== prevCardId;
  if (cardChanged) {
    _log.push(`[T${_state.turnCount}] ${prevPlayer.id} played → ${_cardLabel(_state.currentCard)}`);
  } else {
    _log.push(`[T${_state.turnCount}] ${prevPlayer.id} drew a card`);
  }

  if (_state.gameOver) {
    if (_state.winner) {
      _log.push(`[END] Winner: ${_state.winner} after ${_state.turnCount} turns`);
    } else {
      _log.push(`[END] Turn limit reached (${_state.turnCount} turns)`);
    }
  } else {
    _log.push(`[TURN] ${_turnLabel(_state)}`);
  }

  return _state;
}

/**
 * Auto-play multiple turns (up to maxTurns).
 * @param {number} [maxTurns=20]
 * @returns {Object} Final game state after auto-play
 */
export function autoPlay(maxTurns = 20) {
  if (!_session || !_state) throw new Error('[GUNOS V1] No active session.');
  if (_state.gameOver) return _state;

  _log.push(`[AUTO] Auto-playing up to ${maxTurns} turns...`);

  let played = 0;
  while (!_state.gameOver && played < maxTurns) {
    playOneTurn();
    played++;
  }

  _log.push(`[AUTO] Done — ${played} turns played`);
  return _state;
}

/**
 * Reset the current session.
 */
export function resetSession() {
  _session = null;
  _state   = null;
  _log     = ['[GUNOS V1] Session reset.'];
}

// ── Phase 5: Live Score API ───────────────────────────────────────────────────

/**
 * Compute live score for a single player using preloaded scoring data.
 *
 * @param {string} playerId — e.g. 'P1'
 * @returns {Object} { station_score, route_bonus, hub_bonus, final_score, route_details, hub_stations, station_details }
 */
export function computeLiveScore(playerId) {
  if (!_session || !_state) return _emptyScore();

  const player = _state.players.find(p => p.id === playerId);
  if (!player) return _emptyScore();

  const owned = player.ownedStations || [];
  if (!owned.length) return _emptyScore();

  const { stationMetrics, stationLines, linesMaster } = _session.scoringData;

  // Fall back gracefully if scoring data is missing
  if (!stationMetrics || !stationLines || !linesMaster) {
    return _fallbackScore(owned, stationMetrics);
  }

  try {
    return computeFinalScoreSync(owned, {
      stationMetrics,
      stationLines,
      linesMaster,
    });
  } catch (err) {
    console.warn('[GUNOS V1] computeLiveScore error:', err.message);
    return _fallbackScore(owned, stationMetrics);
  }
}

/**
 * Compute live scores for all players.
 * @returns {Array<{ playerId, ...scoreResult }>}
 */
export function computeAllLiveScores() {
  if (!_session || !_state) return [];
  return _state.players.map(p => ({
    playerId: p.id,
    ...computeLiveScore(p.id),
  }));
}

/**
 * Compute final result summary for all players (for GAME OVER panel).
 * Returns players sorted by final_score descending.
 * @returns {Object} { winner, turnCount, players: [...], gameOver }
 */
export function computeFinalResults() {
  if (!_session || !_state) return null;

  const playerScores = computeAllLiveScores();

  // Sort by final_score descending
  const sorted = [...playerScores].sort((a, b) => b.final_score - a.final_score);

  return {
    winner:    _state.winner || (sorted[0]?.playerId ?? null),
    turnCount: _state.turnCount,
    gameOver:  _state.gameOver,
    players:   sorted,
  };
}

// ── Getters ───────────────────────────────────────────────────────────────────

export function getGameState()    { return _state; }
export function getSession()      { return _session; }
export function getLog()          { return [..._log]; }
export function isRunning()       { return !!_state && !_state.gameOver; }
export function isFinished()      { return !!_state && _state.gameOver; }
export function hasSession()      { return !!_session; }
export function getStationGraph() { return _session?.stationGraph ?? null; }

// ── Internal helpers ──────────────────────────────────────────────────────────

function _normalizeStationLines(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (raw.station_lines && Array.isArray(raw.station_lines)) return raw.station_lines;
  return null;
}

function _normalizeMetrics(raw) {
  if (!raw) return null;
  let items = null;
  if (Array.isArray(raw)) items = raw;
  else if (raw.stations && Array.isArray(raw.stations)) items = raw.stations;
  if (!items) return null;

  // Normalize: ensure score_total exists (London uses composite_score)
  return items.map(m => ({
    ...m,
    score_total: m.score_total ?? m.composite_score ?? m.hub_score ?? 0,
  }));
}

function _normalizeLinesMaster(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  return null;
}

function _emptyScore() {
  return {
    final_score:     0,
    station_score:   0,
    route_bonus:     0,
    hub_bonus:       0,
    routes:          [],
    hubs:            [],
    route_details:   [],
    hub_stations:    [],
    station_details: [],
  };
}

function _fallbackScore(owned, stationMetrics) {
  // Minimal score: sum station scores only, no route/hub bonus
  const metrics = Array.isArray(stationMetrics)
    ? stationMetrics
    : (stationMetrics?.stations || []);

  const normalized = metrics.map(m => ({
    ...m,
    score_total: m.score_total ?? m.composite_score ?? m.hub_score ?? 0,
  }));
  const metricsMap = new Map(normalized.map(m => [m.station_global_id, m]));
  let station_score = 0;
  const station_details = [];

  for (const gid of owned) {
    const m = metricsMap.get(gid);
    if (m) {
      station_score += m.score_total || 0;
      station_details.push({
        station_global_id: m.station_global_id,
        station_name:      m.station_name,
        score_total:       m.score_total || 0,
      });
    }
  }

  station_details.sort((a, b) => b.score_total - a.score_total);

  return {
    final_score:     station_score,
    station_score,
    route_bonus:     0,
    hub_bonus:       0,
    routes:          [],
    hubs:            [],
    route_details:   [],
    hub_stations:    [],
    station_details,
  };
}

function _cardLabel(card) {
  if (!card) return '(none)';
  const name   = card.station_name || card.card_id;
  const rarity = card.rarity ? ` [${card.rarity[0]}]` : '';
  return `${name}${rarity}`;
}

function _turnLabel(state) {
  const p = state.players[state.turnIndex];
  return `${p.id}'s turn — hand: ${p.hand.length}, deck: ${state.deck.length}`;
}
