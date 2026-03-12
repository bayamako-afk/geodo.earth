/**
 * game_simulator_v3.js
 * GUNO V6 — Turn-Based Game Simulator (v3)
 *
 * v3 の設計方針:
 *   - game_engine.js を唯一の真実の源として使用する
 *   - v2 のドラフト方式（プール選択）ではなく、実際のターン制ゲームをシミュレートする
 *   - 戦略別 AI（hub / route / balanced / greedy）を game_engine の runCpuTurn に差し込む
 *   - 各戦略の勝率・平均スコア・路線完成率を集計する
 *
 * 戦略定義:
 *   - greedy:   プレイ可能カードの中でスコアが最も高いカードを選ぶ（デフォルトCPU）
 *   - hub:      hub_bonus_deck が高いカードを優先する
 *   - route:    同じ路線のカードを優先し、路線完成を狙う
 *   - balanced: スコア・hub・route のバランスを取る
 *   - random:   ランダムに選ぶ（ベースライン）
 *
 * 使用方法 (Node.js):
 *   import { runSimulatorV3Sync } from './game_simulator_v3.js';
 *   const result = runSimulatorV3Sync(500, packData);
 */

import {
  initGame,
  makeDeck,
  playCard,
  drawCard,
  passTurn,
  endTurn,
  runCpuTurn,
  calcScore,
  calcRanking,
  GUNO_POINT,
  ROUTE_SIZE,
} from '../core/game_engine.js';

import {
  getPlayableIndices,
  isPlayable,
} from '../core/rules.js';
import {
  computeRouteScoreFromMapState,
} from '../scoring/route_completion_score_v2.js';
import {
  computeNetworkScoreFromMapState,
} from '../scoring/network_score.js';

// ─────────────────────────────────────────────────────────────────────────────
// 戦略定義
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 各戦略の評価関数。
 * card: Card, hand: Card[], mapState: MapState, playerIdx: number, state: GameState
 * → number (高いほど優先)
 */
