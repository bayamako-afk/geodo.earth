/**
 * test_osaka_package.mjs
 * Node.js validation for the Osaka city package.
 *
 * Run from guno_v6/ root:
 *   node scripts/test_osaka_package.mjs
 */

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function pass(msg) { console.log(`  ✓  ${msg}`); }
function fail(msg) { console.error(`  ✗  ${msg}`); process.exitCode = 1; }

async function readJson(relPath) {
  const abs = resolve(ROOT, relPath);
  const txt = await readFile(abs, 'utf8');
  return JSON.parse(txt);
}

async function main() {
  console.log('\n=== Osaka city package validation ===\n');

  // ── 1. city_profile.json ────────────────────────────────────────────────────
  console.log('1. city_profile.json');
  let profile;
  try {
    profile = await readJson('cities/osaka/city_profile.json');
    pass('Loaded cities/osaka/city_profile.json');
  } catch (e) { fail(`Cannot load: ${e.message}`); return; }

  if (profile.city_id === 'osaka')         pass(`city_id === "osaka"`);
  else                                     fail(`city_id mismatch: "${profile.city_id}"`);
  if (profile.status?.data_ready === true) pass(`data_ready === true`);
  else                                     fail(`data_ready is not true`);
  if (Array.isArray(profile.routes?.featured_lines) && profile.routes.featured_lines.length > 0)
                                           pass(`featured_lines: ${profile.routes.featured_lines.join(', ')}`);
  else                                     fail(`featured_lines missing or empty`);

  // ── 2. Dataset files exist ──────────────────────────────────────────────────
  console.log('\n2. Dataset files');
  const datasets = profile.dataset;
  for (const [key, relPath] of Object.entries(datasets)) {
    try {
      await readJson(relPath);
      pass(`${key}: ${relPath}`);
    } catch (e) { fail(`${key}: ${relPath} — ${e.message}`); }
  }

  // ── 3. station_graph.json structure ────────────────────────────────────────
  console.log('\n3. station_graph.json');
  let graph;
  try { graph = await readJson(datasets.station_graph); } catch (e) { fail(e.message); return; }
  if (Array.isArray(graph.nodes) && graph.nodes.length > 0) pass(`nodes: ${graph.nodes.length}`);
  else fail('nodes missing or empty');
  if (Array.isArray(graph.edges) && graph.edges.length > 0) pass(`edges: ${graph.edges.length}`);
  else fail('edges missing or empty');
  const n0 = graph.nodes[0];
  const requiredNodeKeys = ['node_id','station_global_id','station_name','station_slug','lat','lon','line_count'];
  for (const k of requiredNodeKeys) {
    if (n0[k] !== undefined) pass(`node has key: ${k}`);
    else fail(`node missing key: ${k}`);
  }
  const e0 = graph.edges[0];
  const requiredEdgeKeys = ['edge_id','from','to','line_id','line_name'];
  for (const k of requiredEdgeKeys) {
    if (e0[k] !== undefined) pass(`edge has key: ${k}`);
    else fail(`edge missing key: ${k}`);
  }

  // ── 4. station_metrics.json ─────────────────────────────────────────────────
  console.log('\n4. station_metrics.json');
  let metrics;
  try { metrics = await readJson(datasets.station_metrics); } catch (e) { fail(e.message); return; }
  const stations = metrics.stations || metrics;
  if (Array.isArray(stations) && stations.length > 0) pass(`stations: ${stations.length}`);
  else fail('stations missing or empty');
  const s0 = Array.isArray(stations) ? stations[0] : null;
  if (s0) {
    for (const k of ['station_global_id','station_name','score_total','rank','betweenness']) {
      if (s0[k] !== undefined) pass(`station_metrics has key: ${k}`);
      else fail(`station_metrics missing key: ${k}`);
    }
    pass(`Top station: ${s0.station_name} (score=${s0.score_total})`);
  }

  // ── 5. line_metrics.json ────────────────────────────────────────────────────
  console.log('\n5. line_metrics.json');
  let lm;
  try { lm = await readJson(datasets.line_metrics); } catch (e) { fail(e.message); return; }
  const lines = lm.lines || lm;
  if (Array.isArray(lines) && lines.length > 0) pass(`lines: ${lines.length}`);
  else fail('lines missing or empty');
  const l0 = Array.isArray(lines) ? lines[0] : null;
  if (l0) {
    for (const k of ['line_id','line_name','station_count','line_strength']) {
      if (l0[k] !== undefined) pass(`line_metrics has key: ${k}`);
      else fail(`line_metrics missing key: ${k}`);
    }
  }

  // ── 6. deck_v1.json ─────────────────────────────────────────────────────────
  console.log('\n6. deck_v1.json');
  let deck;
  try { deck = await readJson(datasets.default_deck); } catch (e) { fail(e.message); return; }
  const cards = deck.cards || [];
  if (cards.length === 40) pass(`deck has 40 cards`);
  else fail(`deck has ${cards.length} cards (expected 40)`);
  const rarities = {};
  for (const c of cards) rarities[c.rarity] = (rarities[c.rarity] || 0) + 1;
  pass(`Rarity distribution: ${JSON.stringify(rarities)}`);
  const c0 = cards[0];
  for (const k of ['card_id','station_global_id','station_name','score_total','rarity','rank']) {
    if (c0[k] !== undefined) pass(`card has key: ${k}`);
    else fail(`card missing key: ${k}`);
  }

  // ── 7. pack_v1.json ─────────────────────────────────────────────────────────
  console.log('\n7. pack_v1.json');
  let pack;
  try { pack = await readJson(datasets.default_pack); } catch (e) { fail(e.message); return; }
  if (pack.pack_meta) pass(`pack_meta present`);
  else fail(`pack_meta missing`);
  if (pack.entities && Object.keys(pack.entities).length > 0)
    pass(`entities: ${Object.keys(pack.entities).length}`);
  else fail(`entities missing or empty`);
  if (pack.collections && Object.keys(pack.collections).length > 0)
    pass(`collections: ${Object.keys(pack.collections).join(', ')}`);
  else fail(`collections missing or empty`);
  if (pack.rules) pass(`rules present`);
  else fail(`rules missing`);

  // ── 8. Schema compatibility vs Tokyo ────────────────────────────────────────
  console.log('\n8. Schema compatibility vs Tokyo');
  let tokyoMetrics;
  try {
    tokyoMetrics = await readJson('cities/tokyo/data/derived/station_metrics.json');
    const tokyoSt = tokyoMetrics.stations[0];
    const osakaSt = stations[0];
    const sharedKeys = Object.keys(tokyoSt).filter(k => osakaSt[k] !== undefined);
    pass(`Shared station_metrics keys with Tokyo: ${sharedKeys.join(', ')}`);
    const missingKeys = Object.keys(tokyoSt).filter(k => osakaSt[k] === undefined);
    if (missingKeys.length === 0) pass('No missing keys vs Tokyo schema');
    else fail(`Missing keys vs Tokyo: ${missingKeys.join(', ')}`);
  } catch (e) { fail(`Cannot compare with Tokyo: ${e.message}`); }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n=== Validation complete ===');
  if (process.exitCode === 1) {
    console.error('\nResult: FAIL — see errors above\n');
  } else {
    console.log('\nResult: PASS — Osaka package is valid and schema-compatible\n');
  }
}

main().catch(err => { console.error('Unexpected error:', err); process.exit(1); });
