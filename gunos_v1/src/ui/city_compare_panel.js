/**
 * city_compare_panel.js — GUNOS V1 City Comparison Mini-panel
 *
 * V1.2 Task 05: City Pack Extensibility Prep
 *
 * Refactored to load city data dynamically from city_registry.json
 * instead of using hardcoded static data. This allows new cities to be
 * added by updating city_registry.json alone, without modifying this file.
 *
 * Data source priority:
 *   1. registry entry `stats` + `ui_trait` fields (city_registry.json v1.1+)
 *   2. Fallback: display_label / city_id for label, empty for stats
 *
 * Rendered inside the score panel area, below the LOG section.
 * Active city is highlighted.
 */

// ── Module state ──────────────────────────────────────────────────────────────

/** @type {Array<Object>} - Loaded registry city entries */
let _registryCities = [];

// ── Registry loading ──────────────────────────────────────────────────────────

/**
 * Load and cache city registry entries for the compare panel.
 * Must be called once during boot before renderCityComparePanel().
 *
 * @param {Array<Object>} registryCities - Array of city entries from city_registry.json
 */
export function initCityCompareData(registryCities) {
  _registryCities = Array.isArray(registryCities) ? registryCities : [];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render the City Comparison Mini-panel into the score panel body.
 * Appends a new section after the existing score-panel-inner content.
 *
 * @param {string} activeCityId - The currently loaded city ID
 */
export function renderCityComparePanel(activeCityId) {
  const container = document.getElementById('score-panel-body');
  if (!container) return;

  // Remove existing compare panel if present
  const existing = container.querySelector('.city-compare-panel');
  if (existing) existing.remove();

  // Use registry data if available, otherwise fall back to empty
  const cities = _registryCities.length > 0 ? _registryCities : [];

  const cells = cities.map(entry => {
    const cityId  = entry.city_id;
    const label   = entry.display_label || cityId.toUpperCase();
    const stats   = entry.stats || {};
    const trait   = entry.ui_trait || '';
    const nodes   = stats.node_count ?? '—';
    const avg     = stats.avg_score != null ? stats.avg_score.toFixed(1) : '—';
    const isActive = cityId === activeCityId;

    return `
      <div class="city-compare-cell ${isActive ? 'city-compare-cell--active' : ''}" data-city-id="${cityId}">
        <div class="city-compare-cell__name">${label}</div>
        <div class="city-compare-cell__stat">${nodes} stn</div>
        <div class="city-compare-cell__stat">avg ${avg}</div>
        <div class="city-compare-cell__trait">${trait}</div>
      </div>
    `;
  }).join('');

  const panel = document.createElement('div');
  panel.className = 'city-compare-panel';
  panel.innerHTML = `
    <div class="city-compare-panel__title">CITY COMPARE</div>
    <div class="city-compare-grid">
      ${cells}
    </div>
  `;

  // Append to the score-panel-inner if present, else to container
  const inner = container.querySelector('.score-panel-inner');
  if (inner) {
    inner.appendChild(panel);
  } else {
    container.appendChild(panel);
  }
}

/**
 * Update the active city highlight without full re-render.
 * @param {string} activeCityId
 */
export function updateCityCompareActive(activeCityId) {
  const cells = document.querySelectorAll('.city-compare-cell[data-city-id]');
  cells.forEach(cell => {
    const cityId = cell.dataset.cityId;
    if (cityId === activeCityId) {
      cell.classList.add('city-compare-cell--active');
    } else {
      cell.classList.remove('city-compare-cell--active');
    }
  });
}
