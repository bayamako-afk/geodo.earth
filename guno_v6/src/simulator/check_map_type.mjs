import { loadPackFromObject } from '../data/pack_loader.js';
import { runSimulatorV3Sync } from './game_simulator_v3.js';
import { readFileSync } from 'fs';
const packJson = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/assets/guno/guno_pack_v6.json', 'utf8'));
const packData = loadPackFromObject(packJson);
const result = runSimulatorV3Sync(10, packData, null, {});
console.log('_topStationMap type:', typeof result._topStationMap, result._topStationMap instanceof Map ? 'Map' : 'NOT Map');
console.log('_topRouteMap type:', typeof result._topRouteMap, result._topRouteMap instanceof Map ? 'Map' : 'NOT Map');
console.log('_topStationMap keys:', result._topStationMap ? [...result._topStationMap.entries()].slice(0,3) : 'null');
