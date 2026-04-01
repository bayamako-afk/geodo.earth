/**
 * map_overlay.js — GUNOS V1 Map Overlay Info Panel
 *
 * V1.3 Task 05: Adds a lightweight info overlay directly on the map.
 *
 * Components:
 *   - #map-overlay-situation  : top-left, current turn / player / leader
 *   - #map-overlay-scores     : top-right, compact P1/P2 score summary
 *   - #map-overlay-toast      : bottom-center, recent event toast (auto-fades)
 *
 * All panels use pointer-events: none so map interaction is unaffected.
 */

// ── State ─────────────────────────────────────────────────────────────────────

let _toastTimer = null;

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Inject the overlay HTML into #hud-layer (inside #map-area visually).
 * Call once after layout is rendered.
 */
export function initMapOverlay() {
  // Find the hud-layer to inject overlay panels
  const hudLayer = document.getElementById('hud-layer');
  if (!hudLayer) return;

  // Avoid double-init
  if (document.getElementById('map-overlay-info')) return;

  const overlay = document.createElement('div');
  overlay.id = 'map-overlay-info';
  overlay.innerHTML = `
    <!-- Top-left: Current situation -->
    <div id="map-overlay-situation" class="moi-panel moi-panel--situation" aria-live="polite">
      <div class="moi-situation-row moi-situation-row--mode" id="moi-mode-row">
        <span class="moi-chip moi-chip--idle" id="moi-mode-chip">IDLE</span>
      </div>
      <div class="moi-situation-row" id="moi-turn-row" style="display:none">
        <span class="moi-label">TURN</span>
        <span class="moi-value" id="moi-turn">—</span>
        <span class="moi-sep">/</span>
        <span class="moi-value moi-value--dim">20</span>
      </div>
      <div class="moi-situation-row" id="moi-player-row" style="display:none">
        <span class="moi-label">NOW</span>
        <span class="moi-value moi-value--player" id="moi-player">—</span>
      </div>
      <div class="moi-situation-row" id="moi-leader-row" style="display:none">
        <span class="moi-label">LEAD</span>
        <span class="moi-value moi-value--leader" id="moi-leader">—</span>
      </div>
    </div>

    <!-- Top-right: Score summary -->
    <div id="map-overlay-scores" class="moi-panel moi-panel--scores" aria-live="polite">
      <div class="moi-score-row" id="moi-score-p1">
        <span class="moi-score-id moi-score-id--p1">P1</span>
        <span class="moi-score-val" id="moi-score-val-p1">—</span>
      </div>
      <div class="moi-score-row" id="moi-score-p2">
        <span class="moi-score-id moi-score-id--p2">P2</span>
        <span class="moi-score-val" id="moi-score-val-p2">—</span>
      </div>
      <!-- V1.4 Task 03: Global meaning badges (Hub+ / Route+ active state) -->
      <div id="moi-meaning-badges"></div>
    </div>

    <!-- Bottom-center: Recent event toast -->
    <div id="map-overlay-toast" class="moi-toast" aria-live="assertive" style="display:none">
      <span class="moi-toast-icon" id="moi-toast-icon">★</span>
      <span class="moi-toast-text" id="moi-toast-text"></span>
    </div>
  `;

  // Insert before #bottom-area so it sits under the bottom HUD
  const bottomArea = document.getElementById('bottom-area');
  if (bottomArea) {
    hudLayer.insertBefore(overlay, bottomArea);
  } else {
    hudLayer.appendChild(overlay);
  }
}

// ── Update: Situation panel ───────────────────────────────────────────────────

/**
 * Update the situation panel with current game state.
 * @param {Object|null} gameState — play_engine game state
 * @param {string} uiMode — 'idle' | 'running' | 'finished'
 * @param {Array} playerScores — from computeAllLiveScores()
 */
