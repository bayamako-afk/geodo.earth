/**
 * city_ui.js — GUNOS V1 City UI Helper
 *
 * Adapted from guno_v6/src/city/city_ui.js for the GUNOS V1 platform layer.
 *
 * Provides:
 *   - getCityIdFromUrl()          — read ?city= from current URL
 *   - resolveActiveCityId()       — ?city= param OR registry default
 *   - renderCitySelector()        — render city selector buttons in #city-selector
 *   - updateCityDisplay()         — update the active city label in the shell
 *   - showInvalidCityNotice()     — brief notice for unknown city param
 */

import {
  loadCityRegistry,
  getDefaultCityId,
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
 *   1. ?city= param if present and valid in registry
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
    console.warn(`[GUNOS V1] Unknown city_id "${paramId}", falling back to default "${defaultId}"`);
    showInvalidCityNotice(paramId, defaultId);
    return { cityId: defaultId, isDefault: false, registry };
  }

  return { cityId: paramId, isDefault: false, registry };
}

// ── City selector UI ──────────────────────────────────────────────────────────

/**
 * Render city selector buttons into #city-selector element.
 * Clicking a city button reloads the page with ?city=<selected>.
 *
 * @param {Array<{city_id, display_name, display_label}>} cities
 * @param {string} activeCityId
 */
export function renderCitySelector(cities, activeCityId) {
  const container = document.getElementById('city-selector');
  if (!container) return;

  container.innerHTML = '';

  cities.forEach(city => {
    const btn = document.createElement('button');
    btn.className = 'city-btn' + (city.city_id === activeCityId ? ' city-btn--active' : '');
    btn.dataset.cityId = city.city_id;
    btn.textContent = city.display_label || city.city_id.toUpperCase();
    btn.title = city.display_name;

    btn.addEventListener('click', () => {
      if (city.city_id === activeCityId) return;
      const url = new URL(window.location.href);
      url.searchParams.set('city', city.city_id);
      window.location.href = url.toString();
    });

    container.appendChild(btn);
  });
}

/**
 * Update the active city display label in the shell.
 * Targets #city-label and #city-name elements.
 *
 * @param {Object} profile - Loaded city profile
 * @param {Object} registryEntry - { city_id, display_name, display_label }
 */
export function updateCityDisplay(profile, registryEntry) {
  const labelEl = document.getElementById('city-label');
  const nameEl  = document.getElementById('city-name');

  if (labelEl) {
    labelEl.textContent = registryEntry?.display_label || profile.city_id.toUpperCase();
  }
  if (nameEl) {
    nameEl.textContent = profile.display_name || registryEntry?.display_name || profile.city_id;
  }

  // Also update document title
  const label = registryEntry?.display_label || profile.city_id.toUpperCase();
  document.title = `GUNOS V1 · ${label}`;
}

// ── Notice banners ────────────────────────────────────────────────────────────

/**
 * Show a brief notice for an unknown ?city= param.
 * Auto-dismisses after 4 seconds.
 */
export function showInvalidCityNotice(badId, fallbackId) {
  const notice = document.createElement('div');
  notice.className = 'gs-notice gs-notice--warn';
  notice.textContent = `Unknown city "${badId}" — using default "${fallbackId}"`;
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 4000);
}
