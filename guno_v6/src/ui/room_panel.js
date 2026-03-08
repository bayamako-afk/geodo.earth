/**
 * guno_v6/src/ui/room_panel.js
 * GUNO V6 ルームパネル UI
 *
 * オンライン対戦のルーム作成・参加・待合室画面を提供する。
 *
 * 画面遷移:
 *   [ロビー] → [ルーム作成 / ルーム参加] → [待合室] → [ゲーム画面]
 */

import { createRoom, joinRoom, listRooms, updateRoomStatus, deleteRoom, getSessionId } from "../net/room_client.js";

// ===== 定数 =====

const ICONS = ["🌊", "🌸", "🌙", "🏯"];

// ===== ルームパネルのマウント =====

/**
 * ルームパネルをマウントする。
 *
 * @param {object} opts
 * @param {HTMLElement} opts.container - マウント先コンテナ
 * @param {object} opts.supabase - Supabase クライアント
 * @param {function(object): void} opts.onGameStart - ゲーム開始時のコールバック
 *   引数: { room, sessionId, playerIndex, isHost }
 */
export function mountRoomPanel({ container, supabase, onGameStart }) {
  container.innerHTML = "";
  container.className = "room-panel";

  // ===== ロビー画面を表示 =====
  showLobby({ container, supabase, onGameStart });
}

// ===== ロビー画面 =====

async function showLobby({ container, supabase, onGameStart }) {
  const sessionId = getSessionId();

  container.innerHTML = `
    <div class="rp-lobby">
      <div class="rp-header">
        <h2 class="rp-title">🌐 GUNO V6 <span class="rp-badge">ONLINE DEMO</span></h2>
        <p class="rp-sub">Supabase Realtime を使ったオンライン対戦（2〜4人）</p>
      </div>

      <div class="rp-name-row">
        <label class="rp-label">あなたの名前</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <span id="rp-icon-display" style="font-size:24px; cursor:pointer;" title="クリックでアイコン変更">🌊</span>
          <input id="rp-player-name" type="text" class="rp-input" placeholder="プレイヤー名" maxlength="12" value="プレイヤー">
        </div>
      </div>

      <div class="rp-actions">
        <button id="rp-btn-create" class="rp-btn rp-btn-primary">🏠 ルームを作成</button>
        <button id="rp-btn-join" class="rp-btn rp-btn-secondary">🚪 ルームに参加</button>
      </div>

      <div id="rp-join-form" style="display:none;" class="rp-join-form">
        <input id="rp-room-code" type="text" class="rp-input rp-code-input" placeholder="ルームコード（例: AB3X）" maxlength="4">
        <button id="rp-btn-join-confirm" class="rp-btn rp-btn-primary">参加</button>
      </div>

      <div class="rp-room-list-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h3 class="rp-section-title">参加可能なルーム</h3>
          <button id="rp-btn-refresh" class="rp-btn-icon" title="更新">🔄</button>
        </div>
        <div id="rp-room-list" class="rp-room-list">
          <div class="rp-loading">読み込み中...</div>
        </div>
      </div>

      <div id="rp-error" class="rp-error" style="display:none;"></div>
    </div>
  `;

  // アイコン選択
  let iconIdx = 0;
  const iconDisplay = container.querySelector("#rp-icon-display");
  iconDisplay.addEventListener("click", () => {
    iconIdx = (iconIdx + 1) % ICONS.length;
    iconDisplay.textContent = ICONS[iconIdx];
  });

  // 参加フォームトグル
  container.querySelector("#rp-btn-join").addEventListener("click", () => {
    const form = container.querySelector("#rp-join-form");
    form.style.display = form.style.display === "none" ? "flex" : "none";
  });

  // ルーム作成
  container.querySelector("#rp-btn-create").addEventListener("click", async () => {
    const name = container.querySelector("#rp-player-name").value.trim() || "ホスト";
    const icon = ICONS[iconIdx];
    await handleCreateRoom({ container, supabase, onGameStart, playerName: name, playerIcon: icon });
  });

  // ルーム参加（コード入力）
  container.querySelector("#rp-btn-join-confirm").addEventListener("click", async () => {
    const code = container.querySelector("#rp-room-code").value.trim().toUpperCase();
    const name = container.querySelector("#rp-player-name").value.trim() || "ゲスト";
    const icon = ICONS[iconIdx];
    if (!code) { showError(container, "ルームコードを入力してください"); return; }
    await handleJoinRoom({ container, supabase, onGameStart, roomCode: code, playerName: name, playerIcon: icon });
  });

  // ルーム一覧更新
  container.querySelector("#rp-btn-refresh").addEventListener("click", () => {
    loadRoomList(container, supabase, onGameStart);
  });

  // 初回ロード
  await loadRoomList(container, supabase, onGameStart);
}

