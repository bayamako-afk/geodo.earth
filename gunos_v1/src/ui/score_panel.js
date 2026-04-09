/**
 * score_panel.js — GUNOS V1 Score / Status Panel
 *
 * Phase 6: Readability improvements
 *   - Compact player score blocks with lead indicator
 *   - Station / Route / Hub shown as bar-style comparison
 *   - Current card section more prominent
 *   - Status rows tightened
 *   - Log area scrollable with max-height
 */

// ── Public API ────────────────────────────────────────────────────────────────

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

      <!-- Game status (compact) -->
      <div class="score-section score-section--status">
        <div class="score-status-inline" id="score-status-inline">
          <span class="score-status-chip" id="status-mode-chip">READY</span>
          <span class="score-status-item"><span class="score-status-label">P</span><span id="status-player">—</span></span>
          <span class="score-status-item"><span class="score-status-label">T</span><span id="status-turn">—</span></span>
          <span class="score-status-item"><span class="score-status-label">Deck</span><span id="status-deck">—</span></span>
        </div>
      </div>

      <!-- Live score summary -->
      <div class="score-section score-section--scores" id="score-section-scores">
        <div class="score-section__title">SCORE</div>
        <div id="score-live-area">
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

  // Compact status inline
  const mode = uiMode || (gameState.gameOver ? 'finished' : 'running');
  const chip = document.getElementById('status-mode-chip');
  if (chip) {
    const modeLabel = { idle: 'READY', loading: 'LOADING', running: 'RUNNING', finished: 'DONE', error: 'ERROR' };
    chip.textContent = modeLabel[mode] ?? mode.toUpperCase();
    chip.className   = `score-status-chip score-status-chip--${mode}`;
  }
  _setText('status-player', currentPlayer?.id ?? '—');
  _setText('status-turn',   gameState.turnCount);
  _setText('status-deck',   gameState.deck.length);
}

export function updateLiveScores(playerScores) {
  const area = document.getElementById('score-live-area');
  if (!area) return;

  if (!playerScores || !playerScores.length) {
    area.innerHTML = '<div class="score-placeholder">—</div>';
    return;
  }

  // Find leader
  const maxScore = Math.max(...playerScores.map(ps => ps.final_score ?? 0));

  const rows = playerScores.map(ps => {
    const { playerId, station_score, route_bonus, hub_bonus, final_score,
            route_progress, hub_stations } = ps;
    const isLeader    = final_score === maxScore && maxScore > 0;
    const playerClass = playerId === 'P1' ? 'p1' : playerId === 'P2' ? 'p2' : 'pn';

    // Station bar width
    const maxComp    = Math.max(station_score ?? 0, 1);
    const stationPct = Math.min(100, Math.round(((station_score ?? 0) / maxComp) * 100));

    // Route progress: show top 2 lines with progress bars
    let routeProgressHtml = '';
    if (route_progress && route_progress.length > 0) {
      const topRoutes = route_progress.slice(0, 2);
      routeProgressHtml = topRoutes.map(r => {
        const statusClass = r.status === 'complete' ? 'complete' : r.status === 'partial' ? 'partial' : 'progress';
        return `
          <div class="score-route-progress">
            <span class="score-route-name score-route-name--${statusClass}">${r.line_name}</span>
            <div class="score-route-bar-wrap">
              <div class="score-route-bar score-route-bar--${statusClass}" style="width:${r.pct}%"></div>
            </div>
            <span class="score-route-pct">${r.count}/${r.total}</span>
          </div>
        `;
      }).join('');
    }

    // Hub stations: show top 2 hub names
    let hubNamesHtml = '';
    if (hub_stations && hub_stations.length > 0 && hub_bonus > 0) {
      const topHubs = hub_stations.slice(0, 2);
      hubNamesHtml = `<div class="score-hub-names">${topHubs.map(h => `<span class="score-hub-name">${h.station_name}</span>`).join(' ')}</div>`;
    }

    return `
      <div class="score-player-block score-player-block--${playerClass} ${isLeader ? 'score-player-block--lead' : ''}">
        <div class="score-player-header">
          <span class="score-player-id score-player-id--${playerClass}">${playerId}</span>
          ${isLeader ? '<span class="score-lead-badge">▲ LEAD</span>' : ''}
          <span class="score-player-total">${_fmt(final_score)}</span>
        </div>
        <div class="score-breakdown-compact">
          <div class="score-breakdown-bar-row">
            <span class="score-breakdown-label">Stn</span>
            <div class="score-bar-wrap">
              <div class="score-bar score-bar--station" style="width:${stationPct}%"></div>
            </div>
            <span class="score-breakdown-value">${_fmt(station_score)}</span>
          </div>
          <div class="score-breakdown-row score-breakdown-row--route">
            <span class="score-breakdown-label score-breakdown-label--route">Route+
              <span class="score-info-icon">i<span class="score-info-tooltip">Own ⅓ or more of a metro line to earn a Route bonus. Complete the whole line for maximum points.</span></span>
            </span>
            <span class="score-breakdown-value score-breakdown-value--bonus ${(route_bonus > 0) ? 'score-breakdown-value--active' : ''}">${_fmt(route_bonus)}</span>
          </div>
          ${routeProgressHtml}
          <div class="score-breakdown-row score-breakdown-row--network">
            <span class="score-breakdown-label score-breakdown-label--network">Hub+
              <span class="score-info-icon">i<span class="score-info-tooltip">Owning major interchange stations (where many lines cross) earns a Hub bonus. Higher-ranked hubs give more points.</span></span>
            </span>
            <span class="score-breakdown-value score-breakdown-value--bonus ${(hub_bonus > 0) ? 'score-breakdown-value--active' : ''}">${_fmt(hub_bonus)}</span>
          </div>
          ${hubNamesHtml}
        </div>
      </div>
    `;
  }).join('');

  area.innerHTML = rows;
}

export function appendLogEntry(text, type = 'normal') {
  const logArea = document.getElementById('log-area');
  if (!logArea) return;

  const entry = document.createElement('div');
  entry.className = `score-log__entry score-log__entry--${type}`;
  entry.textContent = text;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
}

export function setLogEntries(entries) {
  const logArea = document.getElementById('log-area');
  if (!logArea) return;
  logArea.innerHTML = '';
  entries.forEach(text => appendLogEntry(text));
}

export function clearLog() {
  const logArea = document.getElementById('log-area');
  if (logArea) logArea.innerHTML = '';
}

export function updateScores({ route, network, total } = {}) {
  // No-op — updateLiveScores() is the active API
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _resetStatus(mode) {
  _setText('score-card-name', '—');
  const metaEl = document.getElementById('score-card-meta');
  if (metaEl) metaEl.innerHTML = '';

  const chip = document.getElementById('status-mode-chip');
  if (chip) {
    const modeLabel = { idle: 'READY', loading: 'LOADING', running: 'RUNNING', finished: 'DONE', error: 'ERROR' };
    chip.textContent = modeLabel[mode] ?? mode.toUpperCase();
    chip.className   = `score-status-chip score-status-chip--${mode}`;
  }
  _setText('status-player', '—');
  _setText('status-turn',   '—');
  _setText('status-deck',   '—');

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
