/**
 * hand_panel.js — GUNOS V1 Hand Panel
 *
 * Bottom-left panel: displays the player's hand (playable cards).
 *
 * Phase 2: structured placeholder with card slot preview
 * Phase 3: will be wired to play engine and actual card data
 */

const HAND_SIZE_PREVIEW = 5; // Number of placeholder card slots to show

/**
 * Render the hand panel placeholder.
 * @param {Object} opts
 * @param {Object} opts.profile - Loaded city profile
 */
export function renderHandPanel({ profile }) {
  const container = document.getElementById('hand-panel-body');
  if (!container) return;

  const deckSize = profile.deck_defaults?.deck_size ?? '—';

  container.innerHTML = `
    <div class="hand-panel-inner">
      <div class="hand-cards-row" id="hand-cards-area">
        ${_buildCardSlots(HAND_SIZE_PREVIEW)}
      </div>
      <div class="hand-panel-meta">
        <span class="hand-meta-item">
          <span class="hand-meta-label">DECK</span>
          <span class="hand-meta-value" id="hand-deck-count">${deckSize}</span>
        </span>
        <span class="hand-meta-item">
          <span class="hand-meta-label">HAND</span>
          <span class="hand-meta-value" id="hand-card-count">—</span>
        </span>
        <span class="hand-meta-item hand-meta-note">Phase 3: play engine</span>
      </div>
    </div>
  `;
}

/**
 * Build placeholder card slot HTML.
 */
function _buildCardSlots(count) {
  return Array.from({ length: count }, (_, i) =>
    `<div class="hand-card-slot hand-card-slot--empty" title="Card slot ${i + 1}">
       <div class="hand-card-slot__inner"></div>
     </div>`
  ).join('');
}

/**
 * Update the deck count display.
 * @param {number} count
 */
export function updateDeckCount(count) {
  const el = document.getElementById('hand-deck-count');
  if (el) el.textContent = count;
}

/**
 * Update the hand card count display.
 * @param {number} count
 */
export function updateHandCount(count) {
  const el = document.getElementById('hand-card-count');
  if (el) el.textContent = count;
}
