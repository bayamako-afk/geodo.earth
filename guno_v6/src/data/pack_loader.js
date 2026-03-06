// guno_v6/src/data/pack_loader.js
// GUNO Pack v1.0 Loader for GUNO V6
//
// Responsibility:
//   - Parse and validate GUNO Pack JSON (v1.0 standard, v0.2 fallback)
//   - Extract stations (entities), routes (collections), layouts
//   - Expose hub values (deck-based and global) for game logic
//
// Rules:
//   - No DOM dependency
//   - No side effects (pure functions only)
//   - v6 standard is pack_version "1.0"; v0.2 is accepted for backward compat

"use strict";

const SUPPORTED_VERSIONS = ["0.2", "1.0"];

// ─────────────────────────────────────────
// Validation
// ─────────────────────────────────────────

/**
 * Validate the top-level structure of a parsed pack object.
 * Throws if the pack is invalid.
 * @param {object} packObj
 */
function validatePack(packObj) {
  if (!packObj || typeof packObj !== "object") {
    throw new Error("Invalid pack: not an object");
  }
  const version = packObj?.pack_meta?.pack_version;
  if (!version) {
    throw new Error("Invalid pack: missing pack_meta.pack_version");
  }
  if (!SUPPORTED_VERSIONS.includes(version)) {
    throw new Error(`Unsupported pack_version: ${version}. Supported: ${SUPPORTED_VERSIONS.join(", ")}`);
  }
  if (!packObj.entities || typeof packObj.entities !== "object") {
    throw new Error("Invalid pack: missing or invalid 'entities'");
  }
  if (!packObj.collections || typeof packObj.collections !== "object") {
    throw new Error("Invalid pack: missing or invalid 'collections'");
  }
  if (!packObj.layouts || typeof packObj.layouts !== "object") {
    throw new Error("Invalid pack: missing or invalid 'layouts'");
  }
}

// ─────────────────────────────────────────
// Hub value helpers
// ─────────────────────────────────────────

/**
 * Calculate hub rank from hub degree.
 * @param {number} degree
 * @returns {"S"|"A"|"B"|"C"}
 */
function calcHubRank(degree) {
  if (degree >= 4) return "S";
  if (degree === 3) return "A";
  if (degree === 2) return "B";
  return "C";
}

/**
 * Derive hub values for a station entity against the deck's line set.
 * Used as a fallback when hub values are not pre-baked into the pack.
 * @param {object} entity  - A station entity object
 * @param {Set<string>} deckLines - Set of line codes (lc) present in the deck
 * @returns {{ hub_degree_deck: number, hub_bonus_deck: number, hub_rank_deck: string,
 *             hub_degree_global: number, hub_bonus_global: number, hub_rank_global: string }}
 */
function deriveHubValues(entity, deckLines) {
  const crossLines = entity.cross_lines || [];

  const globalDeg = 1 + crossLines.length;
  const deckCross = crossLines.filter((lc) => deckLines.has(lc));
  const deckDeg = 1 + deckCross.length;

  return {
    hub_degree_global: globalDeg,
    hub_bonus_global: (globalDeg - 1) * 2,
    hub_rank_global: calcHubRank(globalDeg),
    hub_degree_deck: deckDeg,
    hub_bonus_deck: (deckDeg - 1) * 2,
    hub_rank_deck: calcHubRank(deckDeg),
  };
}

// ─────────────────────────────────────────
// Core loader
// ─────────────────────────────────────────

/**
 * Parse a GUNO Pack JSON string and return a structured LoadedPack object.
 * @param {string} jsonText - Raw JSON string of the pack file
 * @returns {LoadedPack}
 */
