/**
 * station_hint.js — GUNOS V1 Station Value Hint Panel
 *
 * V1.4 Task 01: Adds a lightweight station value hint panel to the map overlay.
 *
 * Shows short value tags for the most recently acquired station:
 *   Hub★ / Hub+ / Hub / Route+ / Capture! / Chain / Lead+ / Score / Value
 *
 * Placement: bottom-left, above #bottom-area, inside #hud-layer.
 * Fades after 4 seconds.
 *
 * All panels use pointer-events: none so map interaction is unaffected.
 */

// ── State ─────────────────────────────────────────────────────────────────────

let _fadeTimer = null;
let _lastTurnCount = -1;

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Inject the station hint panel HTML into #map-overlay-info.
 * Call once after initMapOverlay().
 */
export function initStationHint() {
  const overlayInfo = document.getElementById('map-overlay-info');
  if (!overlayInfo) return;

  // Avoid double-init
  if (document.getElementById('station-hint-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'station-hint-panel';
  panel.className = 'sh-panel sh-panel--hidden';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = `
    <div class="sh-station-name" id="sh-station-name"></div>
    <div class="sh-tags" id="sh-tags"></div>
    <div class="sh-reason" id="sh-reason"></div>
  `;

  overlayInfo.appendChild(panel);
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update the station hint panel based on the latest game state and scores.
 *
 * @param {Object|null} gameState — play_engine game state
 * @param {Array} playerScores — from computeAllLiveScores()
 * @param {string} uiMode — 'idle' | 'running' | 'finished'
 */
export function updateStationHint(gameState, playerScores, uiMode) {
  const panel = document.getElementById('station-hint-panel');
  if (!panel) return;

  // Hide when not running
  if (uiMode !== 'running' || !gameState || !playerScores || !playerScores.length) {
    _hideHint(panel);
    return;
  }

  // Only update when a new turn has been played
  const turnCount = gameState.turnCount ?? 0;
  if (turnCount === 0) {
    _hideHint(panel);
    return;
  }

  // Determine which player just played (previous turn index)
  // After playTurn, turnIndex points to the NEXT player
  const prevIndex = (gameState.turnIndex - 1 + gameState.players.length) % gameState.players.length;
  const prevPlayer = gameState.players[prevIndex];
  const prevPlayerId = prevPlayer?.id;

  // Get scores for the previous player
  const prevScore = playerScores.find(p => p.playerId === prevPlayerId);
  if (!prevScore) {
    _hideHint(panel);
    return;
  }

  // Get the current card (the station just played)
  const currentCard = gameState.currentCard;
  if (!currentCard) {
    _hideHint(panel);
    return;
  }

  const stationName = currentCard.station_name || currentCard.card_id || '—';
  const cardScore   = currentCard.score_total ?? 0;

  // Compute value tags for this station
  const tags = _computeValueTags(currentCard, prevScore, playerScores, cardScore);

  // Build reason line
  const reason = _buildReasonLine(tags, prevPlayerId);

  // Update DOM
  const nameEl   = document.getElementById('sh-station-name');
  const tagsEl   = document.getElementById('sh-tags');
  const reasonEl = document.getElementById('sh-reason');

  if (nameEl)   nameEl.textContent = stationName;
  if (tagsEl)   tagsEl.innerHTML   = tags.map(t => `<span class="sh-tag sh-tag--${t.type}">${t.label}</span>`).join('');
  if (reasonEl) reasonEl.textContent = reason;

  // Deduplicate: only show once per turn
  if (turnCount === _lastTurnCount) return;
  _lastTurnCount = turnCount;

  // Cancel any pending fade timer
  if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }

  // Show panel — use double-rAF to ensure CSS transition fires reliably
  panel.style.transition = 'none';
  panel.style.opacity = '0';
  panel.style.transform = 'translateY(6px)';
  panel.classList.remove('sh-panel--hidden', 'sh-panel--fading', 'sh-panel--visible');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';

      // Auto-fade after 4 seconds (start timer AFTER opacity:1 is applied)
      if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }
      _fadeTimer = setTimeout(() => {
        panel.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(4px)';
        _fadeTimer = null;
      }, 4000);
    });
  });
}

