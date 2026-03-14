/**
 * result_panel.js — GUNOS V1 Result / Winner Summary Panel
 *
 * Shown when the game reaches GAME OVER.
 * Overlays the score panel area with a clean result summary:
 *   - Winner announcement
 *   - Final turn count
 *   - Per-player score breakdown (station / route / hub / total)
 *   - "Why they won" — leading category
 *
 * Phase 5: initial implementation
 */

// Player color map (matches map_canvas.js)
const PLAYER_COLORS = {
  P1: '#4fc3f7',
  P2: '#ef9a9a',
  P3: '#a5d6a7',
  P4: '#ffcc80',
};

/**
 * Show the result panel in the score panel area.
 * Replaces the score panel content with the result summary.
 *
 * @param {Object} result — from computeFinalResults()
 *   { winner, turnCount, gameOver, players: [{playerId, final_score, station_score, route_bonus, hub_bonus, route_details, hub_stations, station_details}] }
 */
export function showResultPanel(result) {
  const container = document.getElementById('score-panel-body');
  if (!container || !result) return;

  const { winner, turnCount, players } = result;

  // Build per-player rows (already sorted by final_score desc)
  const playerRows = players.map((ps, idx) => {
    const isWinner = ps.playerId === winner;
    const color    = PLAYER_COLORS[ps.playerId] || '#aaa';
    const rank     = idx + 1;

    // "Why they won" — find leading bonus category
    const whyLabel = _whyWon(ps, isWinner && idx === 0);

    // Best route
    const bestRoute = ps.route_details?.find(r => r.bonus > 0);
    const routeStr  = bestRoute
      ? `${bestRoute.line_name_en || bestRoute.line_id} (${bestRoute.count}/${bestRoute.route_total})`
      : '—';

    // Best hub station
    const bestHub = ps.hub_stations?.[0];
    const hubStr  = bestHub ? bestHub.station_name : '—';

    // Top owned station
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
          <div class="result-breakdown-row">
            <span class="result-breakdown-label">Station</span>
            <span class="result-breakdown-value">${_fmt(ps.station_score)}</span>
          </div>
          <div class="result-breakdown-row">
            <span class="result-breakdown-label">Route bonus</span>
            <span class="result-breakdown-value result-breakdown-value--bonus">${_fmt(ps.route_bonus)}</span>
          </div>
          <div class="result-breakdown-row">
            <span class="result-breakdown-label">Hub bonus</span>
            <span class="result-breakdown-value result-breakdown-value--bonus">${_fmt(ps.hub_bonus)}</span>
          </div>
          <div class="result-breakdown-row result-breakdown-row--divider">
            <span class="result-breakdown-label">Stations owned</span>
            <span class="result-breakdown-value">${ps.station_details?.length ?? 0}</span>
          </div>
          <div class="result-breakdown-row">
            <span class="result-breakdown-label">Best route</span>
            <span class="result-breakdown-value result-breakdown-value--route">${routeStr}</span>
          </div>
          <div class="result-breakdown-row">
            <span class="result-breakdown-label">Hub station</span>
            <span class="result-breakdown-value result-breakdown-value--hub">${hubStr}</span>
          </div>
          <div class="result-breakdown-row">
            <span class="result-breakdown-label">Top station</span>
            <span class="result-breakdown-value result-breakdown-value--station">${topStr}</span>
          </div>
          ${whyLabel ? `<div class="result-why-label">${whyLabel}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="result-panel">

      <!-- Header -->
      <div class="result-header">
        <div class="result-header__title">GAME OVER</div>
        <div class="result-header__sub">Turn ${turnCount} · ${players.length} players</div>
      </div>

      <!-- Winner announcement -->
      <div class="result-winner-announce">
        <span class="result-winner-announce__label">Winner</span>
        <span class="result-winner-announce__name" style="color:${PLAYER_COLORS[winner] || '#fff'}">${winner ?? '—'}</span>
        <span class="result-winner-announce__score">${_fmt(players[0]?.final_score ?? 0)} pts</span>
      </div>

      <!-- Per-player breakdown -->
      <div class="result-players">
        ${playerRows}
      </div>

      <!-- Footer hint -->
      <div class="result-footer">
        Press RESET to play again
      </div>

    </div>
  `;
}

/**
 * Hide the result panel and restore the score panel structure.
 * (Caller should re-render score panel after calling this.)
 */
export function hideResultPanel() {
  const container = document.getElementById('score-panel-body');
  if (!container) return;
  container.innerHTML = '';
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Generate a short "why they won" label for the winner.
 * @param {Object} ps - player score object
 * @param {boolean} isTopPlayer - true if this is the highest-scoring player
 * @returns {string|null}
 */
function _whyWon(ps, isTopPlayer) {
  if (!isTopPlayer) return null;

  const { station_score, route_bonus, hub_bonus } = ps;
  const total = station_score + route_bonus + hub_bonus;
  if (!total) return null;

  // Find dominant category
  const categories = [
    { label: 'Strong station ownership', value: station_score },
    { label: 'Route completion bonus',   value: route_bonus },
    { label: 'Hub network bonus',        value: hub_bonus },
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
