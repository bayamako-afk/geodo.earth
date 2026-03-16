/**
 * map_panel.js — GUNOS V1 Map Panel
 *
 * Phase 6: Cross-city presentation + network visibility polish
 *
 * Improvements:
 *   - City descriptor text (e.g. "dense baseline network")
 *   - Station count / route count summary line
 *   - Network growth visibility: stronger glow on owned adjacency
 *   - Route completion highlight: full-line emphasis when route is completed
 *   - Cleaner header layout with city identity + descriptor
 */

import { renderMapCanvas } from './map_canvas.js?v=13';

// City descriptor map — "same engine, different city behavior"
const CITY_DESCRIPTORS = {
  tokyo:  'dense baseline network',
  osaka:  'compact balanced network',
  london: 'transfer-heavy metro core',
  nyc:    'long-distance Manhattan hub system',
};

// Module-level graph cache (set once per city boot)
let _stationGraph  = null;
let _cityId        = null;
let _profile       = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initial render of the map panel (idle state).
 */
export function renderMapPanel({ profile, stationGraph }) {
  const container = document.getElementById('map-panel-body');
  if (!container) return;

  const cityLabel     = profile._display_label || profile.city_id.toUpperCase();
  const cityName      = profile.display_name || profile.city_id;
  const featuredLines = profile.routes?.featured_lines ?? [];
  const dataReady     = profile.status?.data_ready ?? false;
  const descriptor    = CITY_DESCRIPTORS[profile.city_id] ?? '';

  // Station / route count summary
  const stationCount = profile.routes?.total_stations ?? profile.stats?.station_count ?? null;
  const routeCount   = profile.routes?.total_routes   ?? profile.stats?.route_count   ?? null;
  const summaryParts = [];
  if (stationCount) summaryParts.push(`${stationCount} stations`);
  if (routeCount)   summaryParts.push(`${routeCount} routes`);
  const summary = summaryParts.join(' · ');

  // Cache for updates
  _stationGraph = stationGraph ?? null;
  _cityId       = profile.city_id;
  _profile      = profile;

  container.innerHTML = '';

  // ── Compact header row ───────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'map-header';
  header.innerHTML = `
    <div class="map-header__identity">
      <span class="map-city-label">${cityLabel}</span>
      <span class="map-city-name">${cityName}</span>
      ${descriptor ? `<span class="map-city-descriptor">${descriptor}</span>` : ''}
      ${summary    ? `<span class="map-city-summary">${summary}</span>`     : ''}
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
  statusBadge.id = 'map-data-status';
  statusBadge.textContent = dataReady ? 'DATA READY' : 'DATA PENDING';
  container.appendChild(statusBadge);
}

/**
 * Update the map panel to reflect the current game state.
 */
export function updateMapFromState(gameState, uiMode, graph) {
  const indicator  = document.getElementById('map-game-indicator');
  const canvasWrap = document.getElementById('map-canvas-wrap');

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
      const deckLeft = gameState.deck?.length ?? '?';
      indicator.textContent = `T${gameState.turnCount} · ${currentPlayer?.id} · DECK ${deckLeft}`;
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
 * Inject the station graph after boot.
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
