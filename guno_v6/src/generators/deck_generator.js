/**
 * deck_generator.js
 * GUNO V6 — Dynamic Deck Generator (multi-city)
 *
 * Generates a playable GUNO deck from station metrics and rarity classifications.
 * Applies rarity targets and attempts to maintain route diversity.
 *
 * Public API:
 *   generateDeck(options)          — async, city-aware (preferred)
 *   generateDeckSync(...)          — sync, pre-loaded data (legacy / internal)
 *   generateDeckFromConfig(...)    — async wrapper (legacy compat)
 *
 * generateDeck options:
 *   baseUrl      {string}  — Base URL of guno_v6 root (auto-detected in browser)
 *   cityId       {string}  — City ID, e.g. "tokyo", "osaka" (default: registry default)
 *   deckSize     {number}  — Override deck size (default: from city profile or 40)
 *   rarityTargets {Object} — Override rarity targets
 *   config       {Object}  — Legacy config object (deckSize, rarityTargets, deckName, version)
 */

import { classifyAllStationsSync } from '../scoring/station_rarity.js';
import {
  loadCityRegistry,
  getDefaultCityId,
  loadCityProfile,
  resolveDatasetUrl,
} from '../city/city_loader.js';

// ── Internal defaults ─────────────────────────────────────────────────────────

const FALLBACK_DECK_SIZE = 40;
const FALLBACK_RARITY_TARGETS = {
  Legendary: 1,
  Epic:      9,
  Rare:      10,
  Common:    20
};
const RARITY_ORDER = ['Legendary', 'Epic', 'Rare', 'Common'];

// ── Structured error helper ───────────────────────────────────────────────────

class DeckGeneratorError extends Error {
  constructor(message, code, cityId) {
    super(message);
    this.name = 'DeckGeneratorError';
    this.code = code;       // e.g. 'DATA_NOT_READY', 'MISSING_DATASET', 'INVALID_METRICS'
    this.cityId = cityId;
  }
}

// ── Core sync generator (unchanged logic) ─────────────────────────────────────

/**
 * Generate a deck synchronously using pre-loaded data.
 * @param {Object} stationMetrics - Parsed JSON from station_metrics.json
 * @param {Array|null} stationLines - Parsed JSON from station_lines.json (optional)
 * @param {Object} config - Configuration: { deckSize, rarityTargets, deckName, version, cityId }
 * @returns {Object} Generated deck JSON structure
 */
export function generateDeckSync(stationMetrics, stationLines = null, config = {}) {
  const deckSize     = config.deckSize     || FALLBACK_DECK_SIZE;
  const targets      = { ...FALLBACK_RARITY_TARGETS, ...(config.rarityTargets || {}) };
  const deckName     = config.deckName     || `${config.cityId || 'city'}_dynamic_v1`;
  const version      = config.version      || '1.0';
  const cityId       = config.cityId       || 'unknown';

  // 1. Classify all stations
  const metricsInput = Array.isArray(stationMetrics)
    ? { stations: stationMetrics }
    : stationMetrics;
  const allStations = classifyAllStationsSync(metricsInput);
  if (!allStations || allStations.length === 0) {
    throw new DeckGeneratorError(
      `Failed to classify stations for city "${cityId}". Metrics data may be invalid.`,
      'INVALID_METRICS',
      cityId
    );
  }

  // Build station → lines lookup
  const stationToLines = {};
  if (stationLines && Array.isArray(stationLines)) {
    stationLines.forEach(record => {
      const sid = record.station_global_id;
      if (!stationToLines[sid]) stationToLines[sid] = [];
      if (record.line_name && !stationToLines[sid].includes(record.line_name)) {
        stationToLines[sid].push(record.line_name);
      }
    });
  }

  // 2. Group stations by rarity (sorted by score_total desc from classifyAllStationsSync)
  const grouped = {
    Legendary: allStations.filter(s => s.rarity === 'Legendary'),
    Epic:      allStations.filter(s => s.rarity === 'Epic'),
    Rare:      allStations.filter(s => s.rarity === 'Rare'),
    Common:    allStations.filter(s => s.rarity === 'Common')
  };

  const selectedStations = [];
  const lineCounts = {};

  // Diversity-aware picker
  function pickNextStation(candidates) {
    if (candidates.length === 0) return null;
    if (!stationLines || stationLines.length === 0) return candidates.shift();

    const SOFT_CAP = 6;
    const HARD_CAP = 10;

    let bestIdx = -1;
    for (let i = 0; i < candidates.length; i++) {
      const lines = stationToLines[candidates[i].station_global_id] || [];
      if (lines.length === 0 || lines.some(l => (lineCounts[l] || 0) < SOFT_CAP)) {
        bestIdx = i; break;
      }
    }
    if (bestIdx === -1) {
      for (let i = 0; i < candidates.length; i++) {
        const lines = stationToLines[candidates[i].station_global_id] || [];
        if (lines.length === 0 || lines.some(l => (lineCounts[l] || 0) < HARD_CAP)) {
          bestIdx = i; break;
        }
      }
    }
    if (bestIdx === -1) bestIdx = 0;

    const picked = candidates.splice(bestIdx, 1)[0];
    (stationToLines[picked.station_global_id] || []).forEach(l => {
      lineCounts[l] = (lineCounts[l] || 0) + 1;
    });
    return picked;
  }

  // 3. Select stations to meet targets, cascading shortages downward
  let carryOver = 0;
  for (const rarity of RARITY_ORDER) {
    let target = (targets[rarity] || 0) + carryOver;
    const candidates = [...grouped[rarity]];
    let pickedCount = 0;
    while (pickedCount < target && candidates.length > 0) {
      const picked = pickNextStation(candidates);
      if (picked) { selectedStations.push(picked); pickedCount++; }
    }
    carryOver = pickedCount < target ? target - pickedCount : 0;
  }

  // Fill remaining shortage from any remaining stations
  if (selectedStations.length < deckSize) {
    const needed = deckSize - selectedStations.length;
    const remaining = allStations.filter(
      s => !selectedStations.some(sel => sel.station_global_id === s.station_global_id)
    );
    for (let i = 0; i < needed && remaining.length > 0; i++) {
      selectedStations.push(pickNextStation(remaining));
    }
  }

  // 4. Sort and build cards
  selectedStations.sort((a, b) => b.score_total - a.score_total);
  const finalCards = selectedStations.slice(0, deckSize).map((s, index) => ({
    card_id:           `card_${String(index + 1).padStart(3, '0')}`,
    station_global_id: s.station_global_id,
    station_name:      s.station_name,
    station_slug:      s.station_slug,
    score_total:       s.score_total,
    rank:              s.rank,
    rarity:            s.rarity
  }));

  // 5. Validation
  const uniqueIds = new Set(finalCards.map(c => c.station_global_id));
  const uniqueCardIds = new Set(finalCards.map(c => c.card_id));
  if (uniqueIds.size !== finalCards.length) {
    throw new DeckGeneratorError(
      `Duplicate station_global_id detected in generated deck for city "${cityId}".`,
      'DUPLICATE_STATION',
      cityId
    );
  }
  if (uniqueCardIds.size !== finalCards.length) {
    throw new DeckGeneratorError(
      `Duplicate card_id detected in generated deck for city "${cityId}".`,
      'DUPLICATE_CARD_ID',
      cityId
    );
  }

  // 6. Build deck object
  return {
    deck_meta: {
      version,
      deck_name:   deckName,
      deck_size:   finalCards.length,
      city_id:     cityId,
      generator:   'deck_generator.js',
      generated_at: new Date().toISOString()
    },
    cards: finalCards
  };
}

