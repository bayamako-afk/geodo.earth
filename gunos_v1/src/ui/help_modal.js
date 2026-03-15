/**
 * help_modal.js — GUNOS V1 Onboarding / Help Modal
 *
 * V1.2 Task 03: Lightweight onboarding layer
 *   - "? HELP" button in header opens a 3-step How to Play modal
 *   - Modal is dismissible by clicking outside or the close button
 *   - Content is concise and city-agnostic
 */

const STEPS = [
  {
    icon: '🗺️',
    title: 'Own the Map',
    body: 'Each turn, play a card to claim a station on the map — or draw a card to build your hand. Stations earn you points based on their importance in the city network.',
  },
  {
    icon: '🚉',
    title: 'Route+ and Hub+',
    body: '<strong>Route+</strong>: Own at least ⅓ of a metro line to earn a route bonus. Complete the whole line for maximum points.<br><br><strong>Hub+</strong>: Owning major interchange stations (where many lines cross) earns extra bonus points.',
  },
  {
    icon: '🏆',
    title: 'Win by Score',
    body: 'The game ends after 20 turns. The player with the highest total score wins.<br><br>Watch the <strong>SCORE</strong> panel on the right to track Route+ and Hub+ progress in real time.',
  },
];

let _currentStep = 0;

export function initHelpModal() {
  // Create modal DOM
  const overlay = document.createElement('div');
  overlay.id = 'help-modal-overlay';
  overlay.innerHTML = `
    <div id="help-modal" role="dialog" aria-modal="true" aria-label="How to Play">
      <div id="help-modal-header">
        <span id="help-modal-title">HOW TO PLAY</span>
        <button id="help-modal-close" aria-label="Close">✕</button>
      </div>
      <div id="help-modal-body">
        <div id="help-step-icon"></div>
        <div id="help-step-title"></div>
        <div id="help-step-body"></div>
      </div>
      <div id="help-modal-footer">
        <div id="help-step-dots"></div>
        <div id="help-modal-nav">
          <button id="help-btn-prev">← Back</button>
          <button id="help-btn-next">Next →</button>
          <button id="help-btn-done" style="display:none">Got it ✓</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Wire events
  overlay.addEventListener('click', e => {
    if (e.target === overlay) _closeModal();
  });
  document.getElementById('help-modal-close').addEventListener('click', _closeModal);
  document.getElementById('help-btn-prev').addEventListener('click', () => _goStep(_currentStep - 1));
  document.getElementById('help-btn-next').addEventListener('click', () => _goStep(_currentStep + 1));
  document.getElementById('help-btn-done').addEventListener('click', _closeModal);

  // Keyboard: Escape closes
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('help-modal--open')) _closeModal();
  });
}

export function openHelpModal() {
  _currentStep = 0;
  _renderStep(0);
  const overlay = document.getElementById('help-modal-overlay');
  if (overlay) overlay.classList.add('help-modal--open');
}

function _closeModal() {
  const overlay = document.getElementById('help-modal-overlay');
  if (overlay) overlay.classList.remove('help-modal--open');
}

function _goStep(n) {
  if (n < 0 || n >= STEPS.length) return;
  _currentStep = n;
  _renderStep(n);
}

function _renderStep(n) {
  const step = STEPS[n];
  document.getElementById('help-step-icon').textContent  = step.icon;
  document.getElementById('help-step-title').textContent = step.title;
  document.getElementById('help-step-body').innerHTML    = step.body;

  // Dots
  const dots = document.getElementById('help-step-dots');
  dots.innerHTML = STEPS.map((_, i) =>
    `<span class="help-dot ${i === n ? 'help-dot--active' : ''}"></span>`
  ).join('');

  // Nav buttons
  const prevBtn = document.getElementById('help-btn-prev');
  const nextBtn = document.getElementById('help-btn-next');
  const doneBtn = document.getElementById('help-btn-done');
  prevBtn.style.display = n === 0 ? 'none' : '';
  nextBtn.style.display = n === STEPS.length - 1 ? 'none' : '';
  doneBtn.style.display = n === STEPS.length - 1 ? '' : 'none';
}
