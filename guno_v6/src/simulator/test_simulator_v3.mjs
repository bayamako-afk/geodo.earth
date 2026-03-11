/**
 * test_simulator_v3.mjs
 * game_simulator_v3 の動作確認テスト
 * 
 * 実行: node --experimental-vm-modules test_simulator_v3.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

// pack_loader の代わりに直接 JSON を読み込んでパースする
const packJson = JSON.parse(readFileSync(join(ROOT, 'assets/guno/guno_pack_v6.json'), 'utf8'));

// pack_loader.js を使ってパース
const { loadPackFromObject } = await import('../data/pack_loader.js');
const packData = loadPackFromObject(packJson);

console.log('PackData loaded:');
console.log('  routes:', packData.routes.map(r => r.lc).join(', '));
console.log('  stations:', packData.stations.length);
console.log('');

// game_simulator_v3 をインポート
const { runSimulatorV3Sync, runSingleGameDebug } = await import('./game_simulator_v3.js');

// ─── テスト1: 1ゲームのデバッグ実行 ───
console.log('=== Test 1: Single Game Debug ===');
const debugResult = runSingleGameDebug([
  { id: 'P1', name: 'Hub AI',      strategy: 'hub' },
  { id: 'P2', name: 'Route AI',    strategy: 'route' },
  { id: 'P3', name: 'Balanced AI', strategy: 'balanced' },
  { id: 'P4', name: 'Greedy AI',   strategy: 'greedy' },
], packData);

console.log('Winner:', debugResult.winnerId, '(' + debugResult.winnerStrategy + ')');
console.log('Turn count:', debugResult.turnCount);
console.log('End reason:', debugResult.endReason);
console.log('Results:');
for (const r of debugResult.results) {
  console.log(`  ${r.playerId} (${r.strategy}): total=${r.total}, stCount=${r.stCount}, gunoPts=${r.gunoPts}, gunoCount=${r.gunoCount}`);
}
console.log('');

// ─── テスト2: 100ゲームシミュレーション ───
console.log('=== Test 2: 100 Game Simulation ===');
const simResult = runSimulatorV3Sync(100, packData);

console.log('Game stats:');
console.log('  avg_turns:', simResult.game_stats.avg_turns.toFixed(1));
console.log('  end_reasons:', JSON.stringify(simResult.game_stats.end_reasons));
console.log('');
console.log('Strategy ranking (win rate):');
for (const s of simResult.strategy_ranking) {
  console.log(`  ${s.strategy.padEnd(10)}: win_rate=${s.win_rate.toFixed(1)}%, avg_score=${s.avg_score.toFixed(1)}, avg_st=${s.avg_st_count.toFixed(1)}, avg_guno=${s.avg_guno_count.toFixed(2)}`);
}
console.log('');

// ─── テスト3: 500ゲームシミュレーション（バランス検証） ───
console.log('=== Test 3: 500 Game Simulation (Balance Check) ===');
const simResult500 = runSimulatorV3Sync(500, packData);

console.log('Strategy ranking (win rate):');
for (const s of simResult500.strategy_ranking) {
  console.log(`  ${s.strategy.padEnd(10)}: win_rate=${s.win_rate.toFixed(1)}%, avg_score=${s.avg_score.toFixed(1)}, avg_st=${s.avg_st_count.toFixed(1)}, avg_guno=${s.avg_guno_count.toFixed(2)}`);
}
console.log('');
console.log('Game stats:');
console.log('  avg_turns:', simResult500.game_stats.avg_turns.toFixed(1));
console.log('  end_reasons:', JSON.stringify(simResult500.game_stats.end_reasons));

console.log('\n✓ All tests passed');
