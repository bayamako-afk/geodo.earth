// guno_v6/src/app/online.js
// GUNO V6 Online Mode Entry Point
//
// Responsibility:
//   - Bootstrap the online game mode
//   - Manage lobby state (create room / join room)
//   - Wire RoomClient to the game UI (same renderAll() as local mode)
//   - Handle host/guest role differences
//
// How to use:
//   1. Set SUPABASE_URL and SUPABASE_ANON_KEY in guno_v6/config.js (not committed)
//   2. Load Supabase CDN before this script
//   3. Import and call initOnlineMode() from your entry point

"use strict";

import { loadPack } from "../data/pack_loader.js";
import { initGame } from "../core/game_engine.js";
import { calculateAllScores } from "../core/scoring.js";
import { createSupabaseTransport } from "../net/transport_supabase.js";
import { createRoomClient } from "../net/room_client.js";
import { renderLobby, renderConnectionBadge, injectLobbyCSS } from "../ui/room_ui.js";
import { BUILT_IN_PACK } from "../data/packs/tokyo4.js";

// ─────────────────────────────────────────
// Config (override via guno_v6/config.js)
// ─────────────────────────────────────────

const CONFIG = window.GUNO_CONFIG || {
  supabaseUrl: "",
  supabaseAnonKey: "",
};

// ─────────────────────────────────────────
// Online mode state
// ─────────────────────────────────────────

let roomClient = null;
let transport = null;
let lobbyState = {
  roomId: null,
  playerNames: [],
  isHost: false,
  connectionStatus: "offline",
};

// ─────────────────────────────────────────
// Room ID generator
// ─────────────────────────────────────────

function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─────────────────────────────────────────
// Lobby actions
// ─────────────────────────────────────────

async function createRoom(playerName) {
  const roomId = generateRoomId();
  await connectToRoom(roomId, playerName, true);
}

async function joinRoom(roomId, playerName) {
  await connectToRoom(roomId, playerName, false);
}

async function connectToRoom(roomId, playerName, isHost) {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
    alert("Supabase設定が未完了です。\nguno_v6/config.js に SUPABASE_URL と SUPABASE_ANON_KEY を設定してください。");
    return;
  }

  updateLobbyStatus("connecting");

  try {
    transport = createSupabaseTransport(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const loadedPack = loadPack(BUILT_IN_PACK);

    roomClient = createRoomClient({
      transport,
      isHost,
      playerIndex: isHost ? 0 : undefined,
      loadedPack,
      onStateUpdate: (state, events) => {
        // Delegate to the main game UI render function
        if (window.onOnlineStateUpdate) window.onOnlineStateUpdate(state, events);
      },
      onGameOver: (scores) => {
        if (window.onOnlineGameOver) window.onOnlineGameOver(scores);
      },
      onPlayerJoined: (names) => {
        lobbyState.playerNames = names;
        updateLobbyStatus("online");
        rerenderLobby();
      },
      onError: (err) => {
        console.error("[online] room error", err);
        updateLobbyStatus("error");
        rerenderLobby();
      },
    });

    await roomClient.joinRoom(roomId, playerName);

    lobbyState = {
      roomId,
      playerNames: [playerName],
      isHost,
      connectionStatus: "online",
    };

    rerenderLobby();
  } catch (err) {
    console.error("[online] connect error", err);
    updateLobbyStatus("error");
    rerenderLobby();
  }
}

async function startGame() {
  if (!roomClient || !lobbyState.isHost) return;

  const loadedPack = loadPack(BUILT_IN_PACK);
  const playerCount = Math.max(2, lobbyState.playerNames.length);
  const playerConfigs = lobbyState.playerNames.map((name) => ({ name }));
  const initialState = initGame(loadedPack, playerCount, playerConfigs);

  await roomClient.hostStartGame(initialState, lobbyState.playerNames);

  // Hide lobby, show game
  hideLobby();
}

// ─────────────────────────────────────────
// Lobby UI helpers
// ─────────────────────────────────────────

function updateLobbyStatus(status) {
  lobbyState.connectionStatus = status;
}

function rerenderLobby() {
  const overlay = document.getElementById("lobby-overlay");
  if (!overlay) return;
  renderLobby(overlay, lobbyState, {
    onCreateRoom: createRoom,
    onJoinRoom: joinRoom,
    onStartGame: startGame,
    onCopyRoomId: (id) => {
      navigator.clipboard?.writeText(id).then(() => alert(`Room ID "${id}" をコピーしました`));
    },
  });
}

function showLobby() {
  const overlay = document.getElementById("lobby-overlay");
  if (overlay) overlay.classList.add("visible");
}

function hideLobby() {
  const overlay = document.getElementById("lobby-overlay");
  if (overlay) overlay.classList.remove("visible");
}

// ─────────────────────────────────────────
// Init
// ─────────────────────────────────────────

/**
 * Initialize the online mode.
 * Call this from index.html after the DOM is ready.
 */
export function initOnlineMode() {
  injectLobbyCSS();

  // Create lobby overlay if not present
  if (!document.getElementById("lobby-overlay")) {
    const overlay = document.createElement("div");
    overlay.id = "lobby-overlay";
    document.body.appendChild(overlay);
  }

  // Expose online actions to the toolbar
  window.showOnlineLobby = showLobby;
  window.hideOnlineLobby = hideLobby;
  window.onlineRoomClient = () => roomClient;

  // Show lobby on load
  showLobby();
  rerenderLobby();
}
