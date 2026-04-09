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

import { loadCityProfile, loadCityRegistry, listAvailableCities, resolveDatasetUrl } from '../city/city_loader.js?v=10';
import { resolveActiveCityId } from '../city/city_ui.js?v=9';
import { renderLayout } from '../ui/layout.js?v=13';
import { setHeaderStatus, setStartButtonState, updateHeaderGameState } from '../ui/header_bar.js?v=8';
import { updateHandFromState, resetHandDisplay } from '../ui/hand_panel.js?v=8';
import {
  renderScorePanel,
  updateStatusFromState,
  updateLiveScores,
  appendLogEntry,
  setLogEntries,
  clearLog,
} from '../ui/score_panel.js?v=14';
import { renderCityComparePanel, initCityCompareData } from '../ui/city_compare_panel.js?v=2';
import { initHelpModal, openHelpModal } from '../ui/help_modal.js?v=1';
import { showResultPanel, hideResultPanel } from '../ui/result_panel.js?v=16';
import {
  initMapOverlay,
  updateMapOverlaySituation,
  updateMapOverlayScores,
  showMapOverlayToast,
  resetMapOverlay,
} from '../ui/map_overlay.js?v=1';
import {
  initStationHint,
  updateStationHint,
  resetStationHint,
} from '../ui/station_hint.js?v=9';
import {
  initCandidateIndicator,
  updateCandidateIndicator,
  resetCandidateIndicator,
} from '../ui/candidate_indicator.js?v=1';
import {
  initScoreReason,
  updateScoreReason,
  resetScoreReason,
} from '../ui/score_reason.js?v=1';
import {
  initStationDetailCard,
  updateStationDetailCard,
  resetStationDetailCard,
} from '../ui/station_detail_card.js?v=1';
import { updateMapFromState, setStationGraph } from '../ui/map_panel.js?v=15';
import {
  initOnboardingHints,
  updateOnboardingHints,
  resetOnboardingHints,
} from '../ui/onboarding_hints.js';
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
} from '../game/game_session.js?v=14';

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

  // V1.2 Task 05: seed compare panel data before layout render
  initCityCompareData(cities);

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
  initMapOverlay();
  initStationHint();
  // V1.4 Task 02: init candidate indicator with scoring data
  initCandidateIndicator({
    stationMetrics: datasets.station_metrics ?? null,
    stationLines:   datasets.station_lines   ?? null,
    linesMaster:    datasets.lines_master    ?? null,
  });
  // V1.4 Task 04: init score reason breakdown
  initScoreReason();
  // V1.4 Task 05: init selected station detail card
  initStationDetailCard({
    stationMetrics: datasets.station_metrics ?? null,
    stationLines:   datasets.station_lines   ?? null,
    linesMaster:    datasets.lines_master    ?? null,
  });
  // V1.5 Task 01: init beginner onboarding hints
  initOnboardingHints();
  _setUiMode('idle');
  setHeaderStatus('Ready', 'idle');
  updateHeaderGameState('idle', null, null);

  // V1.2 Task 03: Initialize help modal
  initHelpModal();
  const helpBtn = document.getElementById('btn-help');
  if (helpBtn) helpBtn.addEventListener('click', openHelpModal);

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

    // V1.5 Task 01: reset onboarding hints for each new game session
    resetOnboardingHints();

    _setUiMode('running');
    setHeaderStatus('Running', 'playing');
    _setTurnButtonsEnabled(true);
    updateHeaderGameState('running', gameState.turnCount, null);

    _updateAllPanels(gameState);
    setLogEntries(getLog());
    showMapOverlayToast(`Game started — ${_cityId?.toUpperCase() ?? ''}`, 'normal', 2500);

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
  resetMapOverlay();
  resetStationHint();
  resetCandidateIndicator();
  // V1.4 Task 04: reset score reason breakdown
  resetScoreReason();
  // V1.4 Task 05: reset selected station detail card
  resetStationDetailCard();
  // V1.5 Task 01: reset onboarding hints
  resetOnboardingHints();
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

      // V1.3 Task 05: Show winner toast and update overlay
      const scores = results.players || [];
      updateMapOverlaySituation(getGameState(), 'finished', scores);
      updateMapOverlayScores(scores);
      if (results.winner) {
        showMapOverlayToast(`${results.winner} WINS — ${results.turnCount} turns`, 'win', 5000);
      }
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

  let scores = [];
  try {
    scores = computeAllLiveScores();
    updateLiveScores(scores);
  } catch (err) {
    console.warn('[GUNOS V1] Live score update error:', err.message);
  }

  // V1.3 Task 05: Update map overlay
  updateMapOverlaySituation(gameState, _uiMode, scores);
  updateMapOverlayScores(scores);

  // V1.4 Task 01: Update station value hint
  updateStationHint(gameState, scores, _uiMode);

  // V1.4 Task 02: Update next candidate indicators
  updateCandidateIndicator(gameState, scores, _uiMode);

  // V1.4 Task 04: Update score reason breakdown
  updateScoreReason(gameState, scores, _uiMode);

  // V1.4 Task 05: Update selected station detail card
  updateStationDetailCard(gameState, scores, _uiMode);

  // V1.5 Task 01: Update beginner onboarding hints
  updateOnboardingHints(gameState, scores, _uiMode);

  // Toast for notable events during play
  if (_uiMode === 'running' && gameState && scores.length > 0) {
    _checkAndShowEventToast(gameState, scores);
  }
}

// ── Toast event detection ─────────────────────────────────────────────────────

// Track previous scores to detect changes
let _prevScores = {};

function _checkAndShowEventToast(gameState, scores) {
  if (!scores || !scores.length) return;

  // Check for route or hub bonus activation
  scores.forEach(ps => {
    const prev = _prevScores[ps.playerId] || {};
    const prevRoute = prev.route_bonus || 0;
    const prevHub   = prev.hub_bonus   || 0;

    if (ps.route_bonus > prevRoute && ps.route_bonus > 0) {
      showMapOverlayToast(
        `${ps.playerId} Route+ — +${(ps.route_bonus - prevRoute).toFixed(0)} pts`,
        'route',
        3000
      );
    } else if (ps.hub_bonus > prevHub && ps.hub_bonus > 0) {
      showMapOverlayToast(
        `${ps.playerId} Hub+ — +${(ps.hub_bonus - prevHub).toFixed(0)} pts`,
        'hub',
        3000
      );
    }

    _prevScores[ps.playerId] = {
      route_bonus: ps.route_bonus || 0,
      hub_bonus:   ps.hub_bonus   || 0,
    };
  });
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
