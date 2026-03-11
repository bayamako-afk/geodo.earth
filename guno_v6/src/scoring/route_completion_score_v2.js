/**
 * route_completion_score_v2.js
 * GUNO V6 — Route Completion Scoring Module v2
 *
 * v1 からの改善点:
 *   1. 段階的部分ボーナス（3/10, 5/10, 7/10 の閾値で段階的に増加）
 *   2. 連続占有ボーナス（同一路線で隣接する order を連続占有した場合）
 *   3. 路線難易度係数（routeTotal が大きい路線ほど高ボーナス）
 *
 * 使用方法:
 *   import { computeRouteScoreV2Sync } from './route_completion_score_v2.js';
 *   const result = computeRouteScoreV2Sync(playerStations, stationLines, linesMaster, ownedSlots);
 *
 * ownedSlots (オプション):
 *   { [lc]: Set<number> }  — プレイヤーが占有している各路線のスロット order の集合
 *   連続占有ボーナスを計算するために必要。省略時は連続ボーナスなし。
 *   ※ ゲームエンジン統合時は mapState から生成する。
 */

// ─────────────────────────────────────────────────────────────────────────────
// ボーナステーブル定義
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 路線の総駅数（routeTotal）に基づく難易度係数を返す。
 * 駅数が多い路線ほど完成が難しいため、高い係数を与える。
 *
 * @param {number} routeTotal
 * @returns {number} 難易度係数（1.0〜1.5）
 */
function getDifficultyMultiplier(routeTotal) {
  if (routeTotal >= 10) return 1.5;
  if (routeTotal >= 8)  return 1.3;
  if (routeTotal >= 6)  return 1.1;
  return 1.0;
}

/**
 * 段階的部分ボーナスを計算する。
 * count / routeTotal の比率に応じて段階的にボーナスを与える。
 *
 * 閾値設計（routeTotal = 10 の場合）:
 *   - 完全（10/10）: full_bonus × difficulty
 *   - 高部分（7/10）: tier3_bonus × difficulty
 *   - 中部分（5/10）: tier2_bonus × difficulty
 *   - 低部分（3/10）: tier1_bonus × difficulty
 *   - それ以下: 0
 *
 * @param {number} count - プレイヤーが占有している駅数
 * @param {number} routeTotal - 路線の総駅数
 * @returns {{ bonus: number, tier: 'complete'|'tier3'|'tier2'|'tier1'|'none' }}
 */
function calcTieredBonus(count, routeTotal) {
  const ratio = count / routeTotal;
  const diff  = getDifficultyMultiplier(routeTotal);

  // ベースボーナス値（routeTotal >= 10 の場合）
  // full: 20, tier3(70%): 12, tier2(50%): 6, tier1(30%): 2
  let baseValues;
  if (routeTotal >= 10) {
    baseValues = { full: 20, tier3: 12, tier2: 6, tier1: 2 };
  } else if (routeTotal >= 8) {
    baseValues = { full: 15, tier3: 9,  tier2: 4, tier1: 1 };
  } else if (routeTotal >= 6) {
    baseValues = { full: 10, tier3: 6,  tier2: 3, tier1: 1 };
  } else {
    baseValues = { full: 0,  tier3: 0,  tier2: 0, tier1: 0 };
  }

  if (ratio >= 1.0) {
    return { bonus: Math.round(baseValues.full * diff), tier: 'complete' };
  } else if (ratio >= 0.7) {
    return { bonus: Math.round(baseValues.tier3 * diff), tier: 'tier3' };
  } else if (ratio >= 0.5) {
    return { bonus: Math.round(baseValues.tier2 * diff), tier: 'tier2' };
  } else if (ratio >= 0.3) {
    return { bonus: Math.round(baseValues.tier1 * diff), tier: 'tier1' };
  }
  return { bonus: 0, tier: 'none' };
}

