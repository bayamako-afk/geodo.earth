/**
 * map_panel.js — GUNOS V1 Map Panel
 *
 * Phase 4: Real gameplay visualization layer.
 *
 * Renders a geographic SVG map via map_canvas.js showing:
 *   - Base route lines (city-specific colors)
 *   - Station nodes (hub-sized)
 *   - Owned station overlay (player colors: P1 cyan, P2 red, P3 green, P4 amber)
 *   - Recent action highlight (pulse ring on current card station)
 *   - Network connection emphasis (glow on adjacent owned pairs)
 *   - Player legend (ownership counts)
 *
 * Data flow:
 *   renderMapPanel()    — initial render (idle shell)
 *   updateMapFromState() — called after each turn with live game state + graph
 */

import { renderMapCanvas } from './map_canvas.js?v=5';

// Module-level graph cache (set once per city boot)
let _stationGraph = null;
let _cityId       = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initial render of the map panel (idle state).
 * Stores the station graph for later use by updateMapFromState().
 *
 * @param {Object} opts
 * @param {Object}  opts.profile       - Loaded city profile
 * @param {Object}  [opts.stationGraph] - Pre-loaded station_graph JSON
 */
export function renderMapPanel({ profile, stationGraph }) {
  const container = document.getElementById('map-panel-body');
  if (!container) return;

  const cityLabel     = profile._display_label || profile.city_id.toUpperCase();
  const cityName      = profile.display_name || profile.city_id;
  const featuredLines = profile.routes?.featured_lines ?? [];
  const dataReady     = profile.status?.data_ready ?? false;

  // Cache graph for later updates
  _stationGraph = stationGraph ?? null;
  _cityId       = profile.city_id;

  container.innerHTML = '';

  // ── Header row ──────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'map-header';
  header.innerHTML = `
    <div class="map-header__left">
      <span class="map-city-label">${cityLabel}</span>
      <span class="map-city-name">${cityName}</span>
    </div>
    <div class="map-header__lines" id="map-lines-row">
      ${featuredLines.map(lc => `<span class="map-line-badge" style="border-color:${_lineColor(lc)};color:${_lineColor(lc)}">${lc}</span>`).join('')}
    </div>
    <div class="map-header__right">
      <span class="map-game-indicator" id="map-game-indicator">IDLE</span>
    </div>
  `;
  container.appendChild(header);

  // ── SVG canvas area ──────────────────────────────────────────────────────
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'map-canvas-wrap';
  canvasWrap.id = 'map-canvas-wrap';
  container.appendChild(canvasWrap);

  // ── Initial render: base map (no ownership) ──────────────────────────────
  if (_stationGraph) {
    renderMapCanvas(canvasWrap, _stationGraph, {
      players:       [],
      currentCardId: null,
      uiMode:        'idle',
      cityId:        _cityId,
    });
  } else {
    canvasWrap.innerHTML = `<div class="map-no-graph">Graph data loading...</div>`;
  }

  // ── Data status badge ────────────────────────────────────────────────────
  const statusBadge = document.createElement('div');
  statusBadge.className = 'map-data-status map-data-status--' + (dataReady ? 'ready' : 'pending');
  statusBadge.textContent = dataReady ? 'DATA READY' : 'DATA PENDING';
  container.appendChild(statusBadge);
}

/**
 * Update the map panel to reflect the current game state.
 * Called after every turn by main.js.
 *
 * @param {Object} gameState  - play_engine game state (or null for idle)
 * @param {string} [uiMode]   - 'idle' | 'loading' | 'running' | 'finished' | 'error'
 * @param {Object} [graph]    - station_graph (optional override; uses cached if omitted)
 */
export function updateMapFromState(gameState, uiMode, graph) {
  const indicator  = document.getElementById('map-game-indicator');
  const canvasWrap = document.getElementById('map-canvas-wrap');

  // Use provided graph or fall back to cached
  const activeGraph = graph ?? _stationGraph;

  // ── Update indicator text ────────────────────────────────────────────────
  if (indicator) {
    indicator.className = 'map-game-indicator';

    if (!gameState || uiMode === 'idle') {
      indicator.textContent = 'IDLE';
    } else if (uiMode === 'loading') {
      indicator.textContent = 'LOADING';
      indicator.classList.add('map-game-indicator--loading');
    } else if (uiMode === 'error') {
      indicator.textContent = 'ERROR';
      indicator.classList.add('map-game-indicator--error');
    } else if (gameState.gameOver) {
      const winner = gameState.winner ? `${gameState.winner} WINS` : 'DRAW';
      indicator.textContent = `GAME OVER · ${winner} · T${gameState.turnCount}`;
      indicator.classList.add('map-game-indicator--finished');
    } else {
      const currentPlayer = gameState.players[gameState.turnIndex];
      indicator.textContent = `T${gameState.turnCount} · ${currentPlayer?.id}`;
      indicator.classList.add('map-game-indicator--running');
    }
  }

  // ── Re-render SVG map ────────────────────────────────────────────────────
  if (!canvasWrap || !activeGraph) return;

  if (!gameState || uiMode === 'idle') {
    renderMapCanvas(canvasWrap, activeGraph, {
      players:       [],
      currentCardId: null,
      uiMode:        'idle',
      cityId:        _cityId,
    });
    return;
  }

  const currentCardId = gameState.currentCard?.station_global_id ?? null;
  const effectiveMode = gameState.gameOver ? 'finished' : (uiMode ?? 'running');

  renderMapCanvas(canvasWrap, activeGraph, {
    players:       gameState.players,
    currentCardId,
    uiMode:        effectiveMode,
    cityId:        _cityId,
  });
}

/**
 * Inject the station graph after boot (called from main.js once datasets load).
 * @param {Object} graph
 */
export function setStationGraph(graph) {
  _stationGraph = graph;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _lineColor(lc) {
  const palette = {
    JY: '#80c080', G: '#f0a020', M: '#e04040', T: '#40a0c0', Z: '#8060c0',
    Y: '#40b0a0',  HK: '#c08040', OC: '#e06060',
    CEN: '#e05020', NOR: '#404040', PIC: '#2040a0', DIS: '#408040', CIR: '#c0c020',
    L1: '#c04040',  L4: '#408040', LA: '#4060c0', LN: '#c0c040', L7: '#8040c0',
  };
  return palette[lc] ?? '#6e7681';
}
