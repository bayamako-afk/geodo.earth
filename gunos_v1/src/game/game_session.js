/**
 * game_session.js — GUNOS V1 Game Session Manager
 *
 * Manages a single local game session for GUNOS V1.
 * Bridges the GUNOS V1 city layer with the guno_v6 play engine.
 *
 * Responsibilities:
 *   1. Generate a city-aware deck via guno_v6 deck_generator
 *   2. Create initial game state via guno_v6 play_engine.createInitialGameState
 *   3. Execute turns via play_engine.playTurn
 *   4. Maintain session state and log
 *   5. Expose clean session API to main.js / UI
 *
 * Engine source: guno_v6/src/core/play_engine.js
 * Deck source:   guno_v6/src/generators/deck_generator.js
 *
 * Phase 3: local session, 2 players (P1 vs P2 auto-play)
 * Phase 4: stationGraph exposed via getStationGraph() for map_panel.js
 */

import {
  createInitialGameState,
  playTurn,
} from '../../../guno_v6/src/core/play_engine.js';

import { generateDeck } from '../../../guno_v6/src/generators/deck_generator.js';

// ── Session state ─────────────────────────────────────────────────────────────

let _session = null;   // { cityId, profile, stationGraph, stationLines, playerList }
let _state   = null;   // current play_engine game state
let _log     = [];     // string[]

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize a new game session for the given city.
 *
 * @param {Object} opts
 * @param {string}  opts.cityId      — Active city ID
 * @param {Object}  opts.profile     — Loaded city profile
 * @param {Object}  opts.datasets    — { station_metrics, station_lines, station_graph, ... }
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

  // ── Step 4: Store session ─────────────────────────────────────────────────
  _session = { cityId, profile, stationGraph, stationLines, playerList };

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

// ── Getters ───────────────────────────────────────────────────────────────────

export function getGameState()  { return _state; }
export function getSession()    { return _session; }
export function getLog()        { return [..._log]; }
export function isRunning()     { return !!_state && !_state.gameOver; }
export function isFinished()    { return !!_state && _state.gameOver; }
export function hasSession()    { return !!_session; }
export function getStationGraph() { return _session?.stationGraph ?? null; }

// ── Internal helpers ──────────────────────────────────────────────────────────

function _normalizeStationLines(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (raw.station_lines && Array.isArray(raw.station_lines)) return raw.station_lines;
  return null;
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
