/**
 * map_panel.js — GUNOS V1 Map Panel
 *
 * The map panel is the visual center of the GUNOS V1 play screen.
 * It occupies the dominant area of the layout.
 *
 * Phase 2: city-aware placeholder with featured lines display
 * Phase 4: will be replaced with actual route/network visualization
 */

/**
 * Render the map panel with city-aware placeholder content.
 *
 * @param {Object} opts
 * @param {Object} opts.profile  - Loaded city profile
 */
export function renderMapPanel({ profile }) {
  const container = document.getElementById('map-panel-body');
  if (!container) return;

  const cityLabel    = profile._display_label || profile.city_id.toUpperCase();
  const cityName     = profile.display_name || profile.city_id;
  const featuredLines = profile.routes?.featured_lines ?? [];
  const dataReady    = profile.status?.data_ready ?? false;

  container.innerHTML = '';

  // City identity block
  const identity = document.createElement('div');
  identity.className = 'map-city-identity';
  identity.innerHTML = `
    <div class="map-city-identity__label">${cityLabel}</div>
    <div class="map-city-identity__name">${cityName}</div>
  `;
  container.appendChild(identity);

  // Featured lines badge row
  if (featuredLines.length > 0) {
    const linesRow = document.createElement('div');
    linesRow.className = 'map-lines-row';

    featuredLines.forEach(lc => {
      const badge = document.createElement('span');
      badge.className = 'map-line-badge';
      badge.textContent = lc;
      badge.style.borderColor = _lineColor(lc);
      badge.style.color = _lineColor(lc);
      linesRow.appendChild(badge);
    });

    container.appendChild(linesRow);
  }

  // Placeholder body
  const placeholder = document.createElement('div');
  placeholder.className = 'map-placeholder';
  placeholder.innerHTML = `
    <div class="map-placeholder__grid" id="map-grid-area">
      ${_buildGridPlaceholder(featuredLines)}
    </div>
    <div class="map-placeholder__note">
      Phase 4 — route network visualization
    </div>
  `;
  container.appendChild(placeholder);

  // Data status badge
  const statusBadge = document.createElement('div');
  statusBadge.className = 'map-data-status map-data-status--' + (dataReady ? 'ready' : 'pending');
  statusBadge.textContent = dataReady ? 'DATA READY' : 'DATA PENDING';
  container.appendChild(statusBadge);
}

/**
 * Build a visual grid placeholder representing the featured lines.
 * Each line gets a row of 10 station slots (ROUTE_SIZE = 10).
 */
function _buildGridPlaceholder(featuredLines) {
  if (featuredLines.length === 0) {
    return '<div class="map-grid-empty">No featured lines configured</div>';
  }

  return featuredLines.map(lc => {
    const color = _lineColor(lc);
    const slots = Array.from({ length: 10 }, (_, i) =>
      `<div class="map-slot" style="border-color:${color}22; background:${color}11;" title="${lc}-${i + 1}"></div>`
    ).join('');

    return `
      <div class="map-line-row">
        <div class="map-line-row__label" style="color:${color};">${lc}</div>
        <div class="map-line-row__slots">${slots}</div>
      </div>`;
  }).join('');
}

/**
 * Assign a placeholder color per line code.
 * Phase 4 will replace this with real line colors from pack data.
 */
function _lineColor(lc) {
  const palette = {
    // Tokyo
    JY: '#80c080', G: '#f0a020', M: '#e04040', T: '#40a0c0', Z: '#8060c0',
    // Osaka
    Y: '#40b0a0', HK: '#c08040', OC: '#e06060',
    // London
    CEN: '#e05020', NOR: '#404040', PIC: '#2040a0', DIS: '#408040', CIR: '#c0c020',
    // NYC
    L1: '#c04040', L4: '#408040', LA: '#4060c0', LN: '#c0c040', L7: '#8040c0',
  };
  return palette[lc] ?? '#6e7681';
}
