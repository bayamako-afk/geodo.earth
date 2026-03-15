/**
 * result_panel.js — GUNOS V1 Result / Winner Summary Panel
 *
 * Phase 6: Winner prominence + readability improvements
 *   - Winner announced in large, colored text
 *   - Score breakdown uses compact two-column layout
 *   - "Why they won" label more prominent
 *   - DRAW state handled clearly
 *   - Margin/spacing tightened for compact panel
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

  const playerRows = players.map((ps, idx) => {
    const isWinner  = !isDraw && ps.playerId === winner;
    const color     = PLAYER_COLORS[ps.playerId] || '#aaa';
    const rank      = idx + 1;
    const whyLabel  = _whyWon(ps, isWinner && idx === 0);

    // Best route: prefer completed/partial (bonus > 0), fall back to highest progress
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
          ${whyLabel ? `<div class="result-why-label">↑ ${whyLabel}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Winner color for the announce section
  const winnerColor = isDraw ? '#8b949e' : (PLAYER_COLORS[winner] || '#ffffff');

  container.innerHTML = `
    <div class="result-panel">

      <div class="result-header">
        <div class="result-header__title">GAME OVER</div>
        <div class="result-header__sub">Turn ${turnCount} · ${players.length} players</div>
      </div>

      <div class="result-winner-announce">
        ${isDraw
          ? `<span class="result-winner-announce__draw">DRAW</span>`
          : `<span class="result-winner-announce__label">WINNER</span>
             <span class="result-winner-announce__name" style="color:${winnerColor}">${winner}</span>
             <span class="result-winner-announce__score" style="color:${winnerColor}">${_fmt(topScore)} pts</span>`
        }
      </div>

      <div class="result-players">
        ${playerRows}
      </div>

      <div class="result-footer">
        Press RESET to play again
      </div>

    </div>
  `;
}

export function hideResultPanel() {
  const container = document.getElementById('score-panel-body');
  if (!container) return;
  container.innerHTML = '';
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _whyWon(ps, isTopPlayer) {
  if (!isTopPlayer) return null;

  const { station_score, route_bonus, hub_bonus } = ps;
  const total = (station_score ?? 0) + (route_bonus ?? 0) + (hub_bonus ?? 0);
  if (!total) return null;

  const categories = [
    { label: 'Strong station ownership', value: station_score ?? 0 },
    { label: 'Route completion bonus',   value: route_bonus   ?? 0 },
    { label: 'Hub network bonus',        value: hub_bonus     ?? 0 },
  ].filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  if (!categories.length) return null;

  const top = categories[0];
  const pct = Math.round((top.value / total) * 100);
  return `${top.label} (${pct}% of total)`;
}

function _fmt(val) {
  if (val == null || val === 0) return '0';
  return typeof val === 'number' ? val.toFixed(1) : val;
}
