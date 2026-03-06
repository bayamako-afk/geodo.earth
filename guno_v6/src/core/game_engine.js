/**
 * guno_v6/src/core/game_engine.js
 * GUNO V6 コアゲームエンジン
 *
 * UI・Supabase・DOM に一切依存しない純粋な状態機械。
 * V5 の guno_v5.js からゲームロジックのみを抽出・再実装。
 *
 * 設計方針:
 *   - GameEngine は GameState を受け取り、新しい GameState を返す（イミュータブル志向）
 *   - 副作用（描画・音・通信）は一切行わない
 *   - イベントエミッター（onEvent）で UI / ネット層に変化を通知する
 *
 * GameState 構造:
 *   {
 *     deck:             Card[]
 *     discardPile:      Card[]
 *     players:          Player[]
 *     mapState:         { [key: string]: number }  // "LC-order" → playerIdx | -1
 *     lastHits:         { [lc: string]: number }   // GUNO達成者
 *     teidenPlayed:     { [lc: string]: boolean }
 *     turnIndex:        number
 *     direction:        1 | -1
 *     gameOver:         boolean
 *     consecutivePasses: number
 *     turnCount:        number
 *     routeCodes:       string[]   // デッキ内の路線コード一覧
 *     routeSize:        number     // 各路線のスロット数（通常10）
 *   }
 *
 * Player 構造:
 *   { name, icon, color, isHuman, status: "active"|"eliminated", guno, hand: Card[] }
 *
 * Card 構造（駅）:
 *   { id, type:"station", lc, order, st_ja, st_en, color, file, hub_bonus_deck, ... }
 *
 * Card 構造（停電）:
 *   { id, type:"teiden", lc, file, color }
 */

import {
  INITIAL_HAND_SIZE,
  GUNO_POINT,
  ROUTE_SIZE,
  STATION_CARD_COPIES,
  normStar,
  getPlayableIndices,
  isGunoComplete,
  checkGameOver,
  calcScore,
  calcRanking,
} from "./rules.js";

// ===== デッキ生成 =====

/**
 * PackData からシャッフル済みデッキを生成する。
 *
 * @param {PackData} packData - pack_loader.js の loadPackFromJson() 等が返す値
 * @param {function} [rng] - 乱数関数（デフォルト: Math.random）
 * @returns {Card[]}
 */
export function makeDeck(packData, rng = Math.random) {
  const deck = [];

  // 駅カード（各駅 STATION_CARD_COPIES 枚）
  for (const station of packData.stations) {
    for (let i = 0; i < STATION_CARD_COPIES; i++) {
      deck.push({
        ...station,
        type: "station",
        id: `s-${station.lc}-${station.order}-${i}`,
      });
    }
  }

  // 停電カード（各路線 1 枚）
  for (const [lc, file] of Object.entries(packData.teidenMap)) {
    deck.push({ id: `t-${lc}`, type: "teiden", lc, file, color: "#000" });
  }

  // Fisher-Yates シャッフル
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// ===== ゲーム初期化 =====

/**
 * 新しいゲーム状態を生成する。
 *
 * @param {object} params
 * @param {PackData} params.packData
 * @param {PlayerConfig[]} params.playerConfigs - [{ name, icon, color, isHuman }]
 * @param {function} [params.rng] - 乱数関数
 * @returns {GameState}
 */
export function initGame({ packData, playerConfigs, rng = Math.random }) {
  const routeCodes = packData.routes.map((r) => r.lc);
  const deck = makeDeck(packData, rng);

  // プレイヤー生成
  const players = playerConfigs.map((cfg) => ({
    name:    cfg.name,
    icon:    cfg.icon    ?? "👤",
    color:   cfg.color   ?? "#888",
    isHuman: cfg.isHuman ?? false,
    status:  "active",
    guno:    0,
    hand:    [],
  }));

  // 初期手札配布
  for (const p of players) {
    for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
      if (deck.length) p.hand.push(deck.pop());
    }
  }

  // 最初の捨て札（駅カードが出るまでめくる）
  const discardPile = [];
  const mapState = {};
  const teidenPlayed = Object.fromEntries(routeCodes.map((lc) => [lc, false]));

  while (deck.length) {
    const c = deck.pop();
    discardPile.push(c);
    if (c.type === "station") {
      mapState[`${c.lc}-${c.order}`] = -1; // -1 = 誰も所有していない（初期配置）
      break;
    }
  }

  return {
    deck,
    discardPile,
    players,
    mapState,
    lastHits: {},
    teidenPlayed,
    turnIndex: 0,
    direction: 1,
    gameOver: false,
    consecutivePasses: 0,
    turnCount: 0,
    routeCodes,
    routeSize: ROUTE_SIZE,
  };
}

