/**
 * onboarding_hints.js — GUNOS V1.5 Task 01: Beginner Onboarding Hints
 *
 * Displays a short sequence of beginner hints at meaningful moments during
 * the first game session. Hints are lightweight, non-blocking, and auto-dismiss.
 *
 * Design principles:
 *  - Map-first: hint bubble sits at top-center, never covers the map center
 *  - Short: 1–2 lines maximum
 *  - Sequential: only one hint at a time, shown at the right moment
 *  - Dismissible: auto-fades after 5s, or on click
 *  - Reuses V1.4 meaning vocabulary (Hub, Route+, score reason, detail card)
 *
 * CSS approach: uses ob-hint--visible class for display (CSS opacity: 0 default)
 */

// ── Hint sequence ─────────────────────────────────────────────────────────────

const HINT_SEQUENCE = [
  {
    id:      'hint-map',
    trigger: 'start',
    icon:    '◉',
    text:    'The map is your game board. Stations are your pieces.',
    theme:   'map',
  },
  {
    id:      'hint-candidate',
    trigger: 'turn',
    turnMin: 1,
    icon:    '◆',
    text:    'Bottom-left shows your next best targets — check the value tags.',
    theme:   'candidate',
  },
  {
    id:      'hint-hub',
    trigger: 'capture',
    turnMin: 1,
    icon:    '◆',
    text:    'Hub stations give bonus points. Route+ grows your network.',
    theme:   'hub',
  },
  {
    id:      'hint-score',
    trigger: 'score_change',
    turnMin: 3,
    icon:    '▶',
    text:    'Top-right shows why your score moved — Hub, Route+, or captures.',
    theme:   'score',
  },
  {
    id:      'hint-detail',
    trigger: 'turn',
    turnMin: 5,
    icon:    '●',
    text:    'Each station has a value card. Read it to plan your next move.',
    theme:   'detail',
  },
];

// ── State ─────────────────────────────────────────────────────────────────────

let _shownIds      = new Set();
let _container     = null;
let _showTimer     = null;   // pending show (setTimeout)
let _fadeTimer     = null;   // auto-dismiss (5.5s)
let _fadeOutTimer  = null;   // CSS fade-out completion (400ms)
let _prevScore     = null;
let _initialized   = false;

// ── Public API ────────────────────────────────────────────────────────────────

export function initOnboardingHints() {
  if (_initialized) return;

  const hudLayer = document.getElementById('hud-layer');
  if (!hudLayer) return;

  _container = document.createElement('div');
  _container.id = 'onboarding-hint';
  _container.className = 'ob-hint';
  _container.setAttribute('role', 'status');
  _container.setAttribute('aria-live', 'polite');

  hudLayer.appendChild(_container);

  _container.addEventListener('click', () => _dismissHint());

  _initialized = true;
}

export function updateOnboardingHints(gameState, scores, uiMode) {
  if (!_initialized || !_container) return;
  if (uiMode !== 'running') return;
  if (!gameState) return;

  const turn = gameState.turnCount ?? 0;

  const totalScore = scores ? scores.reduce((s, p) => s + (p.final_score || 0), 0) : 0;
  const scoreChanged = _prevScore !== null && totalScore !== _prevScore;
  _prevScore = totalScore;

  const hasCaptured = !!(gameState.currentCard);

  for (const hint of HINT_SEQUENCE) {
    if (_shownIds.has(hint.id)) continue;

    let shouldFire = false;

    if (hint.trigger === 'start' && turn === 0) {
      shouldFire = true;
    } else if (hint.trigger === 'turn' && turn >= (hint.turnMin ?? 0)) {
      shouldFire = true;
    } else if (hint.trigger === 'capture' && hasCaptured && turn >= (hint.turnMin ?? 0)) {
      shouldFire = true;
    } else if (hint.trigger === 'score_change' && scoreChanged && turn >= (hint.turnMin ?? 0)) {
      shouldFire = true;
    }

    if (shouldFire) {
      _scheduleShow(hint);
      break;
    }
  }
}

export function resetOnboardingHints() {
  _shownIds.clear();
  _prevScore = null;
  _cancelAll();
  _hide();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _cancelAll() {
  if (_showTimer)    { clearTimeout(_showTimer);    _showTimer    = null; }
  if (_fadeTimer)    { clearTimeout(_fadeTimer);    _fadeTimer    = null; }
  if (_fadeOutTimer) { clearTimeout(_fadeOutTimer); _fadeOutTimer = null; }
}

function _hide() {
  if (!_container) return;
  // Remove visible class to trigger CSS fade-out
  _container.classList.remove('ob-hint--visible');
  _container.classList.add('ob-hint--fading');
  // Clear content after transition completes
  _fadeOutTimer = setTimeout(() => {
    _fadeOutTimer = null;
    if (_container) {
      _container.innerHTML = '';
      _container.classList.remove('ob-hint--fading');
    }
  }, 400);
}

function _scheduleShow(hint) {
  // Mark as shown immediately to prevent duplicate scheduling
  _shownIds.add(hint.id);

  // Cancel any pending operations
  _cancelAll();

  // Use setTimeout to ensure this runs after any synchronous dismissals
  _showTimer = setTimeout(() => {
    _showTimer = null;
    _doShow(hint);
  }, 50);
}

function _doShow(hint) {
  if (!_container) return;

  // Build content
  const iconClass = `ob-hint__icon ob-hint__icon--${hint.theme}`;
  _container.innerHTML = `
    <span class="${iconClass}">${hint.icon || ''}</span>
    <span class="ob-hint__text">${hint.text}</span>
  `;

  // Set theme class (remove fading/visible first)
  _container.className = `ob-hint ob-hint--${hint.theme}`;

  // Force reflow to ensure transition fires
  void _container.offsetWidth;

  // Add visible class to trigger CSS fade-in
  _container.classList.add('ob-hint--visible');

  // Auto-dismiss after 5.5s
  _fadeTimer = setTimeout(() => {
    _fadeTimer = null;
    _dismissHint();
  }, 5500);
}

function _dismissHint() {
  if (!_container) return;
  _cancelAll();
  _hide();
}
