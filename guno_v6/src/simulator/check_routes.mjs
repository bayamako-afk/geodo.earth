import { loadPackFromObject } from '../data/pack_loader.js';
import { readFileSync } from 'fs';
const packJson = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/assets/guno/guno_pack_v6.json', 'utf8'));
const packData = loadPackFromObject(packJson);
console.log('routes type:', Array.isArray(packData.routes) ? 'Array' : 'Object');
console.log('routes length:', packData.routes.length || Object.keys(packData.routes).length);
for (const [idx, route] of Object.entries(packData.routes)) {
  console.log(`  [${idx}] lc=${route.lc}, name_ja=${route.name_ja}, name_en=${route.name_en}, size=${route.size}`);
}
