/**
 * test_city_loader.mjs
 * Node.js consistency test for city_loader.js + city_registry.json
 *
 * Run from guno_v6/ root:
 *   node scripts/test_city_loader.mjs
 */

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────────────────

function pass(msg) { console.log(`  ✓  ${msg}`); }
function fail(msg) { console.error(`  ✗  ${msg}`); process.exitCode = 1; }

async function readJson(relPath) {
  const abs = resolve(ROOT, relPath);
  const txt = await readFile(abs, 'utf8');
  return JSON.parse(txt);
}

// ── Test suite ────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== GUNO V6 city_loader consistency check ===\n');

  // ── 1. Load registry ────────────────────────────────────────────────────────
  console.log('1. city_registry.json format');
  let registry;
  try {
    registry = await readJson('config/city_registry.json');
    pass('Loaded config/city_registry.json');
  } catch (e) {
    fail(`Cannot load registry: ${e.message}`);
    return;
  }

  if (typeof registry.default_city === 'string') {
    pass(`default_city is a string: "${registry.default_city}"`);
  } else {
    fail(`default_city is missing or not a string`);
  }

  if (Array.isArray(registry.cities)) {
    pass(`cities is an array (${registry.cities.length} entries)`);
  } else {
    fail(`cities is not an array`);
    return;
  }

  const requiredKeys = ['city_id', 'display_name', 'profile'];
  let allEntriesValid = true;
  for (const entry of registry.cities) {
    for (const key of requiredKeys) {
      if (typeof entry[key] !== 'string') {
        fail(`Entry for "${entry.city_id || '?'}" missing key: ${key}`);
        allEntriesValid = false;
      }
    }
  }
  if (allEntriesValid) pass(`All ${registry.cities.length} city entries have city_id, display_name, profile`);

  // ── 2. city_loader.js exports ───────────────────────────────────────────────
  console.log('\n2. city_loader.js exports');
  const loaderSrc = await readFile(resolve(ROOT, 'src/city/city_loader.js'), 'utf8');

  const expectedExports = [
    'loadCityRegistry',
    'getDefaultCityId',
    'loadCityProfile',
    'resolveDatasetUrl',
    'loadDefaultCityProfile',
    'listAvailableCities',
    'loadCityData',
  ];
  for (const fn of expectedExports) {
    if (loaderSrc.includes(`export async function ${fn}`) || loaderSrc.includes(`export function ${fn}`)) {
      pass(`export: ${fn}`);
    } else {
      fail(`MISSING export: ${fn}`);
    }
  }

  // ── 3. Registry format vs loader expectations ───────────────────────────────
  console.log('\n3. Registry format vs loader expectations');
  const expectsFind = loaderSrc.includes("registry.cities.find(c => c.city_id === cityId)");
  if (expectsFind) {
    pass('city_loader.js uses registry.cities.find(c => c.city_id) — expects object array');
  } else {
    fail('city_loader.js does not use expected .find(c => c.city_id) pattern');
  }

  const firstEntry = registry.cities[0];
  if (firstEntry && typeof firstEntry === 'object' && firstEntry.city_id) {
    pass(`city_registry.json cities[] is object array — format matches loader expectation`);
  } else {
    fail(`city_registry.json cities[] format does NOT match loader expectation (expected objects with city_id)`);
  }

  // ── 4. Default city resolves to "tokyo" ─────────────────────────────────────
  console.log('\n4. Default city resolution');
  if (registry.default_city === 'tokyo') {
    pass(`default_city === "tokyo"`);
  } else {
    fail(`default_city is "${registry.default_city}", expected "tokyo"`);
  }

  const tokyoEntry = registry.cities.find(c => c.city_id === 'tokyo');
  if (tokyoEntry) {
    pass(`Tokyo entry found: profile = "${tokyoEntry.profile}"`);
  } else {
    fail(`Tokyo entry NOT found in registry.cities`);
    return;
  }

  // ── 5. Tokyo city_profile.json exists and is valid ──────────────────────────
  console.log('\n5. Tokyo city_profile.json');
  let tokyoProfile;
  try {
    tokyoProfile = await readJson(tokyoEntry.profile);
    pass(`Loaded ${tokyoEntry.profile}`);
  } catch (e) {
    fail(`Cannot load Tokyo profile: ${e.message}`);
    return;
  }

  if (tokyoProfile.city_id === 'tokyo') pass(`city_id === "tokyo"`);
  else fail(`city_id mismatch: "${tokyoProfile.city_id}"`);

  if (tokyoProfile.dataset && typeof tokyoProfile.dataset === 'object') {
    pass(`dataset block present (${Object.keys(tokyoProfile.dataset).length} keys)`);
  } else {
    fail(`dataset block missing in Tokyo profile`);
  }

  // ── 6. Tokyo dataset files exist ────────────────────────────────────────────
  console.log('\n6. Tokyo dataset files on disk');
  const datasetKeys = Object.entries(tokyoProfile.dataset);
  for (const [key, relPath] of datasetKeys) {
    try {
      await readJson(relPath);
      pass(`${key}: ${relPath}`);
    } catch (e) {
      fail(`${key}: ${relPath} — ${e.message}`);
    }
  }

  // ── 7. Scaffold cities have profile files ───────────────────────────────────
  console.log('\n7. Scaffold city profiles (osaka / london / nyc)');
  for (const entry of registry.cities.filter(c => c.city_id !== 'tokyo')) {
    try {
      const profile = await readJson(entry.profile);
      if (profile.status && profile.status.data_ready === false) {
        pass(`${entry.city_id}: profile loaded, data_ready=false (scaffold)`);
      } else {
        pass(`${entry.city_id}: profile loaded`);
      }
    } catch (e) {
      fail(`${entry.city_id}: cannot load profile — ${e.message}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n=== Check complete ===');
  if (process.exitCode === 1) {
    console.error('\nResult: FAIL — see errors above\n');
  } else {
    console.log('\nResult: PASS — registry and loader are fully compatible\n');
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
