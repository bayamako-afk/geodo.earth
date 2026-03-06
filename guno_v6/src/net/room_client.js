// guno_v6/src/net/room_client.js
// GUNO V6 Online Room Client
//
// Responsibility:
//   - Manage the online room lifecycle (join, leave, reconnect)
//   - Route incoming messages to the appropriate handlers
//   - Expose a clean API for the game app layer
//
// Architecture: Host-Authoritative
//   - Host: processes all actions, broadcasts state updates
//   - Guest: sends action requests, applies received state updates
//
// Usage:
//   const client = createRoomClient({ transport, isHost, playerIndex, onStateUpdate, onGameOver });
//   await client.joinRoom(roomId, playerName);
//   client.sendPlay(cardIndex);
//   client.sendDraw();
//   client.sendPass();
//   await client.leaveRoom();

"use strict";

import {
  MSG,
  buildRoomJoin,
  buildRoomJoined,
  buildActionPlay,
  buildActionDraw,
  buildActionPass,
  buildStateUpdate,
  buildStateSync,
  buildGameStart,
  buildGameOver,
  parseMessage,
} from "./sync_protocol.js";

import {
  playCard,
  drawCard,
  passTurn,
} from "../core/game_engine.js";

import { calculateAllScores } from "../core/scoring.js";
import { stateToJSON, stateFromJSON } from "../core/serializers.js";

// ─────────────────────────────────────────
// Factory
// ─────────────────────────────────────────

/**
 * Create a room client.
 *
 * @param {RoomClientOptions} options
 * @returns {RoomClient}
 */
