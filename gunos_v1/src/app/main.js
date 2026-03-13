/**
 * main.js — GUNOS V1 Application Entry Point
 *
 * Platform: GUNOS V1
 * Phase:    3 — Play Engine Integration
 *
 * Responsibilities:
 *   1. Boot: resolve city, load profile + datasets
 *   2. Render Phase 2 layout
 *   3. START: init game session via game_session.js, render initial state
 *   4. RESET: clear session, return to idle shell
 *   5. PLAY 1 TURN / AUTO PLAY: advance game state, update all UI panels
 *
 * Engine integration:
 *   game_session.js → play_engine.js (guno_v6) → deck_generator.js (guno_v6)
 *
 * UI update flow:
 *   game state → updateHandFromState() + updateStatusFromState() + updateMapFromState()
 *   log entries → setLogEntries() / appendLogEntry()
 */

import { loadCityProfile, loadCityRegistry, listAvailableCities, resolveDatasetUrl } from '../city/city_loader.js';
import { resolveActiveCityId } from '../city/city_ui.js';
import { renderLayout } from '../ui/layout.js';
import { setHeaderStatus, setStartButtonState } from '../ui/header_bar.js';
import { updateHandFromState, resetHandDisplay } from '../ui/hand_panel.js';
import { updateStatusFromState, appendLogEntry, setLogEntries, clearLog } from '../ui/score_panel.js';
import { updateMapFromState } from '../ui/map_panel.js';
import {
  initSession,
  playOneTurn,
  autoPlay,
  resetSession,
  getGameState,
  getLog,
  hasSession,
  isRunning,
  isFinished,
} from '../game/game_session.js';

// ── App state ─────────────────────────────────────────────────────────────────

let _cityId      = null;
let _profile     = null;
let _datasets    = null;
let _registry    = null;
let _cities      = [];
let _uiMode      = 'idle';  // 'idle' | 'loading' | 'running' | 'finished' | 'error'

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  boot().catch(err => {
    console.error('[GUNOS V1] Fatal boot error:', err);
    _showBootError(err.message);
  });
});

async function boot() {
  console.log('[GUNOS V1] Booting platform (Phase 3)...');
  setHeaderStatus('Booting...', 'loading');

  // ── Step 1: Resolve active city ──────────────────────────────────────────
  setHeaderStatus('Loading city...', 'loading');

  let cityId, registry;
  try {
    const resolved = await resolveActiveCityId();
    cityId   = resolved.cityId;
    registry = resolved.registry;
    _registry = registry;
    console.log(`[GUNOS V1] Active city: ${cityId}`);
  } catch (err) {
    throw new Error(`City registry load failed: ${err.message}`);
  }

  // ── Step 2: Load city profile ────────────────────────────────────────────
  let profile;
  try {
    profile = await loadCityProfile(cityId);
    console.log(`[GUNOS V1] City profile loaded: ${profile.display_name}`);
  } catch (err) {
    throw new Error(`City profile load failed for "${cityId}": ${err.message}`);
  }

  // ── Step 3: Pre-load city datasets (station_graph, station_lines) ────────
  setHeaderStatus('Loading datasets...', 'loading');
  let datasets = {};
  try {
    datasets = await _loadCityDatasets(cityId, profile);
    console.log(`[GUNOS V1] Datasets loaded for ${cityId}`);
  } catch (err) {
    console.warn(`[GUNOS V1] Dataset load warning for ${cityId}:`, err.message);
    // Non-fatal: game can run without graph/lines (reduced playability)
  }

  // ── Step 4: Load available cities ────────────────────────────────────────
  const cities = await listAvailableCities();

  // ── Step 5: Store in module state ────────────────────────────────────────
  _cityId   = cityId;
  _profile  = profile;
  _datasets = datasets;
  _cities   = cities;

  // ── Step 6: Render Phase 2 layout ────────────────────────────────────────
  const registryEntry = registry.cities.find(c => c.city_id === cityId);

  renderLayout({
    profile,
    registryEntry,
    cities,
    onStart: _handleStart,
    onReset: _handleReset,
  });

  // ── Step 7: Inject turn controls ─────────────────────────────────────────
  _injectTurnControls();

  // ── Step 8: Set idle state ────────────────────────────────────────────────
  _setUiMode('idle');
  setHeaderStatus('Ready', 'idle');

  console.log('[GUNOS V1] Phase 3 shell ready.');
}

// ── START handler ─────────────────────────────────────────────────────────────

async function _handleStart() {
  if (_uiMode === 'running') {
    console.log('[GUNOS V1] Game already running.');
    return;
  }

  console.log('[GUNOS V1] START pressed — initializing game session...');
  _setUiMode('loading');
  setHeaderStatus('Starting...', 'loading');
  setStartButtonState('playing');
  _setTurnButtonsEnabled(false);

  try {
    // Resolve guno_v6 base URL for deck_generator
    const guno6Base = _resolveGuno6Base();

    const gameState = await initSession({
      cityId:   _cityId,
      profile:  _profile,
      datasets: _datasets,
      guno6Base,
    });

    _setUiMode('running');
    setHeaderStatus('Running', 'playing');
    _setTurnButtonsEnabled(true);

    // Update all UI panels
    _updateAllPanels(gameState);

    // Sync log
    setLogEntries(getLog());

    console.log('[GUNOS V1] Game session started.', gameState);

  } catch (err) {
    console.error('[GUNOS V1] Session init failed:', err);
    _setUiMode('error');
    setHeaderStatus(`Error: ${err.message}`, 'error');
    setStartButtonState('ready');
    appendLogEntry(`[ERROR] ${err.message}`, 'warn');
  }
}

