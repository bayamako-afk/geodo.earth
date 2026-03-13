/**
 * main.js — GUNOS V1 Application Entry Point
 *
 * Platform: GUNOS V1
 * Phase:    2 — Main play layout
 *
 * Responsibilities:
 *   1. Boot the GUNOS V1 app
 *   2. Resolve active city from ?city= URL param or registry default
 *   3. Load city profile via city_loader
 *   4. Render the full Phase 2 play layout via layout.js
 *   5. Maintain app state for future phases
 *
 * Architecture:
 *   URL param / default → city_loader → layout.js → [header_bar, map_panel, hand_panel, score_panel]
 *
 * What is NOT done in Phase 2:
 *   - Full gameplay / play engine wiring
 *   - Turn progression
 *   - Route / network visualization
 *   - Online / Supabase layer
 *   - Final scoring UX
 */

import { loadCityProfile, listAvailableCities } from '../city/city_loader.js';
import { resolveActiveCityId } from '../city/city_ui.js';
import { setState, setActiveCity, setError, getState } from '../state/app_state.js';
import { renderLayout } from '../ui/layout.js';
import { setHeaderStatus, setStartButtonState } from '../ui/header_bar.js';

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  boot().catch(err => {
    console.error('[GUNOS V1] Fatal boot error:', err);
    _showBootError(err.message);
  });
});

async function boot() {
  console.log('[GUNOS V1] Booting platform (Phase 2)...');
  setState({ phase: 'booting' });
  setHeaderStatus('Booting...', 'loading');

  // ── Step 1: Resolve active city ──────────────────────────────────────────
  setState({ phase: 'city_loading' });
  setHeaderStatus('Loading city...', 'loading');

  let cityId, registry;
  try {
    const resolved = await resolveActiveCityId();
    cityId   = resolved.cityId;
    registry = resolved.registry;
    console.log(`[GUNOS V1] Active city resolved: ${cityId}`);
  } catch (err) {
    throw new Error(`City registry load failed: ${err.message}`);
  }

  // ── Step 2: Load city profile ────────────────────────────────────────────
  let profile;
  try {
    profile = await loadCityProfile(cityId);
    console.log(`[GUNOS V1] City profile loaded: ${profile.display_name}`);
  } catch (err) {
    throw new Error(`City profile load failed for "${cityId}": ${err.message}`);
  }

  // ── Step 3: Update app state ─────────────────────────────────────────────
  setActiveCity(cityId, profile, registry);

  // ── Step 4: Load available cities for selector ───────────────────────────
  const cities = await listAvailableCities();

  // ── Step 5: Render full Phase 2 layout ───────────────────────────────────
  const registryEntry = registry.cities.find(c => c.city_id === cityId);

  renderLayout({
    profile,
    registryEntry,
    cities,
    onStart: _handleStart,
    onReset: _handleReset,
  });

  console.log('[GUNOS V1] Phase 2 layout ready.', getState());
}

// ── Action handlers (Phase 2 stubs — wired in Phase 3) ───────────────────────

function _handleStart() {
  console.log('[GUNOS V1] START pressed — Phase 3 will wire play engine here.');
  setHeaderStatus('Phase 3: play engine', 'loading');
  setStartButtonState('playing');

  // Phase 2 stub: show a brief message then revert
  setTimeout(() => {
    setHeaderStatus('Ready', 'idle');
    setStartButtonState('ready');
  }, 2000);
}

function _handleReset() {
  console.log('[GUNOS V1] RESET pressed — reloading city.');
  window.location.reload();
}

// ── Error handling ────────────────────────────────────────────────────────────

function _showBootError(message) {
  setError(message);
  setHeaderStatus(`Error: ${message}`, 'error');

  const errorEl = document.getElementById('boot-error');
  if (errorEl) {
    errorEl.textContent = `GUNOS V1 boot error: ${message}`;
    errorEl.style.display = 'block';
  }
}