/**
 * Reset the station hint panel (on game reset).
 */
export function resetStationHint() {
  const panel = document.getElementById('station-hint-panel');
  if (panel) _hideHint(panel);
  _lastTurnCount = -1;
  if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }
}

// ── Internal: Tag computation ─────────────────────────────────────────────────

/**
 * Compute value tags for a station based on scoring data.
 * Returns array of { type, label, priority }.
 */
function _computeValueTags(currentCard, playerScore, allScores, cardScore) {
  const tags = [];
  const stationName = currentCard.station_name || '';
  const stationId   = currentCard.card_id || currentCard.station_global_id || '';

  // ── Hub tags ──────────────────────────────────────────────────────────────
  const hubEntry = (playerScore.hub_stations || []).find(h =>
    h.station_global_id === stationId ||
    h.station_name === stationName ||
    (stationName && h.station_name && h.station_name.includes(stationName))
  );
  if (hubEntry) {
    if (hubEntry.bonus >= 4) {
      tags.push({ type: 'hub-top', label: '◆ Hub★', priority: 10 });
    } else if (hubEntry.bonus >= 2) {
      tags.push({ type: 'hub-major', label: '◆ Hub+', priority: 9 });
    } else {
      tags.push({ type: 'hub', label: '◆ Hub', priority: 8 });
    }
  }

  // ── Route capture / chain tags ────────────────────────────────────────────
  const routeProgress = playerScore.route_progress || [];
  const justComplete  = routeProgress.find(r => r.status === 'complete');
  const nearComplete  = routeProgress.find(r => r.pct >= 50 && r.status !== 'complete');

  if (justComplete) {
    tags.push({ type: 'capture', label: '▶ Capture!', priority: 11 });
  } else if (nearComplete) {
    tags.push({ type: 'chain', label: '▶ Chain', priority: 6 });
  }

  // ── Route+ bonus tag ──────────────────────────────────────────────────────
  if (playerScore.route_bonus > 0) {
    tags.push({ type: 'route', label: '▶ Route+', priority: 7 });
  }

  // ── Lead swing tag ────────────────────────────────────────────────────────
  if (allScores.length >= 2) {
    const sorted = [...allScores].sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
    const gap    = (sorted[0]?.final_score ?? 0) - (sorted[1]?.final_score ?? 0);
    const isLeader = sorted[0]?.playerId === playerScore.playerId;

    if (isLeader && gap >= 5) {
      tags.push({ type: 'lead', label: 'Lead+', priority: 5 });
    }
  }

  // ── Station score tag ─────────────────────────────────────────────────────
  // Use the card's own score_total (already normalized by game_session.js)
  if (cardScore >= 8) {
    tags.push({ type: 'score', label: 'Score★', priority: 4 });
  } else if (cardScore >= 5) {
    tags.push({ type: 'score', label: 'Score', priority: 3 });
  }

  // ── Fallback: always show at least a Value tag ────────────────────────────
  if (tags.length === 0) {
    const scoreLabel = cardScore > 0 ? `${cardScore.toFixed(1)} pts` : 'Value';
    tags.push({ type: 'value', label: scoreLabel, priority: 1 });
  }

  // Sort by priority descending, take top 2
  tags.sort((a, b) => b.priority - a.priority);
  return tags.slice(0, 2);
}

/**
 * Build a short reason line from the tags.
 */
function _buildReasonLine(tags, playerId) {
  if (!tags.length) return '';

  const topTag = tags[0];
  const playerLabel = playerId || 'P?';

  switch (topTag.type) {
    case 'capture':   return 'Route captured';
    case 'hub-top':   return 'Top interchange';
    case 'hub-major': return 'Major hub';
    case 'hub':       return 'Hub connection';
    case 'route':     return 'Route bonus extended';
    case 'chain':     return 'Route chain built';
    case 'lead':      return 'Lead extended';
    case 'score':     return 'High-value station';
    case 'value':     return 'Station acquired';
    default:          return '';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _hideHint(panel) {
  panel.style.opacity = '0';
  panel.style.transform = 'translateY(6px)';
  panel.classList.remove('sh-panel--visible', 'sh-panel--fading');
  panel.classList.add('sh-panel--hidden');
  if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }
}
