// guno_v6/src/core/game_engine.js
// GUNO V6 Pure Game Engine
//
// Responsibility:
//   - Manage the canonical GameState
//   - Expose pure state-transition functions (initGame, playCard, drawCard)
//   - Generate log events for each action
//   - Detect GUNO (route completion) and game-end conditions
//
// Rules:
//   - NO DOM dependency (no document, window, alert)
//   - NO side effects outside of returned state objects
//   - All functions receive a state and return a NEW state (immutable pattern)

"use strict";

import {
  getPlayableIndices,
  isLineComplete,
  isGameEndByGuno,
  isGameEndByElimination,
  isGameEndByStalemate,
  shouldReverse,
} from "./rules.js";

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const INITIAL_HAND_SIZE = 7;
const STATIONS_PER_LINE = 10;

// Default player templates
const DEFAULT_PLAYERS = [
  { name: "P1", color: "#174a7c", icon: "🌊" },
  { name: "P2", color: "#b52942", icon: "🌸" },
  { name: "P3", color: "#e6b422", icon: "🌙" },
  { name: "P4", color: "#745399", icon: "🏯" },
];

// ─────────────────────────────────────────
// Deck construction
// ─────────────────────────────────────────

/**
 * Build a shuffled deck from a LoadedPack.
 * Each station appears twice; each route gets one teiden (blackout) card.
 *
 * @param {import("../data/pack_loader.js").LoadedPack} loadedPack
 * @returns {Card[]}
 */
export function makeDeck(loadedPack) {
  const deck = [];

  for (const station of loadedPack.stations) {
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: `s-${station.lc}-${station.order}-${i}`,
        type: "station",
        lc: station.lc,
        order: station.order,
        name_ja: station.name_ja,
        name_en: station.name_en,
      });
    }
  }

  for (const route of loadedPack.routes) {
    deck.push({
      id: `t-${route.lc}`,
      type: "teiden",
      lc: route.lc,
      name_ja: "停電",
      name_en: "Blackout",
    });
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// ─────────────────────────────────────────
// Game initialization
// ─────────────────────────────────────────

/**
 * Initialize a new game state from a LoadedPack and player configuration.
 *
 * @param {import("../data/pack_loader.js").LoadedPack} loadedPack
 * @param {number} [playerCount=4] - Number of players (2–4)
 * @param {PlayerConfig[]} [playerConfigs] - Optional player overrides
 * @returns {GameState}
 */
export function initGame(loadedPack, playerCount = 4, playerConfigs = []) {
  const count = Math.max(2, Math.min(4, playerCount));
  const deck = makeDeck(loadedPack);

  const players = Array.from({ length: count }, (_, i) => {
    const defaults = DEFAULT_PLAYERS[i] || { name: `P${i + 1}`, color: "#888", icon: "👤" };
    const cfg = playerConfigs[i] || {};
    return {
      name: cfg.name ?? defaults.name,
      color: cfg.color ?? defaults.color,
      icon: cfg.icon ?? defaults.icon,
      status: "active",
      guno: 0,
      hand: [],
    };
  });

  // Deal initial hands
  for (const player of players) {
    for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
      if (deck.length) player.hand.push(deck.pop());
    }
  }

  // Initialize discard pile with the first station card
  const discardPile = [];
  const mapState = {};
  while (deck.length) {
    const card = deck.pop();
    discardPile.push(card);
    if (card.type === "station") {
      mapState[`${card.lc}-${card.order}`] = -1; // -1 = placed but unowned
      break;
    }
  }

  // Build teidenPlayed map from routes
  const teidenPlayed = {};
  for (const route of loadedPack.routes) {
    teidenPlayed[route.lc] = false;
  }

  return {
    turnIndex: 0,
    direction: 1,
    gameOver: false,
    consecutivePasses: 0,
    mapState,
    lastHits: {},
    teidenPlayed,
    deck,
    discardPile,
    players,
    log: [],
    packMeta: loadedPack.meta,
    routeCount: loadedPack.routes.length,
  };
}

// ─────────────────────────────────────────
// State helpers (pure)
// ─────────────────────────────────────────

function deepCloneState(state) {
  return {
    ...state,
    mapState: { ...state.mapState },
    lastHits: { ...state.lastHits },
    teidenPlayed: { ...state.teidenPlayed },
    deck: [...state.deck],
    discardPile: [...state.discardPile],
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
    log: [...state.log],
  };
}

function addLog(state, message) {
  state.log.push({ time: Date.now(), message });
}