export function parsePack(jsonText) {
  let packObj;
  try {
    packObj = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Failed to parse pack JSON: ${e.message}`);
  }
  return loadPack(packObj);
}

/**
 * Load a GUNO Pack from a pre-parsed object and return a structured LoadedPack.
 * @param {object} packObj - Already-parsed pack JSON object
 * @returns {LoadedPack}
 */
export function loadPack(packObj) {
  validatePack(packObj);

  const meta = packObj.pack_meta;
  const version = meta.pack_version;

  // Collect deck line codes from collections
  const deckLines = new Set();
  for (const col of Object.values(packObj.collections)) {
    if (col.kind === "route" && col.lc) {
      deckLines.add(col.lc);
    }
  }

  // Build station list
  const stations = [];
  for (const [eid, entity] of Object.entries(packObj.entities)) {
    if (entity.type !== "station") continue;

    // Resolve hub values: prefer pre-baked (v1.0), derive if absent (v0.2 fallback)
    let hubValues;
    if (
      version === "1.0" &&
      typeof entity.hub_degree_deck === "number" &&
      typeof entity.hub_degree_global === "number"
    ) {
      hubValues = {
        hub_degree_global: entity.hub_degree_global,
        hub_bonus_global: entity.hub_bonus_global ?? (entity.hub_degree_global - 1) * 2,
        hub_rank_global: entity.hub_rank_global ?? calcHubRank(entity.hub_degree_global),
        hub_degree_deck: entity.hub_degree_deck,
        hub_bonus_deck: entity.hub_bonus_deck ?? (entity.hub_degree_deck - 1) * 2,
        hub_rank_deck: entity.hub_rank_deck ?? calcHubRank(entity.hub_degree_deck),
      };
    } else {
      // Derive from cross_lines (v0.2 or missing hub data)
      hubValues = deriveHubValues(entity, deckLines);
    }

    stations.push({
      id: eid,
      station_code: entity.station_code || eid,
      name_ja: entity.name_ja || entity.name || eid,
      name_en: entity.name_en || entity.name || eid,
      lc: entity.lc,
      order: entity.order,
      cross_lines: entity.cross_lines || [],
      ...hubValues,
    });
  }

  // Build route list
  const routes = [];
  for (const [cid, col] of Object.entries(packObj.collections)) {
    if (col.kind !== "route") continue;
    routes.push({
      id: cid,
      lc: col.lc,
      name_ja: col.name_ja || col.name || cid,
      name_en: col.name_en || col.name || cid,
      color: col.color || "#888888",
      members: col.members || [],
    });
  }

  // Build layout list
  const layouts = [];
  for (const [lid, layout] of Object.entries(packObj.layouts)) {
    layouts.push({
      id: lid,
      name: layout.name || lid,
      routes: layout.routes || [],
    });
  }

  /** @type {LoadedPack} */
  return {
    meta: {
      pack_id: meta.pack_id || "unknown",
      pack_version: version,
      title: meta.title || "",
      description: meta.description || "",
    },
    stations,
    routes,
    layouts,
    deckLines: [...deckLines],
    raw: packObj,
  };
}

// ─────────────────────────────────────────
// Convenience query helpers
// ─────────────────────────────────────────

/**
 * Get all stations belonging to a specific line code.
 * @param {LoadedPack} loadedPack
 * @param {string} lc - Line code (e.g. "JY", "M")
 * @returns {Station[]}
 */
export function getStationsByLine(loadedPack, lc) {
  return loadedPack.stations
    .filter((s) => s.lc === lc)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get a station by its entity ID.
 * @param {LoadedPack} loadedPack
 * @param {string} id
 * @returns {Station|undefined}
 */
export function getStationById(loadedPack, id) {
  return loadedPack.stations.find((s) => s.id === id);
}

/**
 * Get a route by its line code.
 * @param {LoadedPack} loadedPack
 * @param {string} lc
 * @returns {Route|undefined}
 */
export function getRouteByLc(loadedPack, lc) {
  return loadedPack.routes.find((r) => r.lc === lc);
}

// ─────────────────────────────────────────
// JSDoc type definitions (for IDE support)
// ─────────────────────────────────────────

/**
 * @typedef {object} Station
 * @property {string} id
 * @property {string} station_code
 * @property {string} name_ja
 * @property {string} name_en
 * @property {string} lc
 * @property {number} order
 * @property {string[]} cross_lines
 * @property {number} hub_degree_global
 * @property {number} hub_bonus_global
 * @property {string} hub_rank_global
 * @property {number} hub_degree_deck
 * @property {number} hub_bonus_deck
 * @property {string} hub_rank_deck
 */

/**
 * @typedef {object} Route
 * @property {string} id
 * @property {string} lc
 * @property {string} name_ja
 * @property {string} name_en
 * @property {string} color
 * @property {string[]} members
 */

/**
 * @typedef {object} LoadedPack
 * @property {{ pack_id: string, pack_version: string, title: string, description: string }} meta
 * @property {Station[]} stations
 * @property {Route[]} routes
 * @property {{ id: string, name: string, routes: string[] }[]} layouts
 * @property {string[]} deckLines
 * @property {object} raw
 */
