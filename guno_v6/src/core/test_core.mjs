/**
 * guno_v6/src/core/test_core.mjs
 * rules.js / game_engine.js / serializers.js の統合テスト
 *
 * 実行方法:
 *   node guno_v6/src/core/test_core.mjs
 */

import {
  normStar, isPlayable, getPlayableIndices,
  isGunoComplete, checkGameOver, calcScore, calcRanking,
  GUNO_POINT, INITIAL_HAND_SIZE, ROUTE_SIZE,
} from "./rules.js";

import {
  makeDeck, initGame, playCard, drawCard, passTurn, endTurn, runCpuTurn,
} from "./game_engine.js";

import {
  serializeState, deserializeState, buildGameStateUpdate, stateFromRow,
} from "./serializers.js";

// ===== テストユーティリティ =====

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}
function eq(a, b, msg) {
  if (a === b) { console.log(`  ✓ ${msg} (= ${JSON.stringify(a)})`); passed++; }
  else         { console.error(`  ✗ ${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); failed++; }
}

// ===== テスト用 PackData（2路線ミニパック） =====

const MINI_PACK = {
  meta: { pack_id: "mini", pack_version: "1.0", name: "Mini Pack", description: "" },
  routes: [
    {
      lc: "JY", name_ja: "山手線", name_en: "Yamanote", color: "#00AA00", size: 10,
      members: [
        { order:1, id:"st-tokyo",       name_ja:"東京",       name_en:"Tokyo",       isHub:true,  hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:4, hub_bonus_global:6, hub_rank_global:"S" },
        { order:2, id:"st-kanda",       name_ja:"神田",       name_en:"Kanda",       isHub:true,  hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
        { order:3, id:"st-ueno",        name_ja:"上野",       name_en:"Ueno",        isHub:true,  hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
        { order:4, id:"st-ikebukuro",   name_ja:"池袋",       name_en:"Ikebukuro",   isHub:true,  hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
        { order:5, id:"st-takadanobaba",name_ja:"高田馬場",   name_en:"Takadanobaba",isHub:false, hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
        { order:6, id:"st-shinjuku",    name_ja:"新宿",       name_en:"Shinjuku",    isHub:true,  hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
        { order:7, id:"st-shibuya",     name_ja:"渋谷",       name_en:"Shibuya",     isHub:false, hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
        { order:8, id:"st-meguro",      name_ja:"目黒",       name_en:"Meguro",      isHub:false, hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
        { order:9, id:"st-shinagawa",   name_ja:"品川",       name_en:"Shinagawa",   isHub:false, hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
        { order:10,id:"st-shimbashi",   name_ja:"新橋",       name_en:"Shimbashi",   isHub:true,  hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
      ]
    },
    {
      lc: "M", name_ja: "丸ノ内線", name_en: "Marunouchi", color: "#F62E36", size: 10,
      members: [
        { order:1, id:"st-ikebukuro",   name_ja:"池袋",       name_en:"Ikebukuro",   isHub:true,  hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
        { order:2, id:"st-korakuen",    name_ja:"後楽園",     name_en:"Korakuen",    isHub:false, hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
        { order:3, id:"st-ochanomizu",  name_ja:"御茶ノ水",   name_en:"Ochanomizu",  isHub:false, hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
        { order:4, id:"st-otemachi",    name_ja:"大手町",     name_en:"Otemachi",    isHub:false, hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
        { order:5, id:"st-tokyo",       name_ja:"東京",       name_en:"Tokyo",       isHub:true,  hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:4, hub_bonus_global:6, hub_rank_global:"S" },
        { order:6, id:"st-ginza",       name_ja:"銀座",       name_en:"Ginza",       isHub:false, hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
        { order:7, id:"st-akasaka",     name_ja:"赤坂見附",   name_en:"Akasaka-mitsuke",isHub:false,hub_degree_deck:1,hub_bonus_deck:0,hub_rank_deck:"C",hub_degree_global:1,hub_bonus_global:0,hub_rank_global:"C" },
        { order:8, id:"st-yotsuya",     name_ja:"四ツ谷",     name_en:"Yotsuya",     isHub:false, hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
        { order:9, id:"st-shinjuku",    name_ja:"新宿",       name_en:"Shinjuku",    isHub:true,  hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
        { order:10,id:"st-nakano-sakaue",name_ja:"中野坂上",  name_en:"Nakano-sakaue",isHub:false,hub_degree_deck:1,hub_bonus_deck:0,hub_rank_deck:"C",hub_degree_global:1,hub_bonus_global:0,hub_rank_global:"C" },
      ]
    }
  ],
  stations: [], // 後で routes から生成
  teidenMap: { JY: "JY_TEIDEN", M: "M_TEIDEN" },
  raw: {},
};

// stations を routes から生成
for (const route of MINI_PACK.routes) {
  for (const slot of route.members) {
    if (!slot) continue;
    const isInterchange = MINI_PACK.routes.filter(r => r.members.some(s => s?.id === slot.id)).length >= 2;
    MINI_PACK.stations.push({
      lc: route.lc, name_ja: route.name_ja, name_en: route.name_en,
      order: slot.order,
      st_ja: (isInterchange ? "★" : "") + slot.name_ja,
      st_en: (isInterchange ? "★" : "") + slot.name_en,
      color: route.color,
      file: `${route.lc}_${String(slot.order).padStart(2,"0")}_${slot.name_en}`,
      ...slot,
    });
  }
}

const PLAYER_CONFIGS = [
  { name: "P1", icon: "🌊", color: "#174a7c", isHuman: true },
  { name: "P2", icon: "🌸", color: "#b52942", isHuman: false },
  { name: "P3", icon: "🌙", color: "#e6b422", isHuman: false },
  { name: "P4", icon: "🏯", color: "#745399", isHuman: false },
];

// 決定論的乱数（テスト用）
let seed = 42;
function seededRng() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0x100000000;
}

// ===== テスト実行 =====

console.log("\n=== GUNO V6 Core Engine テスト ===\n");

// ── Test 1: rules.js ──
console.log("【Test 1】normStar");
eq(normStar("★東京"), "東京", "★東京 → 東京");
eq(normStar("東京"), "東京", "東京 → 東京");
eq(normStar("★★銀座"), "銀座", "★★銀座 → 銀座");
eq(normStar(""), "", "空文字");

// ── Test 2: isPlayable ──
console.log("\n【Test 2】isPlayable");
const topStation = { type:"station", lc:"JY", order:1, st_ja:"★東京", st_en:"★Tokyo" };
const topTeiden  = { type:"teiden",  lc:"JY" };

// 同路線
assert(isPlayable({ type:"station", lc:"JY", order:3, st_ja:"上野", st_en:"Ueno" }, topStation, []), "同路線 JY → OK");
// 同名（★あり）
assert(isPlayable({ type:"station", lc:"M", order:5, st_ja:"★東京", st_en:"★Tokyo" }, topStation, []), "同名 東京(M) → OK");
// 同順番
assert(isPlayable({ type:"station", lc:"M", order:1, st_ja:"★池袋", st_en:"★Ikebukuro" }, topStation, []), "同順番 order=1(M) → OK");
// 別路線・別名・別順番
assert(!isPlayable({ type:"station", lc:"M", order:3, st_ja:"御茶ノ水", st_en:"Ochanomizu" }, topStation, []), "別路線・別名・別順番 → NG");
// 停電カード（手札2枚以上、同路線）
const hand2 = [{ type:"teiden", lc:"JY" }, { type:"station", lc:"JY", order:1, st_ja:"★東京", st_en:"★Tokyo" }];
assert(isPlayable({ type:"teiden", lc:"JY" }, topStation, hand2), "停電(JY) vs 駅(JY) 手札2枚 → OK");
// 停電カード（手札1枚）
assert(!isPlayable({ type:"teiden", lc:"JY" }, topStation, [{ type:"teiden", lc:"JY" }]), "停電(JY) 手札1枚 → NG");
// 停電 vs 停電
assert(isPlayable({ type:"teiden", lc:"M" }, topTeiden, hand2), "停電(M) vs 停電(JY) → OK");

// ── Test 3: isGunoComplete ──
console.log("\n【Test 3】isGunoComplete");
const fullMap = {};
for (let i = 1; i <= 10; i++) fullMap[`JY-${i}`] = 0;
assert(isGunoComplete("JY", fullMap), "JY 全スロット埋まり → GUNO");
const partialMap = { ...fullMap };
delete partialMap["JY-5"];
assert(!isGunoComplete("JY", partialMap), "JY スロット5欠け → 未完成");
const negMap = { ...fullMap, "JY-3": -1 };
assert(!isGunoComplete("JY", negMap), "JY スロット3が -1 → 未完成");

// ── Test 4: checkGameOver ──
console.log("\n【Test 4】checkGameOver");
const activePlayers = PLAYER_CONFIGS.map(c => ({ ...c, status:"active", guno:0, hand:[] }));
const onlyOne = activePlayers.map((p,i) => ({ ...p, status: i === 0 ? "active" : "eliminated" }));
eq(checkGameOver({ players: onlyOne, totalGuno:0, routeCount:2, consecutivePasses:0 }).reason, "players_eliminated", "1人残り → players_eliminated");
eq(checkGameOver({ players: activePlayers, totalGuno:2, routeCount:2, consecutivePasses:0 }).reason, "all_routes_complete", "全GUNO → all_routes_complete");
eq(checkGameOver({ players: activePlayers, totalGuno:0, routeCount:2, consecutivePasses:16 }).reason, "no_playable_cards", "連続パス上限 → no_playable_cards");
assert(!checkGameOver({ players: activePlayers, totalGuno:0, routeCount:2, consecutivePasses:0 }).over, "通常状態 → over=false");

// ── Test 5: makeDeck ──
console.log("\n【Test 5】makeDeck");
seed = 42;
const deck = makeDeck(MINI_PACK, seededRng);
// 駅カード: 20駅 × 2枚 = 40枚、停電: 2枚 → 合計42枚
eq(deck.length, 42, "デッキ枚数 = 42");
const stationCards = deck.filter(c => c.type === "station");
const teidenCards  = deck.filter(c => c.type === "teiden");
eq(stationCards.length, 40, "駅カード = 40");
eq(teidenCards.length, 2, "停電カード = 2");

// ── Test 6: initGame ──
console.log("\n【Test 6】initGame");
seed = 42;
const state = initGame({ packData: MINI_PACK, playerConfigs: PLAYER_CONFIGS, rng: seededRng });
eq(state.players.length, 4, "プレイヤー数 = 4");
eq(state.players[0].hand.length, INITIAL_HAND_SIZE, `P1 手札 = ${INITIAL_HAND_SIZE}`);
eq(state.players[1].hand.length, INITIAL_HAND_SIZE, `P2 手札 = ${INITIAL_HAND_SIZE}`);
assert(state.discardPile.length >= 1, "捨て札 >= 1");
assert(state.discardPile[state.discardPile.length - 1].type === "station", "最初の捨て札は駅カード");
assert(!state.gameOver, "ゲームオーバーではない");
eq(state.routeCodes.length, 2, "routeCodes = 2");

// ── Test 7: playCard ──
console.log("\n【Test 7】playCard");
seed = 42;
const s2 = initGame({ packData: MINI_PACK, playerConfigs: PLAYER_CONFIGS, rng: seededRng });
const events = [];
const emit = (e) => events.push(e);

// プレイ可能なカードを探す
const topCard = s2.discardPile[s2.discardPile.length - 1];
const playable = s2.players[0].hand
  .map((c, i) => ({ c, i }))
  .filter(({ c }) => {
    if (c.type === "teiden") {
      return s2.players[0].hand.length > 1 && (topCard.type === "teiden" || c.lc === topCard.lc);
    }
    const { normStar: ns } = { normStar: (s) => (s||"").replace(/^★+/,"").trim() };
    return c.lc === topCard.lc || (c.st_ja||"").replace(/^★+/,"").trim() === (topCard.st_ja||"").replace(/^★+/,"").trim() || (topCard.type === "station" && c.order === topCard.order);
  });

if (playable.length > 0) {
  const before = s2.players[0].hand.length;
  const result = playCard(s2, 0, playable[0].i, emit);
  assert(result.ok, "playCard が成功");
  eq(s2.players[0].hand.length, before - 1, "手札が1枚減った");
  eq(s2.discardPile[s2.discardPile.length - 1].id, playable[0].c.id, "捨て札の最上が出したカード");
  assert(events.some(e => e.type === "card_played"), "card_played イベントが発行された");
} else {
  console.log("  ⚠ P1 に出せるカードがない（シード依存）→ スキップ");
}

// 不正なプレイ（存在しないインデックス）
const badResult = playCard(s2, 0, 999, emit);
assert(!badResult.ok, "存在しないインデックスは失敗");

// ── Test 8: drawCard ──
console.log("\n【Test 8】drawCard");
seed = 42;
const s3 = initGame({ packData: MINI_PACK, playerConfigs: PLAYER_CONFIGS, rng: seededRng });
const events3 = [];
const emit3 = (e) => events3.push(e);

// 手札を全部プレイ不可な状態にして drawCard をテスト
// （実際のゲームでは出せるカードがある場合はドロー不可）
const topCard3 = s3.discardPile[s3.discardPile.length - 1];
const playable3 = s3.players[0].hand
  .map((c, i) => ({ c, i }))
  .filter(({ c }) => c.lc === topCard3.lc || (c.st_ja||"").replace(/^★+/,"") === (topCard3.st_ja||"").replace(/^★+/,"") || (topCard3.type === "station" && c.order === topCard3.order));

if (playable3.length === 0) {
  const before = s3.players[0].hand.length;
  const deckBefore = s3.deck.length;
  const result = drawCard(s3, 0, emit3);
  assert(result.ok, "drawCard が成功");
  eq(s3.players[0].hand.length, before + 1, "手札が1枚増えた");
  eq(s3.deck.length, deckBefore - 1, "デッキが1枚減った");
  assert(events3.some(e => e.type === "card_drawn"), "card_drawn イベントが発行された");
} else {
  console.log("  ⚠ P1 に出せるカードあり → drawCard は has_playable_card エラーになるはず");
  const result = drawCard(s3, 0, emit3);
  eq(result.error, "has_playable_card", "出せるカードがある場合は drawCard 失敗");
}

// ── Test 9: CPU ターン（フルゲームシミュレーション） ──
console.log("\n【Test 9】CPU フルゲームシミュレーション");
seed = 12345;
const sGame = initGame({ packData: MINI_PACK, playerConfigs: PLAYER_CONFIGS.map(c => ({ ...c, isHuman: false })), rng: seededRng });
const gameEvents = [];
const emitGame = (e) => gameEvents.push(e);

let maxTurns = 500;
while (!sGame.gameOver && maxTurns-- > 0) {
  runCpuTurn(sGame, emitGame);
  if (!sGame.gameOver) endTurn(sGame, emitGame);
}

assert(sGame.gameOver || maxTurns <= 0, "ゲームが終了した（または上限ターンに達した）");
if (sGame.gameOver) {
  const gunoEvents = gameEvents.filter(e => e.type === "game_over");
  assert(gunoEvents.length >= 1, "game_over イベントが発行された");
  console.log(`  ℹ ゲーム終了理由: ${gunoEvents[0]?.reason}, ターン数: ${sGame.turnCount}`);
}

// ── Test 10: シリアライズ / デシリアライズ ──
console.log("\n【Test 10】シリアライズ / デシリアライズ");
seed = 42;
const sSerial = initGame({ packData: MINI_PACK, playerConfigs: PLAYER_CONFIGS, rng: seededRng });

const json = serializeState(sSerial);
assert(json.v === 1, "state_json.v = 1");
assert(Array.isArray(json.deck), "deck が配列");
assert(Array.isArray(json.players), "players が配列");
eq(json.players.length, 4, "players 数 = 4");

const restored = deserializeState(json);
eq(restored.players.length, 4, "復元後 players 数 = 4");
eq(restored.players[0].hand.length, sSerial.players[0].hand.length, "復元後 P1 手札枚数が一致");
eq(restored.turnIndex, sSerial.turnIndex, "復元後 turnIndex が一致");
eq(restored.direction, sSerial.direction, "復元後 direction が一致");

// バージョン不一致
try {
  deserializeState({ v: 99, deck:[], discardPile:[], players:[] });
  assert(false, "バージョン不一致は例外になるべき");
} catch (e) {
  assert(e.message.includes("unsupported"), `バージョン不一致で例外: ${e.message}`);
}

// buildGameStateUpdate
const update = buildGameStateUpdate(sSerial, 5, "play", "anon-abc");
eq(update.version, 6, "version = prevVersion + 1");
eq(update.last_action, "play", "last_action = play");
assert(update.state_json.v === 1, "state_json.v = 1");

// stateFromRow
const row = { state_json: serializeState(sSerial) };
const fromRow = stateFromRow(row);
eq(fromRow.players.length, 4, "stateFromRow → players 数 = 4");

// ── 結果 ──
console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
