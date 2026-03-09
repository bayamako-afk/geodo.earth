/**
 * guno_v6/src/net/room_client.js
 * GUNO V6 ルームクライアント
 *
 * Supabase の rooms / game_states テーブルを操作して
 * ルームの作成・参加・一覧取得・状態管理を行う。
 *
 * 同期モデル: host-authoritative
 *   - Host がゲームの正状態を保持し、他プレイヤーのアクションを処理して結果をブロードキャスト
 *   - Guest はアクションを Host に送信し、Host からの状態更新を受信する
 */

import GUNO_V6_CONFIG from "../../config.js";

// ===== 定数 =====

const TABLES = GUNO_V6_CONFIG.tables;
const ROOM_EXPIRY_MS = GUNO_V6_CONFIG.room.expiryMs;

// ===== セッション ID =====

/**
 * ブラウザセッション固有の匿名 ID を生成・保持する。
 * localStorage に保存して同一ブラウザ内で一貫性を保つ。
 * @returns {string}
 */
export function getSessionId() {
  let id = localStorage.getItem("guno_v6_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("guno_v6_session_id", id);
  }
  return id;
}

// ===== ルームコード生成 =====

/**
 * 4文字の英数字ルームコードを生成する（例: "AB3X"）。
 * @returns {string}
 */
export function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除外
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ===== ルーム作成 =====

/**
 * 新しいルームを作成する。
 *
 * @param {object} supabase - Supabase クライアント
 * @param {object} opts
 * @param {string} opts.packName - 使用するパック名
 * @param {number} [opts.maxPlayers=4] - 最大プレイヤー数
 * @param {string} [opts.playerName="ホスト"] - ホストのプレイヤー名
 * @returns {Promise<{room: object, sessionId: string}>}
 */
export async function createRoom(supabase, { packName = "routes_guno", maxPlayers = 4, playerName = "ホスト" } = {}) {
  const sessionId = getSessionId();
  const roomCode = generateRoomCode();

  const roomData = {
    room_code: roomCode,
    host_id: sessionId,
    status: "waiting",
    max_players: maxPlayers,
    player_count: 1,
    pack_name: packName,
    players_json: JSON.stringify([
      { session_id: sessionId, name: playerName, icon: "🌊", color: "#174a7c", is_host: true, ready: false },
    ]),
  };

  const { data, error } = await supabase
    .from(TABLES.rooms)
    .insert(roomData)
    .select()
    .single();

  if (error) throw new Error(`ルーム作成失敗: ${error.message}`);
  return { room: data, sessionId };
}

// ===== ルーム参加 =====

/**
 * 既存のルームに参加する。
 *
 * @param {object} supabase - Supabase クライアント
 * @param {string} roomCode - 参加するルームコード
 * @param {object} opts
 * @param {string} [opts.playerName="ゲスト"] - プレイヤー名
 * @returns {Promise<{room: object, sessionId: string, playerIndex: number}>}
 */
export async function joinRoom(supabase, roomCode, { playerName = "ゲスト" } = {}) {
  const sessionId = getSessionId();
  const code = roomCode.toUpperCase().trim();

  // ルームを取得
  const { data: room, error: fetchErr } = await supabase
    .from(TABLES.rooms)
    .select("*")
    .eq("room_code", code)
    .single();

  if (fetchErr || !room) throw new Error(`ルームが見つかりません: ${code}`);

  // 既に参加済みか確認（切断復帰を含む）
  const players = JSON.parse(room.players_json || "[]");
  const existing = players.find(p => p.session_id === sessionId);
  if (existing) {
    const isHost = existing.is_host === true || room.host_id === sessionId;
    return { room, sessionId, playerIndex: players.indexOf(existing), isHost };
  }

  // 新規参加の場合: waiting 状態のみ許可
  if (room.status !== "waiting") throw new Error("このルームはすでにゲームが開始されています");
  if (room.player_count >= room.max_players) throw new Error("ルームが満員です");

  // プレイヤーを追加
  const icons = ["🌸", "🌙", "🏯", "🌊"];
  const colors = ["#b52942", "#e6b422", "#745399", "#174a7c"];
  const idx = players.length;
  players.push({
    session_id: sessionId,
    name: playerName,
    icon: icons[idx % icons.length],
    color: colors[idx % colors.length],
    is_host: false,
    ready: false,
  });

  const { data: updated, error: updateErr } = await supabase
    .from(TABLES.rooms)
    .update({
      player_count: players.length,
      players_json: JSON.stringify(players),
    })
    .eq("room_code", code)
    .select()
    .single();

  if (updateErr) throw new Error(`ルーム参加失敗: ${updateErr.message}`);
  return { room: updated, sessionId, playerIndex: idx, isHost: false };
}

// ===== ルーム一覧取得 =====

/**
 * 参加可能なルーム一覧を取得する（waiting 状態のルームのみ）。
 *
 * @param {object} supabase - Supabase クライアント
 * @returns {Promise<object[]>}
 */