export function updateMapOverlaySituation(gameState, uiMode, playerScores) {
  const chip      = document.getElementById('moi-mode-chip');
  const turnRow   = document.getElementById('moi-turn-row');
  const playerRow = document.getElementById('moi-player-row');
  const leaderRow = document.getElementById('moi-leader-row');
  const turnEl    = document.getElementById('moi-turn');
  const playerEl  = document.getElementById('moi-player');
  const leaderEl  = document.getElementById('moi-leader');

  if (!chip) return;

  // Mode chip
  const modeLabel = {
    idle:     'READY',
    loading:  'LOADING',
    running:  'PLAYING',
    finished: 'GAME OVER',
    error:    'ERROR',
  }[uiMode] || uiMode.toUpperCase();

  chip.textContent = modeLabel;
  chip.className   = `moi-chip moi-chip--${uiMode}`;

  if (uiMode === 'running' && gameState) {
    // Show turn
    if (turnRow) turnRow.style.display = '';
    if (turnEl)  turnEl.textContent = gameState.turnCount ?? '—';

    // Show current player
    const currentPlayer = gameState.players?.[gameState.turnIndex];
    if (playerRow) playerRow.style.display = '';
    if (playerEl)  {
      playerEl.textContent = currentPlayer?.id ?? '—';
      playerEl.className   = `moi-value moi-value--player moi-value--${(currentPlayer?.id || 'p1').toLowerCase()}`;
    }

    // Show leader
    if (playerScores && playerScores.length > 0) {
      const maxScore = Math.max(...playerScores.map(p => p.final_score ?? 0));
      const leader   = playerScores.find(p => p.final_score === maxScore);
      if (leaderRow) leaderRow.style.display = '';
      if (leaderEl && leader) {
        const gap = playerScores.length > 1
          ? Math.abs((playerScores[0]?.final_score ?? 0) - (playerScores[1]?.final_score ?? 0))
          : 0;
        leaderEl.textContent = maxScore > 0
          ? `${leader.playerId} +${gap.toFixed(0)}`
          : '—';
        leaderEl.className = `moi-value moi-value--leader moi-value--${leader.playerId.toLowerCase()}`;
      }
    } else {
      if (leaderRow) leaderRow.style.display = 'none';
    }

  } else if (uiMode === 'finished' && gameState) {
    if (turnRow)   turnRow.style.display = '';
    if (turnEl)    turnEl.textContent = gameState.turnCount ?? '—';
    if (playerRow) playerRow.style.display = 'none';

    // Show winner as leader
    if (playerScores && playerScores.length > 0) {
      const maxScore = Math.max(...playerScores.map(p => p.final_score ?? 0));
      const winner   = playerScores.find(p => p.final_score === maxScore);
      if (leaderRow) leaderRow.style.display = '';
      if (leaderEl && winner) {
        leaderEl.textContent = `${winner.playerId} WINS`;
        leaderEl.className   = `moi-value moi-value--leader moi-value--${winner.playerId.toLowerCase()}`;
      }
    }

  } else {
    // idle / error
    if (turnRow)   turnRow.style.display = 'none';
    if (playerRow) playerRow.style.display = 'none';
    if (leaderRow) leaderRow.style.display = 'none';
  }
}

// ── Update: Score summary panel ───────────────────────────────────────────────

/**
 * Update the compact score summary in the top-right overlay.
 * @param {Array} playerScores — from computeAllLiveScores()
 */
export function updateMapOverlayScores(playerScores) {
  if (!playerScores || !playerScores.length) {
    _setScoreVal('moi-score-val-p1', '—');
    _setScoreVal('moi-score-val-p2', '—');
    _clearLeadClass('moi-score-p1');
    _clearLeadClass('moi-score-p2');
    _updateMeaningBadges([]);
    return;
  }

  const maxScore = Math.max(...playerScores.map(p => p.final_score ?? 0));

  playerScores.forEach(ps => {
    const { playerId, final_score } = ps;
    const valId  = `moi-score-val-${playerId.toLowerCase()}`;
    const rowId  = `moi-score-${playerId.toLowerCase()}`;
    const isLead = final_score === maxScore && maxScore > 0;

    _setScoreVal(valId, final_score != null ? final_score.toFixed(0) : '—');

    const rowEl = document.getElementById(rowId);
    if (rowEl) {
      rowEl.classList.toggle('moi-score-row--lead', isLead);
    }
  });

  // V1.4 Task 03: Update global meaning badges
  _updateMeaningBadges(playerScores);
}

