/**
 * map_panel.js — GUNOS V1 Map Panel
 *
 * The map panel is the visual center of the GUNOS V1 play screen.
 *
 * Phase 2: city-aware placeholder with featured lines display
 * Phase 3: game-active state awareness — shows active game indicator
 * Phase 4: full route/network visualization
 */

/**
 * Render the map panel with city-aware content.
 *
 * @param {Object} opts
 * @param {Object} opts.profile  - Loaded city profile
 */
export function renderMapPanel({ profile }) {
  const container = document.getElementById('map-panel-body');
  if (!container) return;

  const cityLabel     = profile._display_label || profile.city_id.toUpperCase();
  const cityName      = profile.display_name || profile.city_id;
  const featuredLines = profile.routes?.featured_lines ?? [];
  const dataReady     = profile.status?.data_ready ?? false;

  container.innerHTML = '';

  // City identity block
  const identity = document.createElement('div');
  identity.className = 'map-city-identity';
  identity.innerHTML = `
    <div class="map-city-identity__label">${cityLabel}</div>
    <div class="map-city-identity__name">${cityName}</div>
  `;
  container.appendChild(identity);

  // Featured lines badge row
  if (featuredLines.length > 0) {
    const linesRow = document.createElement('div');
    linesRow.className = 'map-lines-row';
    featuredLines.forEach(lc => {
      const badge = document.createElement('span');
      badge.className = 'map-line-badge';
      badge.textContent = lc;
      badge.style.borderColor = _lineColor(lc);
      badge.style.color = _lineColor(lc);
      linesRow.appendChild(badge);
    });
    container.appendChild(linesRow);
  }

  // Game state indicator (Phase 3)
  const gameIndicator = document.createElement('div');
  gameIndicator.className = 'map-game-indicator';
  gameIndicator.id = 'map-game-indicator';
  gameIndicator.innerHTML = `<span class="map-game-indicator__text" id="map-game-status-text">IDLE — press START to begin</span>`;
  container.appendChild(gameIndicator);

  // Grid area
  const placeholder = document.createElement('div');
  placeholder.className = 'map-placeholder';
  placeholder.innerHTML = `
    <div class="map-placeholder__grid" id="map-grid-area">
      ${_buildGridPlaceholder(featuredLines)}
    </div>
    <div class="map-placeholder__note" id="map-phase-note">
      Phase 4 — route network visualization
    </div>
  `;
  container.appendChild(placeholder);

  // Data status badge
  const statusBadge = document.createElement('div');
  statusBadge.className = 'map-data-status map-data-status--' + (dataReady ? 'ready' : 'pending');
  statusBadge.textContent = dataReady ? 'DATA READY' : 'DATA PENDING';
  container.appendChild(statusBadge);
}

/**
 * Update the map panel to reflect game-active state.
 * Phase 3: minimal — shows running indicator and current card station.
 *
 * @param {Object} gameState - play_engine game state (or null for idle)
 * @param {string} [uiMode]  - 'idle' | 'loading' | 'running' | 'finished'
 */
export function updateMapFromState(gameState, uiMode) {
  const statusText = document.getElementById('map-game-status-text');
  const indicator  = document.getElementById('map-game-indicator');
  const gridArea   = document.getElementById('map-grid-area');

  if (!gameState || uiMode === 'idle') {
    if (statusText) statusText.textContent = 'IDLE — press START to begin';
    if (indicator)  indicator.className = 'map-game-indicator';
    return;
  }

  if (uiMode === 'loading') {
    if (statusText) statusText.textContent = 'Loading...';
    if (indicator)  indicator.className = 'map-game-indicator map-game-indicator--loading';
    return;
  }

  if (uiMode === 'error') {
    if (statusText) statusText.textContent = 'Error — check log';
    if (indicator)  indicator.className = 'map-game-indicator map-game-indicator--error';
    return;
  }

  if (gameState.gameOver) {
    const winner = gameState.winner ? `Winner: ${gameState.winner}` : 'Turn limit reached';
    if (statusText) statusText.textContent = `GAME OVER — ${winner} (${gameState.turnCount} turns)`;
    if (indicator)  indicator.className = 'map-game-indicator map-game-indicator--finished';
    return;
  }

  // Running
  const currentCard   = gameState.currentCard;
  const currentPlayer = gameState.players[gameState.turnIndex];
  const cardName      = currentCard?.station_name || '—';
  if (statusText) {
    statusText.textContent = `RUNNING — T${gameState.turnCount} · ${currentPlayer?.id} · ${cardName}`;
  }
  if (indicator) indicator.className = 'map-game-indicator map-game-indicator--running';

  // Phase 3: highlight the current card's line in the grid
  if (gridArea && currentCard) {
    _highlightCurrentCard(gridArea, currentCard);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _buildGridPlaceholder(featuredLines) {
  if (featuredLines.length === 0) {
    return '<div class="map-grid-empty">No featured lines configured</div>';
  }
  return featuredLines.map(lc => {
    const color = _lineColor(lc);
    const slots = Array.from({ length: 10 }, (_, i) =>
      `<div class="map-slot" data-line="${lc}" data-slot="${i}" style="border-color:${color}22; background:${color}11;" title="${lc}-${i + 1}"></div>`
    ).join('');
    return `
      <div class="map-line-row">
        <div class="map-line-row__label" style="color:${color};">${lc}</div>
        <div class="map-line-row__slots">${slots}</div>
      </div>`;
  }).join('');
}

/**
 * Phase 3: Highlight the current card's slot in the grid.
 * Uses card_id index as a proxy for slot position until Phase 4 adds real routing.
 */
function _highlightCurrentCard(gridArea, currentCard) {
  // Remove previous highlights
  gridArea.querySelectorAll('.map-slot--active').forEach(el => {
    el.classList.remove('map-slot--active');
  });

  // card_id is "card_001" format — use index to pick a slot
  const match = currentCard.card_id?.match(/card_(\d+)/);
  if (!match) return;
  const idx = (parseInt(match[1], 10) - 1) % 10;

  // Highlight the slot in the first line row (proxy for Phase 3)
  const slots = gridArea.querySelectorAll(`.map-slot[data-slot="${idx}"]`);
  if (slots.length > 0) {
    slots[0].classList.add('map-slot--active');
  }
}

function _lineColor(lc) {
  const palette = {
    JY: '#80c080', G: '#f0a020', M: '#e04040', T: '#40a0c0', Z: '#8060c0',
    Y: '#40b0a0', HK: '#c08040', OC: '#e06060',
    CEN: '#e05020', NOR: '#404040', PIC: '#2040a0', DIS: '#408040', CIR: '#c0c020',
    L1: '#c04040', L4: '#408040', LA: '#4060c0', LN: '#c0c040', L7: '#8040c0',
  };
  return palette[lc] ?? '#6e7681';
}
