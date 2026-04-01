/**
 * station_detail_card.js — GUNOS V1 Selected Station Detail Card
 *
 * V1.4 Task 05: Selected Station Detail Card
 *
 * Shows a compact card for the "focused" station — the station that is
 * most relevant to the current game moment.
 *
 * Target station selection priority:
 *   1. Most recently acquired station (gameState.currentCard)
 *   2. Top next-candidate from current player's hand
 *   3. No target → hidden
 *
 * Card content:
 *   - Station name
 *   - Line context (up to 2 lines)
 *   - 2–4 meaning badges (◆ Hub / ▶ Route+ / etc.)
 *   - 1-line summary
 *
 * Placement: bottom-left, inside #map-overlay-info, between
 *   #candidate-panel and #station-hint-panel.
 *
 * Design: map-first, pointer-events: none, compact, always-visible
 *   while game is running.
 */

// ── State ─────────────────────────────────────────────────────────────────────

let _session     = null;   // { stationMetrics, stationLines, linesMaster }
let _initialised = false;
let _lastKey     = '';     // dedup key: stationId + turnCount

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Inject the station detail card into #map-overlay-info.
 * Call once after initMapOverlay().
 *
 * @param {Object} scoringData — { stationMetrics, stationLines, linesMaster }
 */
export function initStationDetailCard(scoringData) {
  _session = scoringData || null;

  const overlayInfo = document.getElementById('map-overlay-info');
  if (!overlayInfo) return;

  if (document.getElementById('station-detail-card')) return;

  const card = document.createElement('div');
  card.id = 'station-detail-card';
  card.className = 'sdc-card sdc-card--hidden';
  card.setAttribute('aria-live', 'polite');
  card.innerHTML = `
    <div class="sdc-header">
      <span class="sdc-label" id="sdc-label">FOCUS</span>
      <span class="sdc-name"  id="sdc-name"></span>
    </div>
    <div class="sdc-lines"   id="sdc-lines"></div>
    <div class="sdc-badges"  id="sdc-badges"></div>
    <div class="sdc-summary" id="sdc-summary"></div>
  `;

  // Insert before #station-hint-panel if it exists, else append
  const hintPanel = document.getElementById('station-hint-panel');
  if (hintPanel) {
    overlayInfo.insertBefore(card, hintPanel);
  } else {
    overlayInfo.appendChild(card);
  }

  _initialised = true;
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update the station detail card.
 *
 * @param {Object|null} gameState  — current game state
 * @param {Array}       scores     — from computeAllLiveScores()
 * @param {string}      uiMode     — 'idle' | 'running' | 'finished'
 */
export function updateStationDetailCard(gameState, scores, uiMode) {
  const card = document.getElementById('station-detail-card');
  if (!card) return;

  if (uiMode === 'idle' || !gameState || !scores || !scores.length) {
    _hideCard(card);
    return;
  }

  // ── Select target station ────────────────────────────────────────────────────
  const target = _selectTargetStation(gameState, scores);
  if (!target) {
    _hideCard(card);
    return;
  }

  // Dedup: only re-render when station or turn changes
  const key = `${target.stationId}:${gameState.turnCount ?? 0}`;
  if (key === _lastKey) return;
  _lastKey = key;

  // ── Build card content ───────────────────────────────────────────────────────
  const content = _buildCardContent(target, gameState, scores);

  // ── Render ───────────────────────────────────────────────────────────────────
  const labelEl   = document.getElementById('sdc-label');
  const nameEl    = document.getElementById('sdc-name');
  const linesEl   = document.getElementById('sdc-lines');
  const badgesEl  = document.getElementById('sdc-badges');
  const summaryEl = document.getElementById('sdc-summary');

  if (labelEl)   labelEl.textContent = content.label;
  if (nameEl)    nameEl.textContent  = content.name;

  if (linesEl) {
    if (content.lines.length) {
      linesEl.innerHTML = content.lines
        .map(l => `<span class="sdc-line-chip">${_escapeHtml(l)}</span>`)
        .join('');
      linesEl.style.display = '';
    } else {
      linesEl.style.display = 'none';
    }
  }

  if (badgesEl) {
    badgesEl.innerHTML = content.badges
      .map(b => `<span class="sdc-badge sdc-badge--${b.type}">${_escapeHtml(b.label)}</span>`)
      .join('');
  }

  if (summaryEl) {
    summaryEl.textContent = content.summary;
    summaryEl.style.display = content.summary ? '' : 'none';
  }

  // ── Show card ────────────────────────────────────────────────────────────────
  _showCard(card);
}

/**
 * Reset the station detail card (on game reset).
 */
export function resetStationDetailCard() {
  const card = document.getElementById('station-detail-card');
  if (card) _hideCard(card);
  _lastKey = '';
}

// ── Target station selection ──────────────────────────────────────────────────

/**
 * Select the most relevant station to show in the detail card.
 *
 * @returns {{ stationId, stationName, source, card, playerScore }} | null
 */
function _selectTargetStation(gameState, scores) {
  // Priority 1: Most recently acquired station (currentCard)
  const currentCard = gameState.currentCard;
  if (currentCard && gameState.turnCount > 0) {
    // Determine which player just played
    const prevIndex  = (gameState.turnIndex - 1 + gameState.players.length) % gameState.players.length;
    const prevPlayer = gameState.players[prevIndex];
    const prevScore  = scores.find(p => p.playerId === prevPlayer?.id) ?? scores[0];

    return {
      stationId:   currentCard.station_global_id || currentCard.card_id,
      stationName: currentCard.station_name || currentCard.card_id || '—',
      source:      'acquired',
      card:        currentCard,
      playerScore: prevScore,
      playerId:    prevPlayer?.id,
    };
  }

  // Priority 2: Top candidate from current player's hand
  const currentIndex  = gameState.turnIndex ?? 0;
  const currentPlayer = gameState.players[currentIndex];
  const currentScore  = scores.find(p => p.playerId === currentPlayer?.id) ?? scores[0];
  const hand          = currentPlayer?.hand || [];

  if (hand.length > 0) {
    // Pick the highest-value card from hand using a simple heuristic
    const topCard = _pickTopHandCard(hand, currentScore, scores, currentPlayer?.id);
    if (topCard) {
      return {
        stationId:   topCard.station_global_id || topCard.card_id,
        stationName: topCard.station_name || topCard.card_id || '—',
        source:      'candidate',
        card:        topCard,
        playerScore: currentScore,
        playerId:    currentPlayer?.id,
      };
    }
  }

  return null;
}

/**
 * Pick the highest-value card from a player's hand using scoring heuristics.
 */
function _pickTopHandCard(hand, currentScore, allScores, playerId) {
  if (!hand.length) return null;

  const stationMetrics = _session?.stationMetrics || null;
  const stationLines   = _session?.stationLines   || null;
  const linesMaster    = _session?.linesMaster     || null;

  const metricsMap = _buildMetricsMap(stationMetrics);
  const cityMaxScore = _computeCityMax(metricsMap);
  const stationToLines = _buildStationToLines(stationLines);

  // Build owned stations for current player
  const ownedSet = new Set(currentScore?.station_details?.map(d => d.station_global_id) || []);
  const lineProgress = _buildLineProgress(ownedSet, stationLines, linesMaster);

  let scoreGap = 0;
  let isLeading = false;
  if (allScores.length >= 2) {
    const sorted = [...allScores].sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
    scoreGap  = (sorted[0]?.final_score ?? 0) - (sorted[1]?.final_score ?? 0);
    isLeading = sorted[0]?.playerId === playerId;
  }

  let bestCard  = null;
  let bestScore = -1;

  for (const card of hand) {
    const stationId = card.station_global_id || card.card_id;
    const metric    = metricsMap.get(stationId);
    const rawScore  = metric ? (metric.score_total ?? metric.composite_score ?? metric.hub_score ?? 0) : 0;
    const relScore  = cityMaxScore > 0 ? rawScore / cityMaxScore : 0;

    let s = relScore * 10;

    // Route chain bonus
    const cardLines = stationToLines.get(stationId) || [];
    for (const lid of cardLines) {
      const prog = lineProgress.get(lid);
      if (prog?.pct >= 50) { s += 6; break; }
      if (prog?.pct >= 20) { s += 3; break; }
    }

    // Lead gap bonus
    if (!isLeading && scoreGap >= 5) s += 4;

    if (s > bestScore) {
      bestScore = s;
      bestCard  = card;
    }
  }

  return bestCard;
}

// ── Card content builder ──────────────────────────────────────────────────────

/**
 * Build the full card content for a target station.
 */
function _buildCardContent(target, gameState, scores) {
  const { stationId, stationName, source, card, playerScore, playerId } = target;

  const stationMetrics = _session?.stationMetrics || null;
  const stationLines   = _session?.stationLines   || null;
  const linesMaster    = _session?.linesMaster     || null;

  const metricsMap     = _buildMetricsMap(stationMetrics);
  const cityMaxScore   = _computeCityMax(metricsMap);
  const stationToLines = _buildStationToLines(stationLines);

  // ── Label ─────────────────────────────────────────────────────────────────────
  const label = source === 'acquired'
    ? (playerId ? `${playerId} GOT` : 'GOT')
    : (playerId ? `${playerId} NEXT` : 'NEXT');

  // ── Line context ──────────────────────────────────────────────────────────────
  const lineIds = stationToLines.get(stationId) || [];
  const lineNames = _resolveLineNames(lineIds, linesMaster);

  // ── Meaning badges ────────────────────────────────────────────────────────────
  const metric   = metricsMap.get(stationId);
  const rawScore = metric ? (metric.score_total ?? metric.composite_score ?? metric.hub_score ?? 0) : 0;
  const relScore = cityMaxScore > 0 ? rawScore / cityMaxScore : 0;

  const ownedSet     = new Set(playerScore?.station_details?.map(d => d.station_global_id) || []);
  const lineProgress = _buildLineProgress(ownedSet, stationLines, linesMaster);

  const badges = _buildBadges({
    stationId,
    stationName,
    relScore,
    lineIds,
    lineProgress,
    playerScore,
    scores,
    playerId,
    source,
    card,
  });

  // ── Summary line ──────────────────────────────────────────────────────────────
  const summary = _buildSummary(badges, source, stationName);

  return { label, name: stationName, lines: lineNames.slice(0, 2), badges, summary };
}

/**
 * Build meaning badges for the card.
 */
function _buildBadges({ stationId, stationName, relScore, lineIds, lineProgress, playerScore, scores, playerId, source, card }) {
  const badges = [];

  // ── Hub ───────────────────────────────────────────────────────────────────────
  if (relScore >= 0.70) {
    badges.push({ type: 'hub-top',   label: '◆ Hub★',  priority: 10 });
  } else if (relScore >= 0.45) {
    badges.push({ type: 'hub-major', label: '◆ Hub+',  priority: 9 });
  } else if (relScore >= 0.25) {
    badges.push({ type: 'hub',       label: '◆ Hub',   priority: 8 });
  }

  // ── Route chain / connect ─────────────────────────────────────────────────────
  let isChain = false;
  let isConnect = false;
  for (const lid of lineIds) {
    const prog = lineProgress.get(lid);
    if (!prog) continue;
    if (prog.pct >= 50) { isChain = true; break; }
    if (prog.pct >= 20) isConnect = true;
  }

  if (isChain) {
    badges.push({ type: 'chain', label: '▶ Chain',   priority: 8 });
  } else if (isConnect) {
    badges.push({ type: 'connect', label: '▶ Connect', priority: 5 });
  }

  // ── Route+ bonus ──────────────────────────────────────────────────────────────
  if (playerScore?.route_bonus > 0) {
    const hasRouteBonus = lineIds.some(lid => {
      const prog = lineProgress.get(lid);
      return prog && prog.pct >= 50;
    });
    if (hasRouteBonus && !isChain) {
      badges.push({ type: 'route', label: '▶ Route+', priority: 7 });
    }
  }

  // ── Capture (route just completed) ───────────────────────────────────────────
  if (source === 'acquired') {
    const routeProgress = playerScore?.route_progress || [];
    const justComplete  = routeProgress.find(r => r.status === 'complete');
    if (justComplete) {
      badges.push({ type: 'capture', label: '▶ Capture!', priority: 11 });
    }
  }

  // ── Lead gap ──────────────────────────────────────────────────────────────────
  if (scores.length >= 2) {
    const sorted = [...scores].sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
    const gap    = (sorted[0]?.final_score ?? 0) - (sorted[1]?.final_score ?? 0);
    const isLeader = sorted[0]?.playerId === playerId;

    if (!isLeader && gap >= 5) {
      badges.push({ type: 'lead', label: 'Lead+', priority: 4 });
    } else if (isLeader && gap >= 5) {
      badges.push({ type: 'lead-ext', label: 'Lead↑', priority: 3 });
    }
  }

  // ── Score value ───────────────────────────────────────────────────────────────
  const cardScore = card?.score_total ?? 0;
  if (cardScore >= 8 || relScore >= 0.70) {
    badges.push({ type: 'score', label: 'Score★', priority: 4 });
  } else if (cardScore >= 5 || relScore >= 0.45) {
    badges.push({ type: 'score', label: 'Score',  priority: 3 });
  }

  // Sort by priority, take top 4
  badges.sort((a, b) => b.priority - a.priority);

  // Deduplicate by type
  const seen = new Set();
  const unique = [];
  for (const b of badges) {
    if (!seen.has(b.type)) { seen.add(b.type); unique.push(b); }
  }

  return unique.slice(0, 4);
}

/**
 * Build a 1-line summary from the top badge.
 */
function _buildSummary(badges, source, stationName) {
  if (!badges.length) return '';

  const top = badges[0];
  switch (top.type) {
    case 'capture':   return 'Route capture — full bonus scored.';
    case 'hub-top':   return 'Major hub with strong bonus value.';
    case 'hub-major': return 'Strong hub station for route control.';
    case 'hub':       return 'Hub connection with network value.';
    case 'chain':     return 'Extends current route chain.';
    case 'connect':   return 'Connects to an active route.';
    case 'route':     return 'Boosts existing route bonus.';
    case 'lead':      return 'Useful candidate for reducing the leader gap.';
    case 'lead-ext':  return 'Extends the current lead.';
    case 'score':     return 'High-value station with capture potential.';
    default:          return source === 'acquired' ? 'Station acquired.' : 'Candidate station.';
  }
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function _buildMetricsMap(stationMetrics) {
  const map = new Map();
  if (!stationMetrics) return map;
  const items = Array.isArray(stationMetrics) ? stationMetrics : (stationMetrics?.stations || []);
  for (const m of items) map.set(m.station_global_id, m);
  return map;
}

function _computeCityMax(metricsMap) {
  let max = 0;
  for (const m of metricsMap.values()) {
    const s = m.score_total ?? m.composite_score ?? m.hub_score ?? 0;
    if (s > max) max = s;
  }
  return max;
}

function _buildStationToLines(stationLines) {
  const map = new Map();
  if (!stationLines) return map;
  const sl = Array.isArray(stationLines) ? stationLines : [];
  for (const r of sl) {
    if (!map.has(r.station_global_id)) map.set(r.station_global_id, []);
    map.get(r.station_global_id).push(r.line_id);
  }
  return map;
}

function _resolveLineNames(lineIds, linesMaster) {
  if (!linesMaster || !lineIds.length) return [];
  const lm = Array.isArray(linesMaster) ? linesMaster : [];
  const names = [];
  for (const lid of lineIds) {
    const entry = lm.find(l => l.line_id === lid);
    if (entry) names.push(entry.line_name_en || entry.line_name || lid);
  }
  return names;
}

function _buildLineProgress(ownedSet, stationLines, linesMaster) {
  const progress = new Map();
  if (!stationLines || !linesMaster || !ownedSet.size) return progress;

  const sl = Array.isArray(stationLines) ? stationLines : [];
  const lm = Array.isArray(linesMaster)  ? linesMaster  : [];

  const lineActualCount = {};
  for (const r of sl) {
    if (!lineActualCount[r.line_id]) lineActualCount[r.line_id] = new Set();
    lineActualCount[r.line_id].add(r.station_global_id);
  }

  const lineInfo = {};
  for (const l of lm) {
    const actualTotal = lineActualCount[l.line_id]?.size ?? 0;
    const masterTotal = (typeof l.station_count === 'number' && l.station_count > 0)
      ? l.station_count : actualTotal;
    lineInfo[l.line_id] = { line_name: l.line_name_en || l.line_name, total: masterTotal };
  }

  const stationToLines = {};
  for (const r of sl) {
    if (!stationToLines[r.station_global_id]) stationToLines[r.station_global_id] = [];
    stationToLines[r.station_global_id].push(r.line_id);
  }

  const lineCounts = {};
  for (const gid of ownedSet) {
    for (const lid of (stationToLines[gid] || [])) {
      lineCounts[lid] = (lineCounts[lid] || 0) + 1;
    }
  }

  for (const [lid, count] of Object.entries(lineCounts)) {
    const info  = lineInfo[lid] || { line_name: lid, total: 1 };
    const total = info.total || 1;
    const pct   = Math.min(100, Math.round((count / total) * 100));
    progress.set(lid, { line_name: info.line_name, count, total, pct });
  }

  return progress;
}

// ── Panel visibility ──────────────────────────────────────────────────────────

function _showCard(card) {
  card.classList.remove('sdc-card--hidden');
  card.classList.add('sdc-card--visible');
  requestAnimationFrame(() => {
    card.style.opacity   = '1';
    card.style.transform = 'translateY(0)';
  });
}

function _hideCard(card) {
  card.classList.remove('sdc-card--visible');
  card.classList.add('sdc-card--hidden');
  card.style.opacity   = '0';
  card.style.transform = 'translateY(4px)';
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
