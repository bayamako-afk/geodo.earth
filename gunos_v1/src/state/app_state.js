/**
 * app_state.js — GUNOS V1 Application State
 *
 * Central state container for the GUNOS V1 platform shell.
 * Phase 1: city-aware startup state only.
 * Future phases will extend this with game state, online state, etc.
 */

/**
 * @typedef {Object} AppState
 * @property {string}      platform       - Platform identifier ("GUNOS V1")
 * @property {string|null} cityId         - Active city_id
 * @property {Object|null} cityProfile    - Loaded city_profile.json
 * @property {Object|null} cityRegistry   - Loaded city_registry.json
 * @property {boolean}     cityReady      - Whether city data loaded successfully
 * @property {string}      phase          - App lifecycle phase: "booting" | "city_loading" | "shell_ready" | "error"
 * @property {string|null} errorMessage   - Error message if phase === "error"
 */

/** @type {AppState} */
const _state = {
  platform:     'GUNOS V1',
  cityId:       null,
  cityProfile:  null,
  cityRegistry: null,
  cityReady:    false,
  phase:        'booting',
  errorMessage: null,
};

/**
 * Get a snapshot of the current app state.
 * @returns {AppState}
 */
export function getState() {
  return { ..._state };
}

/**
 * Update app state with a partial patch.
 * @param {Partial<AppState>} patch
 */
export function setState(patch) {
  Object.assign(_state, patch);
}

/**
 * Set the active city.
 * @param {string} cityId
 * @param {Object} profile
 * @param {Object} registry
 */
export function setActiveCity(cityId, profile, registry) {
  Object.assign(_state, {
    cityId,
    cityProfile:  profile,
    cityRegistry: registry,
    cityReady:    true,
    phase:        'shell_ready',
    errorMessage: null,
  });
}

/**
 * Set an error state.
 * @param {string} message
 */
export function setError(message) {
  Object.assign(_state, {
    phase:        'error',
    errorMessage: message,
    cityReady:    false,
  });
}
