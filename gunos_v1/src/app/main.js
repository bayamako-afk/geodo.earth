/**
 * main.js — GUNOS V1 Application Entry Point
 *
 * Platform: GUNOS V1
 * Phase:    1 — City-aware application scaffold
 *
 * Responsibilities:
 *   1. Boot the GUNOS V1 app
 *   2. Resolve active city from ?city= URL param or registry default
 *   3. Load city profile via city_loader
 *   4. Render the initial shell (title, city label, city selector, placeholder panels)
 *   5. Prepare app state for future phases
 *
 * Architecture:
 *   URL param / default → city_loader → city_ui → shell render → app_state
 *
 * What is NOT done in Phase 1:
 *   - Full gameplay UI
 *   - Play engine integration
 *   - Online / Supabase layer
 *   - Map rendering
 *   - Card deck loading
 */

import { loadCityProfile, listAvailableCities } from '../city/city_loader.js';
import { resolveActiveCityId, renderCitySelector, updateCityDisplay } from '../city/city_ui.js';
import { setState, setActiveCity, setError, getState } from '../state/app_state.js';

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  boot().catch(err => {
    console.error('[GUNOS V1] Fatal boot error:', err);
    showBootError(err.message);
  });
});

async function boot() {
  console.log('[GUNOS V1] Booting platform...');
  setState({ phase: 'booting' });

  setShellStatus('Booting GUNOS V1...');

  // ── Step 1: Resolve active city ──────────────────────────────────────────
  setState({ phase: 'city_loading' });
  setShellStatus('Loading city...');

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

  // ── Step 4: Render shell ─────────────────────────────────────────────────
  const registryEntry = registry.cities.find(c => c.city_id === cityId);
  updateCityDisplay(profile, registryEntry);

  const cities = await listAvailableCities();
  renderCitySelector(cities, cityId);

  renderShellPanels(profile);
  setShellStatus('Ready');

  console.log('[GUNOS V1] Shell ready.', getState());
}

// ── Shell render helpers ──────────────────────────────────────────────────────

/**
 * Render placeholder panels with city-aware labels.
 * @param {Object} profile - Loaded city profile
 */
function renderShellPanels(profile) {
  const cityLabel = profile._display_label || profile.city_id.toUpperCase();

  // Map panel placeholder
  const mapPanel = document.getElementById('panel-map');
  if (mapPanel) {
    mapPanel.innerHTML = `
      <div class="panel-placeholder">
        <span class="panel-placeholder__icon">🗺</span>
        <span class="panel-placeholder__label">MAP — ${cityLabel}</span>
        <span class="panel-placeholder__note">Phase 4: map-first gameplay</span>
      </div>`;
  }

  // Hand panel placeholder
  const handPanel = document.getElementById('panel-hand');
  if (handPanel) {
    handPanel.innerHTML = `
      <div class="panel-placeholder">
        <span class="panel-placeholder__icon">🃏</span>
        <span class="panel-placeholder__label">HAND</span>
        <span class="panel-placeholder__note">Phase 3: play engine integration</span>
      </div>`;
  }

  // Score panel placeholder
  const scorePanel = document.getElementById('panel-score');
  if (scorePanel) {
    scorePanel.innerHTML = `
      <div class="panel-placeholder">
        <span class="panel-placeholder__icon">📊</span>
        <span class="panel-placeholder__label">SCORE</span>
        <span class="panel-placeholder__note">Phase 5: scoring / result UX</span>
      </div>`;
  }

  // Log panel placeholder
  const logPanel = document.getElementById('panel-log');
  if (logPanel) {
    logPanel.innerHTML = `
      <div class="panel-placeholder">
        <span class="panel-placeholder__icon">📜</span>
        <span class="panel-placeholder__label">LOG</span>
        <span class="panel-placeholder__note">Phase 3: play engine integration</span>
      </div>`;
  }
}

/**
 * Update the shell status bar text.
 * @param {string} text
 */
function setShellStatus(text) {
  const el = document.getElementById('shell-status');
  if (el) el.textContent = text;
}

/**
 * Show a fatal boot error in the shell.
 * @param {string} message
 */
function showBootError(message) {
  setError(message);
  setShellStatus(`Error: ${message}`);

  const errorEl = document.getElementById('boot-error');
  if (errorEl) {
    errorEl.textContent = `GUNOS V1 boot error: ${message}`;
    errorEl.style.display = 'block';
  }
}
