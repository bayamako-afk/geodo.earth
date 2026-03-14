/**
 * score_panel.js — GUNOS V1 Score / Status Panel
 *
 * Bottom-right panel: current card, game status, live score summary, log.
 *
 * Phase 2: structured placeholder
 * Phase 3: wired to real game state — current card, player, turn, log
 * Phase 5: live score display — station / route / hub / total per player
 */

/**
 * Render the score panel structure.
 * @param {Object} opts
 * @param {Object} opts.profile - Loaded city profile
 */
export function renderScorePanel({ profile }) {
  const container = document.getElementById('score-panel-body');
  if (!container) return;

  container.innerHTML = `
    <div class="score-panel-inner">

      <!-- Current card -->
      <div class="score-section score-section--card">
        <div class="score-section__title">CURRENT CARD</div>
        <div class="score-current-card" id="score-current-card">
          <div class="score-current-card__name" id="score-card-name">—</div>
          <div class="score-current-card__meta" id="score-card-meta"></div>
        </div>
      </div>

      <!-- Game status -->
      <div class="score-section score-section--status">
        <div class="score-section__title">STATUS</div>
        <div class="score-status-rows">
          <div class="score-status-row">
            <span class="score-status-label">Mode</span>
            <span class="score-status-value" id="status-mode">IDLE</span>
          </div>
          <div class="score-status-row">
            <span class="score-status-label">Player</span>
            <span class="score-status-value" id="status-player">—</span>
          </div>
          <div class="score-status-row">
            <span class="score-status-label">Turn</span>
            <span class="score-status-value" id="status-turn">—</span>
          </div>
          <div class="score-status-row">
            <span class="score-status-label">Deck</span>
            <span class="score-status-value" id="status-deck">—</span>
          </div>
        </div>
      </div>

      <!-- Live score summary (Phase 5) -->
      <div class="score-section score-section--scores" id="score-section-scores">
        <div class="score-section__title">SCORE</div>
        <div id="score-live-area">
          <!-- Populated by updateLiveScores() -->
          <div class="score-placeholder">—</div>
        </div>
      </div>

      <!-- Log -->
      <div class="score-section score-section--log">
        <div class="score-section__title">LOG</div>
        <div class="score-log" id="log-area">
          <div class="score-log__entry score-log__entry--muted">Waiting for game start...</div>
        </div>
      </div>

    </div>
  `;
}

/**
 * Update the score panel from real game state.
 * @param {Object} gameState - play_engine game state
 * @param {string} [uiMode]  - 'idle' | 'loading' | 'running' | 'finished' | 'error'
 */
export function updateStatusFromState(gameState, uiMode) {
  if (!gameState) {
    _resetStatus(uiMode || 'idle');
    return;
  }

  const currentPlayer = gameState.players[gameState.turnIndex];
  const currentCard   = gameState.currentCard;

  // Current card
  if (currentCard) {
    const name   = currentCard.station_name || currentCard.card_id;
    const rarity = currentCard.rarity || '';
    const score  = currentCard.score_total != null ? currentCard.score_total.toFixed(1) : '';

    _setText('score-card-name', name);
    const metaEl = document.getElementById('score-card-meta');
    if (metaEl) {
      metaEl.innerHTML = [
        rarity ? `<span class="score-card-rarity score-card-rarity--${rarity.toLowerCase()}">${rarity}</span>` : '',
        score  ? `<span class="score-card-score">${score} pts</span>` : '',
      ].filter(Boolean).join(' ');
    }
  } else {
    _setText('score-card-name', '—');
    const metaEl = document.getElementById('score-card-meta');
    if (metaEl) metaEl.innerHTML = '';
  }

  // Status rows
  const mode = uiMode || (gameState.gameOver ? 'finished' : 'running');
  _setText('status-mode',   mode.toUpperCase());
  _setText('status-player', currentPlayer?.id ?? '—');
  _setText('status-turn',   gameState.turnCount);
  _setText('status-deck',   gameState.deck.length);

  // Mode badge color
  const modeEl = document.getElementById('status-mode');
  if (modeEl) {
    modeEl.className = 'score-status-value score-status-value--' + mode;
  }
}

