/**
 * city_compare_panel.js — GUNOS V1 City Comparison Mini-panel
 *
 * Task 05: Responsive Score / Info Panel Polish + City Comparison Mini-panel
 *
 * Shows a lightweight comparison of all 4 cities:
 *   - Node count
 *   - Average station score (composite_score)
 *   - Hub density (degree >= 2)
 *   - Short city trait text
 *
 * Rendered inside the score panel area, below the LOG section.
 * Active city is highlighted.
 */

// ── City static data (pre-computed from station_metrics.json) ─────────────────

const CITY_COMPARE_DATA = {
  tokyo: {
    label:     'TOKYO',
    nodes:     86,
    avgScore:  6.8,
    maxScore:  18.4,
    hubPct:    94,
    trait:     'dense baseline',
  },
  osaka: {
    label:     'OSAKA',
    nodes:     85,
    avgScore:  6.8,
    maxScore:  22.3,
    hubPct:    92,
    trait:     'compact balanced',
  },
  london: {
    label:     'LONDON',
    nodes:     162,
    avgScore:  1.4,
    maxScore:  5.0,
    hubPct:    95,
    trait:     'transfer-heavy',
  },
  nyc: {
    label:     'NYC',
    nodes:     152,
    avgScore:  1.1,
    maxScore:  5.0,
    hubPct:    94,
    trait:     'Manhattan hubs',
  },
};

const CITY_ORDER = ['tokyo', 'osaka', 'london', 'nyc'];

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

  const cells = CITY_ORDER.map(cityId => {
    const d = CITY_COMPARE_DATA[cityId];
    if (!d) return '';
    const isActive = cityId === activeCityId;
    return `
      <div class="city-compare-cell ${isActive ? 'city-compare-cell--active' : ''}">
        <div class="city-compare-cell__name">${d.label}</div>
        <div class="city-compare-cell__stat">${d.nodes} stn</div>
        <div class="city-compare-cell__stat">avg ${d.avgScore.toFixed(1)}</div>
        <div class="city-compare-cell__trait">${d.trait}</div>
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
  const cells = document.querySelectorAll('.city-compare-cell');
  cells.forEach((cell, i) => {
    const cityId = CITY_ORDER[i];
    if (cityId === activeCityId) {
      cell.classList.add('city-compare-cell--active');
    } else {
      cell.classList.remove('city-compare-cell--active');
    }
  });
}
