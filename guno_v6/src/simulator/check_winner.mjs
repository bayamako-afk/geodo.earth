import { loadPackFromObject } from '../data/pack_loader.js';
import { runSingleGameDebug } from './game_simulator_v3.js';
import { readFileSync } from 'fs';
const packJson = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/assets/guno/guno_pack_v6.json', 'utf8'));
const packData = loadPackFromObject(packJson);
const players = [
  { id: 'P1', strategy: 'hub' },
  { id: 'P2', strategy: 'route' },
  { id: 'P3', strategy: 'balanced' },
  { id: 'P4', strategy: 'greedy' },
];
const result = runSingleGameDebug(players, packData);
console.log('Winner:', result.winnerId);
const winnerResult = result.results.find(r => r.playerId === result.winnerId);
console.log('winnerResult keys:', Object.keys(winnerResult));
console.log('routeDetails:', winnerResult.routeDetails);
console.log('completedRoutes:', winnerResult.completedRoutes);
