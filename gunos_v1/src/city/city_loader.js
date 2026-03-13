/**
 * city_loader.js — GUNOS V1 City Loader
 *
 * Adapted from guno_v6/src/city/city_loader.js for the GUNOS V1 platform layer.
 *
 * Responsibilities:
 *   - Load config/city_registry.json (GUNOS V1 registry)
 *   - Load a city profile by city_id (delegates to guno_v6 city packages)
 *   - Return dataset paths and city metadata
 *
 * Usage:
 *   import { loadCityRegistry, loadCityProfile, getDefaultCityId } from '../city/city_loader.js';
 *
 *   const registry = await loadCityRegistry(baseUrl);
 *   const defaultId = getDefaultCityId(registry);
 *   const profile   = await loadCityProfile(defaultId, baseUrl);
 *
 * Note:
 *   City data packages remain in guno_v6/cities/ — this loader references them
 *   via relative paths in city_registry.json. Do NOT move or modify guno_v6 data.
 */

const REGISTRY_PATH = 'config/city_registry.json';

/**
 * Load the GUNOS V1 city registry.
 * @param {string} [baseUrl] - Base URL of the gunos_v1 root.
 * @returns {Promise<Object>} Parsed registry JSON.
 */
export async function loadCityRegistry(baseUrl) {
  const base = _resolveBase(baseUrl);
  const url  = base + REGISTRY_PATH;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`[GUNOS V1] city_loader: failed to load registry from ${url} (${res.status})`);
  return res.json();
}

/**
 * Get the default city_id from a loaded registry.
 * @param {Object} registry
 * @returns {string}
 */
export function getDefaultCityId(registry) {
  return registry.default_city;
}

/**
 * Load a city profile by city_id.
 * The profile path in city_registry.json is relative to the gunos_v1 root.
 * @param {string} cityId
 * @param {string} [baseUrl]
 * @returns {Promise<Object>}
 */
export async function loadCityProfile(cityId, baseUrl) {
  const base     = _resolveBase(baseUrl);
  const registry = await loadCityRegistry(baseUrl);
  const entry    = registry.cities.find(c => c.city_id === cityId);
  if (!entry) throw new Error(`[GUNOS V1] city_loader: city_id "${cityId}" not found in registry`);

  const profileUrl = base + entry.profile;
  const res        = await fetch(profileUrl);
  if (!res.ok) throw new Error(`[GUNOS V1] city_loader: failed to load profile from ${profileUrl} (${res.status})`);

  const profile = await res.json();
  // Attach display_label from registry entry for UI use
  profile._display_label = entry.display_label || cityId.toUpperCase();
  return profile;
}

/**
 * Load the default city profile.
 * @param {string} [baseUrl]
 * @returns {Promise<Object>}
 */
export async function loadDefaultCityProfile(baseUrl) {
  const registry = await loadCityRegistry(baseUrl);
  const cityId   = getDefaultCityId(registry);
  return loadCityProfile(cityId, baseUrl);
}

/**
 * List all cities in the registry.
 * @param {string} [baseUrl]
 * @returns {Promise<Array<{city_id, display_name, display_label, profile}>>}
 */
export async function listAvailableCities(baseUrl) {
  const registry = await loadCityRegistry(baseUrl);
  return registry.cities;
}

/**
 * Resolve the full URL for a named dataset key from a city profile.
 * Dataset paths in city_profile.json are relative to the guno_v6 root.
 * @param {string} key
 * @param {Object} profile
 * @param {string} [baseUrl] - Base URL of the gunos_v1 root.
 * @returns {string}
 */
export function resolveDatasetUrl(key, profile, baseUrl) {
  const base = _resolveBase(baseUrl);
  const path = profile.dataset[key];
  if (!path) throw new Error(`[GUNOS V1] city_loader: dataset key "${key}" not found in profile for city "${profile.city_id}"`);
  // Dataset paths in city_profile.json are relative to guno_v6 root.
  // We resolve them relative to gunos_v1 root via ../guno_v6/
  return base + '../guno_v6/' + path;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the base URL of the gunos_v1 root.
 * @param {string} [baseUrl]
 * @returns {string} Base URL ending with '/'.
 */
function _resolveBase(baseUrl) {
  if (baseUrl) {
    return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  }
  if (typeof location !== 'undefined') {
    const href = location.href;
    const match = href.match(/^(.*\/gunos_v1\/)/);
    if (match) return match[1];
    return href.substring(0, href.lastIndexOf('/') + 1);
  }
  throw new Error('[GUNOS V1] city_loader: baseUrl must be provided in non-browser environments');
}