// ── RESET handler ─────────────────────────────────────────────────────────────

function _handleReset() {
  console.log('[GUNOS V1] RESET pressed.');
  resetSession();
  _setUiMode('idle');
  setHeaderStatus('Ready', 'idle');
  setStartButtonState('ready');
  _setTurnButtonsEnabled(false);

  // Reset all UI panels to idle
  resetHandDisplay();
  updateStatusFromState(null, 'idle');
  updateMapFromState(null, 'idle');
  clearLog();
  appendLogEntry('Session reset.', 'muted');
}

// ── Turn progression ──────────────────────────────────────────────────────────

function _handlePlayOneTurn() {
  if (!hasSession() || !isRunning()) return;

  try {
    const gameState = playOneTurn();
    _updateAllPanels(gameState);
    _syncLog();

    if (isFinished()) {
      _setUiMode('finished');
      setHeaderStatus('Game Over', 'playing');
      setStartButtonState('ready');
      _setTurnButtonsEnabled(false);
    }
  } catch (err) {
    console.error('[GUNOS V1] playOneTurn error:', err);
    appendLogEntry(`[ERROR] ${err.message}`, 'warn');
  }
}

function _handleAutoPlay() {
  if (!hasSession() || !isRunning()) return;

  _setTurnButtonsEnabled(false);

  try {
    const gameState = autoPlay(20);
    _updateAllPanels(gameState);
    _syncLog();

    if (isFinished()) {
      _setUiMode('finished');
      setHeaderStatus('Game Over', 'playing');
      setStartButtonState('ready');
    } else {
      _setTurnButtonsEnabled(true);
    }
  } catch (err) {
    console.error('[GUNOS V1] autoPlay error:', err);
    appendLogEntry(`[ERROR] ${err.message}`, 'warn');
    _setTurnButtonsEnabled(true);
  }
}

// ── UI update helpers ─────────────────────────────────────────────────────────

function _updateAllPanels(gameState) {
  updateHandFromState(gameState);
  updateStatusFromState(gameState, _uiMode);
  updateMapFromState(gameState, _uiMode);

  // Update panel-score phase badge
  const phaseEl = document.getElementById('panel-score-phase');
  if (phaseEl) phaseEl.textContent = _uiMode.toUpperCase();
}

function _syncLog() {
  // Append only new log entries since last sync
  const allLog = getLog();
  const logArea = document.getElementById('log-area');
  if (!logArea) return;

  const currentCount = logArea.children.length;
  const newEntries   = allLog.slice(currentCount);
  newEntries.forEach(text => appendLogEntry(text));
}

function _setUiMode(mode) {
  _uiMode = mode;
}

// ── Turn controls injection ───────────────────────────────────────────────────

function _injectTurnControls() {
  const container = document.getElementById('hdr-turn-controls');
  if (!container) return;

  container.innerHTML = `
    <button class="turn-btn turn-btn--play1" id="btn-play1" disabled>PLAY 1</button>
    <button class="turn-btn turn-btn--auto"  id="btn-auto"  disabled>AUTO ×20</button>
  `;

  document.getElementById('btn-play1')?.addEventListener('click', _handlePlayOneTurn);
  document.getElementById('btn-auto')?.addEventListener('click',  _handleAutoPlay);
}

function _setTurnButtonsEnabled(enabled) {
  const play1 = document.getElementById('btn-play1');
  const auto  = document.getElementById('btn-auto');
  if (play1) play1.disabled = !enabled;
  if (auto)  auto.disabled  = !enabled;
}

// ── Dataset loading ───────────────────────────────────────────────────────────

/**
 * Load station_graph and station_lines for the given city.
 * Returns a partial datasets object — missing keys are null.
 */
async function _loadCityDatasets(cityId, profile) {
  const datasets = {};
  const keys = ['station_graph', 'station_lines'];

  await Promise.all(keys.map(async key => {
    try {
      const url = resolveDatasetUrl(key, profile);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      datasets[key] = await res.json();
    } catch (err) {
      console.warn(`[GUNOS V1] Could not load dataset "${key}" for ${cityId}:`, err.message);
      datasets[key] = null;
    }
  }));

  return datasets;
}

// ── URL helpers ───────────────────────────────────────────────────────────────

/**
 * Resolve the guno_v6 base URL from the current page location.
 * gunos_v1 is at /gunos_v1/, guno_v6 is at /guno_v6/ (sibling).
 */
function _resolveGuno6Base() {
  const href = location.href;
  const match = href.match(/^(.*\/)gunos_v1\//);
  if (match) return match[1] + 'guno_v6/';
  // Fallback
  return location.origin + '/guno_v6/';
}

// ── Error handling ────────────────────────────────────────────────────────────

function _showBootError(message) {
  setHeaderStatus(`Error: ${message}`, 'error');
  const errorEl = document.getElementById('boot-error');
  if (errorEl) {
    errorEl.textContent = `GUNOS V1 boot error: ${message}`;
    errorEl.style.display = 'block';
  }
}
