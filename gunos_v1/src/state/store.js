/**
 * store.js — GUNOS V1 Central State Store
 *
 * Single source of truth for the GUNOS V1 application state.
 * Replaces the Phase 1/2 app_state.js for Phase 3+ use.
 *
 * State shape:
 *   {
 *     // Platform
 *     activeCityId:   string | null
 *     cityProfile:    Object | null
 *     cityDatasets:   Object | null   — { station_metrics, station_lines, station_graph, ... }
 *     availableCities: Array
 *
 *     // Game session
 *     gameSession:    Object | null   — managed by game_session.js
 *     gameState:      Object | null   — raw play_engine state
 *
 *     // UI mode
 *     uiMode:         'idle' | 'loading' | 'running' | 'finished' | 'error'
 *     errorMessage:   string | null
 *
 *     // Log
 *     log:            string[]
 *   }
 *
 * Phase 3: minimal store with direct mutation (no reactivity framework needed yet)
 * Phase 5+: may introduce event emitter or reactive store if needed
 */

const _state = {
  // Platform
  activeCityId:    null,
  cityProfile:     null,
  cityDatasets:    null,
  availableCities: [],

  // Game session
  gameSession: null,
  gameState:   null,

  // UI mode
  uiMode:       'idle',
  errorMessage: null,

  // Log
  log: [],
};

// ── Getters ───────────────────────────────────────────────────────────────────

export function getStore()          { return _state; }
export function getUiMode()         { return _state.uiMode; }
export function getActiveCity()     { return _state.activeCityId; }
export function getCityProfile()    { return _state.cityProfile; }
export function getCityDatasets()   { return _state.cityDatasets; }
export function getGameState()      { return _state.gameState; }
export function getGameSession()    { return _state.gameSession; }
export function isGameRunning()     { return _state.uiMode === 'running'; }
export function isGameFinished()    { return _state.uiMode === 'finished'; }

// ── Setters ───────────────────────────────────────────────────────────────────

export function setUiMode(mode) {
  _state.uiMode = mode;
}

export function setError(message) {
  _state.uiMode = 'error';
  _state.errorMessage = message;
}

export function setCityContext(cityId, profile, datasets, availableCities) {
  _state.activeCityId    = cityId;
  _state.cityProfile     = profile;
  _state.cityDatasets    = datasets;
  _state.availableCities = availableCities || _state.availableCities;
}

export function setGameSession(session) {
  _state.gameSession = session;
}

export function setGameState(gameState) {
  _state.gameState = gameState;
  _state.uiMode    = gameState?.gameOver ? 'finished' : 'running';
}

export function clearGameSession() {
  _state.gameSession = null;
  _state.gameState   = null;
  _state.uiMode      = 'idle';
  _state.log         = [];
}

// ── Log ───────────────────────────────────────────────────────────────────────

export function appendLog(text) {
  _state.log.push(text);
}

export function clearLog() {
  _state.log = [];
}

export function getLog() {
  return [..._state.log];
}
