/**
 * result_panel.js — GUNOS V1 Result / Winner Summary Panel
 *
 * V1.2 Task 04: Result Drama & Feedback Enhancement
 *   - GAME OVER flash animation on #app
 *   - Score comparison bar (P1 vs P2 visual ratio)
 *   - Match verdict chip: CLOSE WIN / DOMINANT WIN / DRAW
 *   - Score gap display (+XX.X pts)
 *   - Enhanced _whyWon() with multi-line reason block
 *   - REMATCH button (replaces plain text footer)
 *   - Map loser dimming via CSS class on SVG nodes
 *
 * V1.5 Task 02: Result Screen Strategy Summary
 *   - _buildStrategySummary(): detect winning factors from score data
 *   - Compact reason tags (Hub★ / Route+ / Chain / Capture / Lead+)
 *   - 1–3 short explanation lines
 *   - Responsive: PC / landscape / portrait
 */

const PLAYER_COLORS = {
  P1: '#4fc3f7',
  P2: '#ef9a9a',
  P3: '#a5d6a7',
  P4: '#ffcc80',
};

export function showResultPanel(result) {
  const container = document.getElementById('score-panel-body');
  if (!container || !result) return;

  const { winner, turnCount, players } = result;
  const isDraw   = !winner || winner === 'DRAW';
  const topScore = players[0]?.final_score ?? 0;
  const p2Score  = players[1]?.final_score ?? 0;

  // ── GAME OVER flash on #app ──────────────────────────────────────────────
  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.classList.remove('game-over-flash');
    // Force reflow to restart animation
    void appEl.offsetWidth;
    appEl.classList.add('game-over-flash');
    setTimeout(() => appEl.classList.remove('game-over-flash'), 1400);
  }

  // ── Map: dim loser nodes ─────────────────────────────────────────────────
  if (!isDraw && players.length >= 2) {
    const loserId = players[1]?.playerId;
    _applyMapLoserDim(loserId);
  }

  // ── Score gap & verdict ──────────────────────────────────────────────────
  const gap         = topScore - p2Score;
  const gapStr      = isDraw ? '' : `+${gap.toFixed(1)}`;
  const totalScore  = topScore + p2Score;
  const gapPct      = totalScore > 0 ? gap / totalScore : 0;
  let verdictClass  = 'result-verdict--draw';
  let verdictLabel  = 'DRAW';
  if (!isDraw) {
    if (gapPct >= 0.15) {
      verdictClass = 'result-verdict--dominant';
      verdictLabel = 'DOMINANT WIN';
    } else {
      verdictClass = 'result-verdict--close';
      verdictLabel = 'CLOSE WIN';
    }
  }

  // ── Score bar (P1 vs P2) ─────────────────────────────────────────────────
  const p1Pct = totalScore > 0 ? Math.round((topScore / totalScore) * 100) : 50;
  const p2Pct = 100 - p1Pct;
  const p1Id  = players[0]?.playerId ?? 'P1';
  const p2Id  = players[1]?.playerId ?? 'P2';
  const scoreBarHtml = players.length >= 2 ? `
    <div class="result-score-bar-labels">
      <span>${p1Id} ${_fmt(topScore)}</span>
      <span>${p2Id} ${_fmt(p2Score)}</span>
    </div>
    <div class="result-score-bar-wrap">
      <div class="result-score-bar-p1" style="width:${p1Pct}%"></div>
      <div class="result-score-bar-p2" style="width:${p2Pct}%"></div>
    </div>
  ` : '';

  // ── Per-player rows ──────────────────────────────────────────────────────
  const playerRows = players.map((ps, idx) => {
    const isWinner  = !isDraw && ps.playerId === winner;
    const color     = PLAYER_COLORS[ps.playerId] || '#aaa';
    const rank      = idx + 1;
    const whyBlock  = _whyWonBlock(ps, isWinner);

    const bestRoute = ps.route_details?.find(r => r.bonus > 0)
      || ps.route_progress?.sort((a, b) => b.pct - a.pct)?.[0]
      || ps.route_details?.sort((a, b) => b.count - a.count)?.[0];
    const routeStr  = bestRoute
      ? (() => {
          const name  = bestRoute.line_name_en || bestRoute.line_name || bestRoute.line_id;
          const count = bestRoute.count;
          const total = bestRoute.route_total ?? bestRoute.total;
          const bonus = bestRoute.bonus > 0 ? ` +${bestRoute.bonus}pt` : '';
          return `${name} (${count}/${total})${bonus}`;
        })()
      : '—';

    const topStation = ps.station_details?.[0];
    const topStr     = topStation ? `${topStation.station_name} (${_fmt(topStation.score_total)})` : '—';

    return `
      <div class="result-player-block ${isWinner ? 'result-player-block--winner' : ''}">
        <div class="result-player-header">
          <span class="result-rank">#${rank}</span>
          <span class="result-player-id" style="color:${color}">${ps.playerId}</span>
          ${isWinner ? '<span class="result-winner-badge">WINNER</span>' : ''}
          <span class="result-total-score">${_fmt(ps.final_score)}</span>
        </div>
        <div class="result-breakdown">
          <div class="result-breakdown-grid">
            <span class="result-breakdown-label">Station</span>
            <span class="result-breakdown-value">${_fmt(ps.station_score)}</span>
            <span class="result-score-explain"><strong>Station</strong>: points from all owned stations</span>
            <span class="result-breakdown-label">Route+</span>
            <span class="result-breakdown-value result-breakdown-value--bonus">${_fmt(ps.route_bonus)}</span>
            <span class="result-score-explain"><strong>Route+</strong>: bonus for owning ⅓+ of a metro line</span>
            <span class="result-breakdown-label">Hub+</span>
            <span class="result-breakdown-value result-breakdown-value--bonus">${_fmt(ps.hub_bonus)}</span>
            <span class="result-score-explain"><strong>Hub+</strong>: bonus for owning major interchange stations</span>
            <span class="result-breakdown-label">Owned</span>
            <span class="result-breakdown-value">${ps.station_details?.length ?? 0}</span>
            <span class="result-breakdown-label">Best route</span>
            <span class="result-breakdown-value result-breakdown-value--route">${routeStr}</span>
            <span class="result-breakdown-label">Top stn</span>
            <span class="result-breakdown-value result-breakdown-value--station">${topStr}</span>
          </div>
          ${whyBlock}
        </div>
      </div>
    `;
  }).join('');

  // ── Winner color ─────────────────────────────────────────────────────────
  const winnerColor = isDraw ? '#8b949e' : (PLAYER_COLORS[winner] || '#ffffff');

  // ── V1.5 Task 02: Strategy Summary ──────────────────────────────────────
  const strategySummaryHtml = _buildStrategySummary(result, isDraw, gap, gapPct);

  container.innerHTML = `
    <div class="result-panel">

      <div class="result-header">
        <div class="result-header__title">GAME OVER</div>
        <div class="result-header__sub">Turn ${turnCount} · ${players.length} players</div>
      </div>

      <div class="result-winner-announce">
        ${isDraw
          ? `<span class="result-winner-announce__draw">DRAW</span>
             <span class="result-verdict ${verdictClass}">${verdictLabel}</span>`
          : `<span class="result-winner-announce__label">WINNER</span>
             <span class="result-winner-announce__name" style="color:${winnerColor}">${winner}</span>
             <span class="result-score-gap">${gapStr}</span>
             <span class="result-verdict ${verdictClass}">${verdictLabel}</span>
             <span class="result-winner-announce__score" style="color:${winnerColor};margin-left:auto">${_fmt(topScore)} pts</span>`
        }
      </div>

      ${scoreBarHtml}

      ${strategySummaryHtml}

      <div class="result-players">
        ${playerRows}
      </div>

      <div class="result-footer">
        <button class="result-rematch-btn" id="btn-result-rematch">↺ REMATCH</button>
      </div>

    </div>
  `;

  // Wire REMATCH button to RESET
  const rematchBtn = container.querySelector('#btn-result-rematch');
  if (rematchBtn) {
    rematchBtn.addEventListener('click', () => {
      const resetBtn = document.getElementById('btn-reset');
      if (resetBtn) resetBtn.click();
    });
  }
}