// ===== ルーム一覧の読み込み =====

async function loadRoomList(container, supabase, onGameStart) {
  const listEl = container.querySelector("#rp-room-list");
  if (!listEl) return;
  listEl.innerHTML = '<div class="rp-loading">読み込み中...</div>';

  try {
    const rooms = await listRooms(supabase);
    if (rooms.length === 0) {
      listEl.innerHTML = '<div class="rp-empty">参加可能なルームはありません</div>';
      return;
    }

    listEl.innerHTML = rooms.map(r => `
      <div class="rp-room-item" data-code="${r.room_code}">
        <div class="rp-room-info">
          <span class="rp-room-code">${r.room_code}</span>
          <span class="rp-room-pack">${r.pack_name ?? "—"}</span>
        </div>
        <div class="rp-room-meta">
          <span class="rp-room-players">${r.player_count}/${r.max_players}人</span>
          <button class="rp-btn rp-btn-sm rp-btn-join-list" data-code="${r.room_code}">参加</button>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".rp-btn-join-list").forEach(btn => {
      btn.addEventListener("click", async () => {
        const code = btn.dataset.code;
        const name = container.querySelector("#rp-player-name")?.value.trim() || "ゲスト";
        const iconIdx2 = ICONS.indexOf(container.querySelector("#rp-icon-display")?.textContent ?? "🌊");
        const icon = ICONS[iconIdx2 >= 0 ? iconIdx2 : 0];
        await handleJoinRoom({ container, supabase, onGameStart, roomCode: code, playerName: name, playerIcon: icon });
      });
    });
  } catch (e) {
    listEl.innerHTML = `<div class="rp-empty rp-error-text">取得失敗: ${e.message}</div>`;
  }
}

// ===== ルーム作成ハンドラ =====

async function handleCreateRoom({ container, supabase, onGameStart, playerName, playerIcon }) {
  showError(container, "");
  try {
    const { room, sessionId } = await createRoom(supabase, { playerName });
    showWaitingRoom({ container, supabase, room, sessionId, playerIndex: 0, isHost: true, playerName, playerIcon, onGameStart });
  } catch (e) {
    showError(container, e.message);
  }
}

// ===== ルーム参加ハンドラ =====

async function handleJoinRoom({ container, supabase, onGameStart, roomCode, playerName, playerIcon }) {
  showError(container, "");
  try {
    const { room, sessionId, playerIndex, isHost } = await joinRoom(supabase, roomCode, { playerName });
    showWaitingRoom({ container, supabase, room, sessionId, playerIndex, isHost: isHost ?? false, playerName, playerIcon, onGameStart });
  } catch (e) {
    showError(container, e.message);
  }
}

// ===== 待合室画面 =====

function showWaitingRoom({ container, supabase, room, sessionId, playerIndex, isHost, playerName, playerIcon, onGameStart }) {
  let currentRoom = room;
  let players = JSON.parse(room.players_json || "[]");

  const renderWaiting = () => {
    container.innerHTML = `
      <div class="rp-waiting">
        <div class="rp-header">
          <h2 class="rp-title">🏠 待合室</h2>
          <div class="rp-room-code-display">
            ルームコード: <span class="rp-code-big">${currentRoom.room_code}</span>
            <button id="rp-btn-copy" class="rp-btn-icon" title="コピー">📋</button>
          </div>
        </div>

        <div class="rp-players-list">
          <h3 class="rp-section-title">参加プレイヤー (${players.length}/${currentRoom.max_players})</h3>
          <div id="rp-players">
            ${players.map((p, i) => `
              <div class="rp-player-item ${p.session_id === sessionId ? "rp-player-me" : ""}">
                <span class="rp-player-icon">${p.icon ?? ICONS[i % ICONS.length]}</span>
                <span class="rp-player-name">${p.name}${p.is_host ? " 👑" : ""}</span>
                ${p.session_id === sessionId ? '<span class="rp-player-badge">あなた</span>' : ""}
              </div>
            `).join("")}
          </div>
        </div>

        <div id="rp-waiting-msg" class="rp-waiting-msg">
          ${isHost
            ? `<p>他のプレイヤーの参加を待っています...</p><p class="rp-hint">2人以上揃ったらゲームを開始できます</p>`
            : `<p>ホストがゲームを開始するまでお待ちください...</p>`
          }
        </div>

        <div class="rp-waiting-actions">
          ${isHost ? `
            <button id="rp-btn-start" class="rp-btn rp-btn-primary" ${players.length < 2 ? "disabled" : ""}>
              🎮 ゲーム開始 (${players.length}人)
            </button>
          ` : ""}
          <button id="rp-btn-leave" class="rp-btn rp-btn-danger">🚪 退室</button>
        </div>

        <div id="rp-error" class="rp-error" style="display:none;"></div>
      </div>
    `;

    // コードコピー
    container.querySelector("#rp-btn-copy")?.addEventListener("click", () => {
      navigator.clipboard.writeText(currentRoom.room_code).then(() => {
        const btn = container.querySelector("#rp-btn-copy");
        if (btn) { btn.textContent = "✅"; setTimeout(() => { btn.textContent = "📋"; }, 1500); }
      });
    });

    // ゲーム開始（ホストのみ）
    container.querySelector("#rp-btn-start")?.addEventListener("click", async () => {
      try {
        await updateRoomStatus(supabase, currentRoom.id, "playing");
        onGameStart({ room: currentRoom, sessionId, playerIndex, isHost: true, players });
      } catch (e) {
        showError(container, e.message);
      }
    });

    // 退室
    container.querySelector("#rp-btn-leave")?.addEventListener("click", async () => {
      try {
        if (isHost) await deleteRoom(supabase, currentRoom.id);
        showLobby({ container, supabase, onGameStart });
      } catch (e) {
        showLobby({ container, supabase, onGameStart });
      }
    });
  };

  renderWaiting();

  // Realtime でルーム更新を購読（参加者が増えたら再描画）
  const channel = supabase.channel(`rp_room_${currentRoom.id}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "rooms",
      filter: `id=eq.${currentRoom.id}`,
    }, (payload) => {
      currentRoom = payload.new;
      players = JSON.parse(currentRoom.players_json || "[]");

      // ゲーム開始された場合（ゲストが検知）
      if (currentRoom.status === "playing" && !isHost) {
        supabase.removeChannel(channel);
        onGameStart({ room: currentRoom, sessionId, playerIndex, isHost: false, players });
        return;
      }

      renderWaiting();
    })
    .subscribe();
}

