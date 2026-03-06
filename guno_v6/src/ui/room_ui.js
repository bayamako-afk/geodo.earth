// guno_v6/src/ui/room_ui.js
// GUNO V6 Online Room UI Component
//
// Responsibility:
//   - Render the room lobby (room ID display, player list, ready state)
//   - Render the online connection status badge
//   - Emit room actions via callbacks (no direct state mutation)

"use strict";

// ─────────────────────────────────────────
// Connection status badge
// ─────────────────────────────────────────

/**
 * @typedef {"offline"|"connecting"|"online"|"error"} ConnectionStatus
 */

/**
 * Render the connection status badge.
 * @param {HTMLElement} el
 * @param {ConnectionStatus} status
 * @param {string} [roomId]
 */
export function renderConnectionBadge(el, status, roomId) {
  if (!el) return;
  const labels = {
    offline:    { text: "オフライン",   color: "#888" },
    connecting: { text: "接続中...",    color: "#f39700" },
    online:     { text: `オンライン`,   color: "#4caf50" },
    error:      { text: "接続エラー",   color: "#e60012" },
  };
  const { text, color } = labels[status] || labels.offline;
  const roomLabel = (status === "online" && roomId) ? ` [${roomId}]` : "";
  el.innerHTML = `<span style="color:${color};">● ${text}${roomLabel}</span>`;
}

// ─────────────────────────────────────────
// Lobby overlay
// ─────────────────────────────────────────

/**
 * Render the room lobby overlay.
 * @param {HTMLElement} overlayEl
 * @param {LobbyState} lobbyState
 * @param {LobbyCallbacks} callbacks
 */
export function renderLobby(overlayEl, lobbyState, callbacks) {
  if (!overlayEl) return;

  const { roomId, playerNames, isHost, connectionStatus } = lobbyState;
  const { onCreateRoom, onJoinRoom, onStartGame, onCopyRoomId } = callbacks;

  const playerListHtml = playerNames.length
    ? playerNames.map((n, i) => `<li>${i + 1}. ${n}</li>`).join("")
    : "<li style='color:#888'>待機中...</li>";

  overlayEl.innerHTML = `
    <div class="lobby-box">
      <h2>🚃 GUNO V6 オンライン</h2>

      <div id="lobby-status"></div>

      ${!roomId ? `
        <div class="lobby-section">
          <p>プレイヤー名:</p>
          <input id="lobby-name" type="text" placeholder="あなたの名前" maxlength="12" value="Player">
          <div class="lobby-btn-row">
            <button id="btn-create">🏠 部屋を作る</button>
            <button id="btn-join-toggle">🚪 部屋に入る</button>
          </div>
          <div id="join-form" style="display:none; margin-top:8px;">
            <input id="lobby-room-id" type="text" placeholder="Room ID" maxlength="20">
            <button id="btn-join-confirm">参加</button>
          </div>
        </div>
      ` : `
        <div class="lobby-section">
          <p>Room ID: <strong>${roomId}</strong>
            <button id="btn-copy" style="margin-left:6px; font-size:11px;">📋 コピー</button>
          </p>
          <p style="font-size:11px; color:#888;">このIDを友達に共有してください</p>
          <ul class="player-list">${playerListHtml}</ul>
          ${isHost ? `<button id="btn-start" ${playerNames.length < 2 ? "disabled" : ""}>▶️ ゲーム開始</button>` : `<p style="color:#888;">ホストがゲームを開始するのを待っています...</p>`}
        </div>
      `}
    </div>`;

  // Status badge
  renderConnectionBadge(overlayEl.querySelector("#lobby-status"), connectionStatus, roomId);

  // Bind events
  overlayEl.querySelector("#btn-create")?.addEventListener("click", () => {
    const name = overlayEl.querySelector("#lobby-name")?.value.trim() || "Player";
    onCreateRoom?.(name);
  });

  overlayEl.querySelector("#btn-join-toggle")?.addEventListener("click", () => {
    const form = overlayEl.querySelector("#join-form");
    if (form) form.style.display = form.style.display === "none" ? "block" : "none";
  });

  overlayEl.querySelector("#btn-join-confirm")?.addEventListener("click", () => {
    const name = overlayEl.querySelector("#lobby-name")?.value.trim() || "Player";
    const rid = overlayEl.querySelector("#lobby-room-id")?.value.trim();
    if (rid) onJoinRoom?.(rid, name);
  });

  overlayEl.querySelector("#btn-copy")?.addEventListener("click", () => {
    onCopyRoomId?.(roomId);
  });

  overlayEl.querySelector("#btn-start")?.addEventListener("click", () => {
    onStartGame?.();
  });
}

// ─────────────────────────────────────────
// Lobby CSS (injected once)
// ─────────────────────────────────────────

let lobbyCSSInjected = false;

export function injectLobbyCSS() {
  if (lobbyCSSInjected) return;
  lobbyCSSInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    #lobby-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      z-index: 200;
      align-items: center;
      justify-content: center;
    }
    #lobby-overlay.visible { display: flex; }
    .lobby-box {
      background: #1e1e1e;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 24px;
      min-width: 320px;
      text-align: center;
    }
    .lobby-box h2 { font-size: 18px; color: #4caf50; margin-bottom: 12px; }
    .lobby-section { margin-top: 12px; }
    .lobby-section p { margin-bottom: 6px; font-size: 13px; }
    .lobby-section input {
      width: 100%; padding: 6px 8px; background: #2a2a2a; color: #e0e0e0;
      border: 1px solid #444; border-radius: 4px; font-size: 13px; margin-bottom: 8px;
    }
    .lobby-btn-row { display: flex; gap: 8px; justify-content: center; }
    .lobby-box button {
      padding: 6px 14px; background: #2a2a2a; color: #e0e0e0;
      border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 13px;
    }
    .lobby-box button:hover { background: #3a3a3a; }
    .lobby-box button:disabled { opacity: 0.4; cursor: not-allowed; }
    #btn-start { margin-top: 12px; background: #2a4a2a; border-color: #4caf50; color: #4caf50; font-size: 14px; padding: 8px 24px; }
    .player-list { list-style: none; text-align: left; margin: 8px 0; font-size: 13px; }
    .player-list li { padding: 3px 0; border-bottom: 1px solid #333; }
  `;
  document.head.appendChild(style);
}

/**
 * @typedef {object} LobbyState
 * @property {string|null} roomId
 * @property {string[]} playerNames
 * @property {boolean} isHost
 * @property {ConnectionStatus} connectionStatus
 */

/**
 * @typedef {object} LobbyCallbacks
 * @property {function(string): void} [onCreateRoom]
 * @property {function(string, string): void} [onJoinRoom]
 * @property {function(): void} [onStartGame]
 * @property {function(string): void} [onCopyRoomId]
 */
