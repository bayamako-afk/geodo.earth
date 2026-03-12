/**
 * test_london_package.mjs
 * Validate the London city package for GUNO V6.
 */
import { readFileSync } from "fs";
import { loadPackFromObject } from "../src/data/pack_loader.js";

const BASE = "cities/london";

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ── 1. city_profile.json
console.log("\n1. city_profile.json");
const profile = readJSON(`${BASE}/city_profile.json`);
check("city_id = london", profile.city_id === "london");
check("data_ready = true", profile.status?.data_ready === true);
check("featured_lines has 5 entries", profile.routes?.featured_lines?.length === 5);
check("deck_defaults.deck_size = 30", profile.deck_defaults?.deck_size === 30);
check("deck_defaults rarity keys lowercase", "legendary" in profile.deck_defaults.rarity_targets);

// ── 2. stations_master.json
console.log("\n2. stations_master.json");
const stations = readJSON(`${BASE}/data/master/stations_master.json`);
check("station count >= 100", stations.length >= 100, `got ${stations.length}`);
check("has station_global_id", stations[0]?.station_global_id?.startsWith("ST_"));
check("has lat/lon", typeof stations[0]?.lat === "number");
const transfers = stations.filter(s => s.hub_degree_global > 1);
check("transfer stations > 10", transfers.length > 10, `got ${transfers.length}`);

// ── 3. station_lines.json
console.log("\n3. station_lines.json");
const stationLines = readJSON(`${BASE}/data/master/station_lines.json`);
check("station_lines count >= 150", stationLines.length >= 150, `got ${stationLines.length}`);
check("has line_id", stationLines[0]?.line_id?.length > 0);

// ── 4. station_graph.json
console.log("\n4. station_graph.json");
const graph = readJSON(`${BASE}/data/graph/station_graph.json`);
check("node_count >= 100", graph.graph_meta.node_count >= 100, `got ${graph.graph_meta.node_count}`);
check("edge_count >= 100", graph.graph_meta.edge_count >= 100, `got ${graph.graph_meta.edge_count}`);
check("city_id = london", graph.graph_meta.city_id === "london");

// ── 5. station_metrics.json
console.log("\n5. station_metrics.json");
const metrics = readJSON(`${BASE}/data/derived/station_metrics.json`);
check("station count matches master", metrics.stations.length === stations.length, `metrics=${metrics.stations.length} master=${stations.length}`);
check("has composite_score", typeof metrics.stations[0]?.composite_score === "number");
check("has rarity", metrics.stations[0]?.rarity?.length > 0);
const rarities = metrics.stations.map(s => s.rarity);
const uniqueRarities = [...new Set(rarities)];
check("has multiple rarity tiers", uniqueRarities.length >= 2, `got ${uniqueRarities.join(",")}`);

// ── 6. line_metrics.json
console.log("\n6. line_metrics.json");
const lineMetrics = readJSON(`${BASE}/data/derived/line_metrics.json`);
check("5 lines", lineMetrics.lines.length === 5);
check("has line_strength_score", typeof lineMetrics.lines[0]?.line_strength_score === "number");

// ── 7. pack_v1.json via pack_loader
console.log("\n7. pack_v1.json (via pack_loader)");
const packRaw = readJSON(`${BASE}/data/packs/pack_v1.json`);
const packData = loadPackFromObject(packRaw);
check("routes = 5", packData.routes.length === 5, `got ${packData.routes.length}`);
check("stations >= 25", packData.stations.length >= 25, `got ${packData.stations.length}`);
check("pack_id = london_v1", packData.meta?.pack_id === "london_v1", `got ${packData.meta?.pack_id}`);

// ── 8. deck_v1.json
console.log("\n8. deck_v1.json");
const deck = readJSON(`${BASE}/data/decks/deck_v1.json`);
check("deck_size = 30", deck.deck_meta.deck_size === 30, `got ${deck.deck_meta.deck_size}`);
check("cards count = 30", deck.cards.length === 30, `got ${deck.cards.length}`);
const deckRarities = {};
deck.cards.forEach(c => { deckRarities[c.rarity] = (deckRarities[c.rarity] || 0) + 1; });
check("legendary = 1", deckRarities["legendary"] === 1, `got ${deckRarities["legendary"]}`);
check("no duplicate card_id", new Set(deck.cards.map(c => c.card_id)).size === deck.cards.length);
check("no duplicate station_global_id", new Set(deck.cards.map(c => c.station_global_id)).size === deck.cards.length);

// ── Summary
console.log(`\n${"─".repeat(40)}`);
console.log(`Total: ${passed + failed} checks — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
