/**
 * guno_v6/src/core/rules.js
 * GUNO V6 ゲームルール定数・プレイ可否判定
 *
 * UI・Supabase・DOM に一切依存しない純粋関数モジュール。
 *
 * 主な責務:
 *   - ゲームルール定数の定義
 *   - カードのプレイ可否判定（isPlayable / getPlayableIndices）
 *   - 停電カードのプレイ可否判定
 *   - ★（乗換駅）正規化ユーティリティ
 */

// ===== ルール定数 =====

/** 初期手札枚数 */
export const INITIAL_HAND_SIZE = 7;

/** GUNO達成時のボーナスポイント */
export const GUNO_POINT = 10;

/** 路線を完成させるために必要なスロット数 */
export const ROUTE_SIZE = 10;

/** 連続パス上限（全アクティブプレイヤー数 × 2 でゲーム終了） */
export const PASS_MULTIPLIER = 2;

/** 各路線の停電カード枚数（1枚ずつ） */
export const TEIDEN_COUNT_PER_ROUTE = 1;

/** 各駅カードのデッキ内コピー数 */
export const STATION_CARD_COPIES = 2;

// ===== ★正規化ユーティリティ =====

/**
 * ★プレフィックスを除去して正規化した駅名を返す。
 * @param {string} s
 * @returns {string}
 */
export function normStar(s) {
  return (s || "").replace(/^★+/, "").trim();
}

// ===== プレイ可否判定 =====

/**
 * 場の最上カードに対して、手札の1枚がプレイ可能かどうかを判定する。
 *
 * プレイ可能条件（V5 ルール準拠）:
 *   - 駅カード:
 *       (a) 同じ路線コード（lc が一致）
 *       (b) 同じ駅名（★を除いた名前が一致）
 *       (c) 同じ順番（order が一致）
 *   - 停電カード:
 *       手札が2枚以上、かつ
 *       (a) 場のカードも停電カード、または
 *       (b) 停電カードと場のカードの路線コードが一致
 *
 * @param {Card} card - 判定するカード
 * @param {Card} topCard - 場の最上カード
 * @param {Card[]} hand - プレイヤーの手札全体（停電カードの枚数チェック用）
 * @returns {boolean}
 */
export function isPlayable(card, topCard, hand) {
  if (!topCard) return false;

  if (card.type === "teiden") {
    // 停電カードは手札が2枚以上の場合のみプレイ可能
    if (hand.length <= 1) return false;
    return topCard.type === "teiden" || card.lc === topCard.lc;
  }

  // 駅カード
  if (card.lc === topCard.lc) return true;
  if (normStar(card.st_ja) === normStar(topCard.st_ja)) return true;
  if (topCard.type === "station" && card.order === topCard.order) return true;

  return false;
}

/**
 * プレイヤーの手札からプレイ可能なカードのインデックス配列を返す。
 *
 * @param {Card[]} hand - プレイヤーの手札
 * @param {Card|null} topCard - 場の最上カード（null の場合は空配列）
 * @returns {number[]}
 */
export function getPlayableIndices(hand, topCard) {
  if (!topCard) return [];
  return hand
    .map((card, i) => (isPlayable(card, topCard, hand) ? i : -1))
    .filter((i) => i !== -1);
}

/**
 * GUNO（路線完成）を達成しているかどうかを判定する。
 *
 * @param {string} lc - 路線コード
 * @param {MapState} mapState - マップ状態（key: "LC-order" → owner idx | -1 | undefined）
 * @param {number} routeSize - 路線のスロット数（デフォルト: ROUTE_SIZE）
 * @returns {boolean}
 */
export function isGunoComplete(lc, mapState, routeSize = ROUTE_SIZE) {
  for (let i = 1; i <= routeSize; i++) {
    const owner = mapState[`${lc}-${i}`];
    if (owner === undefined || owner === -1) return false;
  }
  return true;
}

/**
 * ゲーム終了条件を判定する。
 *
 * 終了条件:
 *   (a) アクティブプレイヤーが1人以下
 *   (b) 全 GUNO 数が路線数に達した（全路線完成）
 *   (c) 連続パス数が上限を超えた
 *
 * @param {object} params
 * @param {Player[]} params.players
 * @param {number} params.totalGuno
 * @param {number} params.routeCount - デッキ内の路線数
 * @param {number} params.consecutivePasses
 * @returns {{ over: boolean, reason: string|null }}
 */
export function checkGameOver({ players, totalGuno, routeCount, consecutivePasses }) {
  const activePlayers = players.filter((p) => p.status === "active");

  if (activePlayers.length <= 1) {
    return { over: true, reason: "players_eliminated" };
  }
  if (totalGuno >= routeCount) {
    return { over: true, reason: "all_routes_complete" };
  }
  if (consecutivePasses >= activePlayers.length * PASS_MULTIPLIER) {
    return { over: true, reason: "no_playable_cards" };
  }
  return { over: false, reason: null };
}

/**
 * プレイヤーのスコアを計算する。
 *
 * スコア = GUNO 数 × GUNO_POINT + 所有駅スロット数
 *
 * @param {Player} player
 * @param {number} playerIdx
 * @param {MapState} mapState
 * @returns {number}
 */
export function calcScore(player, playerIdx, mapState) {
  const stCount = Object.values(mapState).filter((owner) => owner === playerIdx).length;
  return player.guno * GUNO_POINT + stCount;
}

/**
 * 全プレイヤーのランキングを返す（スコア降順、生存者優先）。
 *
 * @param {Player[]} players
 * @param {MapState} mapState
 * @returns {RankEntry[]}
 */
export function calcRanking(players, mapState) {
  return players
    .map((p, idx) => {
      const stCount = Object.values(mapState).filter((owner) => owner === idx).length;
      const gunoPts = p.guno * GUNO_POINT;
      const total = gunoPts + stCount;
      const isAlive = p.status !== "eliminated";
      return { playerIdx: idx, player: p, stCount, gunoPts, total, isAlive };
    })
    .sort((a, b) => {
      // 生存者優先
      if (a.isAlive !== b.isAlive) return (b.isAlive ? 1 : 0) - (a.isAlive ? 1 : 0);
      return b.total - a.total;
    });
}
