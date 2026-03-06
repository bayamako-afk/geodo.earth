/**
 * guno_v6/src/core/scoring.js
 * GUNO V6 スコアリングモジュール
 *
 * UI・Supabase・DOM に一切依存しない純粋関数モジュール。
 *
 * 引き継ぎ書 Phase 4 の方針:
 *   - ゲーム内スコアには `hub_bonus_deck` を使用する
 *   - `hub_bonus_global` は統計情報としてのみ扱い、スコアには影響させない
 *
 * スコア構成（V5 互換 + Hub 拡張）:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Total Score = GUNO Points + Station Points + Hub Bonus     │
 *   │                                                             │
 *   │  GUNO Points   = guno_count × GUNO_POINT (10)              │
 *   │  Station Points = 所有スロット数（1スロット = 1pt）          │
 *   │  Hub Bonus     = 所有駅の hub_bonus_deck の合計             │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * 後方互換性:
 *   - `calcScore(player, playerIdx, mapState)` は rules.js の同名関数と同じシグネチャ
 *   - Hub Bonus なしの V5 互換スコアは `calcScoreV5Compat()` で取得可能
 */

import { GUNO_POINT } from "./rules.js";

// ===== スコアリング定数 =====

/** 1スロット所有あたりの基本ポイント */
export const STATION_POINT = 1;

/** Hub ランクの表示名マッピング */
export const HUB_RANK_LABEL = {
  S: "超主要駅",
  A: "主要駅",
  B: "乗換駅",
  C: "通常駅",
};

// ===== 内部ヘルパー =====

/**
 * mapState から指定プレイヤーが所有するスロットキー一覧を返す。
 *
 * @param {number} playerIdx
 * @param {MapState} mapState
 * @returns {string[]}
 */
function ownedKeys(playerIdx, mapState) {
  return Object.entries(mapState)
    .filter(([, owner]) => owner === playerIdx)
    .map(([key]) => key);
}

/**
 * スロットキー（"LC-order"）から路線コードと順番を分解する。
 *
 * @param {string} key
 * @returns {{ lc: string, order: number }}
 */
function parseKey(key) {
  const idx = key.lastIndexOf("-");
  return { lc: key.slice(0, idx), order: parseInt(key.slice(idx + 1), 10) };
}

// ===== メインスコアリング =====

/**
 * プレイヤーの詳細スコアを計算する（Hub Bonus 込み）。
 *
 * @param {object} params
 * @param {Player}   params.player     - プレイヤーオブジェクト
 * @param {number}   params.playerIdx  - プレイヤーインデックス
 * @param {MapState} params.mapState   - マップ状態
 * @param {Card[]}   [params.stationsDB] - 全駅カードの配列（hub_bonus_deck 取得用）
 *                                        省略時は Hub Bonus = 0
 * @returns {ScoreDetail}
 */
export function calcScoreDetail({ player, playerIdx, mapState, stationsDB = [] }) {
  const keys = ownedKeys(playerIdx, mapState);

  // 駅ポイント（スロット数 × STATION_POINT）
  const stationPoints = keys.length * STATION_POINT;

  // GUNO ポイント
  const gunoPoints = player.guno * GUNO_POINT;

  // Hub Bonus（hub_bonus_deck の合計）
  let hubBonus = 0;
  const hubDetails = [];

  if (stationsDB.length > 0) {
    for (const key of keys) {
      const { lc, order } = parseKey(key);
      const st = stationsDB.find((s) => s.lc === lc && s.order === order);
      if (st && st.hub_bonus_deck > 0) {
        hubBonus += st.hub_bonus_deck;
        hubDetails.push({
          key,
          lc,
          order,
          st_ja: st.st_ja,
          st_en: st.st_en,
          hub_bonus_deck: st.hub_bonus_deck,
          hub_rank_deck:  st.hub_rank_deck ?? "C",
        });
      }
    }
  }

  const total = gunoPoints + stationPoints + hubBonus;

  return {
    playerIdx,
    playerName:    player.name,
    playerIcon:    player.icon,
    playerColor:   player.color,
    isAlive:       player.status !== "eliminated",
    guno:          player.guno,
    gunoPoints,
    stationCount:  keys.length,
    stationPoints,
    hubBonus,
    hubDetails,
    total,
  };
}