// ── Async city-aware generator (primary API) ──────────────────────────────────

/**
 * Generate a deck asynchronously for a given city.
 *
 * @param {Object} options
 * @param {string} [options.baseUrl]       — Base URL of guno_v6 root
 * @param {string} [options.cityId]        — City ID (default: registry default_city)
 * @param {number} [options.deckSize]      — Override deck size
 * @param {Object} [options.rarityTargets] — Override rarity targets
 * @param {Object} [options.config]        — Legacy config object (deckSize, rarityTargets, deckName, version)
 * @returns {Promise<Object>} Generated deck JSON
 */
export async function generateDeck(options = {}) {
  const baseUrl = options.baseUrl || '';

  // 1. Resolve cityId
  let cityId = options.cityId || null;
  if (!cityId) {
    try {
      const registry = await loadCityRegistry(baseUrl || undefined);
      cityId = getDefaultCityId(registry);
    } catch (err) {
      // Fallback for environments where registry is not accessible
      cityId = 'tokyo';
      console.warn(`[deck_generator] Could not load city registry, defaulting to "${cityId}":`, err.message);
    }
  }

  // 2. Load city profile
  let profile;
  try {
    profile = await loadCityProfile(cityId, baseUrl || undefined);
  } catch (err) {
    throw new DeckGeneratorError(
      `Could not load city profile for "${cityId}": ${err.message}`,
      'PROFILE_LOAD_FAILED',
      cityId
    );
  }

  // 3. Check data_ready
  if (profile.status && profile.status.data_ready === false) {
    throw new DeckGeneratorError(
      `City data for "${cityId}" is not ready yet.`,
      'DATA_NOT_READY',
      cityId
    );
  }

  // 4. Resolve config: profile defaults → legacy config → explicit options
  const profileDefaults = profile.deck_defaults || {};
  const legacyConfig    = options.config || {};

  const deckSize = options.deckSize
    ?? legacyConfig.deckSize
    ?? profileDefaults.deck_size
    ?? FALLBACK_DECK_SIZE;

  const rarityTargets = options.rarityTargets
    ?? legacyConfig.rarityTargets
    ?? profileDefaults.rarity_targets
    ?? FALLBACK_RARITY_TARGETS;

  const deckName  = legacyConfig.deckName  || `${cityId}_dynamic_v1`;
  const version   = legacyConfig.version   || '1.0';

  const finalConfig = {
    deckSize,
    rarityTargets,
    deckName,
    version,
    cityId
  };

  // 5. Load station_metrics (required)
  let metricsData;
  try {
    const metricsUrl = resolveDatasetUrl('station_metrics', profile, baseUrl || undefined);
    const res = await fetch(metricsUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    metricsData = await res.json();
  } catch (err) {
    throw new DeckGeneratorError(
      `Failed to load station_metrics for city "${cityId}": ${err.message}`,
      'MISSING_DATASET',
      cityId
    );
  }

  // 6. Load station_lines (optional, for diversity)
  let linesData = null;
  try {
    const linesUrl = resolveDatasetUrl('station_lines', profile, baseUrl || undefined);
    const res = await fetch(linesUrl);
    if (res.ok) linesData = await res.json();
  } catch (err) {
    console.warn(`[deck_generator] Could not load station_lines for "${cityId}" (diversity disabled):`, err.message);
  }

  // 7. Generate
  return generateDeckSync(metricsData, linesData, finalConfig);
}

// ── Legacy compat wrapper ─────────────────────────────────────────────────────

/**
 * Generate a deck from a specific config (legacy wrapper).
 * @param {Object} config
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function generateDeckFromConfig(config, options = {}) {
  return generateDeck({ ...options, config });
}
