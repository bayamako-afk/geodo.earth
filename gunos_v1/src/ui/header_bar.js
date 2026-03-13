/**
 * header_bar.js — GUNOS V1 Header Bar
 *
 * Renders and manages the top header bar:
 *   - GUNOS V1 platform branding
 *   - Active city label
 *   - City selector buttons
 *   - Start / Reset action buttons
 *   - Shell status indicator
 *
 * Phase 2: layout structure + button stubs (no gameplay wiring yet)
 * Phase 3: Start / Reset will be wired to play engine
 */

/**
 * Render the header bar with city context and action buttons.
 *
 * @param {Object} opts
 * @param {Object}   opts.profile        - Loaded city profile
 * @param {Object}   opts.registryEntry  - { city_id, display_name, display_label }
 * @param {Array}    opts.cities         - All available cities from registry
 * @param {Function} opts.onStart        - Callback for Start button (stub in Phase 2)
 * @param {Function} opts.onReset        - Callback for Reset button (stub in Phase 2)
 */
export function renderHeaderBar({ profile, registryEntry, cities, onStart, onReset }) {
  _updateBrand(profile, registryEntry);
  _renderCitySelector(cities, profile.city_id);
  _bindActionButtons(onStart, onReset);
}

/**
 * Update the platform brand and city label in the header.
 */
function _updateBrand(profile, registryEntry) {
  const cityLabelEl = document.getElementById('hdr-city-label');
  const cityNameEl  = document.getElementById('hdr-city-name');

  const label = registryEntry?.display_label || profile.city_id.toUpperCase();
  const name  = profile.display_name || registryEntry?.display_name || profile.city_id;

  if (cityLabelEl) cityLabelEl.textContent = label;
  if (cityNameEl)  cityNameEl.textContent  = name;

  document.title = `GUNOS V1 · ${label}`;
}

/**
 * Render city selector buttons into #hdr-city-selector.
 */
function _renderCitySelector(cities, activeCityId) {
  const container = document.getElementById('hdr-city-selector');
  if (!container) return;

  container.innerHTML = '';
  cities.forEach(city => {
    const btn = document.createElement('button');
    btn.className = 'hdr-city-btn' + (city.city_id === activeCityId ? ' hdr-city-btn--active' : '');
    btn.dataset.cityId = city.city_id;
    btn.textContent = city.display_label || city.city_id.toUpperCase();
    btn.title = city.display_name;

    btn.addEventListener('click', () => {
      if (city.city_id === activeCityId) return;
      const url = new URL(window.location.href);
      url.searchParams.set('city', city.city_id);
      window.location.href = url.toString();
    });

    container.appendChild(btn);
  });
}

/**
 * Bind Start and Reset button click handlers.
 * In Phase 2 these are stubs — actual wiring happens in Phase 3.
 */
function _bindActionButtons(onStart, onReset) {
  const startBtn = document.getElementById('btn-start');
  const resetBtn = document.getElementById('btn-reset');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (typeof onStart === 'function') onStart();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (typeof onReset === 'function') onReset();
    });
  }
}

/**
 * Update the shell status text in the header.
 * @param {string} text
 * @param {'idle'|'loading'|'playing'|'error'} [state='idle']
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
  btn.className = `hdr-action-btn hdr-action-btn--start hdr-action-btn--${state}`;

  const labels = { ready: 'START', playing: 'PLAYING...', disabled: 'START' };
  btn.textContent = labels[state] ?? 'START';
}
