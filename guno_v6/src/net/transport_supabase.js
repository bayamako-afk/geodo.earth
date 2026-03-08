/**
 * guno_v6/src/net/transport_supabase.js
 * GUNO V6 Supabase Realtime トランスポート層
 *
 * Supabase Realtime の Postgres Changes と Broadcast を組み合わせて
 * ゲーム状態のリアルタイム同期を実現する。
 *
 * 同期モデル: host-authoritative
 *   - Host: game_states テーブルを更新 → Postgres Changes で全員に配信
 *   - Guest: Broadcast で Host にアクションを送信
 *
 * チャンネル構成:
 *   - "guno_v6_room_{roomId}": ルーム内の全通信に使用
 *     - Postgres Changes: game_states テーブルの変更を購読
 *     - Broadcast: ゲストのアクション送信
 *     - Presence: オンラインプレイヤーの追跡
 */

import GUNO_V6_CONFIG from "../../config.js";
import { getSessionId } from "./room_client.js";

const CHANNEL_PREFIX = GUNO_V6_CONFIG.realtime.channelPrefix;

// ===== TransportSupabase クラス =====

/**
 * Supabase Realtime を使ったゲーム状態同期クラス。
 *
 * @example
 * const transport = new TransportSupabase(supabase, roomId, { isHost: true });
 * transport.onStateUpdate = (newState) => { renderAll(newState); };
 * transport.onGuestAction = (action) => { handleGuestAction(action); };
 * transport.onPresenceChange = (players) => { updatePlayerList(players); };
 * await transport.connect();
 */
export class TransportSupabase {
  /**
   * @param {object} supabase - Supabase クライアント
   * @param {string} roomId - ルーム UUID
   * @param {object} opts
   * @param {boolean} opts.isHost - ホストかどうか
   * @param {string} [opts.playerName] - プレイヤー名（Presence 用）
   * @param {string} [opts.playerIcon] - プレイヤーアイコン（Presence 用）
   */
  constructor(supabase, roomId, { isHost = false, playerName = "Player", playerIcon = "🌊" } = {}) {
    this._supabase = supabase;
    this._roomId = roomId;
    this._isHost = isHost;
    this._sessionId = getSessionId();
    this._playerName = playerName;
    this._playerIcon = playerIcon;
    this._channel = null;
    this._connected = false;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;
    this._reconnectTimer = null;

    // ===== コールバック（外部から設定） =====

    /** @type {function(object): void} ゲーム状態更新時のコールバック */
    this.onStateUpdate = null;

    /** @type {function(object): void} ゲストのアクション受信時のコールバック（ホストのみ） */
    this.onGuestAction = null;

    /** @type {function(object[]): void} Presence 変化時のコールバック */
    this.onPresenceChange = null;

    /** @type {function(string): void} エラー発生時のコールバック */
    this.onError = null;

    /** @type {function(string): void} 接続状態変化時のコールバック */
    this.onConnectionChange = null;

    /** @type {function(object): void} ルーム状態変化時のコールバック */
    this.onRoomUpdate = null;
  }

  // ===== 接続 =====

