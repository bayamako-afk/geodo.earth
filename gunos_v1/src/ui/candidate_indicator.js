/**
 * candidate_indicator.js — GUNOS V1 Next Candidate Indicators
 *
 * V1.4 Task 02: Adds a lightweight "next candidate" panel to the map overlay.
 *
 * Shows 1–3 candidate stations the current player might want to target next,
 * with short value tags (Hub / Hub+ / Route+ / Chain / Connect / Lead+ / Score / Value)
 * and a one-line reason.
 *
 * Placement: bottom-left, above #station-hint-panel, inside #hud-layer.
 * Stays visible while the game is running; fades out on reset/game-over.
 *
 * All panels use pointer-events: none so map interaction is unaffected.
 */

// ── State ─────────────────────────────────────────────────────────────────────

let _lastTurnCount = -1;
let _session = null;   // { stationMetrics, stationLines, linesMaster } — injected once

// Drag state
let _dragging = false;
let _dragOffsetX = 0;
let _dragOffsetY = 0;
let _userPos = null;   // { left, top } in px when user has moved the panel

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Inject the candidate panel HTML into #map-overlay-info.
 * Call once after initMapOverlay().
 *
 * @param {Object} scoringData — { stationMetrics, stationLines, linesMaster }
 */
export function initCandidateIndicator(scoringData) {
  _session = scoringData || null;

  const overlayInfo = document.getElementById('map-overlay-info');
  if (!overlayInfo) return;

  // Avoid double-init
  if (document.getElementById('candidate-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'candidate-panel';
  panel.className = 'ci-panel ci-panel--hidden';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = `
    <div class="ci-header" id="ci-header">NEXT</div>
    <div class="ci-list" id="ci-list"></div>
  `;

  overlayInfo.appendChild(panel);

  // Attach drag behaviour
  _attachDrag(panel);
}

// ── Drag ─────────────────────────────────────────────────────────────────────

/**
 * Make the panel draggable via mouse and touch.
 * The panel switches to position:fixed while dragging so it can move freely.
 */
function _attachDrag(panel) {
  // Use the header as the drag handle
  const handle = panel.querySelector('.ci-header') || panel;

  function onMouseDown(e) {
    // Only primary button
    if (e.button !== 0) return;
    e.preventDefault();

    const rect = panel.getBoundingClientRect();
    _dragOffsetX = e.clientX - rect.left;
    _dragOffsetY = e.clientY - rect.top;
    _dragging = true;

    // Switch to fixed positioning so the panel escapes any overflow clipping
    panel.style.position = 'fixed';
    panel.style.left = rect.left + 'px';
    panel.style.top  = rect.top  + 'px';
    panel.style.bottom = 'auto';
    panel.style.cursor = 'grabbing';
    panel.style.transition = 'none';
    panel.style.zIndex = '9999';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  }

  function onMouseMove(e) {
    if (!_dragging) return;
    const x = e.clientX - _dragOffsetX;
    const y = e.clientY - _dragOffsetY;
    // Clamp inside viewport
    const maxX = window.innerWidth  - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;
    const clampedX = Math.max(0, Math.min(x, maxX));
    const clampedY = Math.max(0, Math.min(y, maxY));
    panel.style.left = clampedX + 'px';
    panel.style.top  = clampedY + 'px';
    _userPos = { left: clampedX, top: clampedY };
  }

  function onMouseUp() {
    if (!_dragging) return;
    _dragging = false;
    panel.style.cursor = 'grab';
    panel.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
  }

  // Touch support
  function onTouchStart(e) {
    const touch = e.touches[0];
    const rect = panel.getBoundingClientRect();
    _dragOffsetX = touch.clientX - rect.left;
    _dragOffsetY = touch.clientY - rect.top;
    _dragging = true;

    panel.style.position = 'fixed';
    panel.style.left = rect.left + 'px';
    panel.style.top  = rect.top  + 'px';
    panel.style.bottom = 'auto';
    panel.style.transition = 'none';
    panel.style.zIndex = '9999';
  }

  function onTouchMove(e) {
    if (!_dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const x = touch.clientX - _dragOffsetX;
    const y = touch.clientY - _dragOffsetY;
    const maxX = window.innerWidth  - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;
    const clampedX = Math.max(0, Math.min(x, maxX));
    const clampedY = Math.max(0, Math.min(y, maxY));
    panel.style.left = clampedX + 'px';
    panel.style.top  = clampedY + 'px';
    _userPos = { left: clampedX, top: clampedY };
  }

  function onTouchEnd() {
    _dragging = false;
    panel.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
  }

  handle.addEventListener('mousedown',  onMouseDown);
  handle.addEventListener('touchstart', onTouchStart, { passive: true });
  handle.addEventListener('touchmove',  onTouchMove,  { passive: false });
  handle.addEventListener('touchend',   onTouchEnd);
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update the candidate indicator panel.
 *
 * @param {Object|null} gameState — play_engine game state
 * @param {Array} playerScores — from computeAllLiveScores()
 * @param {string} uiMode — 'idle' | 'running' | 'finished'
 */
export function updateCandidateIndicator(gameState, playerScores, uiMode) {
  const panel = document.getElementById('candidate-panel');
  if (!panel) return;

  // Hide when not running
  if (uiMode !== 'running' || !gameState || !playerScores || !playerScores.length) {
    _hidePanel(panel);
    return;
  }

  const turnCount = gameState.turnCount ?? 0;

  // Determine which player is about to play (current turn index)
  const currentIndex = gameState.turnIndex ?? 0;
  const currentPlayer = gameState.players[currentIndex];
  const currentPlayerId = currentPlayer?.id;

  // Get current player's score data
  const currentScore = playerScores.find(p => p.playerId === currentPlayerId);

  // Get all owned station IDs across all players
  const allOwned = new Set();
  for (const p of gameState.players) {
    for (const sid of (p.ownedStations || [])) {
      allOwned.add(sid);
    }
  }

  // Get cards in current player's hand (unowned candidates)
  const hand = currentPlayer?.hand || [];
  if (!hand.length) {
    _hidePanel(panel);
    return;
  }

  // Score each hand card as a candidate
  const candidates = _rankCandidates(hand, currentScore, playerScores, allOwned, currentPlayerId);

  if (!candidates.length) {
    _hidePanel(panel);
    return;
  }

  // Only re-render when turn changes
  if (turnCount === _lastTurnCount) return;
  _lastTurnCount = turnCount;

  // Update DOM
  const listEl = document.getElementById('ci-list');
  const headerEl = document.getElementById('ci-header');
  if (!listEl) return;

  if (headerEl) {
    headerEl.textContent = 'NEXT';
  }

  listEl.innerHTML = candidates.slice(0, 3).map(c => `
    <div class="ci-item">
      <span class="ci-name">${_escapeHtml(c.name)}</span>
      <div class="ci-tags">${c.tags.map(t => `<span class="ci-tag ci-tag--${t.type}">${t.label}</span>`).join('')}</div>
      <span class="ci-reason">${_escapeHtml(c.reason)}</span>
    </div>
  `).join('');

  // Show panel — restore user-dragged position if set
  if (_userPos) {
    panel.style.position = 'fixed';
    panel.style.left   = _userPos.left + 'px';
    panel.style.top    = _userPos.top  + 'px';
    panel.style.bottom = 'auto';
  }
  panel.classList.remove('ci-panel--hidden');
  panel.classList.add('ci-panel--visible');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    });
  });
}