/**
 * Update the live score section with per-player score data.
 * @param {Array<{playerId, station_score, route_bonus, hub_bonus, final_score, route_details}>} playerScores
 */
export function updateLiveScores(playerScores) {
  const area = document.getElementById('score-live-area');
  if (!area) return;

  if (!playerScores || !playerScores.length) {
    area.innerHTML = '<div class="score-placeholder">—</div>';
    return;
  }

  const rows = playerScores.map(ps => {
    const { playerId, station_score, route_bonus, hub_bonus, final_score, route_details } = ps;

    // Best route label
    const bestRoute = route_details?.find(r => r.bonus > 0);
    const routeLabel = bestRoute
      ? `${bestRoute.line_name_en || bestRoute.line_id} (${bestRoute.count}/${bestRoute.route_total})`
      : '—';

    const playerClass = playerId === 'P1' ? 'p1' : playerId === 'P2' ? 'p2' : 'pn';

    return `
      <div class="score-player-block score-player-block--${playerClass}">
        <div class="score-player-header">
          <span class="score-player-id score-player-id--${playerClass}">${playerId}</span>
          <span class="score-player-total">${_fmt(final_score)}</span>
        </div>
        <div class="score-breakdown-rows">
          <div class="score-breakdown-row">
            <span class="score-breakdown-label">Station</span>
            <span class="score-breakdown-value">${_fmt(station_score)}</span>
          </div>
          <div class="score-breakdown-row">
            <span class="score-breakdown-label">Route</span>
            <span class="score-breakdown-value score-breakdown-value--bonus">${_fmt(route_bonus)}</span>
          </div>
          <div class="score-breakdown-row">
            <span class="score-breakdown-label">Hub</span>
            <span class="score-breakdown-value score-breakdown-value--bonus">${_fmt(hub_bonus)}</span>
          </div>
          <div class="score-breakdown-row score-breakdown-row--route">
            <span class="score-breakdown-label">Best route</span>
            <span class="score-breakdown-value score-breakdown-value--route">${routeLabel}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  area.innerHTML = rows;
}

/**
 * Append a log entry to the log area.
 * @param {string} text
 * @param {'normal'|'highlight'|'muted'|'warn'} [type='normal']
 */
export function appendLogEntry(text, type = 'normal') {
  const logArea = document.getElementById('log-area');
  if (!logArea) return;

  const entry = document.createElement('div');
  entry.className = `score-log__entry score-log__entry--${type}`;
  entry.textContent = text;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
}

/**
 * Replace all log entries at once (bulk update).
 * @param {string[]} entries
 */
export function setLogEntries(entries) {
  const logArea = document.getElementById('log-area');
  if (!logArea) return;
  logArea.innerHTML = '';
  entries.forEach(text => appendLogEntry(text));
}

/**
 * Clear the log area.
 */
export function clearLog() {
  const logArea = document.getElementById('log-area');
  if (logArea) logArea.innerHTML = '';
}

/**
 * Legacy updateScores shim (for backwards compat with Phase 3/4 callers).
 * @param {{ route?: number, network?: number, total?: number }} scores
 */
export function updateScores({ route, network, total } = {}) {
  // No-op in Phase 5 — updateLiveScores() is the new API
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _resetStatus(mode) {
  _setText('score-card-name', '—');
  const metaEl = document.getElementById('score-card-meta');
  if (metaEl) metaEl.innerHTML = '';

  _setText('status-mode',   mode.toUpperCase());
  _setText('status-player', '—');
  _setText('status-turn',   '—');
  _setText('status-deck',   '—');

  const modeEl = document.getElementById('status-mode');
  if (modeEl) modeEl.className = 'score-status-value score-status-value--' + mode;

  // Clear live scores
  const area = document.getElementById('score-live-area');
  if (area) area.innerHTML = '<div class="score-placeholder">—</div>';
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

function _fmt(val) {
  if (val == null || val === 0) return '0';
  return typeof val === 'number' ? val.toFixed(1) : val;
}
