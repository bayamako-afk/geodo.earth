/**
 * score_reason.js — GUNOS V1 Score Reason Breakdown
 *
 * V1.4 Task 04: Score Reason Breakdown
 *
 * Adds a compact panel below the score summary (#map-overlay-scores)
 * that shows WHY the score changed this turn.
 *
 * Components:
 *   - #score-reason-panel  : compact reason tag row + short reason line
 *
 * Design principles:
 *   - map-first: panel is small, right-aligned, non-blocking
 *   - reason tags use the same ◆/▶ icon system as Task 01–03
 *   - shows delta values when available (+N Hub+, +N Route+, etc.)
 *   - max 3 reason tags to avoid clutter
 *   - 1 short reason line below tags
 *   - hides when idle or no reason detected
 */

// ── State ─────────────────────────────────────────────────────────────────────

/** Previous score snapshot per player for delta detection */
const _prevSnapshot = {};

/** Whether the panel has been initialised */
let _initialised = false;

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Inject the score reason panel into #map-overlay-scores.
 * Call once after initMapOverlay().
 */
export function initScoreReason() {
  if (_initialised) return;

  const scoresPanel = document.getElementById('map-overlay-scores');
  if (!scoresPanel) return;

  // Avoid double-init
  if (document.getElementById('score-reason-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'score-reason-panel';
  panel.className = 'sr-panel sr-panel--hidden';
  panel.innerHTML = `
    <div class="sr-tags" id="sr-tags"></div>
    <div class="sr-reason" id="sr-reason"></div>
  `;

  scoresPanel.appendChild(panel);
  _initialised = true;
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update the score reason panel based on the latest score snapshot.
 *
 * @param {Object|null} gameState  — current game state
 * @param {Array}       scores     — from computeAllLiveScores()
 * @param {string}      uiMode     — 'idle' | 'running' | 'finished'
 */
export function updateScoreReason(gameState, scores, uiMode) {
  const panel   = document.getElementById('score-reason-panel');
  const tagsEl  = document.getElementById('sr-tags');
  const reasonEl = document.getElementById('sr-reason');
  if (!panel || !tagsEl || !reasonEl) return;

  // Hide when idle
  if (uiMode === 'idle' || !scores || !scores.length || !gameState) {
    _hidePanel(panel);
    return;
  }

  // Build reason tags from score deltas
  const reasons = _buildReasons(gameState, scores);

  if (!reasons.tags.length) {
    _hidePanel(panel);
    return;
  }

  // Render tags
  tagsEl.innerHTML = reasons.tags
    .slice(0, 3)
    .map(t => `<span class="sr-tag sr-tag--${t.type}">${_escapeHtml(t.label)}</span>`)
    .join('');

  // Render reason line
  reasonEl.textContent = reasons.reason || '';
  reasonEl.style.display = reasons.reason ? '' : 'none';

  // Show panel
  _showPanel(panel);
}

/**
 * Reset the score reason panel to hidden state.
 */
export function resetScoreReason() {
  const panel = document.getElementById('score-reason-panel');
  if (panel) _hidePanel(panel);

  // Clear previous snapshots
  for (const key of Object.keys(_prevSnapshot)) {
    delete _prevSnapshot[key];
  }
}

// ── Reason builder ────────────────────────────────────────────────────────────

/**
 * Build reason tags and a short reason line from score deltas.
 *
 * @param {Object} gameState
 * @param {Array}  scores
 * @returns {{ tags: Array<{type, label, priority}>, reason: string }}
 */
function _buildReasons(gameState, scores) {
  const tags = [];
  let topReason = '';

  // Determine "current player" — the player who just played
  // (last entry in play order before current turn)
  const currentPlayer = gameState?.currentPlayer ?? null;
  const turnCount     = gameState?.turnCount ?? 0;

  // We show reasons for the player who just acted.
  // On turn 0 (game start), show nothing.
  if (turnCount === 0) return { tags, reason: '' };

  // Find the player who just played (the one before currentPlayer in turn order)
  // In a 2-player game: if currentPlayer is P1, last player was P2, and vice versa.
  // Simpler: show reasons for the player with the highest recent delta.
  let focusScore = null;
  let maxDelta   = 0;

  for (const ps of scores) {
    const prev = _prevSnapshot[ps.playerId] || {};
    const delta = (ps.final_score ?? 0) - (prev.final_score ?? 0);
    if (delta > maxDelta) {
      maxDelta   = delta;
      focusScore = ps;
    }
  }

  // If no delta detected, try the current player's score
  if (!focusScore && currentPlayer) {
    focusScore = scores.find(ps => ps.playerId === currentPlayer) ?? scores[0] ?? null;
  }

  if (!focusScore) return { tags, reason: '' };

  const prev = _prevSnapshot[focusScore.playerId] || {};

  // ── Hub bonus delta ──────────────────────────────────────────────────────────
  const hubDelta = (focusScore.hub_bonus ?? 0) - (prev.hub_bonus ?? 0);
  if (hubDelta > 0) {
    const hubVal = focusScore.hub_bonus ?? 0;
    if (hubVal >= 10) {
      tags.push({ type: 'hub-top', label: `◆ +${hubDelta.toFixed(0)} Hub★`, priority: 10 });
    } else if (hubVal >= 5) {
      tags.push({ type: 'hub-major', label: `◆ +${hubDelta.toFixed(0)} Hub+`, priority: 9 });
    } else {
      tags.push({ type: 'hub', label: `◆ +${hubDelta.toFixed(0)} Hub`, priority: 8 });
    }
    if (!topReason) topReason = 'Hub bonus increased this turn.';
  }

  // ── Route+ bonus delta ───────────────────────────────────────────────────────
  const routeDelta = (focusScore.route_bonus ?? 0) - (prev.route_bonus ?? 0);
  if (routeDelta > 0) {
    tags.push({ type: 'route', label: `▶ +${routeDelta.toFixed(0)} Route+`, priority: 7 });
    if (!topReason) topReason = 'Route chain extended.';
  }

  // ── Station capture / score delta ────────────────────────────────────────────
  const stationDelta = (focusScore.station_score ?? 0) - (prev.station_score ?? 0);
  if (stationDelta > 0) {
    // Check if a route was just completed (route_progress has a 'complete' entry)
    const routeProgress = focusScore.route_progress || [];
    const justComplete  = routeProgress.find(r => r.status === 'complete');
    if (justComplete) {
      tags.push({ type: 'capture', label: `▶ +${stationDelta.toFixed(0)} Capture`, priority: 11 });
      if (!topReason) topReason = 'Route capture scored.';
    } else {
      tags.push({ type: 'score', label: `+${stationDelta.toFixed(0)} Score`, priority: 5 });
      if (!topReason) topReason = 'Station score added.';
    }
  }

  // ── Lead gap change ──────────────────────────────────────────────────────────
  if (scores.length >= 2) {
    const sorted = [...scores].sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
    const gap    = (sorted[0].final_score ?? 0) - (sorted[1].final_score ?? 0);
    const prevGap = _computePrevGap(scores);
    const gapDelta = gap - prevGap;

    // Show Lead+ if the gap narrowed for the trailing player
    const isLeading = focusScore.playerId === sorted[0].playerId;
    if (!isLeading && gapDelta < -2) {
      tags.push({ type: 'lead', label: `Lead+`, priority: 4 });
      if (!topReason) topReason = 'Leader gap narrowed.';
    } else if (isLeading && gapDelta > 2) {
      tags.push({ type: 'lead-ext', label: `Lead↑`, priority: 3 });
      if (!topReason) topReason = 'Lead extended.';
    }
  }

  // Sort by priority descending
  tags.sort((a, b) => b.priority - a.priority);

  // Update snapshot AFTER building reasons
  _updateSnapshot(scores);

  return { tags, reason: topReason };
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

/**
 * Update the previous score snapshot.
 * @param {Array} scores
 */
function _updateSnapshot(scores) {
  for (const ps of scores) {
    _prevSnapshot[ps.playerId] = {
      final_score:   ps.final_score   ?? 0,
      hub_bonus:     ps.hub_bonus     ?? 0,
      route_bonus:   ps.route_bonus   ?? 0,
      station_score: ps.station_score ?? 0,
    };
  }
}

/**
 * Compute the previous score gap between the top two players.
 * @param {Array} scores
 * @returns {number}
 */
function _computePrevGap(scores) {
  if (scores.length < 2) return 0;
  const prevVals = scores.map(ps => _prevSnapshot[ps.playerId]?.final_score ?? 0);
  prevVals.sort((a, b) => b - a);
  return prevVals[0] - prevVals[1];
}

// ── Panel visibility ──────────────────────────────────────────────────────────

function _showPanel(panel) {
  panel.classList.remove('sr-panel--hidden');
  panel.classList.add('sr-panel--visible');
  requestAnimationFrame(() => {
    panel.style.opacity   = '1';
    panel.style.transform = 'translateY(0)';
  });
}

function _hidePanel(panel) {
  panel.classList.remove('sr-panel--visible');
  panel.classList.add('sr-panel--hidden');
  panel.style.opacity   = '0';
  panel.style.transform = 'translateY(4px)';
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
