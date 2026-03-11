import { loadPackFromObject } from '../data/pack_loader.js';
import { readFileSync } from 'fs';
const packJson = JSON.parse(readFileSync('/home/ubuntu/geodo.earth/guno_v6/assets/guno/guno_pack_v6.json', 'utf8'));
const packData = loadPackFromObject(packJson);
console.log('packData keys:', Object.keys(packData));
console.log('routes type:', typeof packData.routes);
if (packData.routes) {
  const keys = Object.keys(packData.routes);
  console.log('routes keys:', keys.slice(0,3));
  const firstKey = keys[0];
  const route = packData.routes[firstKey];
  console.log('first route keys:', Object.keys(route));
  console.log('first route name:', route.name_ja, route.name);
  console.log('first route members[0]:', JSON.stringify(route.members?.[0]));
} else {
  // routesがなければ別の構造を確認
  console.log('No routes. routeCodes:', packData.routeCodes);
  if (packData.routeCodes) {
    const lc = packData.routeCodes[0];
    console.log('packData[lc]:', JSON.stringify(packData[lc])?.slice(0,200));
  }
}
