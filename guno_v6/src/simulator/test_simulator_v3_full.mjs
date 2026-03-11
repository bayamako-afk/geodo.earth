/**
 * test_simulator_v3_full.mjs
 * game_simulator_v3 + route_completion_score_v2 + network_score の統合テスト
 * 
 * 実行: node test_simulator_v3_full.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

const packJson     = JSON.parse(readFileSync(join(ROOT, 'assets/guno/guno_pack_v6.json'), 'utf8'));
const stationGraph = JSON.parse(readFileSync(join(ROOT, 'data/graph/station_graph_tokyo.json'), 'utf8'));

const { loadPackFromObject } = await import('../data/pack_loader.js');
const packData = loadPackFromObject(packJson);

const { runSimulatorV3Sync, runSingleGameDebug } = await import('./game_simulator_v3.js');

// ─── Test 1: 1ゲームのデバッグ実行（Network Score込み）───
console.log('=== Test 1: Single Game Debug (with Network Score) ===');
const debugResult = runSingleGameDebug([
  { id: 'P1', name: 'Hub AI',      strategy: 'hub' },
  { id: 'P2', name: 'Route AI',    strategy: 'route' },
  { id: 'P3', name: 'Balanced AI', strategy: 'balanced' },
  { id: 'P4', name: 'Greedy AI',   strategy: 'greedy' },
], packData);

// stationGraph なし（runSingleGameDebug は options を渡せないため）
console.log('Winner:', debugResult.winnerId, '(' + debugResult.winnerStrategy + ')');
console.log('Turn count:', debugResult.turnCount);
console.log('End reason:', debugResult.endReason);
console.log('Results:');
for (const r of debugResult.results) {
  console.log(`  ${r.playerId} (${r.strategy.padEnd(8)}): total=${String(r.total).padStart(3)}, st=${r.stCount}, guno=${r.gunoPts}, route=${r.totalRouteBonus}, net=${r.networkBonus}`);
  if (r.completedRoutes.length > 0) console.log(`    completed: ${r.completedRoutes.join(', ')}`);
  if (r.partialRoutes.length > 0)   console.log(`    partial:   ${r.partialRoutes.join(', ')}`);
}
console.log('');

// ─── Test 2: 500ゲームシミュレーション（Network Score込み）───
console.log('=== Test 2: 500 Game Simulation (with Network Score) ===');
const simResult = runSimulatorV3Sync(500, packData, null, { stationGraph });

console.log('\nStrategy ranking (win rate):');
for (const s of simResult.strategy_ranking) {
  console.log(
    `  ${s.strategy.padEnd(10)}: ` +
    `win=${s.win_rate.toFixed(1)}%, ` +
    `total=${s.avg_score.toFixed(1)}, ` +
    `st=${s.avg_st_count.toFixed(1)}, ` +
    `guno=${s.avg_guno_count.toFixed(2)}, ` +
    `route=${s.avg_route_bonus.toFixed(1)}, ` +
    `net=${s.avg_network_bonus.toFixed(1)}`
  );
}

console.log('\nGame stats:');
console.log('  avg_turns:', simResult.game_stats.avg_turns.toFixed(1));
console.log('  end_reasons:', JSON.stringify(simResult.game_stats.end_reasons));

// ─── バランス分析 ───
console.log('\n=== Balance Analysis ===');
const ranking = simResult.strategy_ranking;
const topWinRate = ranking[0].win_rate;
const bottomWinRate = ranking[ranking.length - 1].win_rate;
const winRateSpread = topWinRate - bottomWinRate;
const expectedWinRate = 100 / ranking.length;

console.log(`Expected win rate (uniform): ${expectedWinRate.toFixed(1)}%`);
console.log(`Win rate spread: ${winRateSpread.toFixed(1)}% (top=${topWinRate.toFixed(1)}%, bottom=${bottomWinRate.toFixed(1)}%)`);
if (winRateSpread < 15) {
  console.log('✓ Balance: GOOD (spread < 15%)');
} else if (winRateSpread < 25) {
  console.log('△ Balance: MODERATE (spread 15-25%)');
} else {
  console.log('✗ Balance: POOR (spread > 25%)');
}

// スコア構成分析
console.log('\nScore composition (avg per game):');
for (const s of simResult.strategy_ranking) {
  const totalAvg = s.avg_score;
  const stPct    = totalAvg > 0 ? (s.avg_st_count / totalAvg * 100).toFixed(0) : 0;
  const gunoPct  = totalAvg > 0 ? (s.avg_guno_pts / totalAvg * 100).toFixed(0) : 0;
  const routePct = totalAvg > 0 ? (s.avg_route_bonus / totalAvg * 100).toFixed(0) : 0;
  const netPct   = totalAvg > 0 ? (s.avg_network_bonus / totalAvg * 100).toFixed(0) : 0;
  console.log(
    `  ${s.strategy.padEnd(10)}: ` +
    `st=${stPct}%, guno=${gunoPct}%, route=${routePct}%, net=${netPct}%`
  );
}

console.log('\n✓ Full integration test completed');
