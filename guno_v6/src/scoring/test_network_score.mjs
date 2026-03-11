/**
 * test_network_score.mjs
 * network_score.js の動作確認テスト
 * 
 * 実行: node test_network_score.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  computeNetworkScoreFromMapState,
  getNetworkSizeBonus,
  getCrossLineBonus,
} from './network_score.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

// データ読み込み
const packJson = JSON.parse(readFileSync(join(ROOT, 'assets/guno/guno_pack_v6.json'), 'utf8'));
const stationGraph = JSON.parse(readFileSync(join(ROOT, 'data/graph/station_graph_tokyo.json'), 'utf8'));
const { loadPackFromObject } = await import('../data/pack_loader.js');
const packData = loadPackFromObject(packJson);

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

function assertGte(label, actual, min) {
  if (actual >= min) {
    console.log(`  ✓ ${label} (${actual} >= ${min})`);
    passed++;
  } else {
    console.error(`  ✗ ${label}: expected >= ${min}, got ${actual}`);
    failed++;
  }
}

// ─── Test 1: ボーナステーブル ───
console.log('\n=== Test 1: getNetworkSizeBonus ===');
assert('size=1 → 0',  getNetworkSizeBonus(1),  0);
assert('size=2 → 2',  getNetworkSizeBonus(2),  2);
assert('size=3 → 4',  getNetworkSizeBonus(3),  4);
assert('size=5 → 10', getNetworkSizeBonus(5),  10);
assert('size=10 → 35', getNetworkSizeBonus(10), 35);
assert('size=15 → 35', getNetworkSizeBonus(15), 35);

console.log('\n=== Test 2: getCrossLineBonus ===');
assert('1路線 → 0',  getCrossLineBonus(1), 0);
assert('2路線 → 3',  getCrossLineBonus(2), 3);
assert('3路線 → 6',  getCrossLineBonus(3), 6);
assert('4路線 → 10', getCrossLineBonus(4), 10);

// ─── Test 3: 空の mapState ───
console.log('\n=== Test 3: Empty mapState ===');
const r0 = computeNetworkScoreFromMapState({}, 0, packData, stationGraph);
assert('empty → network_bonus=0', r0.network_bonus, 0);
assert('empty → max_component_size=0', r0.max_component_size, 0);

// ─── Test 4: 孤立駅（隣接なし）───
console.log('\n=== Test 4: Isolated stations ===');
// JY-1=東京, JY-3=秋葉原（隣接しない）
const mapState4 = { 'JY-1': 0, 'JY-3': 0 };
const r4 = computeNetworkScoreFromMapState(mapState4, 0, packData, stationGraph);
// 東京(JY-1)と秋葉原(JY-3)は直接隣接していない（神田が間にある）
// → 2つの孤立成分（各サイズ1）→ bonus=0
assert('JY-1,JY-3 isolated → network_bonus=0', r4.network_bonus, 0);

// ─── Test 5: 連続する駅（隣接あり）───
console.log('\n=== Test 5: Adjacent stations ===');
// JY-1=東京, JY-2=神田（隣接）
const mapState5 = { 'JY-1': 0, 'JY-2': 0 };
const r5 = computeNetworkScoreFromMapState(mapState5, 0, packData, stationGraph);
// 東京-神田は隣接 → size=2 → bonus=2
assert('JY-1,JY-2 adjacent → network_bonus=2', r5.network_bonus, 2);
assert('JY-1,JY-2 → max_component_size=2', r5.max_component_size, 2);
assert('JY-1,JY-2 → components.length=1', r5.components.length, 1);

// ─── Test 6: 3駅連続 ───
console.log('\n=== Test 6: 3 consecutive stations ===');
// JY-1=東京, JY-2=神田, JY-3=秋葉原（連続）
const mapState6 = { 'JY-1': 0, 'JY-2': 0, 'JY-3': 0 };
const r6 = computeNetworkScoreFromMapState(mapState6, 0, packData, stationGraph);
assert('JY-1,2,3 → max_component_size=3', r6.max_component_size, 3);
assert('JY-1,2,3 → network_bonus=4', r6.network_bonus, 4);

// ─── Test 7: 乗換駅を通じた異路線接続 ───
console.log('\n=== Test 7: Cross-line connection via transfer station ===');
// 東京(JY-1)は丸ノ内線とも接続
// JY-1=東京(0), M-1=東京(0) → 同じ駅名なので連結
// さらにM-2=大手町(0)を追加
const mapState7 = { 'JY-1': 0, 'M-1': 0, 'M-2': 0 };
const r7 = computeNetworkScoreFromMapState(mapState7, 0, packData, stationGraph);
// 東京はJY・Mの両方に登場するが、packDataでは別カードなので駅名は同じ「東京」
// graph上で東京-大手町は隣接（M線）
// 東京(JY) = 東京(M) = 同じ駅名 → 連結
console.log('  r7 components:', JSON.stringify(r7.components.map(c => ({ stations: c.stations, size: c.size, lines: c.lines }))));
assertGte('cross-line connection → max_component_size >= 2', r7.max_component_size, 2);
assertGte('cross-line connection → network_bonus >= 2', r7.network_bonus, 2);

// ─── Test 8: 実際のゲームシミュレーション後のスコア ───
console.log('\n=== Test 8: Full game simulation ===');
// P0が複数の連続した駅を占有するシナリオ
const mapState8 = {};
// JY: 東京(1), 神田(2), 秋葉原(3), 御徒町(4), 上野(5) → 5連続
for (let i = 1; i <= 5; i++) mapState8[`JY-${i}`] = 0;
// M: 東京(1), 大手町(2), 淡路町(3) → 3連続
for (let i = 1; i <= 3; i++) mapState8[`M-${i}`] = 0;
// 残りは他プレイヤー
const r8 = computeNetworkScoreFromMapState(mapState8, 0, packData, stationGraph);
console.log('  r8 network_bonus:', r8.network_bonus);
console.log('  r8 max_component_size:', r8.max_component_size);
console.log('  r8 total_connected_stations:', r8.total_connected_stations);
console.log('  r8 components:', JSON.stringify(r8.components.map(c => ({
  stations: c.stations, size: c.size, lines: c.lines, total_bonus: c.total_bonus
}))));
assertGte('full game → network_bonus >= 10', r8.network_bonus, 10);

// ─── Summary ───
console.log(`\n${'─'.repeat(40)}`);
console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('✓ All tests passed');
} else {
  console.error(`✗ ${failed} tests failed`);
  process.exit(1);
}