// ── V1.4 Task 03: Global meaning badges ─────────────────────────────────────

/**
 * Update the global meaning badge bar in the score summary panel.
 * Shows Hub+ / Route+ badges when any player has active bonuses.
 * @param {Array} playerScores — from computeAllLiveScores()
 */
function _updateMeaningBadges(playerScores) {
  const badgesEl = document.getElementById('moi-meaning-badges');
  if (!badgesEl) return;

  if (!playerScores || !playerScores.length) {
    badgesEl.innerHTML = '';
    return;
  }

  const badges = [];

  // Check if any player has Hub+ bonus active
  const anyHubBonus = playerScores.some(ps => (ps.hub_bonus ?? 0) > 0);
  if (anyHubBonus) {
    // Find the player with the highest hub bonus
    const topHub = [...playerScores].sort((a, b) => (b.hub_bonus ?? 0) - (a.hub_bonus ?? 0))[0];
    const hubVal = topHub?.hub_bonus ?? 0;
    const hubLabel = hubVal >= 10 ? '◆ Hub★' : '◆ Hub+';
    badges.push(`<span class="moi-mbadge moi-mbadge--hub">${hubLabel}</span>`);
  }

  // Check if any player has Route+ bonus active
  const anyRouteBonus = playerScores.some(ps => (ps.route_bonus ?? 0) > 0);
  if (anyRouteBonus) {
    badges.push(`<span class="moi-mbadge moi-mbadge--route">▶ Route+</span>`);
  }

  badgesEl.innerHTML = badges.join('');
}

// ── Toast: Recent event ───────────────────────────────────────────────────────

/**
 * Show a brief toast message on the map overlay.
 * Auto-hides after `duration` ms.
 *
 * @param {string} text    — Short event description
 * @param {string} [type]  — 'normal' | 'bonus' | 'hub' | 'route' | 'win'
 * @param {number} [duration] — ms to show (default 3000)
 */
export function showMapOverlayToast(text, type = 'normal', duration = 3000) {
  const toast   = document.getElementById('map-overlay-toast');
  const textEl  = document.getElementById('moi-toast-text');
  const iconEl  = document.getElementById('moi-toast-icon');
  if (!toast || !textEl) return;

  // Icon by type
  const icons = {
    normal: '●',
    bonus:  '★',
    hub:    '◆',
    route:  '▶',
    win:    '🏆',
  };
  if (iconEl) iconEl.textContent = icons[type] || '●';

  textEl.textContent = text;
  toast.className    = `moi-toast moi-toast--${type}`;
  toast.style.display = '';
  toast.classList.remove('moi-toast--hidden');

  // Clear existing timer
  if (_toastTimer) clearTimeout(_toastTimer);

  _toastTimer = setTimeout(() => {
    toast.classList.add('moi-toast--hidden');
    setTimeout(() => { toast.style.display = 'none'; }, 400);
  }, duration);
}

/**
 * Hide the toast immediately.
 */
export function hideMapOverlayToast() {
  const toast = document.getElementById('map-overlay-toast');
  if (!toast) return;
  if (_toastTimer) clearTimeout(_toastTimer);
  toast.style.display = 'none';
}

// ── Reset ─────────────────────────────────────────────────────────────────────

/**
 * Reset the overlay to idle state.
 */
export function resetMapOverlay() {
  updateMapOverlaySituation(null, 'idle', []);
  updateMapOverlayScores([]);
  hideMapOverlayToast();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _setScoreVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _clearLeadClass(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('moi-score-row--lead');
}