export function hideResultPanel() {
  const container = document.getElementById('score-panel-body');
  if (!container) return;
  container.innerHTML = '';
  // Remove loser dim on reset
  document.querySelectorAll('.map-node--loser').forEach(el => {
    el.classList.remove('map-node--loser');
  });
}

// ── V1.5 Task 02: Strategy Summary builder ────────────────────────────────────

/**
 * Build a compact strategy summary block for the result screen.
 * Detects the top 1–3 winning factors and generates:
 *   - Reason tags (Hub★ / Route+ / Chain / Capture / Score)
 *   - 1–3 short explanation lines
 *   - Optional comparison line (winner vs runner-up)
 */
function _buildStrategySummary(result, isDraw, gap, gapPct) {
  const { winner, players } = result;
  if (!players || players.length < 1) return '';

  const winnerPs  = isDraw ? null : players.find(p => p.playerId === winner);
  const runnerPs  = players.find(p => p.playerId !== winner) ?? players[1];

  // ── Detect winning factors ───────────────────────────────────────────────
  const factors = [];

  if (!isDraw && winnerPs) {
    const total = winnerPs.final_score || 1;

    // Hub dominance
    const hubPct = (winnerPs.hub_bonus ?? 0) / total;
    if (hubPct >= 0.25) {
      factors.push({ tag: 'Hub★', label: 'Hub control', weight: hubPct, color: 'ss-tag--hub' });
    } else if (hubPct >= 0.10) {
      factors.push({ tag: 'Hub+', label: 'Hub bonus', weight: hubPct, color: 'ss-tag--hub' });
    }

    // Route+ bonus
    const routePct = (winnerPs.route_bonus ?? 0) / total;
    if (routePct >= 0.20) {
      factors.push({ tag: 'Route+', label: 'Route bonus', weight: routePct, color: 'ss-tag--route' });
    }

    // Station capture dominance
    const stationPct = (winnerPs.station_score ?? 0) / total;
    if (stationPct >= 0.70 && (winnerPs.hub_bonus ?? 0) < 2) {
      factors.push({ tag: 'Capture', label: 'Station value', weight: stationPct, color: 'ss-tag--capture' });
    }

    // Chain: multiple completed routes
    const completedRoutes = (winnerPs.routes ?? []).length;
    if (completedRoutes >= 2) {
      factors.push({ tag: 'Chain', label: 'Route chain', weight: completedRoutes * 0.1, color: 'ss-tag--chain' });
    }

    // Lead: dominant win
    if (gapPct >= 0.15) {
      factors.push({ tag: 'Lead+', label: 'Score lead', weight: gapPct, color: 'ss-tag--lead' });
    }

    // Score: fallback if no other factor
    if (factors.length === 0) {
      factors.push({ tag: 'Score', label: 'Station score', weight: stationPct, color: 'ss-tag--score' });
    }
  }

  // Sort by weight descending, keep top 3
  factors.sort((a, b) => b.weight - a.weight);
  const topFactors = factors.slice(0, 3);

  // ── Build explanation lines ──────────────────────────────────────────────
  const lines = [];

  if (isDraw) {
    lines.push('Both players finished with equal scores.');
    lines.push('No clear advantage in Hub, Route+, or station value.');
  } else if (winnerPs) {
    const winnerColor = PLAYER_COLORS[winner] || '#fff';
    const runnerColor = runnerPs ? (PLAYER_COLORS[runnerPs.playerId] || '#aaa') : '#aaa';

    // Primary line: winner's main factor
    const primary = topFactors[0];
    if (primary) {
      if (primary.tag === 'Hub★' || primary.tag === 'Hub+') {
        const hubCount = winnerPs.hub_stations?.length ?? 0;
        lines.push(`<strong style="color:${winnerColor}">${winner}</strong> controlled ${hubCount} hub station${hubCount !== 1 ? 's' : ''}, building a strong bonus lead.`);
      } else if (primary.tag === 'Route+') {
        const completedRoutes = winnerPs.routes?.length ?? 0;
        lines.push(`<strong style="color:${winnerColor}">${winner}</strong> completed ${completedRoutes} route${completedRoutes !== 1 ? 's' : ''}, earning significant Route+ bonus.`);
      } else if (primary.tag === 'Chain') {
        lines.push(`<strong style="color:${winnerColor}">${winner}</strong> chained multiple route completions to extend the lead.`);
      } else if (primary.tag === 'Capture') {
        lines.push(`<strong style="color:${winnerColor}">${winner}</strong> captured high-value stations to build the score advantage.`);
      } else if (primary.tag === 'Lead+') {
        lines.push(`<strong style="color:${winnerColor}">${winner}</strong> established an early lead and held it throughout the game.`);
      } else {
        lines.push(`<strong style="color:${winnerColor}">${winner}</strong> outscored on station value to secure the win.`);
      }
    }

    // Secondary line: comparison with runner-up
    if (runnerPs && players.length >= 2) {
      const runnerHub   = runnerPs.hub_bonus   ?? 0;
      const runnerRoute = runnerPs.route_bonus ?? 0;
      const winnerHub   = winnerPs.hub_bonus   ?? 0;
      const winnerRoute = winnerPs.route_bonus ?? 0;

      if (runnerHub > winnerHub && runnerRoute < winnerRoute) {
        lines.push(`<strong style="color:${runnerColor}">${runnerPs.playerId}</strong> had stronger hub control, but fell short on Route+ bonus.`);
      } else if (runnerRoute > winnerRoute) {
        lines.push(`<strong style="color:${runnerColor}">${runnerPs.playerId}</strong> kept pace with Route+, but could not close the gap.`);
      } else if (gapPct < 0.08) {
        lines.push(`<strong style="color:${runnerColor}">${runnerPs.playerId}</strong> stayed close — a single hub or route could have changed the result.`);
      } else {
        lines.push(`<strong style="color:${runnerColor}">${runnerPs.playerId}</strong> could not match the station value advantage.`);
      }
    }
  }

  // ── Render tags ──────────────────────────────────────────────────────────
  const tagsHtml = topFactors.length > 0
    ? `<div class="ss-tags">${topFactors.map(f => `<span class="ss-tag ${f.color}">${f.tag}</span>`).join('')}</div>`
    : '';

  const linesHtml = lines.length > 0
    ? `<div class="ss-lines">${lines.map(l => `<div class="ss-line">${l}</div>`).join('')}</div>`
    : '';

  if (!tagsHtml && !linesHtml) return '';

  return `
    <div class="result-strategy-summary">
      <div class="ss-header">STRATEGY SUMMARY</div>
      ${tagsHtml}
      ${linesHtml}
    </div>
  `;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _whyWonBlock(ps, isWinner) {
  if (!isWinner) return '';

  const { station_score, route_bonus, hub_bonus } = ps;
  const total = (station_score ?? 0) + (route_bonus ?? 0) + (hub_bonus ?? 0);
  if (!total) return '';

  const categories = [
    { label: 'Station ownership', value: station_score ?? 0 },
    { label: 'Route+ bonus',      value: route_bonus   ?? 0 },
    { label: 'Hub+ bonus',        value: hub_bonus     ?? 0 },
  ].filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  if (!categories.length) return '';

  const lines = categories.map(c => {
    const pct = Math.round((c.value / total) * 100);
    return `<div class="result-why-line"><strong>${c.label}</strong>: ${_fmt(c.value)} pts (${pct}%)</div>`;
  }).join('');

  return `<div class="result-why-block">${lines}</div>`;
}

function _applyMapLoserDim(loserId) {
  // Find all SVG map-node groups that belong to the loser
  // Nodes are tagged with data-owner attribute set by map_canvas.js
  setTimeout(() => {
    document.querySelectorAll('.map-node').forEach(node => {
      const owner = node.getAttribute('data-owner');
      if (owner === loserId) {
        node.classList.add('map-node--loser');
      }
    });
  }, 300); // slight delay to let map render settle
}

function _fmt(val) {
  if (val == null || val === 0) return '0';
  return typeof val === 'number' ? val.toFixed(1) : val;
}
