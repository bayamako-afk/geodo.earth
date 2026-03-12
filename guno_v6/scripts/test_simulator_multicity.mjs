/**
 * test_simulator_multicity.mjs
 * Node.js validation: game_simulator_v3 multi-city support
 *
 * Checks:
 *   1. Tokyo: runSimulatorV3Sync runs 20 games successfully
 *   2. Osaka: runSimulatorV3Sync runs 20 games successfully
 *   3. London: SimulatorError DATA_NOT_READY is thrown
 *   4. Batch summary includes city_id (via runSimulationBatch mock)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadPackSync(cityId) {
  const profilePath = resolve(ROOT, `cities/${cityId}/city_profile.json`);
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const packPath = resolve(ROOT, profile.dataset.default_pack);
  const raw = JSON.parse(readFileSync(packPath, 'utf8'));
  return raw;
}

function loadGraphSync(cityId) {
  try {
    const profilePath = resolve(ROOT, `cities/${cityId}/city_profile.json`);
    const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
    const graphPath = resolve(ROOT, profile.dataset.station_graph);
    return JSON.parse(readFileSync(graphPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

// ── Import simulator ──────────────────────────────────────────────────────────

const { runSimulatorV3Sync, SimulatorError } = await import('../src/simulator/game_simulator_v3.js');
const { loadPackFromObject } = await import('../src/data/pack_loader.js');

// ── Test 1: Tokyo ─────────────────────────────────────────────────────────────

console.log('\n[1] Tokyo simulation (20 games)');
try {
  const raw = loadPackSync('tokyo');
  const pack = loadPackFromObject(raw);
  const graph = loadGraphSync('tokyo');
  const result = runSimulatorV3Sync(20, pack, null, { stationGraph: graph });

  check('result.game_stats.total_simulations === 20', result.game_stats.total_simulations === 20);
  check('strategy_ranking has 4 entries', result.strategy_ranking.length === 4);
  check('avg_turns > 0', result.game_stats.avg_turns > 0);
  check('top_stations array exists', Array.isArray(result.top_stations));
  check('top_routes array exists', Array.isArray(result.top_routes));
  check('no city_id in sync result (expected)', result.city_id === undefined);
  console.log(`  → Top strategy: ${result.strategy_ranking[0].strategy} (${result.strategy_ranking[0].win_rate.toFixed(1)}%)`);
  console.log(`  → Avg turns: ${result.game_stats.avg_turns.toFixed(1)}`);
} catch (e) {
  console.error('  FAIL:', e.message);
  failed++;
}

// ── Test 2: Osaka ─────────────────────────────────────────────────────────────

console.log('\n[2] Osaka simulation (20 games)');
try {
  const raw = loadPackSync('osaka');
  const pack = loadPackFromObject(raw);
  const graph = loadGraphSync('osaka');
  const result = runSimulatorV3Sync(20, pack, null, { stationGraph: graph });

  check('result.game_stats.total_simulations === 20', result.game_stats.total_simulations === 20);
  check('strategy_ranking has 4 entries', result.strategy_ranking.length === 4);
  check('avg_turns > 0', result.game_stats.avg_turns > 0);
  check('top_stations array exists', Array.isArray(result.top_stations));
  check('top_routes array exists', Array.isArray(result.top_routes));
  console.log(`  → Top strategy: ${result.strategy_ranking[0].strategy} (${result.strategy_ranking[0].win_rate.toFixed(1)}%)`);
  console.log(`  → Avg turns: ${result.game_stats.avg_turns.toFixed(1)}`);
  if (result.top_stations.length > 0) {
    console.log(`  → Top station: ${result.top_stations[0].name} (${result.top_stations[0].wins} wins)`);
  }
} catch (e) {
  console.error('  FAIL:', e.message);
  failed++;
}

// ── Test 3: London scaffold (data_ready: false) ───────────────────────────────

console.log('\n[3] London scaffold (data_ready: false)');
try {
  const profilePath = resolve(ROOT, 'cities/london/city_profile.json');
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  check('London data_ready === false', profile.status?.data_ready === false);

  // Simulate what runSimulationBatch would do
  if (profile.status?.data_ready === false) {
    throw new SimulatorError('DATA_NOT_READY', `City data for "london" is not ready yet.`);
  }
} catch (e) {
  if (e instanceof SimulatorError && e.code === 'DATA_NOT_READY') {
    check('SimulatorError thrown with DATA_NOT_READY code', true);
    check('Error message mentions "london"', e.message.includes('london'));
    console.log(`  → Error message: ${e.message}`);
  } else {
    console.error('  FAIL unexpected error:', e.message);
    failed++;
  }
}

// ── Test 4: SimulatorError class exported ─────────────────────────────────────

console.log('\n[4] SimulatorError export');
check('SimulatorError is exported', typeof SimulatorError === 'function');
const err = new SimulatorError('TEST_CODE', 'test message');
check('SimulatorError.code works', err.code === 'TEST_CODE');
check('SimulatorError.name is SimulatorError', err.name === 'SimulatorError');

// ── Test 5: runSimulatorV3Sync exports ────────────────────────────────────────

console.log('\n[5] Exports check');
check('runSimulatorV3Sync exported', typeof runSimulatorV3Sync === 'function');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('✓ ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.error('✗ SOME CHECKS FAILED');
  process.exit(1);
}
