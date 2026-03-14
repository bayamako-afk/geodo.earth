/**
 * main.js — GUNOS V1 Application Entry Point
 *
 * Platform: GUNOS V1
 * Phase:    6 — Runtime Clarity & Cross-City Polish
 *
 * Changes from Phase 5:
 *   - updateHeaderGameState() called on every state transition
 *   - Turn counter shown in header during play
 *   - Winner ID passed to header on GAME OVER
 *   - All module imports bumped to ?v=8
 */

import { loadCityProfile, loadCityRegistry, listAvailableCities, resolveDatasetUrl } from '../city/city_loader.js?v=8';
import { resolveActiveCityId } from '../city/city_ui.js?v=8';
import { renderLayout } from '../ui/layout.js?v=12';
import { setHeaderStatus, setStartButtonState, updateHeaderGameState } from '../ui/header_bar.js?v=8';
import { updateHandFromState, resetHandDisplay } from '../ui/hand_panel.js?v=8';
import {
  renderScorePanel,
  updateStatusFromState,
  updateLiveScores,
  appendLogEntry,
  setLogEntries,
  clearLog,
} from '../ui/score_panel.js?v=8';
import { renderCityComparePanel } from '../ui/city_compare_panel.js?v=1';
import { showResultPanel, hideResultPanel } from '../ui/result_panel.js?v=8';
import { updateMapFromState, setStationGraph } from '../ui/map_panel.js?v=8';
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
  getStationGraph,
  computeAllLiveScores,
  computeFinalResults,
} from '../game/game_session.js?v=8';

// ── App state ─────────────────────────────────────────────────────────────────

let _cityId   = null;
let _profile  = null;
let _datasets = null;
let _registry = null;
let _cities   = [];
let _uiMode   = 'idle';

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  boot().catch(err => {
    console.error('[GUNOS V1] Fatal boot error:', err);
    _showBootError(err.message);
  });
});

async function boot() {
  console.log('[GUNOS V1] Booting platform (Phase 6)...');
  setHeaderStatus('Booting...', 'loading');

  setHeaderStatus('Loading city...', 'loading');

  let cityId, registry;
  try {
    const resolved = await resolveActiveCityId();
    cityId   = resolved.cityId;
    registry = resolved.registry;
    _registry = registry;
  } catch (err) {
    throw new Error(`City registry load failed: ${err.message}`);
  }

  let profile;
  try {
    profile = await loadCityProfile(cityId);
  } catch (err) {
    throw new Error(`City profile load failed for "${cityId}": ${err.message}`);
  }

  setHeaderStatus('Loading datasets...', 'loading');
  let datasets = {};
  try {
    datasets = await _loadCityDatasets(cityId, profile);
  } catch (err) {
    console.warn(`[GUNOS V1] Dataset load warning for ${cityId}:`, err.message);
  }

  const cities = await listAvailableCities();

  _cityId   = cityId;
  _profile  = profile;
  _datasets = datasets;
  _cities   = cities;

  const registryEntry = registry.cities.find(c => c.city_id === cityId);

  renderLayout({
    profile,
    registryEntry,
    cities,
    stationGraph: datasets.station_graph ?? null,
    onStart: _handleStart,
    onReset: _handleReset,
  });

  _injectTurnControls();
  _setUiMode('idle');
  setHeaderStatus('Ready', 'idle');
  updateHeaderGameState('idle', null, null);

  console.log('[GUNOS V1] Phase 6 shell ready.');
}

// ── START handler ─────────────────────────────────────────────────────────────

async function _handleStart() {
  if (_uiMode === 'running') return;

  if (_uiMode === 'finished') {
    hideResultPanel();
    renderScorePanel({ profile: _profile });
    renderCityComparePanel(_cityId);
  }

  _setUiMode('loading');
  setHeaderStatus('Starting...', 'loading');
  setStartButtonState('playing');
  _setTurnButtonsEnabled(false);
  updateHeaderGameState('loading', null, null);

  try {
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
    updateHeaderGameState('running', gameState.turnCount, null);

    _updateAllPanels(gameState);
    setLogEntries(getLog());

  } catch (err) {
    console.error('[GUNOS V1] Session init failed:', err);
    _setUiMode('error');
    setHeaderStatus(`Error: ${err.message}`, 'error');
    setStartButtonState('ready');
    updateHeaderGameState('error', null, null);
    appendLogEntry(`[ERROR] ${err.message}`, 'warn');
  }
}

// ── RESET handler ─────────────────────────────────────────────────────────────

function _handleReset() {
  resetSession();

  if (_uiMode === 'finished') {
    hideResultPanel();
    renderScorePanel({ profile: _profile });
    renderCityComparePanel(_cityId);
  }

  _setUiMode('idle');
  setHeaderStatus('Ready', 'idle');
  setStartButtonState('ready');
  _setTurnButtonsEnabled(false);
  updateHeaderGameState('idle', null, null);

  resetHandDisplay();
  updateStatusFromState(null, 'idle');
  updateLiveScores([]);
  updateMapFromState(null, 'idle', _datasets?.station_graph ?? null);
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
      _handleGameOver();
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
      _handleGameOver();
    } else {
      _setTurnButtonsEnabled(true);
      updateHeaderGameState('running', gameState.turnCount, null);
    }
  } catch (err) {
    console.error('[GUNOS V1] autoPlay error:', err);
    appendLogEntry(`[ERROR] ${err.message}`, 'warn');
    _setTurnButtonsEnabled(true);
  }
}

// ── GAME OVER handler ─────────────────────────────────────────────────────────

function _handleGameOver() {
  _setUiMode('finished');
  setHeaderStatus('Game Over', 'playing');
  setStartButtonState('ready');
  _setTurnButtonsEnabled(false);

  try {
    const results = computeFinalResults();
    if (results) {
      updateHeaderGameState('finished', results.turnCount, results.winner ?? null);
      showResultPanel(results);
      renderCityComparePanel(_cityId);
    }
  } catch (err) {
    console.warn('[GUNOS V1] Result panel error:', err.message);
    updateHeaderGameState('finished', null, null);
  }
}

// ── UI update helpers ─────────────────────────────────────────────────────────

function _updateAllPanels(gameState) {
  const graph = getStationGraph() ?? _datasets?.station_graph ?? null;
  updateMapFromState(gameState, _uiMode, graph);
  updateHandFromState(gameState);
  updateStatusFromState(gameState, _uiMode);

  // Phase 6: update header turn counter during play
  if (_uiMode === 'running' && gameState) {
    updateHeaderGameState('running', gameState.turnCount, null);
  }

  try {
    const scores = computeAllLiveScores();
    updateLiveScores(scores);
  } catch (err) {
    console.warn('[GUNOS V1] Live score update error:', err.message);
  }
}

function _syncLog() {
  const allLog  = getLog();
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

async function _loadCityDatasets(cityId, profile) {
  const datasets = {};
  const keys = ['station_graph', 'station_lines', 'station_metrics', 'lines_master'];

  await Promise.all(keys.map(async key => {
    try {
      const url = resolveDatasetUrl(key, profile);
      if (!url) {
        datasets[key] = null;
        return;
      }
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

function _resolveGuno6Base() {
  const href  = location.href;
  const match = href.match(/^(.*\/)gunos_v1\//);
  if (match) return match[1] + 'guno_v6/';
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