/**
 * 連続占有ボーナスを計算する。
 * 同一路線で連続する order を占有している場合にボーナスを与える。
 *
 * 設計:
 *   - 連続2駅: +1pt
 *   - 連続3駅: +2pt（追加）
 *   - 連続4駅以上: +3pt（追加）
 *   ※ 連続チェーンが重複しないように最長連続を優先する
 *
 * @param {Set<number>} ownedOrders - 占有している order の集合
 * @param {number} routeTotal - 路線の総駅数
 * @returns {{ bonus: number, max_chain: number, chains: number[] }}
 */
function calcConsecutiveBonus(ownedOrders, routeTotal) {
  if (!ownedOrders || ownedOrders.size < 2) {
    return { bonus: 0, max_chain: ownedOrders?.size || 0, chains: [] };
  }

  // order を昇順にソート
  const sorted = [...ownedOrders].sort((a, b) => a - b);

  // 連続チェーンを検出
  const chains = [];
  let chainStart = sorted[0];
  let chainLen   = 1;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      chainLen++;
    } else {
      if (chainLen >= 2) chains.push(chainLen);
      chainStart = sorted[i];
      chainLen   = 1;
    }
  }
  if (chainLen >= 2) chains.push(chainLen);

  // ボーナス計算（各チェーンのボーナスを合計）
  let totalBonus = 0;
  for (const len of chains) {
    if (len >= 4) totalBonus += 3;
    else if (len === 3) totalBonus += 2;
    else if (len === 2) totalBonus += 1;
  }

  const maxChain = chains.length > 0 ? Math.max(...chains) : (sorted.length > 0 ? 1 : 0);

  return { bonus: totalBonus, max_chain: maxChain, chains };
}

// ─────────────────────────────────────────────────────────────────────────────
// コアスコアリング関数（同期版）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * route_completion_score v2 の同期版。
 *
 * @param {string[]} playerStations  - station_global_id の配列（v1 互換のため維持）
 * @param {Object[]} stationLines    - station_lines_tokyo.json の配列
 * @param {Object[]} linesMaster     - lines_tokyo_master.json の配列
 * @param {Object}   [ownedSlots]    - { [lc]: Set<number> } プレイヤーが占有している各路線のスロット order
 * @returns {Object} スコア結果
 */
