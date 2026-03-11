import { loadPackFromObject } from '../data/pack_loader.js';
import { runSimulatorV3Sync } from './game_simulator_v3.js';
import { readFileSync } from 'fs';
const packJson = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/assets/guno/guno_pack_v6.json', 'utf8'));
const packData = loadPackFromObject(packJson);
const stationGraph = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/data/graph/station_graph_tokyo.json', 'utf8'));
const result = runSimulatorV3Sync(200, packData, null, { stationGraph });
console.log('Top stations:', result.top_stations.slice(0,10).map(s => `${s.name}:${s.wins}`).join(', '));
console.log('Top routes:', result.top_routes.slice(0,5).map(r => `${r.name}:${r.wins}`).join(', '));
