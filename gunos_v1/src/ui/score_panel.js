/**
 * score_panel.js — GUNOS V1 Score / Status Panel
 *
 * Bottom-right panel: current card, player info, score summary, log.
 *
 * Phase 2: structured placeholder
 * Phase 3: wired to real game state — current card, player, turn, log
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

      <!-- Score summary (Phase 5+) -->
      <div class="score-section score-section--scores">
        <div class="score-section__title">SCORE</div>
        <div class="score-rows">
          <div class="score-row">
            <span class="score-row__label">Route</span>
            <span class="score-row__value" id="score-route">—</span>
          </div>
          <div class="score-row">
            <span class="score-row__label">Network</span>
            <span class="score-row__value" id="score-network">—</span>
          </div>
          <div class="score-row score-row--total">
            <span class="score-row__label">Total</span>
            <span class="score-row__value" id="score-total">—</span>
          </div>
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
 * Update score display values.
 * @param {{ route?: number, network?: number, total?: number }} scores
 */
export function updateScores({ route, network, total } = {}) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.textContent = val;
  };
  set('score-route',   route);
  set('score-network', network);
  set('score-total',   total);
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
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}
