// guno_v6/src/core/serializers.js
// GUNO V6 State Serialization / Deserialization
//
// Responsibility:
//   - Convert GameState to a plain JSON-serializable object
//   - Restore GameState from a serialized snapshot
//   - Provide a stable format for online state synchronization
//
// Rules:
//   - No DOM dependency
//   - Pure functions only

"use strict";

const SERIALIZER_VERSION = "v6.1";

// ─────────────────────────────────────────
// Serialize
// ─────────────────────────────────────────

/**
 * Serialize a GameState into a plain JSON-compatible snapshot object.
 * This snapshot is safe to send over the network (e.g. Supabase Realtime).
 *
 * @param {import("./game_engine.js").GameState} state
 * @returns {object} Serialized snapshot
 */
export function serializeState(state) {
  return {
    _v: SERIALIZER_VERSION,
    turnIndex: state.turnIndex,
    direction: state.direction,
    gameOver: state.gameOver,
    consecutivePasses: state.consecutivePasses,
    mapState: { ...state.mapState },
    lastHits: { ...state.lastHits },
    teidenPlayed: { ...state.teidenPlayed },
    deck: state.deck.map(serializeCard),
    discardPile: state.discardPile.map(serializeCard),
    players: state.players.map(serializePlayer),
    log: [...state.log],
  };
}

/**
 * Deserialize a snapshot back into a GameState object.
 * @param {object} snapshot - Output of serializeState()
 * @returns {import("./game_engine.js").GameState}
 */
export function deserializeState(snapshot) {
  if (!snapshot || snapshot._v !== SERIALIZER_VERSION) {
    throw new Error(`Incompatible serializer version: expected ${SERIALIZER_VERSION}, got ${snapshot?._v}`);
  }
  return {
    turnIndex: snapshot.turnIndex,
    direction: snapshot.direction,
    gameOver: snapshot.gameOver,
    consecutivePasses: snapshot.consecutivePasses,
    mapState: { ...snapshot.mapState },
    lastHits: { ...snapshot.lastHits },
    teidenPlayed: { ...snapshot.teidenPlayed },
    deck: snapshot.deck.map(deserializeCard),
    discardPile: snapshot.discardPile.map(deserializeCard),
    players: snapshot.players.map(deserializePlayer),
    log: [...snapshot.log],
  };
}

// ─────────────────────────────────────────
// Card helpers
// ─────────────────────────────────────────

function serializeCard(card) {
  return {
    id: card.id,
    type: card.type,
    lc: card.lc,
    order: card.order ?? null,
    name_ja: card.name_ja ?? null,
    name_en: card.name_en ?? null,
  };
}

function deserializeCard(raw) {
  return {
    id: raw.id,
    type: raw.type,
    lc: raw.lc,
    order: raw.order ?? undefined,
    name_ja: raw.name_ja ?? undefined,
    name_en: raw.name_en ?? undefined,
  };
}

// ─────────────────────────────────────────
// Player helpers
// ─────────────────────────────────────────

function serializePlayer(player) {
  return {
    name: player.name,
    color: player.color,
    icon: player.icon,
    status: player.status,
    guno: player.guno,
    hand: player.hand.map(serializeCard),
  };
}

function deserializePlayer(raw) {
  return {
    name: raw.name,
    color: raw.color,
    icon: raw.icon,
    status: raw.status,
    guno: raw.guno,
    hand: raw.hand.map(deserializeCard),
  };
}

// ─────────────────────────────────────────
// JSON string helpers (for network transport)
// ─────────────────────────────────────────

/**
 * Serialize a GameState to a JSON string (for network transport).
 * @param {import("./game_engine.js").GameState} state
 * @returns {string}
 */
export function stateToJSON(state) {
  return JSON.stringify(serializeState(state));
}

/**
 * Deserialize a GameState from a JSON string.
 * @param {string} jsonText
 * @returns {import("./game_engine.js").GameState}
 */
export function stateFromJSON(jsonText) {
  return deserializeState(JSON.parse(jsonText));
}
