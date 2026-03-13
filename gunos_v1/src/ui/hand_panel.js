/**
 * hand_panel.js — GUNOS V1 Hand Panel
 *
 * Bottom-left panel: displays the current player's hand.
 *
 * Phase 2: structured placeholder
 * Phase 3: wired to real game state — renders actual hand cards
 */

/**
 * Render the initial hand panel structure.
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
        ${_buildEmptySlots(5)}
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
        <span class="hand-meta-item">
          <span class="hand-meta-label">PLAYER</span>
          <span class="hand-meta-value" id="hand-current-player">—</span>
        </span>
        <span class="hand-meta-item">
          <span class="hand-meta-label">TURN</span>
          <span class="hand-meta-value" id="hand-turn-count">—</span>
        </span>
      </div>
    </div>
  `;
}

/**
 * Update the hand panel with real game state.
 * @param {Object} gameState - play_engine game state
 */
export function updateHandFromState(gameState) {
  if (!gameState) {
    _resetHandDisplay();
    return;
  }

  const currentPlayer = gameState.players[gameState.turnIndex];
  const hand          = currentPlayer?.hand || [];

  // Update meta row
  _setText('hand-deck-count',     gameState.deck.length);
  _setText('hand-card-count',     hand.length);
  _setText('hand-current-player', currentPlayer?.id ?? '—');
  _setText('hand-turn-count',     gameState.turnCount);

  // Render hand cards
  const area = document.getElementById('hand-cards-area');
  if (!area) return;

  if (hand.length === 0) {
    area.innerHTML = `<div class="hand-empty-msg">${gameState.gameOver ? 'Hand empty — game over' : 'No cards in hand'}</div>`;
    return;
  }

  area.innerHTML = hand.map(card => _buildCardHtml(card)).join('');
}

/**
 * Show all players' hands in a compact multi-player view.
 * @param {Object} gameState
 */
export function updateAllHandsFromState(gameState) {
  if (!gameState) { _resetHandDisplay(); return; }

  const area = document.getElementById('hand-cards-area');
  if (!area) return;

  // Show current player's hand prominently
  const currentPlayer = gameState.players[gameState.turnIndex];
  const hand          = currentPlayer?.hand || [];

  _setText('hand-deck-count',     gameState.deck.length);
  _setText('hand-card-count',     hand.length);
  _setText('hand-current-player', currentPlayer?.id ?? '—');
  _setText('hand-turn-count',     gameState.turnCount);

  if (hand.length === 0) {
    area.innerHTML = `<div class="hand-empty-msg">${gameState.gameOver ? 'Hand empty' : 'No cards'}</div>`;
    return;
  }

  area.innerHTML = hand.map(card => _buildCardHtml(card)).join('');
}

/**
 * Reset hand panel to idle state.
 */
export function resetHandDisplay() {
  _resetHandDisplay();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _buildEmptySlots(count) {
  return Array.from({ length: count }, (_, i) =>
    `<div class="hand-card-slot hand-card-slot--empty" title="Card slot ${i + 1}">
       <div class="hand-card-slot__inner"></div>
     </div>`
  ).join('');
}

function _buildCardHtml(card) {
  const name    = card.station_name || card.card_id;
  const rarity  = card.rarity || '';
  const score   = card.score_total != null ? card.score_total.toFixed(1) : '';
  const rarityClass = `hand-card--${(rarity || 'common').toLowerCase()}`;

  return `
    <div class="hand-card-slot hand-card-slot--filled ${rarityClass}" title="${name} (${rarity})">
      <div class="hand-card-slot__inner">
        <div class="hand-card__name">${name}</div>
        <div class="hand-card__meta">
          ${rarity ? `<span class="hand-card__rarity">${rarity[0]}</span>` : ''}
          ${score   ? `<span class="hand-card__score">${score}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function _resetHandDisplay() {
  const area = document.getElementById('hand-cards-area');
  if (area) area.innerHTML = _buildEmptySlots(5);
  _setText('hand-deck-count',     '—');
  _setText('hand-card-count',     '—');
  _setText('hand-current-player', '—');
  _setText('hand-turn-count',     '—');
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

// ── Legacy API (Phase 2 compat) ───────────────────────────────────────────────

export function updateDeckCount(count) { _setText('hand-deck-count', count); }
export function updateHandCount(count) { _setText('hand-card-count', count); }
