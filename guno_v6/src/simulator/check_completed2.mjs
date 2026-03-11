import { loadPackFromObject } from '../data/pack_loader.js';
import { runSingleGameDebug } from './game_simulator_v3.js';
import { readFileSync } from 'fs';
const packJson = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/assets/guno/guno_pack_v6.json', 'utf8'));
const packData = loadPackFromObject(packJson);
const stationGraph = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/data/graph/station_graph_tokyo.json', 'utf8'));
const players = [
  { id: 'P1', strategy: 'hub' },
  { id: 'P2', strategy: 'route' },
  { id: 'P3', strategy: 'balanced' },
  { id: 'P4', strategy: 'greedy' },
];
// 10ゲームでcompletedRoutesを確認
let totalCompleted = 0;
for (let i = 0; i < 10; i++) {
  const result = runSingleGameDebug(players, packData);
  for (const r of result.results) {
    if (r.completedRoutes && r.completedRoutes.length > 0) {
      console.log(`Game ${i+1} Player ${r.playerId}: completedRoutes=${JSON.stringify(r.completedRoutes)}`);
      totalCompleted += r.completedRoutes.length;
    }
  }
}
console.log(`Total completed routes in 10 games: ${totalCompleted}`);
