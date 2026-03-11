/**
 * test_route_v2.mjs
 * route_completion_score_v2 の動作確認テスト
 * 
 * 実行: node test_route_v2.mjs
 */

import {
  computeRouteScoreV2Sync,
  computeRouteScoreFromMapState,
  buildOwnedSlotsFromMapState,
  calcTieredBonus,
  calcConsecutiveBonus,
  getDifficultyMultiplier,
} from './route_completion_score_v2.js';

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertRange(label, actual, min, max) {
  if (actual >= min && actual <= max) {
    console.log(`  ✓ ${label} (${actual} in [${min}, ${max}])`);
    passed++;
  } else {
    console.error(`  ✗ ${label}: expected [${min}, ${max}], got ${actual}`);
    failed++;
  }
}

// ─── Test 1: getDifficultyMultiplier ───
console.log('\n=== Test 1: getDifficultyMultiplier ===');
assert('routeTotal=10 → 1.5', getDifficultyMultiplier(10), 1.5);
assert('routeTotal=8  → 1.3', getDifficultyMultiplier(8),  1.3);
assert('routeTotal=6  → 1.1', getDifficultyMultiplier(6),  1.1);
assert('routeTotal=4  → 1.0', getDifficultyMultiplier(4),  1.0);

// ─── Test 2: calcTieredBonus ───
console.log('\n=== Test 2: calcTieredBonus (routeTotal=10) ===');
const t_complete = calcTieredBonus(10, 10);
assert('10/10 → tier=complete', t_complete.tier, 'complete');
assert('10/10 → bonus=30 (20*1.5)', t_complete.bonus, 30);

const t_tier3 = calcTieredBonus(7, 10);
assert('7/10 → tier=tier3', t_tier3.tier, 'tier3');
assert('7/10 → bonus=18 (12*1.5)', t_tier3.bonus, 18);

const t_tier2 = calcTieredBonus(5, 10);
assert('5/10 → tier=tier2', t_tier2.tier, 'tier2');
assert('5/10 → bonus=9 (6*1.5)', t_tier2.bonus, 9);

const t_tier1 = calcTieredBonus(3, 10);
assert('3/10 → tier=tier1', t_tier1.tier, 'tier1');
assert('3/10 → bonus=3 (2*1.5)', t_tier1.bonus, 3);

const t_none = calcTieredBonus(2, 10);
assert('2/10 → tier=none', t_none.tier, 'none');
assert('2/10 → bonus=0', t_none.bonus, 0);

// ─── Test 3: calcConsecutiveBonus ───
console.log('\n=== Test 3: calcConsecutiveBonus ===');
const c1 = calcConsecutiveBonus(new Set([1, 2, 3, 4, 5]), 10);
assert('5連続 → max_chain=5', c1.max_chain, 5);
assert('5連続 → bonus=3 (4+以上)', c1.bonus, 3);

const c2 = calcConsecutiveBonus(new Set([1, 2, 4, 5, 6]), 10);
assert('2連続+3連続 → max_chain=3', c2.max_chain, 3);
assert('2連続+3連続 → bonus=3 (1+2)', c2.bonus, 3);

const c3 = calcConsecutiveBonus(new Set([1, 3, 5, 7]), 10);
assert('非連続4駅 → max_chain=1', c3.max_chain, 1);
assert('非連続4駅 → bonus=0', c3.bonus, 0);

const c4 = calcConsecutiveBonus(new Set([1, 2]), 10);
assert('2連続 → max_chain=2', c4.max_chain, 2);
assert('2連続 → bonus=1', c4.bonus, 1);

const c5 = calcConsecutiveBonus(new Set([1]), 10);
assert('1駅のみ → bonus=0', c5.bonus, 0);

// ─── Test 4: buildOwnedSlotsFromMapState ───
console.log('\n=== Test 4: buildOwnedSlotsFromMapState ===');
const mapState = {
  'JY-1': 0,  // P0 owns
  'JY-2': 0,  // P0 owns
  'JY-3': 1,  // P1 owns
  'JY-4': 0,  // P0 owns
  'M-1':  0,  // P0 owns
  'M-2':  -1, // nobody
};
const slots0 = buildOwnedSlotsFromMapState(mapState, 0);
assert('P0 owns JY-1,2,4 → JY set size=3', slots0['JY'].size, 3);
assert('P0 owns M-1 → M set size=1', slots0['M'].size, 1);
assert('P0 JY has order 1', slots0['JY'].has(1), true);
assert('P0 JY has order 2', slots0['JY'].has(2), true);
assert('P0 JY has order 4', slots0['JY'].has(4), true);
assert('P0 JY does NOT have order 3', slots0['JY'].has(3), false);

// ─── Test 5: computeRouteScoreFromMapState ───
console.log('\n=== Test 5: computeRouteScoreFromMapState ===');
const packData = {
  routes: [
    { lc: 'JY', name_ja: '山手線', name_en: 'Yamanote', size: 10, color: '#9ACD32', members: [] },
    { lc: 'M',  name_ja: '丸ノ内線', name_en: 'Marunouchi', size: 10, color: '#F62E36', members: [] },
  ],
};

// P0: JY 7駅連続 (1-7) → tier3(18) + consecutive(3) = 21
const mapState2 = {};
for (let i = 1; i <= 7; i++) mapState2[`JY-${i}`] = 0;
for (let i = 8; i <= 10; i++) mapState2[`JY-${i}`] = 1;
for (let i = 1; i <= 10; i++) mapState2[`M-${i}`] = 1;

const result2 = computeRouteScoreFromMapState(mapState2, 0, packData);
assert('P0 JY 7連続: tier=tier3', result2.route_details[0].tier, 'tier3');
assert('P0 JY 7連続: route_bonus=18', result2.route_details[0].route_bonus, 18);
assert('P0 JY 7連続: consecutive_bonus=3', result2.route_details[0].consecutive_bonus, 3);
assert('P0 JY 7連続: total_bonus=21', result2.route_details[0].total_bonus, 21);
assert('P0 total_route_bonus=21', result2.total_route_bonus, 21);

// P0: JY 完全（10駅）→ complete(30) + consecutive(3) = 33
const mapState3 = {};
for (let i = 1; i <= 10; i++) mapState3[`JY-${i}`] = 0;
const result3 = computeRouteScoreFromMapState(mapState3, 0, packData);
assert('P0 JY 完全: tier=complete', result3.route_details[0].tier, 'complete');
assert('P0 JY 完全: route_bonus=30', result3.route_details[0].route_bonus, 30);
assert('P0 JY 完全: consecutive_bonus=3', result3.route_details[0].consecutive_bonus, 3);
assert('P0 completed_routes includes Yamanote', result3.completed_routes.includes('Yamanote'), true);

// P0: JY 2駅のみ → none
const mapState4 = { 'JY-1': 0, 'JY-5': 0 };
const result4 = computeRouteScoreFromMapState(mapState4, 0, packData);
assert('P0 JY 2駅: tier=none', result4.route_details[0].tier, 'none');
assert('P0 JY 2駅: total_route_bonus=0', result4.total_route_bonus, 0);

// ─── Summary ───
console.log(`\n${'─'.repeat(40)}`);
console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('✓ All tests passed');
} else {
  console.error(`✗ ${failed} tests failed`);
  process.exit(1);
}