// ===== ターン進行 =====

/**
 * ターンを次のプレイヤーに進める（state を直接変更）。
 * @param {GameState} state
 */
function advanceTurn(state) {
  state.turnCount++;
  const n = state.players.length;
  state.turnIndex = (state.turnIndex + state.direction + n) % n;
}

// ===== GUNO チェック =====

/**
 * 路線が完成していれば GUNO を記録し、イベントを発行する。
 * @param {GameState} state
 * @param {string} lc
 * @param {number} pIdx
 * @param {function} emit
 */
function checkGuno(state, lc, pIdx, emit) {
  if (state.lastHits[lc] !== undefined) return; // 既に達成済み
  if (!isGunoComplete(lc, state.mapState, state.routeSize)) return;

  state.lastHits[lc] = pIdx;
  state.players[pIdx].guno++;

  emit({ type: "guno", lc, playerIdx: pIdx, player: state.players[pIdx] });

  const totalGuno = state.players.reduce((sum, p) => sum + p.guno, 0);
  if (totalGuno >= state.routeCodes.length) {
    endGame(state, emit);
  }
}

// ===== ゲーム終了 =====

/**
 * ゲームを終了状態にしてイベントを発行する。
 * @param {GameState} state
 * @param {function} emit
 * @param {string} [reason]
 */
function endGame(state, emit, reason = "routes_complete") {
  if (state.gameOver) return;
  state.gameOver = true;
  const ranking = calcRanking(state.players, state.mapState);
  emit({ type: "game_over", reason, ranking });
}

// ===== カードプレイ =====

/**
 * 指定プレイヤーが手札のカードをプレイする。
 * state を直接変更し、発生したイベントを emit で通知する。
 *
 * @param {GameState} state
 * @param {number} pIdx - プレイヤーインデックス
 * @param {number} cardIdx - 手札インデックス
 * @param {function} emit - イベントコールバック
 * @returns {{ ok: boolean, error?: string }}
 */
export function playCard(state, pIdx, cardIdx, emit) {
  if (state.gameOver) return { ok: false, error: "game_over" };

  const p = state.players[pIdx];
  if (p.status !== "active") return { ok: false, error: "player_not_active" };

  const topCard = state.discardPile[state.discardPile.length - 1];
  const playable = getPlayableIndices(p.hand, topCard);
  if (!playable.includes(cardIdx)) return { ok: false, error: "not_playable" };

  const card = p.hand.splice(cardIdx, 1)[0];
  state.discardPile.push(card);
  state.consecutivePasses = 0;

  emit({ type: "card_played", playerIdx: pIdx, player: p, card });

  if (card.type === "station") {
    const key = `${card.lc}-${card.order}`;
    const prev = state.mapState[key];

    if (prev !== undefined && prev !== -1 && prev !== pIdx) {
      emit({ type: "station_captured", key, fromIdx: prev, toIdx: pIdx });
    }

    state.mapState[key] = pIdx;

    // 同名駅カードを出すと方向反転
    if (topCard?.type === "station" && normStar(card.st_ja) === normStar(topCard.st_ja)) {
      state.direction *= -1;
      emit({ type: "direction_reversed", direction: state.direction });
    }

    checkGuno(state, card.lc, pIdx, emit);

  } else {
    // 停電カード
    state.teidenPlayed[card.lc] = true;
    state.direction *= -1;
    emit({ type: "teiden_played", lc: card.lc, playerIdx: pIdx, direction: state.direction });

    // 他のアクティブプレイヤーに1枚ドロー
    for (let i = 0; i < state.players.length; i++) {
      if (i !== pIdx && state.players[i].status === "active" && state.deck.length) {
        const drawn = state.deck.pop();
        state.players[i].hand.push(drawn);
        emit({ type: "card_drawn", playerIdx: i, player: state.players[i], card: drawn, reason: "teiden" });
      }
    }

    checkGuno(state, card.lc, pIdx, emit);
  }

  // 手札0 → 脱落
  if (p.hand.length === 0) {
    p.status = "eliminated";
    emit({ type: "player_eliminated", playerIdx: pIdx, player: p, reason: "empty_hand" });
  }

  // 生存者チェック
  const { over, reason } = checkGameOver({
    players: state.players,
    totalGuno: state.players.reduce((s, pl) => s + pl.guno, 0),
    routeCount: state.routeCodes.length,
    consecutivePasses: state.consecutivePasses,
  });
  if (over) endGame(state, emit, reason);

  return { ok: true };
}

