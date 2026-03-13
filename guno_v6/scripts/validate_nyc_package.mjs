/**
 * validate_nyc_package.mjs
 * Validate NYC city package structure and schema compatibility.
 */
import fs from 'fs';

const BASE = 'cities/nyc';

let pass = 0;
let fail = 0;

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    fail++;
  }
}

// 1. city_profile.json
const profile = JSON.parse(fs.readFileSync(`${BASE}/city_profile.json`, 'utf8'));
check('city_profile.city_id', profile.city_id === 'nyc');
check('city_profile.data_ready', profile.status.data_ready === true);
check('city_profile.language', profile.language === 'en');
check('city_profile.timezone', profile.timezone === 'America/New_York');

// 2. Required files exist
const required = [
  'data/master/stations_master.json',
  'data/master/station_lines.json',
  'data/master/lines_master.json',
  'data/graph/station_graph.json',
  'data/derived/station_metrics.json',
  'data/derived/line_metrics.json',
  'data/decks/deck_v1.json',
  'data/packs/pack_v1.json',
];
for (const f of required) {
  check(`file_exists: ${f}`, fs.existsSync(`${BASE}/${f}`));
}

// 3. station_graph.json structure
const graph = JSON.parse(fs.readFileSync(`${BASE}/data/graph/station_graph.json`, 'utf8'));
check('graph.nodes > 0', graph.nodes.length > 0, `${graph.nodes.length} nodes`);
check('graph.edges > 0', graph.edges.length > 0, `${graph.edges.length} edges`);
check('graph.city_id', graph.graph_meta.city_id === 'nyc');

// 4. station_metrics.json
const metrics = JSON.parse(fs.readFileSync(`${BASE}/data/derived/station_metrics.json`, 'utf8'));
check('metrics.stations > 0', metrics.stations.length > 0, `${metrics.stations.length} stations`);
check('metrics.has_composite_score', metrics.stations.every(s => typeof s.composite_score === 'number'));
check('metrics.has_rarity', metrics.stations.every(s => typeof s.rarity === 'string'));

// 5. line_metrics.json
const lm = JSON.parse(fs.readFileSync(`${BASE}/data/derived/line_metrics.json`, 'utf8'));
check('line_metrics.lines == 5', lm.lines.length === 5, `${lm.lines.length} lines`);

// 6. deck_v1.json
const deck = JSON.parse(fs.readFileSync(`${BASE}/data/decks/deck_v1.json`, 'utf8'));
check('deck.cards > 0', deck.cards.length > 0, `${deck.cards.length} cards`);
check('deck.city_id', deck.deck_meta.city_id === 'nyc');
const deckRarity = {};
for (const c of deck.cards) deckRarity[c.rarity] = (deckRarity[c.rarity] || 0) + 1;
check('deck.legendary == 1', deckRarity.legendary === 1, JSON.stringify(deckRarity));

// 7. pack_v1.json schema check
const pack = JSON.parse(fs.readFileSync(`${BASE}/data/packs/pack_v1.json`, 'utf8'));
const colKeys = Object.keys(pack.collections);
check('pack.collections == 5', colKeys.length === 5, `${colKeys.length} collections`);

let allSize10 = true;
let allMembersString = true;
for (const lc of colKeys) {
  const col = pack.collections[lc];
  if (col.size !== 10 || col.members.length !== 10) allSize10 = false;
  if (!Array.isArray(col.members) || !col.members.every(m => typeof m === 'string')) allMembersString = false;
}
check('pack.all_collections_size_10', allSize10);
check('pack.members_are_string_ids', allMembersString);

// 8. entities dict check
const entityKeys = Object.keys(pack.entities);
check('pack.entities_count == 50', entityKeys.length === 50, `${entityKeys.length} entities`);
check('pack.entities_dict_format', entityKeys.every(k => typeof pack.entities[k] === 'object'));

// 9. Cross-reference: all member IDs exist in entities
let xrefOk = true;
for (const lc of colKeys) {
  for (const mid of pack.collections[lc].members) {
    if (!pack.entities[mid]) {
      console.log(`    XREF FAIL: ${mid} not in entities`);
      xrefOk = false;
    }
  }
}
check('pack.xref_members_in_entities', xrefOk);

// 10. Schema compatibility with London (spot check field names)
const firstEntity = pack.entities[entityKeys[0]];
check('entity.has_type', typeof firstEntity.type === 'string');
check('entity.has_name_ja', typeof firstEntity.name_ja === 'string');
check('entity.has_name_en', typeof firstEntity.name_en === 'string');
check('entity.has_station_global_id', typeof firstEntity.station_global_id === 'string');
check('entity.has_cross_lines', Array.isArray(firstEntity.cross_lines));

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`NYC Package Validation: ${pass} PASS / ${fail} FAIL`);
if (fail === 0) {
  console.log('All checks passed. NYC package is ready.');
} else {
  console.log('Some checks failed. Review above.');
}

// Detailed collection report
console.log('\nCollection details:');
for (const lc of colKeys) {
  const col = pack.collections[lc];
  const names = col.members.map(eid => pack.entities[eid]?.name_en || eid);
  console.log(`  ${lc.toUpperCase()} (${col.name_en}): ${names.join(', ')}`);
}
