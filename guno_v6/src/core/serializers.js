/**
 * guno_v6/src/core/serializers.js
 * GUNO V6 GameState ↔ Supabase JSON 変換
 *
 * Supabase の game_states テーブルの state_json カラムに保存・復元するための
 * シリアライズ / デシリアライズ関数を提供する。
 *
 * state_json スキーマ（Supabase 保存形式）:
 *   {
 *     v:                number          // スキーマバージョン（現在: 1）
 *     deck:             CardSnapshot[]
 *     discardPile:      CardSnapshot[]
 *     players:          PlayerSnapshot[]
 *     mapState:         { [key: string]: number }
 *     lastHits:         { [lc: string]: number }
 *     teidenPlayed:     { [lc: string]: boolean }
 *     turnIndex:        number
 *     direction:        1 | -1
 *     gameOver:         boolean
 *     consecutivePasses: number
 *     turnCount:        number
 *     routeCodes:       string[]
 *     routeSize:        number
 *   }
 *
 * CardSnapshot: カードオブジェクトをそのまま保存（軽量化のため hub 値は省略可）
 * PlayerSnapshot: { name, icon, color, isHuman, status, guno, hand: CardSnapshot[] }
 */

const STATE_JSON_VERSION = 1;

// ===== シリアライズ =====

/**
 * GameState を Supabase 保存用の JSON オブジェクトに変換する。
 *
 * @param {GameState} state
 * @returns {object} state_json として保存可能なオブジェクト
 */
export function serializeState(state) {
  return {
    v: STATE_JSON_VERSION,
    deck:             state.deck.map(serializeCard),
    discardPile:      state.discardPile.map(serializeCard),
    players:          state.players.map(serializePlayer),
    mapState:         { ...state.mapState },
    lastHits:         { ...state.lastHits },
    teidenPlayed:     { ...state.teidenPlayed },
    turnIndex:        state.turnIndex,
    direction:        state.direction,
    gameOver:         state.gameOver,
    consecutivePasses: state.consecutivePasses,
    turnCount:        state.turnCount,
    routeCodes:       [...state.routeCodes],
    routeSize:        state.routeSize,
  };
}

/**
 * カードを保存用オブジェクトに変換する。
 * hub 値などの派生値は省略して軽量化する。
 *
 * @param {Card} card
 * @returns {CardSnapshot}
 */
function serializeCard(card) {
  if (card.type === "teiden") {
    return { id: card.id, type: "teiden", lc: card.lc, file: card.file, color: card.color };
  }
  return {
    id:     card.id,
    type:   card.type,
    lc:     card.lc,
    order:  card.order,
    st_ja:  card.st_ja,
    st_en:  card.st_en,
    color:  card.color,
    file:   card.file,
    name_ja: card.name_ja,
    name_en: card.name_en,
    // hub 値（ゲームロジックに必要なものだけ保持）
    hub_bonus_deck:  card.hub_bonus_deck  ?? 0,
    hub_degree_deck: card.hub_degree_deck ?? 1,
    hub_rank_deck:   card.hub_rank_deck   ?? "C",
  };
}

/**
 * プレイヤーを保存用オブジェクトに変換する。
 *
 * @param {Player} player
 * @returns {PlayerSnapshot}
 */
function serializePlayer(player) {
  return {
    name:    player.name,
    icon:    player.icon,
    color:   player.color,
    isHuman: player.isHuman,
    status:  player.status,
    guno:    player.guno,
    hand:    player.hand.map(serializeCard),
  };
}

// ===== デシリアライズ =====

/**
 * Supabase から取得した state_json を GameState に復元する。
 *
 * @param {object} json - state_json カラムの値
 * @returns {GameState}
 * @throws {Error} バージョン不一致時
 */
export function deserializeState(json) {
  if (!json || typeof json !== "object") {
    throw new Error("deserializeState: invalid json");
  }
  if (json.v !== STATE_JSON_VERSION) {
    throw new Error(`deserializeState: unsupported state_json version ${json.v} (expected ${STATE_JSON_VERSION})`);
  }

  return {
    deck:             (json.deck          || []).map(deserializeCard),
    discardPile:      (json.discardPile   || []).map(deserializeCard),
    players:          (json.players       || []).map(deserializePlayer),
    mapState:         { ...(json.mapState      || {}) },
    lastHits:         { ...(json.lastHits      || {}) },
    teidenPlayed:     { ...(json.teidenPlayed  || {}) },
    turnIndex:        json.turnIndex        ?? 0,
    direction:        json.direction        ?? 1,
    gameOver:         json.gameOver         ?? false,
    consecutivePasses: json.consecutivePasses ?? 0,
    turnCount:        json.turnCount        ?? 0,
    routeCodes:       [...(json.routeCodes  || [])],
    routeSize:        json.routeSize        ?? 10,
  };
}

/**
 * CardSnapshot を Card オブジェクトに復元する。
 *
 * @param {CardSnapshot} snap
 * @returns {Card}
 */
function deserializeCard(snap) {
  return { ...snap };
}

/**
 * PlayerSnapshot を Player オブジェクトに復元する。
 *
 * @param {PlayerSnapshot} snap
 * @returns {Player}
 */
function deserializePlayer(snap) {
  return {
    name:    snap.name    ?? "Player",
    icon:    snap.icon    ?? "👤",
    color:   snap.color   ?? "#888",
    isHuman: snap.isHuman ?? false,
    status:  snap.status  ?? "active",
    guno:    snap.guno    ?? 0,
    hand:    (snap.hand   || []).map(deserializeCard),
  };
}

// ===== 差分（Delta）生成 =====

/**
 * 前後の GameState から Supabase 更新用の差分オブジェクトを生成する。
 * game_states テーブルの各カラムに対応する。
 *
 * @param {GameState} state - 最新の GameState
 * @param {number} prevVersion - 現在の version カラムの値（楽観的ロック用）
 * @param {string} lastAction - 最後のアクション名（"play"|"draw"|"pass"|"start"）
 * @param {string} lastActorId - アクションを実行したプレイヤーの匿名 ID
 * @returns {object} game_states テーブルの UPDATE 用オブジェクト
 */
export function buildGameStateUpdate(state, prevVersion, lastAction, lastActorId) {
  return {
    state_json:       serializeState(state),
    turn_index:       state.turnIndex,
    turn_count:       state.turnCount,
    direction:        state.direction,
    game_over:        state.gameOver,
    last_action:      lastAction,
    last_actor_id:    lastActorId,
    version:          prevVersion + 1,
    updated_at:       new Date().toISOString(),
  };
}

/**
 * game_states テーブルの行から GameState を復元するショートカット。
 *
 * @param {object} row - Supabase の game_states テーブルの行
 * @returns {GameState}
 */
export function stateFromRow(row) {
  return deserializeState(row.state_json);
}