export function createRoomClient(options) {
  const {
    transport,
    isHost,
    playerIndex,
    loadedPack,
    onStateUpdate,   // (state, events) => void
    onGameOver,      // (scores) => void
    onPlayerJoined,  // (playerNames) => void
    onError,         // (error) => void
  } = options;

  let roomId = null;
  let localState = null; // Host only: canonical state
  let myPlayerIndex = playerIndex ?? 0;

  // ─── Message handler ───

  function handleMessage(msg) {
    const parsed = parseMessage(msg);
    if (!parsed) return;

    switch (parsed.type) {
      case MSG.ROOM_JOIN:
        if (isHost) handleGuestJoin(parsed);
        break;

      case MSG.ROOM_JOINED:
        if (!isHost) {
          myPlayerIndex = parsed.playerIndex;
          if (onPlayerJoined) onPlayerJoined(parsed.playerNames);
        }
        break;

      case MSG.GAME_START:
        if (!isHost) {
          const state = stateFromJSON(parsed.stateJSON);
          if (onStateUpdate) onStateUpdate(state, []);
        }
        break;

      case MSG.ACTION_PLAY:
        if (isHost) hostHandleActionPlay(parsed);
        break;

      case MSG.ACTION_DRAW:
        if (isHost) hostHandleActionDraw(parsed);
        break;

      case MSG.ACTION_PASS:
        if (isHost) hostHandleActionPass(parsed);
        break;

      case MSG.STATE_UPDATE:
        if (!isHost) {
          const state = stateFromJSON(parsed.stateJSON);
          if (onStateUpdate) onStateUpdate(state, parsed.events || []);
          if (state.gameOver && onGameOver) {
            onGameOver(parsed.events?.find(e => e.type === "gameOver")?.scores || []);
          }
        }
        break;

      case MSG.STATE_SYNC:
        if (!isHost) {
          const state = stateFromJSON(parsed.stateJSON);
          if (onStateUpdate) onStateUpdate(state, []);
        }
        break;

      case MSG.GAME_OVER:
        if (onGameOver) onGameOver(parsed.scores);
        break;

      default:
        break;
    }
  }

  // ─── Host: handle guest join ───

  function handleGuestJoin(msg) {
    // In a real implementation, assign player index and confirm
    // For now, broadcast a joined confirmation
    const assignedIndex = 1; // TODO: dynamic assignment
    transport.send(buildRoomJoined(roomId, assignedIndex, []));
    if (onPlayerJoined) onPlayerJoined([msg.playerName]);
  }

  // ─── Host: process actions ───

  function hostHandleActionPlay(msg) {
    if (!localState) return;
    try {
      const { state, events } = playCard(localState, msg.playerIndex, msg.cardIndex);
      localState = state;
      const stateJSON = stateToJSON(localState);

      const eventsWithScores = [...events];
      if (localState.gameOver) {
        const scores = calculateAllScores(localState, loadedPack);
        eventsWithScores.push({ type: "gameOver", scores });
        transport.send(buildStateUpdate(stateJSON, eventsWithScores));
        transport.send(buildGameOver(scores));
        if (onStateUpdate) onStateUpdate(localState, eventsWithScores);
        if (onGameOver) onGameOver(scores);
      } else {
        transport.send(buildStateUpdate(stateJSON, eventsWithScores));
        if (onStateUpdate) onStateUpdate(localState, eventsWithScores);
      }
    } catch (e) {
      if (onError) onError(e);
    }
  }

  function hostHandleActionDraw(msg) {
    if (!localState) return;
    try {
      const { state, events } = drawCard(localState, msg.playerIndex);
      localState = state;
      const stateJSON = stateToJSON(localState);
      transport.send(buildStateUpdate(stateJSON, events));
      if (onStateUpdate) onStateUpdate(localState, events);
    } catch (e) {
      if (onError) onError(e);
    }
  }

  function hostHandleActionPass(msg) {
    if (!localState) return;
    try {
      const { state, events } = passTurn(localState, msg.playerIndex);
      localState = state;
      const stateJSON = stateToJSON(localState);
      transport.send(buildStateUpdate(stateJSON, events));
      if (onStateUpdate) onStateUpdate(localState, events);
    } catch (e) {
      if (onError) onError(e);
    }
  }

  // ─── Public API ───

  /**
   * Join a room.
   * @param {string} rid - Room ID
   * @param {string} playerName
   * @returns {Promise<void>}
   */
  async function joinRoom(rid, playerName) {
    roomId = rid;
    transport.onMessage(handleMessage);
    await transport.connect(rid);
    if (!isHost) {
      await transport.send(buildRoomJoin(rid, playerName));
    }
  }

  /**
   * Leave the room.
   * @returns {Promise<void>}
   */
  async function leaveRoom() {
    transport.offMessage(handleMessage);
    await transport.disconnect();
    roomId = null;
  }

  /**
   * Host: start the game with an initial state.
   * @param {import("../core/game_engine.js").GameState} initialState
   * @param {string[]} playerNames
   * @returns {Promise<void>}
   */
  async function hostStartGame(initialState, playerNames) {
    if (!isHost) throw new Error("Only the host can start the game");
    localState = initialState;
    const stateJSON = stateToJSON(initialState);
    await transport.send(buildGameStart(stateJSON, playerNames));
    if (onStateUpdate) onStateUpdate(localState, []);
  }

  /**
   * Guest: send a play-card action to the host.
   * @param {number} cardIndex
   * @returns {Promise<void>}
   */
  async function sendPlay(cardIndex) {
    await transport.send(buildActionPlay(myPlayerIndex, cardIndex));
  }

  /**
   * Guest: send a draw-card action to the host.
   * @returns {Promise<void>}
   */
  async function sendDraw() {
    await transport.send(buildActionDraw(myPlayerIndex));
  }

  /**
   * Guest: send a pass action to the host.
   * @returns {Promise<void>}
   */
  async function sendPass() {
    await transport.send(buildActionPass(myPlayerIndex));
  }

  /**
   * Request a full state resync from the host (for reconnect).
   * Host will respond with a state:sync message.
   * @returns {Promise<void>}
   */
  async function requestResync() {
    if (isHost && localState) {
      await transport.send(buildStateSync(stateToJSON(localState)));
    }
  }

  /** @type {RoomClient} */
  return {
    joinRoom,
    leaveRoom,
    hostStartGame,
    sendPlay,
    sendDraw,
    sendPass,
    requestResync,
    get myPlayerIndex() { return myPlayerIndex; },
  };
}

/**
 * @typedef {object} RoomClientOptions
 * @property {import("./transport_supabase.js").SupabaseTransport} transport
 * @property {boolean} isHost
 * @property {number} [playerIndex]
 * @property {import("../data/pack_loader.js").LoadedPack} loadedPack
 * @property {function} onStateUpdate
 * @property {function} onGameOver
 * @property {function} [onPlayerJoined]
 * @property {function} [onError]
 */

/**
 * @typedef {object} RoomClient
 * @property {function(string, string): Promise<void>} joinRoom
 * @property {function(): Promise<void>} leaveRoom
 * @property {function(GameState, string[]): Promise<void>} hostStartGame
 * @property {function(number): Promise<void>} sendPlay
 * @property {function(): Promise<void>} sendDraw
 * @property {function(): Promise<void>} sendPass
 * @property {function(): Promise<void>} requestResync
 * @property {number} myPlayerIndex
 */
