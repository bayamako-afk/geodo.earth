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

import {
  computeRouteScoreSync,
} from '../../../guno_v6/src/scoring/route_completion_score.js?v=2';

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

  // V1.2 patch: enforce 20-turn limit for gunos_v1 UI
  if (!_state.gameOver && _state.turnCount >= 20) {
    _state.gameOver = true;
    _log.push(`[END] Turn limit reached (${_state.turnCount} turns)`);
  }

  if (_state.gameOver) {
    if (_state.winner) {
      _log.push(`[END] Winner: ${_state.winner} after ${_state.turnCount} turns`);
    } else if (!_log.some(l => l.startsWith('[END]'))) {
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
  if (!stationMetrics) {
    return _fallbackScore(owned, null);
  }

  try {
    // Station score (always available)
    const stationResult = _computeStationScore(owned, stationMetrics);

    // Route bonus (requires stationLines + linesMaster)
    let routeResult = { route_bonus: 0, completed_routes: [], partial_routes: [], route_details: [] };
    if (stationLines && linesMaster) {
      routeResult = computeRouteScoreSync(owned, stationLines, linesMaster);
    }

    // Hub bonus — use relative scoring for cross-city compatibility
    const hubResult = _computeHubBonusRelative(owned, stationMetrics);

    // Route progress (for UI display even when bonus is 0)
    const routeProgress = _computeRouteProgress(owned, stationLines, linesMaster);

    const final_score = stationResult.station_score + routeResult.route_bonus + hubResult.hub_bonus;

    return {
      final_score,
      station_score:   stationResult.station_score,
      route_bonus:     routeResult.route_bonus,
      hub_bonus:       hubResult.hub_bonus,
      routes:          routeResult.completed_routes || [],
      hubs:            hubResult.hub_stations.map(h => h.station_name),
      route_details:   routeResult.route_details || [],
      hub_stations:    hubResult.hub_stations,
      station_details: stationResult.station_details,
      route_progress:  routeProgress,
    };
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

/**
 * Compute station score sum from preloaded metrics.
 *
 * V1.2 Task 02: Added city-scale normalization.
 * London/NYC station scores are ~5x smaller than Tokyo/Osaka (avg 1.1-1.4 vs 6.8).
 * Without normalization, Hub+ (fixed +4/+2/+1 pts) dominates London/NYC scoring
 * (66-74% of total vs ~20% for Tokyo/Osaka).
 *
 * Normalization: multiply station scores by (TARGET_AVG / city_avg_score)
 * where TARGET_AVG = 6.0 (close to Tokyo/Osaka average).
 * This keeps the scoring scale consistent across all cities.
 */
const STATION_SCORE_TARGET_AVG = 6.0;

function _computeStationScore(owned, stationMetrics) {
  const metrics = Array.isArray(stationMetrics) ? stationMetrics
    : (stationMetrics?.stations || []);
  const metricsMap = new Map(metrics.map(m => [m.station_global_id, m]));

  // Compute city average score for normalization
  const allRawScores = metrics.map(m => m.score_total ?? m.composite_score ?? m.hub_score ?? 0);
  const cityAvg = allRawScores.length > 0
    ? allRawScores.reduce((a, b) => a + b, 0) / allRawScores.length
    : 1;
  // Scale factor: normalize to TARGET_AVG; cap at 5x to avoid extreme scaling
  const scaleFactor = cityAvg > 0
    ? Math.min(5.0, STATION_SCORE_TARGET_AVG / cityAvg)
    : 1.0;

  let station_score = 0;
  const station_details = [];
  for (const gid of owned) {
    const m = metricsMap.get(gid);
    if (m) {
      const rawScore = m.score_total ?? m.composite_score ?? m.hub_score ?? 0;
      const s = Math.round(rawScore * scaleFactor * 10) / 10;  // normalize + round to 1dp
      station_score += s;
      station_details.push({
        station_global_id: m.station_global_id,
        station_name:      m.station_name,
        score_total:       s,
        score_raw:         rawScore,
        rank:              m.rank,
        line_count:        m.line_count,
      });
    }
  }
  station_details.sort((a, b) => b.score_total - a.score_total);
  return { station_score, station_details, scaleFactor };
}

/**
 * Compute hub bonus using relative score thresholds (city-agnostic).
 *
 * V1.2 Task 02: Changed from percentile-based (p90/p75/p50) to
 * relative-score-based (score / max_score) thresholds.
 *
 * Problem with old approach: London/NYC have very flat score distributions
 * (e.g. p75 = 1.0 for London, meaning 78% of stations qualified as "hub").
 * This caused Hub+ to dominate scoring (66-74% of total score) in those cities.
 *
 * New thresholds (score / city_max_score):
 *   >= 0.70 → +4 pts  (top ~5-10%, true interchange hubs)
 *   >= 0.45 → +2 pts  (top ~15-25%, major stations)
 *   >= 0.25 → +1 pt   (top ~30-40%, secondary hubs)
 *
 * This ensures Hub+ contributes ~15-25% of total score across all cities.
 */
function _computeHubBonusRelative(owned, stationMetrics) {
  const metrics = Array.isArray(stationMetrics) ? stationMetrics
    : (stationMetrics?.stations || []);
  if (!metrics.length) return { hub_bonus: 0, hub_stations: [] };

  // Compute max score for relative threshold calculation
  const allScores = metrics.map(m => m.score_total ?? m.composite_score ?? m.hub_score ?? 0);
  const maxScore = Math.max(...allScores);
  if (maxScore <= 0) return { hub_bonus: 0, hub_stations: [] };

  const metricsMap = new Map(metrics.map(m => [m.station_global_id, m]));
  let hub_bonus = 0;
  const hub_stations = [];

  for (const gid of owned) {
    const m = metricsMap.get(gid);
    if (!m) continue;
    const s = m.score_total ?? m.composite_score ?? m.hub_score ?? 0;
    const rel = s / maxScore;  // relative score: 0.0 - 1.0
    let bonus = 0;
    if (rel >= 0.70)      bonus = 4;  // top ~5-10%: true interchange hubs
    else if (rel >= 0.45) bonus = 2;  // top ~15-25%: major stations
    else if (rel >= 0.25) bonus = 1;  // top ~30-40%: secondary hubs
    if (bonus > 0) {
      hub_bonus += bonus;
      hub_stations.push({
        station_global_id: m.station_global_id,
        station_name:      m.station_name,
        score_total:       s,
        hub_score:         m.hub_score,
        line_count:        m.line_count,
        bonus,
      });
    }
  }
  hub_stations.sort((a, b) => b.bonus - a.bonus || b.score_total - a.score_total);
  return { hub_bonus, hub_stations };
}

/**
 * Compute route progress for each line (for UI progress bars).
 * Returns array of { line_id, line_name, count, total, pct, status }
 *
 * V1.1 Task 03: When lines_master.station_count is null/missing (e.g. NYC),
 * fall back to counting unique stations in station_lines for that line.
 */
function _computeRouteProgress(owned, stationLines, linesMaster) {
  if (!stationLines || !linesMaster || !owned.length) return [];

  const sl = Array.isArray(stationLines) ? stationLines : [];
  const lm = Array.isArray(linesMaster) ? linesMaster : [];

  // Build actual station count per line from station_lines (authoritative)
  const lineActualCount = {};
  for (const r of sl) {
    if (!lineActualCount[r.line_id]) lineActualCount[r.line_id] = new Set();
    lineActualCount[r.line_id].add(r.station_global_id);
  }

  // line_id → { line_name, total }
  // Prefer lines_master.station_count; fall back to actual count from station_lines
  const lineInfo = {};
  for (const l of lm) {
    const actualTotal = lineActualCount[l.line_id]?.size ?? 0;
    const masterTotal = (typeof l.station_count === 'number' && l.station_count > 0)
      ? l.station_count
      : actualTotal;
    lineInfo[l.line_id] = { line_name: l.line_name_en || l.line_name, total: masterTotal };
  }

  // station_global_id → [line_id]
  const stationToLines = {};
  for (const r of sl) {
    const sid = r.station_global_id;
    if (!stationToLines[sid]) stationToLines[sid] = [];
    stationToLines[sid].push(r.line_id);
  }

  // line_id → count of owned stations
  const lineCounts = {};
  for (const gid of owned) {
    const lines = stationToLines[gid] || [];
    for (const lid of lines) {
      lineCounts[lid] = (lineCounts[lid] || 0) + 1;
    }
  }

  const progress = [];
  for (const [lid, count] of Object.entries(lineCounts)) {
    const info = lineInfo[lid] || { line_name: lid, total: 0 };
    const total = info.total || 1;
    const pct = Math.min(100, Math.round((count / total) * 100));
    const threshold = total / 2;
    const status = count >= total ? 'complete' : count >= threshold ? 'partial' : 'progress';
    progress.push({ line_id: lid, line_name: info.line_name, count, total, pct, status });
  }
  progress.sort((a, b) => b.pct - a.pct);
  return progress;
}

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
