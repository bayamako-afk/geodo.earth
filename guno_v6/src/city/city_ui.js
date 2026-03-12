/**
 * city_ui.js — GUNO V6 City UI Helper
 *
 * Provides:
 *   - getCityIdFromUrl()          — read ?city= from current URL
 *   - resolveActiveCityId()       — ?city= param OR registry default
 *   - buildCitySelectorHtml()     — render a <select> dropdown
 *   - injectCitySelectorInToolbar() — inject selector into #toolbar
 *   - showDataNotReady()          — banner for scaffold-only cities
 *
 * Usage (inline script in debug viewers):
 *   import { resolveActiveCityId, injectCitySelectorInToolbar, showDataNotReady }
 *     from '../src/city/city_ui.js';
 */

import {
  loadCityRegistry,
  getDefaultCityId,
  loadCityProfile,
  listAvailableCities,
} from './city_loader.js';

// ── URL helpers ───────────────────────────────────────────────────────────────

/**
 * Read the ?city= query parameter from the current URL.
 * Returns null if not present.
 */
export function getCityIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('city') || null;
}

/**
 * Resolve the active city_id:
 *   1. ?city= param if present and valid
 *   2. registry.default_city otherwise
 *
 * @param {string} [baseUrl]
 * @returns {Promise<{ cityId: string, isDefault: boolean, registry: Object }>}
 */
export async function resolveActiveCityId(baseUrl) {
  const registry  = await loadCityRegistry(baseUrl);
  const defaultId = getDefaultCityId(registry);
  const paramId   = getCityIdFromUrl();

  if (!paramId) {
    return { cityId: defaultId, isDefault: true, registry };
  }

  const valid = registry.cities.some(c => c.city_id === paramId);
  if (!valid) {
    console.warn(`[city_ui] Unknown city_id "${paramId}", falling back to default "${defaultId}"`);
    showInvalidCityBanner(paramId, defaultId);
    return { cityId: defaultId, isDefault: false, registry };
  }

  return { cityId: paramId, isDefault: false, registry };
}

// ── City selector UI ──────────────────────────────────────────────────────────

/**
 * Inject a city selector <select> into the #toolbar element.
 * Changing the selection reloads the page with ?city=<selected>.
 *
 * @param {Array<{city_id, display_name}>} cities  — from listAvailableCities()
 * @param {string} activeCityId                    — currently selected city
 */
export function injectCitySelectorInToolbar(cities, activeCityId) {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'city-selector-wrapper';
  wrapper.style.cssText = `
    display: flex;
    align-items: center;
    gap: 5px;
    margin-left: 8px;
  `;

  const label = document.createElement('span');
  label.textContent = 'City:';
  label.style.cssText = `
    font-size: 10px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  `;

  const select = document.createElement('select');
  select.id = 'city-select';
  select.style.cssText = `
    background: #374151;
    color: #d1d5db;
    border: 1px solid #4b5563;
    border-radius: 4px;
    font-size: 11px;
    padding: 3px 6px;
    cursor: pointer;
    outline: none;
  `;

  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city.city_id;
    opt.textContent = city.display_name || city.city_id;
    if (city.city_id === activeCityId) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('city', select.value);
    window.location.href = url.toString();
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);

  // Insert before the status span (last child), or just append
  const statusEl = document.getElementById('toolbar-status');
  if (statusEl) {
    toolbar.insertBefore(wrapper, statusEl);
  } else {
    toolbar.appendChild(wrapper);
  }
}

// ── Data-not-ready banner ─────────────────────────────────────────────────────

/**
 * Show a prominent "data not ready" banner for scaffold-only cities.
 * Does NOT crash the viewer; the banner sits above the content.
 *
 * @param {string} cityName  — display name of the city
 * @param {string} cityId    — city_id
 */
export function showDataNotReady(cityName, cityId) {
  const existing = document.getElementById('data-not-ready-banner');
  if (existing) return;

  const banner = document.createElement('div');
  banner.id = 'data-not-ready-banner';
  banner.style.cssText = `
    position: fixed;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: #78350f;
    color: #fde68a;
    padding: 10px 24px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 9997;
    text-align: center;
    pointer-events: none;
    border: 1px solid #d97706;
  `;
  banner.innerHTML = `
    <strong>${cityName}</strong> — dataset not ready yet
    <span style="color:#a16207;margin-left:8px">(city_id: ${cityId})</span>
  `;
  document.body.appendChild(banner);
}

// ── Invalid city banner ───────────────────────────────────────────────────────

function showInvalidCityBanner(badId, fallbackId) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: #7f1d1d;
    color: #fca5a5;
    padding: 10px 24px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 9997;
    text-align: center;
    pointer-events: none;
  `;
  banner.textContent = `Unknown city "${badId}" — falling back to "${fallbackId}"`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 5000);
}