  /**
   * Realtime チャンネルに接続する。
   * @returns {Promise<void>}
   */
  async connect() {
    if (this._connected) return;

    const channelName = `${CHANNEL_PREFIX}${this._roomId}`;
    this._channel = this._supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: this._sessionId },
      },
    });

    // --- Postgres Changes: game_states テーブルの変更を購読 ---
    this._channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_states",
        filter: `room_id=eq.${this._roomId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const record = payload.new;
          if (record && record.state_json) {
            try {
              const state = typeof record.state_json === "string"
                ? JSON.parse(record.state_json)
                : record.state_json;
              state._version = record.version;
              state._gameStateId = record.id;
              if (this.onStateUpdate) this.onStateUpdate(state);
            } catch (e) {
              console.error("[Transport] state_json パースエラー:", e);
            }
          }
        }
      }
    );

    // --- Postgres Changes: rooms テーブルの変更を購読 ---
    this._channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${this._roomId}`,
      },
      (payload) => {
        if (payload.new && this.onRoomUpdate) {
          this.onRoomUpdate(payload.new);
        }
      }
    );

    // --- Broadcast: ゲストのアクション受信（ホストのみ処理） ---
    this._channel.on("broadcast", { event: "guest_action" }, (payload) => {
      if (this._isHost && this.onGuestAction) {
        this.onGuestAction(payload.payload);
      }
    });

    // --- Broadcast: チャット・システムメッセージ ---
    this._channel.on("broadcast", { event: "system_message" }, (payload) => {
      console.log("[Transport] System:", payload.payload?.message);
    });

    // --- Presence: プレイヤーのオンライン状態追跡 ---
    this._channel.on("presence", { event: "sync" }, () => {
      const state = this._channel.presenceState();
      const players = Object.values(state).flat().map(p => ({
        session_id: p.session_id ?? p.key,
        name: p.name,
        icon: p.icon,
        online: true,
      }));
      if (this.onPresenceChange) this.onPresenceChange(players);
    });

    this._channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      console.log("[Transport] Joined:", key, newPresences);
    });

    this._channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      console.log("[Transport] Left:", key, leftPresences);
    });

    // --- チャンネル購読 ---
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime 接続タイムアウト")), 10000);

      this._channel.subscribe(async (status) => {
        if (this.onConnectionChange) this.onConnectionChange(status);

        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          this._connected = true;
          this._reconnectAttempts = 0;

          // Presence に自分の情報を登録
          await this._channel.track({
            session_id: this._sessionId,
            name: this._playerName,
            icon: this._playerIcon,
            is_host: this._isHost,
            joined_at: Date.now(),
          });

          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          this._connected = false;
          if (this._reconnectAttempts < this._maxReconnectAttempts) {
            // 自動再接続を試みる
            this._scheduleReconnect();
            resolve(); // 初回接続失敗でも reject しない（再接続で復帰）
          } else {
            const err = new Error(`Realtime 接続失敗: ${status}`);
            if (this.onError) this.onError(err.message);
            reject(err);
          }
        }
      });
    });
  }

  // ===== 再接続 =====

  /**
   * 再接続をスケジュールする（指数バックオフ）。
   */
  _scheduleReconnect() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
    this._reconnectAttempts++;
    console.log(`[Transport] 再接続を試みます (${this._reconnectAttempts}/${this._maxReconnectAttempts}) - ${delay}ms 後`);
    this._reconnectTimer = setTimeout(async () => {
      try {
        if (this._channel) {
          await this._supabase.removeChannel(this._channel);
          this._channel = null;
        }
        this._connected = false;
        await this.connect();
        console.log("[Transport] 再接続成功");
        if (this.onConnectionChange) this.onConnectionChange("RECONNECTED");
      } catch (e) {
        console.warn("[Transport] 再接続失敗:", e.message);
        if (this._reconnectAttempts < this._maxReconnectAttempts) {
          this._scheduleReconnect();
        } else {
          if (this.onError) this.onError("再接続上限に達しました");
        }
      }
    }, delay);
  }

  // ===== ゲストアクション送信 =====

  /**
   * ゲストがホストにアクションを送信する。
   * @param {object} action - アクション情報
   * @param {"play_card"|"draw_card"|"pass_turn"} action.type
   * @param {number} [action.cardIndex]
   */
  sendAction(action) {
    if (!this._channel || !this._connected) {
      throw new Error("チャンネルが接続されていません");
    }
    this._channel.send({
      type: "broadcast",
      event: "guest_action",
      payload: {
        ...action,
        session_id: this._sessionId,
        timestamp: Date.now(),
      },
    });
  }

  // ===== システムメッセージ送信 =====

  /**
   * システムメッセージをブロードキャストする（ホスト用）。
   * @param {string} message
   */
  broadcastMessage(message) {
    if (!this._channel || !this._connected) return;
    this._channel.send({
      type: "broadcast",
      event: "system_message",
      payload: { message, from: this._sessionId, timestamp: Date.now() },
    });
  }

  // ===== 切断 =====

  /**
   * チャンネルから切断する。
   */
  async disconnect() {
    if (this._channel) {
      await this._supabase.removeChannel(this._channel);
      this._channel = null;
      this._connected = false;
    }
  }

  // ===== ゲッター =====

  /** @returns {boolean} 接続中かどうか */
  get connected() { return this._connected; }

  /** @returns {boolean} ホストかどうか */
  get isHost() { return this._isHost; }

  /** @returns {string} セッション ID */
  get sessionId() { return this._sessionId; }
}

// ===== ファクトリ関数 =====

/**
 * TransportSupabase インスタンスを作成して接続する。
 *
 * @param {object} supabase - Supabase クライアント
 * @param {string} roomId - ルーム UUID
 * @param {object} opts - TransportSupabase コンストラクタのオプション
 * @returns {Promise<TransportSupabase>}
 */
export async function createTransport(supabase, roomId, opts = {}) {
  const transport = new TransportSupabase(supabase, roomId, opts);
  await transport.connect();
  return transport;
}