// ===== エラー表示 =====

function showError(container, message) {
  const el = container.querySelector("#rp-error");
  if (!el) return;
  if (!message) { el.style.display = "none"; el.textContent = ""; return; }
  el.style.display = "block";
  el.textContent = `⚠ ${message}`;
}

// ===== CSS インジェクション =====

/**
 * ルームパネル用のスタイルをページに追加する（一度だけ）。
 */
export function injectRoomPanelStyles() {
  if (document.getElementById("rp-styles")) return;
  const style = document.createElement("style");
  style.id = "rp-styles";
  style.textContent = `
    .room-panel {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.92);
      z-index: 500;
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .rp-lobby, .rp-waiting {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 16px;
      padding: 24px;
      width: 100%; max-width: 480px;
      max-height: 90vh; overflow-y: auto;
      display: flex; flex-direction: column; gap: 16px;
    }
    .rp-header { text-align: center; }
    .rp-title { color: gold; margin: 0 0 4px; font-size: 1.4em; }
    .rp-badge {
      background: #c0392b; color: #fff;
      font-size: 0.55em; padding: 2px 8px; border-radius: 20px;
      vertical-align: middle; font-weight: 700;
    }
    .rp-sub { color: #888; font-size: 0.85em; margin: 0; }
    .rp-section-title { color: #aaa; font-size: 0.85em; margin: 0; text-transform: uppercase; letter-spacing: 0.08em; }
    .rp-label { color: #888; font-size: 0.85em; display: block; margin-bottom: 6px; }
    .rp-name-row { display: flex; flex-direction: column; gap: 6px; }
    .rp-input {
      background: #111; border: 1px solid #444; color: #eee;
      padding: 8px 12px; border-radius: 8px; font-size: 14px; outline: none;
      transition: border-color 0.2s;
    }
    .rp-input:focus { border-color: gold; }
    .rp-code-input { text-transform: uppercase; letter-spacing: 0.2em; font-size: 18px; text-align: center; width: 120px; }
    .rp-actions { display: flex; gap: 10px; }
    .rp-join-form { display: flex; gap: 8px; align-items: center; }
    .rp-btn {
      padding: 8px 16px; border: none; border-radius: 8px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      transition: filter 0.15s, transform 0.1s; flex: 1;
    }
    .rp-btn:active { transform: scale(0.95); filter: brightness(0.85); }
    .rp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .rp-btn-primary { background: gold; color: #000; }
    .rp-btn-secondary { background: #2a2a2a; color: #ccc; border: 1px solid #444; }
    .rp-btn-danger { background: #c0392b; color: #fff; }
    .rp-btn-sm { padding: 4px 10px; font-size: 11px; flex: none; }
    .rp-btn-join-list { background: #2980b9; color: #fff; }
    .rp-btn-icon {
      background: none; border: 1px solid #444; color: #aaa;
      padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;
    }
    .rp-room-list { display: flex; flex-direction: column; gap: 6px; }
    .rp-room-item {
      background: #111; border: 1px solid #333; border-radius: 8px;
      padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;
    }
    .rp-room-info { display: flex; flex-direction: column; gap: 2px; }
    .rp-room-code { font-weight: 700; color: gold; letter-spacing: 0.1em; font-size: 14px; }
    .rp-room-pack { color: #666; font-size: 11px; }
    .rp-room-meta { display: flex; align-items: center; gap: 8px; }
    .rp-room-players { color: #888; font-size: 12px; }
    .rp-loading, .rp-empty { color: #555; font-size: 13px; text-align: center; padding: 12px; }
    .rp-error { background: rgba(192,57,43,0.15); color: #e74c3c; border: 1px solid #c0392b; border-radius: 8px; padding: 8px 12px; font-size: 13px; }
    .rp-error-text { color: #e74c3c; }
    .rp-room-code-display { color: #aaa; font-size: 13px; margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .rp-code-big { color: gold; font-size: 2em; font-weight: 900; letter-spacing: 0.2em; }
    .rp-players-list { display: flex; flex-direction: column; gap: 8px; }
    .rp-player-item {
      background: #111; border: 1px solid #333; border-radius: 8px;
      padding: 8px 12px; display: flex; align-items: center; gap: 10px;
    }
    .rp-player-me { border-color: gold; }
    .rp-player-icon { font-size: 20px; }
    .rp-player-name { flex: 1; font-size: 14px; }
    .rp-player-badge { background: #2980b9; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
    .rp-waiting-msg { color: #888; font-size: 13px; text-align: center; }
    .rp-hint { color: #555; font-size: 12px; margin-top: 4px; }
    .rp-waiting-actions { display: flex; gap: 10px; }
  `;
  document.head.appendChild(style);
}
