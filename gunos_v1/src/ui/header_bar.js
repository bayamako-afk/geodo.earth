/**
 * header_bar.js — GUNOS V1 Header Bar
 *
 * Phase 6: Runtime clarity polish
 *   - Clearer START / RESET / PLAY 1 / AUTO button states
 *   - Game state badge (IDLE / RUNNING / GAME OVER) always visible
 *   - Turn counter in header
 *   - City selector with station count summary
 */

// ── Module state ──────────────────────────────────────────────────────────────

let _currentCityId = null;
let _cities        = [];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render the header bar.
 */
export function renderHeaderBar({ profile, registryEntry, cities, onStart, onReset }) {
  _currentCityId = profile.city_id;
  _cities        = cities;

  _updateBrand(profile, registryEntry);
  _renderCitySelector(cities, profile.city_id, profile);
  _bindActionButtons(onStart, onReset);
  _initGameStateBadge();
}

/**
 * Update the shell status text.
 */
export function setHeaderStatus(text, state = 'idle') {
  const el = document.getElementById('hdr-status');
  if (!el) return;
  el.textContent = text;
  el.className = `hdr-status hdr-status--${state}`;
}

/**
 * Set the Start button visual state.
 * @param {'ready'|'playing'|'disabled'} state
 */
export function setStartButtonState(state) {
  const btn = document.getElementById('btn-start');
  if (!btn) return;

  btn.disabled = (state === 'disabled');
  btn.className = `hdr-action-btn hdr-action-btn--start`;

  if (state === 'playing') {
    btn.classList.add('hdr-action-btn--playing');
    btn.textContent = '▶ PLAYING';
  } else if (state === 'disabled') {
    btn.classList.add('hdr-action-btn--disabled');
    btn.textContent = 'START';
  } else {
    btn.textContent = '▶ START';
  }
}

/**
 * Update the game state badge and turn counter in the header.
 * @param {'idle'|'running'|'finished'|'loading'|'error'} mode
 * @param {number|null} turnCount
 * @param {string|null} winnerId
 */
export function updateHeaderGameState(mode, turnCount = null, winnerId = null) {
  const badge    = document.getElementById('hdr-game-badge');
  const turnEl   = document.getElementById('hdr-turn-counter');

  if (badge) {
    badge.className = `hdr-game-badge hdr-game-badge--${mode}`;
    const labels = {
      idle:     'IDLE',
      loading:  'LOADING',
      running:  'RUNNING',
      finished: winnerId ? `${winnerId} WINS` : 'GAME OVER',
      error:    'ERROR',
    };
    badge.textContent = labels[mode] ?? mode.toUpperCase();
  }

  if (turnEl) {
    turnEl.textContent = turnCount != null ? `T${turnCount}` : '';
    turnEl.style.display = (mode === 'running' || mode === 'finished') ? 'inline' : 'none';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _updateBrand(profile, registryEntry) {
  const cityLabelEl = document.getElementById('hdr-city-label');
  const cityNameEl  = document.getElementById('hdr-city-name');

  const label = registryEntry?.display_label || profile.city_id.toUpperCase();
  const name  = profile.display_name || registryEntry?.display_name || profile.city_id;

  if (cityLabelEl) cityLabelEl.textContent = label;
  if (cityNameEl)  cityNameEl.textContent  = name;

  document.title = `GUNOS V1 · ${label}`;
}

function _renderCitySelector(cities, activeCityId, activeProfile) {
  const container = document.getElementById('hdr-city-selector');
  if (!container) return;

  container.innerHTML = '';
  cities.forEach(city => {
    const isActive = city.city_id === activeCityId;
    const btn = document.createElement('button');
    btn.className = 'hdr-city-btn' + (isActive ? ' hdr-city-btn--active' : '');
    btn.dataset.cityId = city.city_id;
    btn.title = city.display_name;

    // City label + optional station count
    const stationCount = isActive
      ? (activeProfile.routes?.total_stations ?? activeProfile.stats?.station_count ?? null)
      : null;

    btn.innerHTML = `<span class="hdr-city-btn__label">${city.display_label || city.city_id.toUpperCase()}</span>`
      + (stationCount ? `<span class="hdr-city-btn__count">${stationCount}</span>` : '');

    btn.addEventListener('click', () => {
      if (city.city_id === activeCityId) return;
      const url = new URL(window.location.href);
      url.searchParams.set('city', city.city_id);
      window.location.href = url.toString();
    });

    container.appendChild(btn);
  });
}

function _bindActionButtons(onStart, onReset) {
  const startBtn = document.getElementById('btn-start');
  const resetBtn = document.getElementById('btn-reset');

  if (startBtn) {
    // Remove old listeners by cloning
    const fresh = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(fresh, startBtn);
    fresh.addEventListener('click', () => {
      if (typeof onStart === 'function') onStart();
    });
  }

  if (resetBtn) {
    const fresh = resetBtn.cloneNode(true);
    resetBtn.parentNode.replaceChild(fresh, resetBtn);
    fresh.addEventListener('click', () => {
      if (typeof onReset === 'function') onReset();
    });
  }
}

function _initGameStateBadge() {
  // Ensure badge starts in idle state
  updateHeaderGameState('idle', null, null);
}
