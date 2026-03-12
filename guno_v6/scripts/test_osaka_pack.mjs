import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { loadPackFromObject } = await import('../src/data/pack_loader.js');
const raw = JSON.parse(readFileSync(resolve(ROOT, 'cities/osaka/data/packs/pack_v1.json'), 'utf8'));
const pack = loadPackFromObject(raw);

console.log('routes:', pack.routes.length);
console.log('stations:', pack.stations.length);
console.log('first route:', pack.routes[0]?.lc, pack.routes[0]?.name_ja, 'size:', pack.routes[0]?.size);
console.log('first station:', pack.stations[0]?.lc, pack.stations[0]?.st_ja, 'order:', pack.stations[0]?.order);
console.log('PASS: Osaka pack_v1.json loaded successfully');