const STRATEGY_EVALUATORS = {
  /**
   * greedy: スコア（hub_bonus_deck + order）が最大のカードを選ぶ
   * game_engine の runCpuTurn と同等のデフォルト動作
   */
  greedy: (card) => {
    const hubBonus = card.hub_bonus_deck || 0;
    return hubBonus * 2 + (card.order || 0);
  },

  /**
   * hub: hub_bonus_deck を最大化する（ハブ駅を積極的に取る）
   */
  hub: (card) => {
    const hubBonus = card.hub_bonus_deck || 0;
    const hubDegree = card.hub_degree_deck || 0;
    return hubBonus * 3 + hubDegree * 2;
  },

  /**
   * route v2: セグメント拡張・完成率・連続ブロック長を考慮した改善版
   *
   * 評価軸:
   *   1. adjacency_bonus: 既存の連続ブロックに隣接する駅（order±1）を優先
   *   2. completion_bonus: 完成に近い路線（残り駅数が少ない）を優先
   *   3. block_length_bonus: 既存の最長連続ブロックを延ばす方向を優先
   *   4. owned_count_bonus: 既に多く持っている路線のカードを補助的に優先
   */
  route: (card, hand, mapState, playerIdx, state) => {
    const lc = card.lc;
    const order = card.order || 0;
    // 自分が占有している全スロットを路線別に整理
    const ownedByLine = {};   // lc → Set<order>
    for (const [key, owner] of Object.entries(mapState)) {
      if (owner === playerIdx) {
        const [linecode, ord] = key.split('-');
        if (!ownedByLine[linecode]) ownedByLine[linecode] = new Set();
        ownedByLine[linecode].add(Number(ord));
      }
    }
    const ownedOrders = ownedByLine[lc] || new Set();
    // 1. adjacency_bonus: 既存占有駅の order±1 に隣接しているか
    let adjacencyBonus = 0;
    if (ownedOrders.has(order - 1) || ownedOrders.has(order + 1)) {
      adjacencyBonus = 20;
      // さらに両側に隣接（ブロックの中間を埋める）場合は追加ボーナス
      if (ownedOrders.has(order - 1) && ownedOrders.has(order + 1)) {
        adjacencyBonus = 30;
      }
    }
    // 2. completion_bonus: 路線の残り駅数が少ないほど高い
    //    routeSize は state.routeCodes から取得（なければ10と仮定）
    const routeSize = (state && state.routeCodes)
      ? Object.keys(mapState).filter(k => k.startsWith(lc + '-')).length
      : 10;
    const ownedCount = ownedOrders.size;
    const remaining = routeSize - ownedCount;
    // remaining が 0〜3 のとき高ボーナス（完成間近）
    const completionBonus = remaining <= 0 ? 0
      : remaining === 1 ? 25
      : remaining === 2 ? 18
      : remaining === 3 ? 12
      : remaining <= 5 ? 8
      : ownedCount * 2;  // まだ序盤は所有数に比例
    // 3. block_length_bonus: 最長連続ブロックを計算して延ばす方向を優先
    let maxBlock = 0;
    if (ownedOrders.size > 0) {
      const sorted = [...ownedOrders].sort((a, b) => a - b);
      let cur = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) { cur++; }
        else { cur = 1; }
        if (cur > maxBlock) maxBlock = cur;
      }
      if (maxBlock === 0) maxBlock = 1;
    }
    // このカードを置いたときに最長ブロックが伸びるか
    const wouldExtendBlock = ownedOrders.has(order - 1) || ownedOrders.has(order + 1);
    const blockBonus = wouldExtendBlock ? maxBlock * 3 : 0;
    // 4. owned_count_bonus: 補助的な所有数ボーナス
    const ownedCountBonus = ownedCount * 1.5;
    return adjacencyBonus + completionBonus + blockBonus + ownedCountBonus
      + (card.hub_bonus_deck || 0) * 0.5;
  },

  /**
   * balanced: スコア・hub・route のバランスを取る
   */
  balanced: (card, hand, mapState, playerIdx) => {
    const hubBonus = card.hub_bonus_deck || 0;
    const ownedByLine = {};
    for (const [key, owner] of Object.entries(mapState)) {
      if (owner === playerIdx) {
        const lc = key.split('-')[0];
        ownedByLine[lc] = (ownedByLine[lc] || 0) + 1;
      }
    }
    const sameLineCount = ownedByLine[card.lc] || 0;
    return hubBonus * 1.5 + sameLineCount * 2 + (card.order || 0) * 0.5;
  },

  /**
   * random: ランダムに選ぶ（ベースライン）
   */
  random: () => Math.random(),
};

// ─────────────────────────────────────────────────────────────────────────────
// 戦略付き CPU ターン実行
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 戦略を使って CPU ターンを実行する。
 * game_engine の runCpuTurn を戦略対応版に置き換える。
 *
 * @param {GameState} state
 * @param {string} strategy - 'greedy' | 'hub' | 'route' | 'balanced' | 'random'
 * @param {function} emit
 * @returns {{ action: string }}
 */