/**
 * V5 互換スコアを計算する（Hub Bonus なし）。
 * rules.js の calcScore() と同等。
 *
 * @param {Player}   player
 * @param {number}   playerIdx
 * @param {MapState} mapState
 * @returns {number}
 */
export function calcScoreV5Compat(player, playerIdx, mapState) {
  const stCount = Object.values(mapState).filter((owner) => owner === playerIdx).length;
  return player.guno * GUNO_POINT + stCount;
}

/**
 * プレイヤーのスコアを計算する（Hub Bonus 込みの合計値のみ）。
 * game_engine.js から呼び出す際のシンプルな API。
 *
 * @param {Player}   player
 * @param {number}   playerIdx
 * @param {MapState} mapState
 * @param {Card[]}   [stationsDB]
 * @returns {number}
 */
export function calcScore(player, playerIdx, mapState, stationsDB = []) {
  return calcScoreDetail({ player, playerIdx, mapState, stationsDB }).total;
}

// ===== ランキング =====

/**
 * 全プレイヤーのランキングを計算する（Hub Bonus 込み）。
 *
 * ソート順:
 *   1. 生存者優先（eliminated は後ろ）
 *   2. total スコア降順
 *   3. GUNO 数降順（同点時）
 *   4. 駅数降順（同点時）
 *
 * @param {Player[]}  players
 * @param {MapState}  mapState
 * @param {Card[]}    [stationsDB]
 * @returns {RankEntry[]}
 */
export function calcRanking(players, mapState, stationsDB = []) {
  return players
    .map((player, playerIdx) =>
      calcScoreDetail({ player, playerIdx, mapState, stationsDB })
    )
    .sort((a, b) => {
      // 生存者優先
      if (a.isAlive !== b.isAlive) return b.isAlive ? 1 : -1;
      // スコア降順
      if (b.total !== a.total) return b.total - a.total;
      // GUNO 数降順（同点時）
      if (b.guno !== a.guno) return b.guno - a.guno;
      // 駅数降順（同点時）
      return b.stationCount - a.stationCount;
    })
    .map((entry, rank) => ({ ...entry, rank: rank + 1 }));
}

// ===== 路線別スコア集計 =====

/**
 * 路線ごとの所有状況と GUNO 達成者を集計する。
 *
 * @param {string[]}  routeCodes
 * @param {MapState}  mapState
 * @param {object}    lastHits   - { [lc]: playerIdx }
 * @param {Player[]}  players
 * @param {number}    [routeSize=10]
 * @returns {RouteStats[]}
 */
export function calcRouteStats(routeCodes, mapState, lastHits, players, routeSize = 10) {
  return routeCodes.map((lc) => {
    const ownerCounts = {};
    let filledSlots = 0;

    for (let i = 1; i <= routeSize; i++) {
      const owner = mapState[`${lc}-${i}`];
      if (owner !== undefined && owner !== -1) {
        filledSlots++;
        ownerCounts[owner] = (ownerCounts[owner] ?? 0) + 1;
      }
    }

    const dominantIdx = Object.entries(ownerCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    return {
      lc,
      filledSlots,
      totalSlots: routeSize,
      completionRate: filledSlots / routeSize,
      gunoAchiever: lastHits[lc] !== undefined ? players[lastHits[lc]] : null,
      gunoAchieverIdx: lastHits[lc] ?? null,
      dominantPlayerIdx: dominantIdx !== undefined ? parseInt(dominantIdx, 10) : null,
      ownerCounts: Object.fromEntries(
        Object.entries(ownerCounts).map(([k, v]) => [parseInt(k, 10), v])
      ),
    };
  });
}

// ===== ゲーム統計 =====

/**
 * ゲーム終了時の統計情報を生成する。
 *
 * @param {GameState} state
 * @param {Card[]}    [stationsDB]
 * @returns {GameStats}
 */
export function buildGameStats(state, stationsDB = []) {
  const ranking = calcRanking(state.players, state.mapState, stationsDB);
  const routeStats = calcRouteStats(
    state.routeCodes,
    state.mapState,
    state.lastHits,
    state.players,
    state.routeSize
  );

  const totalCards = state.deck.length + state.discardPile.length +
    state.players.reduce((sum, p) => sum + p.hand.length, 0);

  return {
    turnCount:    state.turnCount,
    totalCards,
    deckRemaining: state.deck.length,
    ranking,
    routeStats,
    winner: ranking[0] ?? null,
    gunoCount: Object.keys(state.lastHits).length,
  };
}
