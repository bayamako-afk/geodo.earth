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
   * route: 既に所有している路線のカードを優先する（路線完成を狙う）
   * 同路線カードに大きなボーナスを与える
   */
  route: (card, hand, mapState, playerIdx) => {
    // 自分が所有している路線のカード数を数える
    const ownedByLine = {};
    for (const [key, owner] of Object.entries(mapState)) {
      if (owner === playerIdx) {
        const lc = key.split('-')[0];
        ownedByLine[lc] = (ownedByLine[lc] || 0) + 1;
      }
    }
    const sameLineCount = ownedByLine[card.lc] || 0;
    // 既に多く持っている路線のカードを優先
    return sameLineCount * 5 + (card.hub_bonus_deck || 0);
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

  return {
    game_stats:       gameStats,
    strategy_stats:   strategyStats,
    strategy_ranking: strategyRanking,
    players,
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