export function computeRouteScoreV2Sync(playerStations, stationLines, linesMaster, ownedSlots) {
  if (!Array.isArray(playerStations) || playerStations.length === 0) {
    return {
      route_bonus: 0,
      consecutive_bonus: 0,
      total_route_bonus: 0,
      completed_routes: [],
      partial_routes: [],
      route_details: [],
    };
  }

  // ── データ構築 ──────────────────────────────────────────────────────────────

  // line_id → { line_name, line_name_en, station_count }
  const lineInfo = {};
  for (const line of linesMaster) {
    lineInfo[line.line_id] = {
      line_name:     line.line_name,
      line_name_en:  line.line_name_en,
      station_count: line.station_count,
    };
  }

  // station_global_id → [line_id, ...]
  const stationToLines = {};
  for (const record of stationLines) {
    const sid = record.station_global_id;
    if (!stationToLines[sid]) stationToLines[sid] = [];
    stationToLines[sid].push(record.line_id);
  }

  // line_id → Set<station_global_id>
  const routeStations = {};
  for (const record of stationLines) {
    const lid = record.line_id;
    if (!routeStations[lid]) routeStations[lid] = new Set();
    routeStations[lid].add(record.station_global_id);
  }

  // プレイヤーが持つ各路線の駅数をカウント
  const routeCounts = {};
  for (const sid of playerStations) {
    const lines = stationToLines[sid];
    if (!lines) continue;
    for (const lid of lines) {
      routeCounts[lid] = (routeCounts[lid] || 0) + 1;
    }
  }

  // ── スコア計算 ──────────────────────────────────────────────────────────────

  let totalRouteBonus     = 0;
  let totalConsecutiveBonus = 0;
  const completedRoutes   = [];
  const partialRoutes     = [];
  const routeDetails      = [];

  for (const [lineId, count] of Object.entries(routeCounts)) {
    const routeTotal = routeStations[lineId] ? routeStations[lineId].size : 0;
    const info       = lineInfo[lineId] || {};

    // 段階的部分ボーナス
    const { bonus: routeBonus, tier } = calcTieredBonus(count, routeTotal);

    // 連続占有ボーナス（ownedSlots が提供されている場合のみ）
    const ownedOrdersForLine = ownedSlots?.[lineId];
    const { bonus: consBonus, max_chain, chains } = calcConsecutiveBonus(ownedOrdersForLine, routeTotal);

    totalRouteBonus      += routeBonus;
    totalConsecutiveBonus += consBonus;

    // 完成・部分ルートの分類
    if (tier === 'complete') {
      completedRoutes.push(info.line_name_en || lineId);
    } else if (tier !== 'none') {
      partialRoutes.push(info.line_name_en || lineId);
    }

    routeDetails.push({
      line_id:           lineId,
      line_name:         info.line_name     || lineId,
      line_name_en:      info.line_name_en  || lineId,
      count,
      route_total:       routeTotal,
      ratio:             routeTotal > 0 ? (count / routeTotal) : 0,
      tier,
      route_bonus:       routeBonus,
      consecutive_bonus: consBonus,
      total_bonus:       routeBonus + consBonus,
      max_chain,
      chains,
      difficulty:        getDifficultyMultiplier(routeTotal),
    });
  }

  // 詳細をボーナス降順でソート
  routeDetails.sort((a, b) => b.total_bonus - a.total_bonus || b.count - a.count);

  const totalBonus = totalRouteBonus + totalConsecutiveBonus;

  return {
    route_bonus:        totalRouteBonus,
    consecutive_bonus:  totalConsecutiveBonus,
    total_route_bonus:  totalBonus,
    completed_routes:   completedRoutes,
    partial_routes:     partialRoutes,
    route_details:      routeDetails,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// mapState からの ownedSlots 変換ユーティリティ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * game_engine の mapState から特定プレイヤーの ownedSlots を生成する。
 *
 * @param {Object} mapState - { "LC-order": playerIdx | -1 }
 * @param {number} playerIdx - 対象プレイヤーのインデックス
 * @returns {{ [lc: string]: Set<number> }}
 */
export function buildOwnedSlotsFromMapState(mapState, playerIdx) {
  const ownedSlots = {};
  for (const [key, owner] of Object.entries(mapState)) {
    if (owner !== playerIdx) continue;
    const dashIdx = key.lastIndexOf('-');
    if (dashIdx === -1) continue;
    const lc    = key.slice(0, dashIdx);
    const order = parseInt(key.slice(dashIdx + 1), 10);
    if (isNaN(order)) continue;
    if (!ownedSlots[lc]) ownedSlots[lc] = new Set();
    ownedSlots[lc].add(order);
  }
  return ownedSlots;
}

// ─────────────────────────────────────────────────────────────────────────────
// mapState ベースの直接スコアリング（ゲームエンジン統合用）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mapState から直接スコアを計算する（ゲームエンジン統合版）。
 * station_lines / linesMaster は不要。
 * packData の routes から路線情報を取得する。
 *
 * @param {Object} mapState   - { "LC-order": playerIdx | -1 }
 * @param {number} playerIdx  - 対象プレイヤーのインデックス
 * @param {Object} packData   - pack_loader.js の PackData
 * @returns {Object} スコア結果
 */
export function computeRouteScoreFromMapState(mapState, playerIdx, packData) {
  if (!mapState || !packData) {
    return {
      route_bonus: 0,
      consecutive_bonus: 0,
      total_route_bonus: 0,
      completed_routes: [],
      partial_routes: [],
      route_details: [],
    };
  }

  let totalRouteBonus       = 0;
  let totalConsecutiveBonus = 0;
  const completedRoutes     = [];
  const partialRoutes       = [];
  const routeDetails        = [];

  for (const route of packData.routes) {
    const lc         = route.lc;
    const routeTotal = route.size || 10;

    // プレイヤーが占有している order の集合
    const ownedOrders = new Set();
    for (let order = 1; order <= routeTotal; order++) {
      const key = `${lc}-${order}`;
      if (mapState[key] === playerIdx) {
        ownedOrders.add(order);
      }
    }

    const count = ownedOrders.size;
    if (count === 0) continue;

    // 段階的部分ボーナス
    const { bonus: routeBonus, tier } = calcTieredBonus(count, routeTotal);

    // 連続占有ボーナス
    const { bonus: consBonus, max_chain, chains } = calcConsecutiveBonus(ownedOrders, routeTotal);

    totalRouteBonus       += routeBonus;
    totalConsecutiveBonus += consBonus;

    if (tier === 'complete') {
      completedRoutes.push(route.name_en || lc);
    } else if (tier !== 'none') {
      partialRoutes.push(route.name_en || lc);
    }

    routeDetails.push({
      line_id:           lc,
      line_name:         route.name_ja || lc,
      line_name_en:      route.name_en || lc,
      count,
      route_total:       routeTotal,
      ratio:             count / routeTotal,
      tier,
      route_bonus:       routeBonus,
      consecutive_bonus: consBonus,
      total_bonus:       routeBonus + consBonus,
      max_chain,
      chains,
      difficulty:        getDifficultyMultiplier(routeTotal),
    });
  }

  routeDetails.sort((a, b) => b.total_bonus - a.total_bonus || b.count - a.count);

  return {
    route_bonus:        totalRouteBonus,
    consecutive_bonus:  totalConsecutiveBonus,
    total_route_bonus:  totalRouteBonus + totalConsecutiveBonus,
    completed_routes:   completedRoutes,
    partial_routes:     partialRoutes,
    route_details:      routeDetails,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 非同期版（ブラウザ向け）
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATION_LINES_PATH = '../../data/master/station_lines_tokyo.json';
const DEFAULT_LINES_MASTER_PATH  = '../../data/master/lines_tokyo_master.json';

let _stationLinesCache = null;
let _linesMasterCache  = null;

/**
 * route_completion_score v2 の非同期版。
 *
 * @param {string[]} playerStations
 * @param {Object}   [options]
 * @param {Object}   [options.stationLines]  Pre-loaded station_lines data
 * @param {Object}   [options.linesMaster]   Pre-loaded lines_master data
 * @param {Object}   [options.ownedSlots]    { [lc]: Set<number> }
 * @returns {Promise<Object>}
 */
export async function computeRouteScoreV2(playerStations, options = {}) {
  const stationLines = options.stationLines || await (async () => {
    if (_stationLinesCache) return _stationLinesCache;
    const url = options.baseUrl
      ? `${options.baseUrl}data/master/station_lines_tokyo.json`
      : DEFAULT_STATION_LINES_PATH;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load station_lines_tokyo.json');
    _stationLinesCache = await res.json();
    return _stationLinesCache;
  })();

  const linesMaster = options.linesMaster || await (async () => {
    if (_linesMasterCache) return _linesMasterCache;
    const url = options.baseUrl
      ? `${options.baseUrl}data/master/lines_tokyo_master.json`
      : DEFAULT_LINES_MASTER_PATH;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load lines_tokyo_master.json');
    _linesMasterCache = await res.json();
    return _linesMasterCache;
  })();

  return computeRouteScoreV2Sync(playerStations, stationLines, linesMaster, options.ownedSlots);
}

// ─────────────────────────────────────────────────────────────────────────────
// ボーナステーブルのエクスポート（テスト・デバッグ用）
// ─────────────────────────────────────────────────────────────────────────────

export { calcTieredBonus, calcConsecutiveBonus, getDifficultyMultiplier };