function runStrategyTurn(state, strategy, emit) {
  if (state.gameOver) return { action: 'none' };

  const pIdx = state.turnIndex;
  const p = state.players[pIdx];
  if (p.status !== 'active') return { action: 'skip' };

  const topCard = state.discardPile[state.discardPile.length - 1];
  const playableIndices = getPlayableIndices(p.hand, topCard);

  if (playableIndices.length > 0) {
    // 戦略に基づいてカードを選ぶ
    const evaluator = STRATEGY_EVALUATORS[strategy] || STRATEGY_EVALUATORS.greedy;
    let bestIdx = playableIndices[0];
    let bestScore = -Infinity;

    for (const idx of playableIndices) {
      const card = p.hand[idx];
      const score = evaluator(card, p.hand, state.mapState, pIdx, state);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    playCard(state, pIdx, bestIdx, emit);
    return { action: 'play' };
  }

  // プレイできない場合はドロー
  if (state.deck.length > 0) {
    const result = drawCard(state, pIdx, emit);
    if (result.ok) {
      // ドロー後に出せるか再チェック（戦略適用）
      const topCard2 = state.discardPile[state.discardPile.length - 1];
      const playableAfterDraw = getPlayableIndices(p.hand, topCard2);
      if (playableAfterDraw.length > 0) {
        const evaluator = STRATEGY_EVALUATORS[strategy] || STRATEGY_EVALUATORS.greedy;
        let bestIdx = playableAfterDraw[0];
        let bestScore = -Infinity;
        for (const idx of playableAfterDraw) {
          const card = p.hand[idx];
          const score = evaluator(card, p.hand, state.mapState, pIdx, state);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = idx;
          }
        }
        playCard(state, pIdx, bestIdx, emit);
        return { action: 'draw_then_play' };
      }
      state.consecutivePasses++;
    }
    return { action: 'draw' };
  }

  // デッキも空の場合はパス
  passTurn(state, pIdx, emit);
  return { action: 'pass' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1ゲームシミュレーション
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1ゲームをシミュレートする。
 *
 * @param {Object[]} playerConfigs - [{ id, name, strategy }]
 * @param {Object} packData - pack_loader.js の PackData
 * @param {Object} [options]
 * @param {number} [options.maxTurns=500] - 無限ループ防止の最大ターン数
 * @returns {Object} ゲーム結果
 */
function simulateSingleGameV3(playerConfigs, packData, options = {}) {
  const maxTurns = options.maxTurns || 500;

  // イベントログ（デバッグ用、通常は無効）
  const events = [];
  let endReason = 'unknown';
  const emit = (e) => {
    if (e.type === 'game_over') endReason = e.reason || 'unknown';
    if (options.logEvents) events.push(e);
  };

  // ゲーム初期化
  const state = initGame({
    packData,
    playerConfigs: playerConfigs.map(p => ({
      name:    p.name || p.id,
      icon:    p.icon || '🤖',
      color:   p.color || '#888',
      isHuman: false,
    })),
  });

  // ターン制シミュレーション
  let safetyCounter = 0;
  while (!state.gameOver && safetyCounter < maxTurns) {
    safetyCounter++;
    const pIdx = state.turnIndex;
    const strategy = playerConfigs[pIdx]?.strategy || 'greedy';

    runStrategyTurn(state, strategy, emit);

    if (!state.gameOver) {
      endTurn(state, emit);
    }
  }

   // スコア計算（ランキング）
  const ranking = calcRanking(state.players, state.mapState);
  // station_graph（Network Score 用）は options から取得、なければ null
  const stationGraph = options.stationGraph || null;
  // 各プレイヤーの結果を構築
  const results = playerConfigs.map((cfg, idx) => {
    const p = state.players[idx];
    const stCount = Object.values(state.mapState).filter(o => o === idx).length;
    const gunoPts = p.guno * GUNO_POINT;
    // Route Completion Score v2
    const routeScore = computeRouteScoreFromMapState(state.mapState, idx, packData);
    // Network Score（stationGraph が提供されている場合のみ）
    const netScore = stationGraph
      ? computeNetworkScoreFromMapState(state.mapState, idx, packData, stationGraph)
      : { network_bonus: 0, max_component_size: 0, total_connected_stations: 0 };
    // 合計スコア（基本 + GUNO + 路線完成 + ネットワーク）
    const total = stCount + gunoPts + routeScore.total_route_bonus + netScore.network_bonus;
    // GUNO 達成路線
    const gunoRoutes = [];
    for (const lc of state.routeCodes) {
      if (state.lastHits && state.lastHits[lc] === idx) {
        gunoRoutes.push(lc);
      }
    }
    // 占有スロットのキー配列（上位駅集計用）
    const ownedSlots = Object.entries(state.mapState)
      .filter(([, owner]) => owner === idx)
      .map(([key]) => key);
    return {
      playerId:              cfg.id,
      strategy:              cfg.strategy,
      stCount,
      gunoPts,
      gunoCount:             p.guno,
      routeBonus:            routeScore.route_bonus,
      consecutiveBonus:      routeScore.consecutive_bonus,
      totalRouteBonus:       routeScore.total_route_bonus,
      networkBonus:          netScore.network_bonus,
      maxComponentSize:      netScore.max_component_size,
      totalConnectedSt:      netScore.total_connected_stations,
      completedRoutes:       routeScore.completed_routes,
      partialRoutes:         routeScore.partial_routes,
      total,
      gunoRoutes,
      isAlive:               p.status !== 'eliminated',
      ownedSlots,
      routeDetails:          routeScore.route_details || [],
    };
  });

  // 勝者（ランキング1位）
  const winner = ranking[0];
  const winnerIdx = winner.playerIdx;

  return {
    winnerId:    playerConfigs[winnerIdx].id,
    winnerStrategy: playerConfigs[winnerIdx].strategy,
    turnCount:   state.turnCount,
    endReason:   endReason,
    results,
    events: options.logEvents ? events : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 複数ゲームシミュレーション（集計）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 複数ゲームをシミュレートして戦略別の統計を集計する。
 *
 * @param {number} numSimulations - シミュレーション回数
 * @param {Object} packData - pack_loader.js の PackData
 * @param {Object[]} [playerConfigs] - プレイヤー設定（省略時はデフォルト4戦略）
 * @param {Object} [options]
 * @returns {Object} 集計結果
 */
export function runSimulatorV3Sync(numSimulations, packData, playerConfigs, options = {}) {
  const players = playerConfigs || [
    { id: 'P1', name: 'Hub AI',      strategy: 'hub' },
    { id: 'P2', name: 'Route AI',    strategy: 'route' },
    { id: 'P3', name: 'Balanced AI', strategy: 'balanced' },
    { id: 'P4', name: 'Greedy AI',   strategy: 'greedy' },
  ];

  // 戦略別統計の初期化
  const strategyStats = {};
  const allStrategies = [...new Set(players.map(p => p.strategy))];
  for (const s of allStrategies) {
    strategyStats[s] = {
      strategy:              s,
      wins:                  0,
      games_played:          0,
      total_score:           0,
      total_st_count:        0,
      total_guno_pts:        0,
      total_guno_count:      0,
      total_route_bonus:     0,
      total_network_bonus:   0,
      win_rate:              0,
      avg_score:             0,
      avg_st_count:          0,
      avg_guno_pts:          0,
      avg_guno_count:        0,
      avg_route_bonus:       0,
      avg_network_bonus:     0,
    };
  }

   // ゲーム全体統計
  const gameStats = {
    total_simulations: numSimulations,
    total_turns:       0,
    avg_turns:         0,
    end_reasons:       {},
  };
  // 上位駅・路線集計（勝者が最も多く占有した駅・完成した路線）
  const topStationMap = new Map();  // station_name → wins
  const topRouteMap   = new Map();  // route_name → { wins, lc }
  // packData.routesは配列なので、lcコードおよび英語名でルックアップできるマップを作成
  const routeByLc = {};
  if (packData.routes) {
    for (const route of Object.values(packData.routes)) {
      if (route.lc)     routeByLc[route.lc]     = route;
      if (route.name_en) routeByLc[route.name_en] = route;  // 英語名でもルックアップ可能
    }
  }
  // シミュレーション実行
  for (let i = 0; i < numSimulations; i++) {
    const result = simulateSingleGameV3(players, packData, options);
    // ゲーム統計更新
    gameStats.total_turns += result.turnCount;
    const reason = result.endReason || 'unknown';
    gameStats.end_reasons[reason] = (gameStats.end_reasons[reason] || 0) + 1;
    // 戦略別統計更新
    for (const res of result.results) {
      const st = strategyStats[res.strategy];
      if (!st) continue;
      st.games_played++;
      st.total_score        += res.total;
      st.total_st_count     += res.stCount;
      st.total_guno_pts     += res.gunoPts;
      st.total_guno_count   += res.gunoCount;
      st.total_route_bonus  += res.totalRouteBonus || 0;
      st.total_network_bonus += res.networkBonus  || 0;
      if (res.playerId === result.winnerId) {
        st.wins++;
      }
    }
    // 勝者の占有駅・完成路線を集計
    const winnerResult = result.results.find(r => r.playerId === result.winnerId);
    if (winnerResult) {
      // 勝者の占有駅を ownedSlots から取得
      for (const key of (winnerResult.ownedSlots || [])) {
        const [lc, ord] = key.split('-');
        const route = routeByLc[lc];
        if (route && route.members) {
          const member = route.members[Number(ord) - 1];
          if (member) {
            const name = member.name_ja || member.name || key;
            topStationMap.set(name, (topStationMap.get(name) || 0) + 1);
          }
        }
      }
      // 勝者が最も占有した路線（完成・未完成問わず、占有数最大の路線）を集計
      const routeDetails = winnerResult.routeDetails || [];
      // 占有数最大の路線（トップ1位）を記録
      if (routeDetails.length > 0) {
        const topRoute = routeDetails[0];  // routeDetailsはボーナス降順でソート済み
        const lc   = topRoute.line_id;
        const name = topRoute.line_name || lc;
        const prev = topRouteMap.get(name) || { wins: 0, lc };
        topRouteMap.set(name, { wins: prev.wins + 1, lc });
      }
    }
  }

  // 平均値計算
  gameStats.avg_turns = gameStats.total_turns / numSimulations;

  for (const s of allStrategies) {
    const st = strategyStats[s];
    if (st.games_played > 0) {
      st.win_rate       = (st.wins / numSimulations) * 100;
      st.avg_score         = st.total_score         / st.games_played;
      st.avg_st_count      = st.total_st_count      / st.games_played;
      st.avg_guno_pts      = st.total_guno_pts      / st.games_played;
      st.avg_guno_count    = st.total_guno_count    / st.games_played;
      st.avg_route_bonus   = st.total_route_bonus   / st.games_played;
      st.avg_network_bonus = st.total_network_bonus / st.games_played;
    }
  }

  // 戦略別ランキング（勝率順）
  const strategyRanking = Object.values(strategyStats)
    .sort((a, b) => b.win_rate - a.win_rate);

  // 上位駅・路線をソートして配列化
  const topStations = [...topStationMap.entries()]
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 20);
  const topRoutes = [...topRouteMap.entries()]
    .map(([name, data]) => ({ name, wins: data.wins, lc: data.lc }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10);
  return {
    game_stats:       gameStats,
    strategy_stats:   strategyStats,
    strategy_ranking: strategyRanking,
    players,
    top_stations:     topStations,
    top_routes:       topRoutes,
    _topStationMap:   Object.fromEntries(topStationMap),
    _topRouteMap:     Object.fromEntries([...topRouteMap.entries()].map(([k,v]) => [k, v])),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 非同期ラッパー（ブラウザ向け）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 非同期版：packData を URL から取得してシミュレーションを実行する。
 *
 * @param {number} numSimulations
 * @param {Object} [options]
 * @param {string} [options.packUrl] - guno_pack_v6.json の URL
 * @param {Object[]} [options.playerConfigs]
 * @returns {Promise<Object>}
 */
export async function runSimulatorV3(numSimulations, options = {}) {
  const packUrl = options.packUrl || '../../assets/guno/guno_pack_v6.json';

  // pack_loader を動的インポート（ブラウザ環境向け）
  const { loadPackFromUrl } = await import('../data/pack_loader.js');
  const packData = await loadPackFromUrl(packUrl);

  return runSimulatorV3Sync(numSimulations, packData, options.playerConfigs, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// 単一ゲームの詳細ログ出力（デバッグ用）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1ゲームを詳細ログ付きで実行する（デバッグ・検証用）。
 *
 * @param {Object[]} playerConfigs
 * @param {Object} packData
 * @returns {Object}
 */
export function runSingleGameDebug(playerConfigs, packData) {
  return simulateSingleGameV3(playerConfigs, packData, { logEvents: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// マルチシティ対応 API（city_loader.js 統合）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SimulatorError — city data not ready or load failure
 */
export class SimulatorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SimulatorError';
    this.code = code;
  }
}

/**
 * 都市IDを解決する（URLパラメータ → レジストリのデフォルト）。
 * @param {string|null} cityId
 * @param {string} baseUrl
 * @returns {Promise<string>}
 */
async function _resolveCityId(cityId, baseUrl) {
  if (cityId) return cityId;
  const { loadCityRegistry, getDefaultCityId } = await import('../city/city_loader.js');
  const registry = await loadCityRegistry(baseUrl);
  return getDefaultCityId(registry);
}

/**
 * 都市プロファイルとパックデータをロードする。
 * data_ready === false の場合は SimulatorError をスローする。
 *
 * @param {string} cityId
 * @param {string} baseUrl
 * @returns {Promise<{ profile: Object, packData: Object, stationGraph: Object|null }>}
 */
async function _loadCityAssets(cityId, baseUrl) {
  const { loadCityProfile, resolveDatasetUrl } = await import('../city/city_loader.js');
  const { loadPackFromUrl } = await import('../data/pack_loader.js');

  const profile = await loadCityProfile(cityId, baseUrl);

  // data_ready チェック
  if (profile.status?.data_ready === false) {
    throw new SimulatorError(
      'DATA_NOT_READY',
      `City data for "${cityId}" is not ready yet. ` +
      `Please generate the data package before running simulations.`
    );
  }

  // パックデータをロード
  const packUrl = resolveDatasetUrl('default_pack', profile, baseUrl);
  const packData = await loadPackFromUrl(packUrl);

  // station_graph（ネットワークスコア用、オプション）
  let stationGraph = null;
  try {
    const graphUrl = resolveDatasetUrl('station_graph', profile, baseUrl);
    const res = await fetch(graphUrl);
    if (res.ok) stationGraph = await res.json();
  } catch (e) {
    console.warn(`game_simulator_v3: station_graph not loaded for "${cityId}":`, e.message);
  }

  return { profile, packData, stationGraph };
}

/**
 * マルチシティ対応バッチシミュレーション。
 *
 * @param {Object} options
 * @param {string}   [options.baseUrl]          - guno_v6 ルートのベースURL
 * @param {string}   [options.cityId]           - 都市ID（省略時はレジストリのデフォルト）
 * @param {number}   [options.simulationCount]  - シミュレーション回数（デフォルト: 100）
 * @param {Object[]} [options.strategySetup]    - プレイヤー設定（省略時はデフォルト4戦略）
 * @param {boolean}  [options.useNetworkScore]  - ネットワークスコアを使用するか（デフォルト: true）
 * @param {number}   [options.maxTurns]         - 1ゲームの最大ターン数（デフォルト: 500）
 * @returns {Promise<Object>} バッチ集計結果（city_id を含む）
 */
export async function runSimulationBatch(options = {}) {
  const baseUrl = options.baseUrl || null;
  const simCount = options.simulationCount || 100;
  const useNetwork = options.useNetworkScore !== false;

  const cityId = await _resolveCityId(options.cityId || null, baseUrl);
  const { profile, packData, stationGraph } = await _loadCityAssets(cityId, baseUrl);

  const players = options.strategySetup || [
    { id: 'P1', name: 'Hub AI',      strategy: 'hub' },
    { id: 'P2', name: 'Route AI',    strategy: 'route' },
    { id: 'P3', name: 'Balanced AI', strategy: 'balanced' },
    { id: 'P4', name: 'Greedy AI',   strategy: 'greedy' },
  ];

  const simOptions = {
    stationGraph: useNetwork ? stationGraph : null,
    maxTurns: options.maxTurns || 500,
  };

  const result = runSimulatorV3Sync(simCount, packData, players, simOptions);

  // city_id をバッチサマリーに追加
  result.city_id          = cityId;
  result.city_name        = profile.city_name || cityId;
  result.simulation_count = simCount;

  return result;
}

/**
 * マルチシティ対応単一ゲームシミュレーション。
 *
 * @param {Object} options
 * @param {string}   [options.baseUrl]
 * @param {string}   [options.cityId]
 * @param {Object[]} [options.strategySetup]
 * @param {boolean}  [options.logEvents]
 * @param {number}   [options.maxTurns]
 * @returns {Promise<Object>} 単一ゲーム結果
 */
export async function runSingleSimulation(options = {}) {
  const baseUrl = options.baseUrl || null;
  const cityId  = await _resolveCityId(options.cityId || null, baseUrl);
  const { packData, stationGraph } = await _loadCityAssets(cityId, baseUrl);

  const players = options.strategySetup || [
    { id: 'P1', name: 'Hub AI',      strategy: 'hub' },
    { id: 'P2', name: 'Route AI',    strategy: 'route' },
    { id: 'P3', name: 'Balanced AI', strategy: 'balanced' },
    { id: 'P4', name: 'Greedy AI',   strategy: 'greedy' },
  ];

  const simOptions = {
    stationGraph: stationGraph,
    maxTurns: options.maxTurns || 500,
    logEvents: options.logEvents || false,
  };

  return simulateSingleGameV3(players, packData, simOptions);
}