function advanceTurn(state) {
  const n = state.players.length;
  state.turnIndex = (state.turnIndex + state.direction + n) % n;
}

// ─────────────────────────────────────────
// Play a card
// ─────────────────────────────────────────

/**
 * Execute a card play action.
 * Returns a new GameState with the card played and all resulting effects applied.
 *
 * @param {GameState} state
 * @param {number} playerIndex - Index of the player making the move
 * @param {number} cardIndex   - Index of the card in the player's hand
 * @returns {{ state: GameState, events: GameEvent[] }}
 */
export function playCard(state, playerIndex, cardIndex) {
  const next = deepCloneState(state);
  const events = [];

  const player = next.players[playerIndex];
  const playableIndices = getPlayableIndices(player.hand, next.discardPile[next.discardPile.length - 1]);

  if (!playableIndices.includes(cardIndex)) {
    throw new Error(`Card at index ${cardIndex} is not playable for player ${playerIndex}`);
  }

  const card = player.hand.splice(cardIndex, 1)[0];
  const topCard = next.discardPile[next.discardPile.length - 1];
  next.discardPile.push(card);
  next.consecutivePasses = 0;

  if (card.type === "station") {
    const key = `${card.lc}-${card.order}`;
    const prev = next.mapState[key];

    if (prev !== undefined && prev !== -1 && prev !== playerIndex) {
      const prevName = next.players[prev].name;
      addLog(next, `⚔️ ${player.name} が ${prevName} から ${card.name_ja} を奪取！`);
      events.push({ type: "capture", from: prev, to: playerIndex, key });
    }

    next.mapState[key] = playerIndex;

    // Reverse if same station name
    if (shouldReverse(card, topCard)) {
      next.direction *= -1;
      addLog(next, "🔄 REVERSE!");
      events.push({ type: "reverse" });
    }

    // Check GUNO
    if (isLineComplete(card.lc, next.mapState) && next.lastHits[card.lc] === undefined) {
      next.lastHits[card.lc] = playerIndex;
      next.players[playerIndex].guno++;
      addLog(next, `🎆 ${player.name} が ${card.lc} を完成！(GUNO達成)`);
      events.push({ type: "guno", lc: card.lc, playerIndex });
    }
  } else {
    // teiden (blackout)
    next.teidenPlayed[card.lc] = true;
    next.direction *= -1;
    addLog(next, `⚡ 停電！逆転！ [${card.lc}]`);
    events.push({ type: "teiden", lc: card.lc });

    // All other active players draw 1 card
    next.players.forEach((p, i) => {
      if (i !== playerIndex && p.status === "active" && next.deck.length) {
        p.hand.push(next.deck.pop());
        addLog(next, `🎴 ${p.name} がカードを引きました`);
        events.push({ type: "draw", playerIndex: i });
      }
    });

    // Check GUNO for teiden line
    if (isLineComplete(card.lc, next.mapState) && next.lastHits[card.lc] === undefined) {
      next.lastHits[card.lc] = playerIndex;
      next.players[playerIndex].guno++;
      addLog(next, `🎆 ${player.name} が ${card.lc} を完成！(GUNO達成)`);
      events.push({ type: "guno", lc: card.lc, playerIndex });
    }
  }

  addLog(next, `[${player.icon}${player.name}] ${card.lc} ${card.name_ja || "⚡"}`);
  events.push({ type: "play", playerIndex, card });

  // Elimination check
  if (player.hand.length === 0) {
    player.status = "eliminated";
    addLog(next, `❌ ${player.name} が脱落しました（手札0）`);
    events.push({ type: "eliminated", playerIndex });
  }

  // Game-end checks
  if (
    isGameEndByGuno(next.players, next.routeCount) ||
    isGameEndByElimination(next.players)
  ) {
    next.gameOver = true;
    addLog(next, "🏁 ゲーム終了！");
    events.push({ type: "gameOver" });
    return { state: next, events };
  }

  advanceTurn(next);
  return { state: next, events };
}

// ─────────────────────────────────────────
// Draw a card
// ─────────────────────────────────────────

/**
 * Execute a draw-card action for a player.
 * The player draws one card from the deck.
 * If still no playable cards after drawing, the turn passes automatically.
 *
 * @param {GameState} state
 * @param {number} playerIndex
 * @returns {{ state: GameState, events: GameEvent[], turnPassed: boolean }}
 */