export async function listRooms(supabase) {
  const expiryTime = new Date(Date.now() - ROOM_EXPIRY_MS).toISOString();

  const { data, error } = await supabase
    .from(TABLES.rooms)
    .select("id, room_code, status, player_count, max_players, pack_name, created_at")
    .eq("status", "waiting")
    .gte("created_at", expiryTime)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(`ルーム一覧取得失敗: ${error.message}`);
  return data ?? [];
}

// ===== ルーム状態更新 =====

/**
 * ルームのステータスを更新する（ホストのみ）。
 *
 * @param {object} supabase - Supabase クライアント
 * @param {string} roomId - ルーム UUID
 * @param {"waiting"|"playing"|"finished"} status - 新しいステータス
 * @returns {Promise<object>}
 */
export async function updateRoomStatus(supabase, roomId, status) {
  const sessionId = getSessionId();

  const { data, error } = await supabase
    .from(TABLES.rooms)
    .update({ status })
    .eq("id", roomId)
    .eq("host_id", sessionId)
    .select()
    .single();

  if (error) throw new Error(`ルーム状態更新失敗: ${error.message}`);
  return data;
}

// ===== ゲーム状態の初期保存 =====

/**
 * ゲーム開始時に game_states テーブルに初期状態を保存する（ホストのみ）。
 *
 * @param {object} supabase - Supabase クライアント
 * @param {string} roomId - ルーム UUID
 * @param {object} gameState - シリアライズ済みゲーム状態
 * @returns {Promise<object>}
 */
export async function saveInitialGameState(supabase, roomId, gameState) {
  const { data, error } = await supabase
    .from(TABLES.gameStates)
    .insert({
      room_id: roomId,
      state_json: gameState,
      turn_index: gameState.turnIndex ?? 0,
      turn_count: gameState.turnCount ?? 0,
      direction: gameState.direction ?? 1,
      game_over: false,
      last_action: "init",
      last_actor_id: getSessionId(),
      version: 1,
    })
    .select()
    .single();

  if (error) throw new Error(`ゲーム状態保存失敗: ${error.message}`);
  return data;
}

// ===== ゲーム状態の更新 =====

/**
 * ゲーム状態を更新する（ホストのみ）。楽観的ロックによる競合検出付き。
 *
 * @param {object} supabase - Supabase クライアント
 * @param {string} gameStateId - game_states レコードの UUID
 * @param {object} gameState - シリアライズ済みゲーム状態
 * @param {number} expectedVersion - 期待するバージョン番号（楽観的ロック）
 * @param {string} lastAction - 最後のアクション種別
 * @returns {Promise<object>}
 */
export async function updateGameState(supabase, gameStateId, gameState, expectedVersion, lastAction = "turn") {
  const { data, error } = await supabase
    .from(TABLES.gameStates)
    .update({
      state_json: gameState,
      turn_index: gameState.turnIndex ?? 0,
      turn_count: gameState.turnCount ?? 0,
      direction: gameState.direction ?? 1,
      game_over: gameState.gameOver ?? false,
      last_action: lastAction,
      last_actor_id: getSessionId(),
      version: expectedVersion + 1,
    })
    .eq("id", gameStateId)
    .eq("version", expectedVersion)
    .select()
    .single();

  if (error) throw new Error(`ゲーム状態更新失敗: ${error.message}`);
  if (!data) throw new Error("バージョン競合: 他のクライアントが先に更新しました");
  return data;
}

// ===== ゲーム状態の取得 =====

/**
 * 最新のゲーム状態を取得する。
 *
 * @param {object} supabase - Supabase クライアント
 * @param {string} roomId - ルーム UUID
 * @returns {Promise<object|null>}
 */
export async function fetchGameState(supabase, roomId) {
  const { data, error } = await supabase
    .from(TABLES.gameStates)
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(`ゲーム状態取得失敗: ${error.message}`);
  return data ?? null;
}

// ===== ゲストのアクション送信 =====

/**
 * ゲスト（非ホスト）がアクションを Realtime Broadcast で送信する。
 * Host がこれを受信してゲーム状態を更新する。
 *
 * @param {object} channel - Supabase Realtime チャンネル
 * @param {object} action - アクション情報
 * @param {string} action.type - "play_card" | "draw_card" | "pass_turn"
 * @param {number} [action.cardIndex] - プレイするカードのインデックス
 * @param {string} action.sessionId - 送信者のセッション ID
 */
export function sendGuestAction(channel, action) {
  channel.send({
    type: "broadcast",
    event: "guest_action",
    payload: { ...action, timestamp: Date.now() },
  });
}

// ===== ルーム削除（ホスト退室） =====

/**
 * ルームを削除する（ホストのみ）。
 *
 * @param {object} supabase - Supabase クライアント
 * @param {string} roomId - ルーム UUID
 */
export async function deleteRoom(supabase, roomId) {
  const sessionId = getSessionId();
  const { error } = await supabase
    .from(TABLES.rooms)
    .delete()
    .eq("id", roomId)
    .eq("host_id", sessionId);

  if (error) throw new Error(`ルーム削除失敗: ${error.message}`);
}
