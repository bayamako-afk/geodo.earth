import { loadPackFromObject } from '../data/pack_loader.js';
import { runSimulatorV3Sync } from './game_simulator_v3.js';
import { readFileSync } from 'fs';
const packJson = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/assets/guno/guno_pack_v6.json', 'utf8'));
const packData = loadPackFromObject(packJson);
const stationGraph = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/data/graph/station_graph_tokyo.json', 'utf8'));
const players = [
  { id: 'P1', name: 'Hub',      strategy: 'hub' },
  { id: 'P2', name: 'Route',    strategy: 'route' },
  { id: 'P3', name: 'Balanced', strategy: 'balanced' },
  { id: 'P4', name: 'Greedy',   strategy: 'greedy' },
];
const result = runSimulatorV3Sync(1000, packData, players, { stationGraph });
console.log('=== 1000 Game Simulation ===');
for (const s of result.strategy_ranking) {
  console.log(`  ${s.strategy.padEnd(10)}: win=${s.win_rate.toFixed(1)}%, total=${s.avg_score.toFixed(1)}, st=${s.avg_st_count.toFixed(1)}, route=${s.avg_route_bonus.toFixed(1)}, net=${s.avg_network_bonus.toFixed(1)}`);
}
const spread = result.strategy_ranking[0].win_rate - result.strategy_ranking[result.strategy_ranking.length-1].win_rate;
console.log(`Spread: ${spread.toFixed(1)}%`);
console.log(`Avg turns: ${result.game_stats.avg_turns.toFixed(1)}`);
console.log('Top stations (winner):', result.top_stations.slice(0,5).map(s => `${s.name}:${s.wins}`).join(', '));
console.log('Top routes (winner):', result.top_routes.slice(0,5).map(r => `${r.name}:${r.wins}`).join(', '));