export function drawCard(state, playerIndex) {
  const next = deepCloneState(state);
  const events = [];

  const player = next.players[playerIndex];
  const topCard = next.discardPile[next.discardPile.length - 1];

  // Validate: only draw if no playable cards
  const playable = getPlayableIndices(player.hand, topCard);
  if (playable.length > 0) {
    throw new Error(`Player ${playerIndex} has playable cards and cannot draw`);
  }
  if (!next.deck.length) {
    throw new Error("Deck is empty, cannot draw");
  }

  const drawn = next.deck.pop();
  player.hand.push(drawn);
  addLog(next, `🎴 ${player.name} がカードを引きました`);
  events.push({ type: "draw", playerIndex, card: drawn });

  // Check if still no playable cards after draw → pass
  const playableAfter = getPlayableIndices(player.hand, topCard);
  let turnPassed = false;
  if (playableAfter.length === 0) {
    next.consecutivePasses++;
    addLog(next, `${player.name} はパスしました`);
    events.push({ type: "pass", playerIndex });

    if (isGameEndByStalemate(next.consecutivePasses, next.players)) {
      next.gameOver = true;
      addLog(next, "🏁 ゲーム終了！ 誰もプレイできるカードがありません");
      events.push({ type: "gameOver", reason: "stalemate" });
      return { state: next, events, turnPassed: true };
    }

    advanceTurn(next);
    turnPassed = true;
  }

  return { state: next, events, turnPassed };
}

// ─────────────────────────────────────────
// Pass turn (when deck is empty and no playable cards)
// ─────────────────────────────────────────

/**
 * Force-pass the current player's turn (used when deck is empty and no cards are playable).
 * @param {GameState} state
 * @param {number} playerIndex
 * @returns {{ state: GameState, events: GameEvent[] }}
 */
export function passTurn(state, playerIndex) {
  const next = deepCloneState(state);
  const events = [];

  next.consecutivePasses++;
  addLog(next, `${next.players[playerIndex].name} はパスしました`);
  events.push({ type: "pass", playerIndex });

  if (isGameEndByStalemate(next.consecutivePasses, next.players)) {
    next.gameOver = true;
    addLog(next, "🏁 ゲーム終了！ 誰もプレイできるカードがありません");
    events.push({ type: "gameOver", reason: "stalemate" });
    return { state: next, events };
  }

  advanceTurn(next);
  return { state: next, events };
}

// ─────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────

/**
 * Get the current active player.
 * @param {GameState} state
 * @returns {Player}
 */
export function getCurrentPlayer(state) {
  return state.players[state.turnIndex];
}

/**
 * Get the top card of the discard pile.
 * @param {GameState} state
 * @returns {Card|undefined}
 */
export function getTopCard(state) {
  return state.discardPile[state.discardPile.length - 1];
}

/**
 * Get playable card indices for the current player.
 * @param {GameState} state
 * @returns {number[]}
 */
export function getPlayableForCurrentPlayer(state) {
  const player = getCurrentPlayer(state);
  const topCard = getTopCard(state);
  return getPlayableIndices(player.hand, topCard);
}

// ─────────────────────────────────────────
// JSDoc type definitions
// ─────────────────────────────────────────

/**
 * @typedef {object} GameState
 * @property {number} turnIndex
 * @property {1|-1} direction
 * @property {boolean} gameOver
 * @property {number} consecutivePasses
 * @property {{ [key: string]: number }} mapState
 * @property {{ [lc: string]: number }} lastHits
 * @property {{ [lc: string]: boolean }} teidenPlayed
 * @property {Card[]} deck
 * @property {Card[]} discardPile
 * @property {Player[]} players
 * @property {LogEntry[]} log
 * @property {object} packMeta
 * @property {number} routeCount
 */

/**
 * @typedef {object} Card
 * @property {string} id
 * @property {"station"|"teiden"} type
 * @property {string} lc
 * @property {number} [order]
 * @property {string} [name_ja]
 * @property {string} [name_en]
 */

/**
 * @typedef {object} Player
 * @property {string} name
 * @property {string} color
 * @property {string} icon
 * @property {"active"|"eliminated"} status
 * @property {number} guno
 * @property {Card[]} hand
 */

/**
 * @typedef {object} LogEntry
 * @property {number} time
 * @property {string} message
 */

/**
 * @typedef {object} GameEvent
 * @property {string} type
 */

/**
 * @typedef {object} PlayerConfig
 * @property {string} [name]
 * @property {string} [color]
 * @property {string} [icon]
 */