/**
 * Reset the candidate indicator panel (on game reset).
 */
export function resetCandidateIndicator() {
  const panel = document.getElementById('candidate-panel');
  if (panel) {
    _hidePanel(panel);
    // Restore default CSS positioning
    panel.style.position = '';
    panel.style.left     = '';
    panel.style.top      = '';
    panel.style.bottom   = '';
    panel.style.zIndex   = '';
    panel.style.cursor   = '';
  }
  _lastTurnCount = -1;
  _userPos = null;
}

// ── Internal: Candidate ranking ───────────────────────────────────────────────

/**
 * Rank hand cards as next candidates.
 * Returns array of { name, tags, reason, score } sorted by score descending.
 */
function _rankCandidates(hand, currentScore, allScores, allOwned, playerId) {
  if (!hand.length) return [];

  const stationMetrics = _session?.stationMetrics || null;
  const stationLines   = _session?.stationLines   || null;
  const linesMaster    = _session?.linesMaster     || null;

  // Build metrics lookup
  const metricsMap = new Map();
  if (stationMetrics) {
    const items = Array.isArray(stationMetrics) ? stationMetrics
      : (stationMetrics?.stations || []);
    for (const m of items) {
      metricsMap.set(m.station_global_id, m);
    }
  }

  // Build city max score for relative hub threshold
  let cityMaxScore = 0;
  if (metricsMap.size > 0) {
    for (const m of metricsMap.values()) {
      const s = m.score_total ?? m.composite_score ?? m.hub_score ?? 0;
      if (s > cityMaxScore) cityMaxScore = s;
    }
  }

  // Build station → lines lookup
  const stationToLines = new Map();
  if (stationLines) {
    const sl = Array.isArray(stationLines) ? stationLines : [];
    for (const r of sl) {
      if (!stationToLines.has(r.station_global_id)) {
        stationToLines.set(r.station_global_id, []);
      }
      stationToLines.get(r.station_global_id).push(r.line_id);
    }
  }

  // Build owned stations for current player
  const ownedByCurrentPlayer = new Set(currentScore?.station_details?.map(d => d.station_global_id) || []);

  // Build line progress for current player
  const lineProgress = _buildLineProgress(ownedByCurrentPlayer, stationLines, linesMaster);

  // Score gap for lead analysis
  let scoreGap = 0;
  let isLeading = false;
  if (allScores.length >= 2) {
    const sorted = [...allScores].sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
    scoreGap = (sorted[0]?.final_score ?? 0) - (sorted[1]?.final_score ?? 0);
    isLeading = sorted[0]?.playerId === playerId;
  }

  const results = [];

  for (const card of hand) {
    const stationId   = card.station_global_id || card.card_id;
    const stationName = card.station_name || card.card_id || '—';

    // Skip already owned
    if (allOwned.has(stationId)) continue;

    const metric = metricsMap.get(stationId);
    const rawScore = metric ? (metric.score_total ?? metric.composite_score ?? metric.hub_score ?? 0) : 0;
    const relScore = cityMaxScore > 0 ? rawScore / cityMaxScore : 0;

    const tags = [];
    let candidateScore = 0;

    // ── Hub value ──────────────────────────────────────────────────────────────────
    if (relScore >= 0.70) {
      tags.push({ type: 'hub-top', label: '◆ Hub★', priority: 10 });
      candidateScore += 10;
    } else if (relScore >= 0.45) {
      tags.push({ type: 'hub-major', label: '◆ Hub+', priority: 9 });
      candidateScore += 7;
    } else if (relScore >= 0.25) {
      tags.push({ type: 'hub', label: '◆ Hub', priority: 6 });
      candidateScore += 4;
    }// ── Route chain / connect value ───────────────────────────────────────────
    const cardLines = stationToLines.get(stationId) || [];
    let bestRouteScore = 0;
    let bestRouteName  = null;
    let isChain = false;
    let isConnect = false;

    for (const lineId of cardLines) {
      const prog = lineProgress.get(lineId);
      if (!prog) continue;

      if (prog.pct >= 50) {
        isChain = true;
        if (prog.pct > bestRouteScore) {
          bestRouteScore = prog.pct;
          bestRouteName  = prog.line_name;
        }
      } else if (prog.pct >= 20) {
        isConnect = true;
        if (prog.pct > bestRouteScore) {
          bestRouteScore = prog.pct;
          bestRouteName  = prog.line_name;
        }
      }
    }

    if (isChain) {
      tags.push({ type: 'chain', label: '▶ Chain', priority: 8 });
      candidateScore += 6;
    } else if (isConnect) {
      tags.push({ type: 'connect', label: '▶ Connect', priority: 5 });
      candidateScore += 3;
    }

    // ── Route+ bonus potential ─────────────────────────────────────────────────────────────────
    // If current player already has route bonus, adding to that line helps
    if (currentScore?.route_bonus > 0 && cardLines.length > 0) {
      const hasRouteBonus = cardLines.some(lid => {
        const prog = lineProgress.get(lid);
        return prog && prog.pct >= 50;
      });
      if (hasRouteBonus && !tags.find(t => t.type === 'chain')) {
        tags.push({ type: 'route', label: '▶ Route+', priority: 7 });
        candidateScore += 5;
      }
    }

    // ── Lead gap value ────────────────────────────────────────────────────────
    if (!isLeading && scoreGap >= 5) {
      tags.push({ type: 'lead', label: 'Lead+', priority: 4 });
      candidateScore += 4;
    }

    // ── Station score value ───────────────────────────────────────────────────
    // Use normalized score (approximate — city-scale factor not available here,
    // but relative score gives a good proxy)
    const approxNormScore = rawScore > 0 ? relScore * 10 : 0;
    if (approxNormScore >= 7) {
      tags.push({ type: 'score', label: 'Score★', priority: 3 });
      candidateScore += 3;
    } else if (approxNormScore >= 4) {
      tags.push({ type: 'score', label: 'Score', priority: 2 });
      candidateScore += 2;
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    if (tags.length === 0) {
      tags.push({ type: 'value', label: 'Value', priority: 1 });
      candidateScore += 1;
    }

    // Sort tags by priority, take top 1
    tags.sort((a, b) => b.priority - a.priority);
    const topTags = tags.slice(0, 1);

    // Build reason
    const reason = _buildCandidateReason(topTags, bestRouteName);

    results.push({
      name: stationName,
      tags: topTags,
      reason,
      score: candidateScore,
    });
  }

  // Sort by score descending, take top 3
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}

/**
 * Build line progress map for owned stations.
 * Returns Map<line_id, { line_name, pct, count, total }>
 */
function _buildLineProgress(ownedSet, stationLines, linesMaster) {
  const progress = new Map();
  if (!stationLines || !linesMaster || !ownedSet.size) return progress;

  const sl = Array.isArray(stationLines) ? stationLines : [];
  const lm = Array.isArray(linesMaster) ? linesMaster : [];

  // Build actual count per line
  const lineActualCount = {};
  for (const r of sl) {
    if (!lineActualCount[r.line_id]) lineActualCount[r.line_id] = new Set();
    lineActualCount[r.line_id].add(r.station_global_id);
  }

  // line_id → { line_name, total }
  const lineInfo = {};
  for (const l of lm) {
    const actualTotal = lineActualCount[l.line_id]?.size ?? 0;
    const masterTotal = (typeof l.station_count === 'number' && l.station_count > 0)
      ? l.station_count
      : actualTotal;
    lineInfo[l.line_id] = { line_name: l.line_name_en || l.line_name, total: masterTotal };
  }

  // station → lines
  const stationToLines = {};
  for (const r of sl) {
    if (!stationToLines[r.station_global_id]) stationToLines[r.station_global_id] = [];
    stationToLines[r.station_global_id].push(r.line_id);
  }

  // Count owned per line
  const lineCounts = {};
  for (const gid of ownedSet) {
    const lines = stationToLines[gid] || [];
    for (const lid of lines) {
      lineCounts[lid] = (lineCounts[lid] || 0) + 1;
    }
  }

  for (const [lid, count] of Object.entries(lineCounts)) {
    const info = lineInfo[lid] || { line_name: lid, total: 1 };
    const total = info.total || 1;
    const pct = Math.min(100, Math.round((count / total) * 100));
    progress.set(lid, { line_name: info.line_name, count, total, pct });
  }

  return progress;
}

/**
 * Build a short reason line from the top tags.
 */
function _buildCandidateReason(tags, routeName) {
  if (!tags.length) return '';
  const top = tags[0];

  switch (top.type) {
    case 'hub-top':   return 'top hub';
    case 'hub-major': return 'major hub';
    case 'hub':       return 'hub';
    case 'chain':     return routeName ? routeName : 'route chain';
    case 'connect':   return routeName ? routeName : 'route';
    case 'route':     return 'route bonus';
    case 'lead':      return 'closes gap';
    case 'score':     return 'high value';
    case 'value':     return 'station';
    default:          return '';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _hidePanel(panel) {
  panel.classList.remove('ci-panel--visible');
  panel.classList.add('ci-panel--hidden');
  panel.style.opacity = '0';
  panel.style.transform = 'translateY(6px)';
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
