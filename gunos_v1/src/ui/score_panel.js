/**
 * score_panel.js — GUNOS V1 Score Panel
 *
 * Bottom-right panel: current player info, active card, score summary.
 *
 * Phase 2: structured placeholder with score row stubs
 * Phase 5: will be wired to scoring engine and result UX
 */

/**
 * Render the score panel placeholder.
 * @param {Object} opts
 * @param {Object} opts.profile - Loaded city profile
 */
export function renderScorePanel({ profile }) {
  const container = document.getElementById('score-panel-body');
  if (!container) return;

  container.innerHTML = `
    <div class="score-panel-inner">

      <!-- Current card area -->
      <div class="score-section score-section--card">
        <div class="score-section__title">CURRENT CARD</div>
        <div class="score-current-card" id="score-current-card">
          <div class="score-current-card__slot">—</div>
        </div>
      </div>

      <!-- Score summary -->
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

      <!-- Log panel -->
      <div class="score-section score-section--log">
        <div class="score-section__title">LOG</div>
        <div class="score-log" id="log-area">
          <div class="score-log__entry score-log__entry--muted">Phase 3: play engine integration</div>
        </div>
      </div>

    </div>
  `;
}

/**
 * Append a log entry to the log area.
 * @param {string} text
 * @param {'normal'|'highlight'|'muted'} [type='normal']
 */
export function appendLogEntry(text, type = 'normal') {
  const logArea = document.getElementById('log-area');
  if (!logArea) return;

  const entry = document.createElement('div');
  entry.className = `score-log__entry score-log__entry--${type}`;
  entry.textContent = text;
  logArea.appendChild(entry);

  // Auto-scroll to bottom
  logArea.scrollTop = logArea.scrollHeight;
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
