/**
 * city_loader.js — GUNO V6 City Loader
 *
 * Responsibilities:
 *   - Load config/city_registry.json
 *   - Load a city profile by city_id
 *   - Return dataset paths and city metadata
 *
 * Usage:
 *   import { loadCityRegistry, loadCityProfile, getDefaultCityId } from '../city/city_loader.js';
 *
 *   const registry = await loadCityRegistry(baseUrl);
 *   const defaultId = getDefaultCityId(registry);
 *   const profile   = await loadCityProfile(defaultId, baseUrl);
 *
 *   // Resolve full URL for a dataset file:
 *   const metricsUrl = resolveDatasetUrl('station_metrics', profile, baseUrl);
 *
 * TODO (multi-city):
 *   - Add city selection UI integration
 *   - Cache loaded profiles in memory
 *   - Support locale-specific overrides per city
 */

const REGISTRY_PATH = 'config/city_registry.json';

/**
 * Load the city registry from config/city_registry.json.
 * @param {string} [baseUrl] - Base URL of the guno_v6 root (defaults to auto-detect from location).
 * @returns {Promise<Object>} Parsed registry JSON.
 */
export async function loadCityRegistry(baseUrl) {
  const base = _resolveBase(baseUrl);
  const url  = base + REGISTRY_PATH;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`city_loader: failed to load registry from ${url} (${res.status})`);
  return res.json();
}

/**
 * Get the default city_id from a loaded registry.
 * @param {Object} registry - Registry object returned by loadCityRegistry().
 * @returns {string} city_id of the default city.
 */
export function getDefaultCityId(registry) {
  return registry.default_city;
}

/**
 * Load a city profile by city_id.
 * @param {string} cityId - e.g. "tokyo"
 * @param {string} [baseUrl] - Base URL of the guno_v6 root.
 * @returns {Promise<Object>} Parsed city profile JSON.
 */
export async function loadCityProfile(cityId, baseUrl) {
  const base     = _resolveBase(baseUrl);
  const registry = await loadCityRegistry(baseUrl);
  const entry    = registry.cities.find(c => c.city_id === cityId);
  if (!entry) throw new Error(`city_loader: city_id "${cityId}" not found in registry`);

  const profileUrl = base + entry.profile;
  const res        = await fetch(profileUrl);
  if (!res.ok) throw new Error(`city_loader: failed to load profile from ${profileUrl} (${res.status})`);
  return res.json();
}

/**
 * Resolve the full URL for a named dataset key from a city profile.
 * @param {string} key - Dataset key, e.g. "station_metrics", "station_graph".
 * @param {Object} profile - City profile returned by loadCityProfile().
 * @param {string} [baseUrl] - Base URL of the guno_v6 root.
 * @returns {string} Full URL to the dataset file.
 */
export function resolveDatasetUrl(key, profile, baseUrl) {
  const base = _resolveBase(baseUrl);
  const path = profile.dataset[key];
  if (!path) throw new Error(`city_loader: dataset key "${key}" not found in profile for city "${profile.city_id}"`);
  return base + path;
}

/**
 * Load the default city profile using the registry's default_city.
 * Convenience wrapper for the most common case.
 * @param {string} [baseUrl] - Base URL of the guno_v6 root.
 * @returns {Promise<Object>} Parsed city profile JSON.
 */
export async function loadDefaultCityProfile(baseUrl) {
  const registry = await loadCityRegistry(baseUrl);
  const cityId   = getDefaultCityId(registry);
  return loadCityProfile(cityId, baseUrl);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the base URL of the guno_v6 root.
 * When running in a browser, auto-detects from location.href.
 * When running in Node.js (tests), must be provided explicitly.
 * @param {string} [baseUrl]
 * @returns {string} Base URL ending with '/'.
 */
function _resolveBase(baseUrl) {
  if (baseUrl) {
    return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  }
  // Browser auto-detect: walk up from current page to guno_v6/ root
  if (typeof location !== 'undefined') {
    const href = location.href;
    // Find guno_v6/ in the path and use everything up to and including it
    const match = href.match(/^(.*\/guno_v6\/)/);
    if (match) return match[1];
    // Fallback: use origin + pathname up to last '/'
    return href.substring(0, href.lastIndexOf('/') + 1);
  }
  throw new Error('city_loader: baseUrl must be provided in non-browser environments');
}
