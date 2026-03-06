// guno_v6/config.js
// GUNO V6 オンライン版 - Supabase 接続設定
// このファイルは自動生成されました（Supabase MCP セットアップ）
// 生成日時: 2026-03-06

/**
 * Supabase プロジェクト設定
 *
 * SUPABASE_URL    : Supabase プロジェクトの API エンドポイント
 * SUPABASE_ANON_KEY : 公開可能な匿名キー（RLS によりアクセス制御済み）
 *
 * セキュリティ注意事項:
 *   - ANON_KEY は公開鍵であり、クライアントサイドでの使用を想定しています
 *   - 実際のアクセス制御は Supabase の RLS ポリシーで行われます
 *   - SERVICE_ROLE_KEY は絶対にクライアントサイドに含めないでください
 */
export const SUPABASE_URL = "https://aidvwjxprhytwqmgwmkg.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZHZ3anhwcmh5dHdxbWd3bWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTAwODAsImV4cCI6MjA4ODM2NjA4MH0.E4hiXUZOeN78IV2tOli6GjF9EvlMCd0veY-WYX4fal4";

/**
 * GUNO V6 アプリケーション設定
 */
export const GUNO_V6_CONFIG = {
  // Supabase 接続
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  },

  // ゲームルーム設定
  room: {
    /** ルームコードの長さ（例: ABCD-1234） */
    codeLength: 8,
    /** ルームの最大プレイヤー数 */
    maxPlayers: 4,
    /** ルームの最小プレイヤー数 */
    minPlayers: 2,
    /** ルームの有効期限（ミリ秒）: 2時間 */
    expiryMs: 2 * 60 * 60 * 1000,
  },

  // Realtime 設定
  realtime: {
    /** game_states テーブルの Realtime チャンネル名プレフィックス */
    channelPrefix: "guno_v6_room_",
    /** ゲーム状態の同期間隔（ミリ秒） */
    syncIntervalMs: 100,
  },

  // データベーステーブル名
  tables: {
    rooms: "rooms",
    gameStates: "game_states",
  },

  // ゲーム設定（V5 互換）
  game: {
    /** 初期手札枚数 */
    initialHandSize: 7,
    /** デフォルトプレイヤー数 */
    defaultPlayerCount: 4,
    /** ホスト権限モデル（host-authoritative） */
    hostAuthoritative: true,
  },
};

export default GUNO_V6_CONFIG;