// ===== カードドロー =====

/**
 * 指定プレイヤーがデッキからカードを1枚引く。
 *
 * @param {GameState} state
 * @param {number} pIdx
 * @param {function} emit
 * @returns {{ ok: boolean, card?: Card, error?: string }}
 */
export function drawCard(state, pIdx, emit) {
  if (state.gameOver) return { ok: false, error: "game_over" };

  const p = state.players[pIdx];
  if (p.status !== "active") return { ok: false, error: "player_not_active" };
  if (!state.deck.length) return { ok: false, error: "deck_empty" };

  const topCard = state.discardPile[state.discardPile.length - 1];
  const playable = getPlayableIndices(p.hand, topCard);
  if (playable.length > 0) return { ok: false, error: "has_playable_card" };

  const card = state.deck.pop();
  p.hand.push(card);
  emit({ type: "card_drawn", playerIdx: pIdx, player: p, card, reason: "draw" });

  return { ok: true, card };
}

// ===== パス（ドローもプレイもできない場合） =====

/**
 * 指定プレイヤーがパスする（デッキ空かつプレイ不可の場合）。
 *
 * @param {GameState} state
 * @param {number} pIdx
 * @param {function} emit
 * @returns {{ ok: boolean, error?: string }}
 */
export function passTurn(state, pIdx, emit) {
  if (state.gameOver) return { ok: false, error: "game_over" };

  const p = state.players[pIdx];
  if (p.status !== "active") return { ok: false, error: "player_not_active" };

  const topCard = state.discardPile[state.discardPile.length - 1];
  const playable = getPlayableIndices(p.hand, topCard);
  if (playable.length > 0) return { ok: false, error: "has_playable_card" };
  if (state.deck.length > 0) return { ok: false, error: "can_draw" };

  state.consecutivePasses++;
  emit({ type: "turn_passed", playerIdx: pIdx, player: p });

  const { over, reason } = checkGameOver({
    players: state.players,
    totalGuno: state.players.reduce((s, pl) => s + pl.guno, 0),
    routeCount: state.routeCodes.length,
    consecutivePasses: state.consecutivePasses,
  });
  if (over) endGame(state, emit, reason);

  return { ok: true };
}

// ===== ターン終了（次のプレイヤーへ） =====

/**
 * 現在のターンを終了して次のプレイヤーに進む。
 * アクティブでないプレイヤーは自動的にスキップする。
 *
 * @param {GameState} state
 * @param {function} emit
 */
export function endTurn(state, emit) {
  if (state.gameOver) return;

  advanceTurn(state);

  // 脱落プレイヤーをスキップ
  let safety = state.players.length;
  while (
    state.players[state.turnIndex].status !== "active" &&
    safety-- > 0
  ) {
    advanceTurn(state);
  }

  emit({ type: "turn_changed", turnIndex: state.turnIndex, player: state.players[state.turnIndex] });
}

// ===== CPU ターン（シンプルな AI） =====

/**
 * CPU プレイヤーのターンを自動実行する。
 * 戦略: プレイ可能なカードがあれば先頭を出す。なければドロー。
 *
 * @param {GameState} state
 * @param {function} emit
 * @returns {{ action: "play"|"draw"|"pass" }}
 */
export function runCpuTurn(state, emit) {
  if (state.gameOver) return { action: "none" };

  const pIdx = state.turnIndex;
  const p = state.players[pIdx];
  if (p.status !== "active") return { action: "skip" };

  const topCard = state.discardPile[state.discardPile.length - 1];
  const playable = getPlayableIndices(p.hand, topCard);

  if (playable.length > 0) {
    playCard(state, pIdx, playable[0], emit);
    return { action: "play" };
  }

  if (state.deck.length > 0) {
    const result = drawCard(state, pIdx, emit);
    if (result.ok) {
      // ドロー後に出せるか再チェック
      const playable2 = getPlayableIndices(p.hand, topCard);
      if (playable2.length > 0) {
        playCard(state, pIdx, playable2[0], emit);
        return { action: "draw_then_play" };
      }
      state.consecutivePasses++;
    }
    return { action: "draw" };
  }

  passTurn(state, pIdx, emit);
  return { action: "pass" };
}

// ===== スコア・ランキング（rules.js の再エクスポート） =====
export { calcScore, calcRanking, GUNO_POINT, INITIAL_HAND_SIZE, ROUTE_SIZE };
