/**
 * guno_v6/src/core/test_scoring.mjs
 * scoring.js の単体テスト
 *
 * 実行方法:
 *   node guno_v6/src/core/test_scoring.mjs
 */

import {
  calcScore, calcScoreDetail, calcScoreV5Compat,
  calcRanking, calcRouteStats, buildGameStats,
  STATION_POINT, HUB_RANK_LABEL,
} from "./scoring.js";

import { initGame, runCpuTurn, endTurn } from "./game_engine.js";

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

// ===== テスト用データ =====

const PLAYERS = [
  { name:"P1", icon:"🌊", color:"#174a7c", isHuman:true,  status:"active",     guno:2, hand:[] },
  { name:"P2", icon:"🌸", color:"#b52942", isHuman:false, status:"active",     guno:1, hand:[] },
  { name:"P3", icon:"🌙", color:"#e6b422", isHuman:false, status:"eliminated", guno:0, hand:[] },
  { name:"P4", icon:"🏯", color:"#745399", isHuman:false, status:"active",     guno:0, hand:[] },
];

// mapState: P1が5スロット、P2が3スロット、P3が1スロット、P4が0スロット
const MAP_STATE = {
  "JY-1": 0, "JY-2": 0, "JY-3": 0, "JY-4": 0, "JY-5": 0,  // P1: 5スロット
  "JY-6": 1, "JY-7": 1, "JY-8": 1,                          // P2: 3スロット
  "M-1":  2,                                                  // P3: 1スロット
  // P4: 0スロット
};

// stationsDB（Hub Bonus テスト用）
const STATIONS_DB = [
  // JY-1: 東京（Hub S, hub_bonus_deck=5）
  { lc:"JY", order:1, st_ja:"★東京", st_en:"★Tokyo", hub_bonus_deck:5, hub_rank_deck:"S" },
  // JY-2: 神田（Hub B, hub_bonus_deck=2）
  { lc:"JY", order:2, st_ja:"★神田", st_en:"★Kanda", hub_bonus_deck:2, hub_rank_deck:"B" },
  // JY-3: 上野（Hub B, hub_bonus_deck=2）
  { lc:"JY", order:3, st_ja:"★上野", st_en:"★Ueno", hub_bonus_deck:2, hub_rank_deck:"B" },
  // JY-4: 池袋（Hub B, hub_bonus_deck=2）
  { lc:"JY", order:4, st_ja:"★池袋", st_en:"★Ikebukuro", hub_bonus_deck:2, hub_rank_deck:"B" },
  // JY-5: 高田馬場（通常, hub_bonus_deck=0）
  { lc:"JY", order:5, st_ja:"高田馬場", st_en:"Takadanobaba", hub_bonus_deck:0, hub_rank_deck:"C" },
  // JY-6: 新宿（Hub B, hub_bonus_deck=2）
  { lc:"JY", order:6, st_ja:"★新宿", st_en:"★Shinjuku", hub_bonus_deck:2, hub_rank_deck:"B" },
  // JY-7: 渋谷（通常, hub_bonus_deck=0）
  { lc:"JY", order:7, st_ja:"渋谷", st_en:"Shibuya", hub_bonus_deck:0, hub_rank_deck:"C" },
  // JY-8: 目黒（通常, hub_bonus_deck=0）
  { lc:"JY", order:8, st_ja:"目黒", st_en:"Meguro", hub_bonus_deck:0, hub_rank_deck:"C" },
  // M-1: 池袋（Hub B, hub_bonus_deck=2）
  { lc:"M",  order:1, st_ja:"★池袋", st_en:"★Ikebukuro", hub_bonus_deck:2, hub_rank_deck:"B" },
];

console.log("\n=== GUNO V6 Scoring テスト ===\n");

// ── Test 1: 定数 ──
console.log("【Test 1】定数");
eq(STATION_POINT, 1, "STATION_POINT = 1");
assert(typeof HUB_RANK_LABEL === "object", "HUB_RANK_LABEL はオブジェクト");
eq(HUB_RANK_LABEL["S"], "超主要駅", "HUB_RANK_LABEL.S = 超主要駅");
eq(HUB_RANK_LABEL["C"], "通常駅", "HUB_RANK_LABEL.C = 通常駅");

// ── Test 2: calcScoreV5Compat（Hub Bonus なし）──
console.log("\n【Test 2】calcScoreV5Compat（V5互換）");
// P1: guno=2 → 20pt + 5スロット = 25pt
eq(calcScoreV5Compat(PLAYERS[0], 0, MAP_STATE), 25, "P1 V5互換スコア = 25");
// P2: guno=1 → 10pt + 3スロット = 13pt
eq(calcScoreV5Compat(PLAYERS[1], 1, MAP_STATE), 13, "P2 V5互換スコア = 13");
// P3: guno=0 → 0pt + 1スロット = 1pt
eq(calcScoreV5Compat(PLAYERS[2], 2, MAP_STATE), 1, "P3 V5互換スコア = 1");
// P4: guno=0 → 0pt + 0スロット = 0pt
eq(calcScoreV5Compat(PLAYERS[3], 3, MAP_STATE), 0, "P4 V5互換スコア = 0");

// ── Test 3: calcScoreDetail（Hub Bonus 込み）──
console.log("\n【Test 3】calcScoreDetail（Hub Bonus 込み）");

// P1: 5スロット所有（JY-1〜5）
// Hub: JY-1(東京)=5, JY-2(神田)=2, JY-3(上野)=2, JY-4(池袋)=2, JY-5(高田馬場)=0 → hubBonus=11
// Total: 20(guno) + 5(station) + 11(hub) = 36
const p1Detail = calcScoreDetail({ player:PLAYERS[0], playerIdx:0, mapState:MAP_STATE, stationsDB:STATIONS_DB });
eq(p1Detail.gunoPoints,    20, "P1 gunoPoints = 20");
eq(p1Detail.stationPoints,  5, "P1 stationPoints = 5");
eq(p1Detail.hubBonus,      11, "P1 hubBonus = 11 (東京5+神田2+上野2+池袋2)");
eq(p1Detail.total,         36, "P1 total = 36");
eq(p1Detail.hubDetails.length, 4, "P1 hubDetails 4件（hub_bonus_deck > 0 の駅）");
assert(p1Detail.isAlive, "P1 isAlive = true");

// P2: 3スロット所有（JY-6〜8）
// Hub: JY-6(新宿)=2, JY-7(渋谷)=0, JY-8(目黒)=0 → hubBonus=2
// Total: 10(guno) + 3(station) + 2(hub) = 15
const p2Detail = calcScoreDetail({ player:PLAYERS[1], playerIdx:1, mapState:MAP_STATE, stationsDB:STATIONS_DB });
eq(p2Detail.gunoPoints,   10, "P2 gunoPoints = 10");
eq(p2Detail.stationPoints, 3, "P2 stationPoints = 3");
eq(p2Detail.hubBonus,      2, "P2 hubBonus = 2 (新宿2)");
eq(p2Detail.total,        15, "P2 total = 15");

// P3: 1スロット所有（M-1: 池袋）
// Hub: M-1(池袋)=2 → hubBonus=2
// Total: 0(guno) + 1(station) + 2(hub) = 3
const p3Detail = calcScoreDetail({ player:PLAYERS[2], playerIdx:2, mapState:MAP_STATE, stationsDB:STATIONS_DB });
eq(p3Detail.hubBonus, 2, "P3 hubBonus = 2 (M池袋)");
eq(p3Detail.total,    3, "P3 total = 3");
assert(!p3Detail.isAlive, "P3 isAlive = false（eliminated）");

// P4: 0スロット
const p4Detail = calcScoreDetail({ player:PLAYERS[3], playerIdx:3, mapState:MAP_STATE, stationsDB:STATIONS_DB });
eq(p4Detail.total, 0, "P4 total = 0");

// stationsDB なし（Hub Bonus = 0）
const p1NoHub = calcScoreDetail({ player:PLAYERS[0], playerIdx:0, mapState:MAP_STATE });
eq(p1NoHub.hubBonus, 0, "stationsDB なし → hubBonus = 0");
eq(p1NoHub.total, 25, "stationsDB なし → total = V5互換スコア");

// ── Test 4: calcScore（シンプル API）──
console.log("\n【Test 4】calcScore（シンプル API）");
eq(calcScore(PLAYERS[0], 0, MAP_STATE, STATIONS_DB), 36, "calcScore P1 = 36");
eq(calcScore(PLAYERS[1], 1, MAP_STATE, STATIONS_DB), 15, "calcScore P2 = 15");
eq(calcScore(PLAYERS[0], 0, MAP_STATE),              25, "calcScore P1 (no hub) = 25");

// ── Test 5: calcRanking ──
console.log("\n【Test 5】calcRanking");
const ranking = calcRanking(PLAYERS, MAP_STATE, STATIONS_DB);
eq(ranking.length, 4, "ランキング 4件");
// P1が1位（生存かつ最高スコア36）
eq(ranking[0].playerIdx, 0, "1位 = P1");
eq(ranking[0].rank, 1, "P1 rank = 1");
eq(ranking[0].total, 36, "P1 total = 36");
// P3は eliminated なので最後
eq(ranking[3].playerIdx, 2, "最下位 = P3（eliminated）");
assert(!ranking[3].isAlive, "最下位は eliminated");

// Hub Bonus なしランキング
const rankingNoHub = calcRanking(PLAYERS, MAP_STATE);
eq(rankingNoHub[0].playerIdx, 0, "Hub なし 1位 = P1");
eq(rankingNoHub[0].total, 25, "Hub なし P1 total = 25");

// ── Test 6: calcRouteStats ──
console.log("\n【Test 6】calcRouteStats");
const lastHits = { JY: 0 }; // P1が JY を GUNO 達成
const routeStats = calcRouteStats(["JY", "M"], MAP_STATE, lastHits, PLAYERS);
eq(routeStats.length, 2, "routeStats 2路線");

const jyStat = routeStats.find(r => r.lc === "JY");
eq(jyStat.filledSlots, 8, "JY filledSlots = 8");
eq(jyStat.completionRate, 0.8, "JY completionRate = 0.8");
eq(jyStat.gunoAchieverIdx, 0, "JY gunoAchiever = P1");
eq(jyStat.dominantPlayerIdx, 0, "JY dominant = P1（5スロット）");

const mStat = routeStats.find(r => r.lc === "M");
eq(mStat.filledSlots, 1, "M filledSlots = 1");
assert(mStat.gunoAchieverIdx === null, "M gunoAchiever = null（未達成）");

// ── Test 7: buildGameStats（フルゲームシミュレーション）──
console.log("\n【Test 7】buildGameStats（フルゲームシミュレーション）");

// ミニパックで CPU フルゲームを実行
const MINI_PACK = {
  meta: { pack_id:"mini", pack_version:"1.0", name:"Mini", description:"" },
  routes: [
    {
      lc:"JY", name_ja:"山手線", name_en:"Yamanote", color:"#00AA00", size:10,
      members: Array.from({length:10}, (_, i) => ({
        order: i+1, id:`jy-${i+1}`,
        name_ja: `JY駅${i+1}`, name_en: `JY-St${i+1}`,
        isHub: i < 3,
        hub_degree_deck: i < 3 ? 2 : 1, hub_bonus_deck: i < 3 ? 2 : 0, hub_rank_deck: i < 3 ? "B" : "C",
        hub_degree_global: 1, hub_bonus_global: 0, hub_rank_global: "C",
      }))
    },
    {
      lc:"M", name_ja:"丸ノ内線", name_en:"Marunouchi", color:"#F62E36", size:10,
      members: Array.from({length:10}, (_, i) => ({
        order: i+1, id:`m-${i+1}`,
        name_ja: `M駅${i+1}`, name_en: `M-St${i+1}`,
        isHub: false,
        hub_degree_deck: 1, hub_bonus_deck: 0, hub_rank_deck: "C",
        hub_degree_global: 1, hub_bonus_global: 0, hub_rank_global: "C",
      }))
    }
  ],
  stations: [],
  teidenMap: { JY: "JY_TEIDEN", M: "M_TEIDEN" },
  raw: {},
};

// stations を生成
for (const route of MINI_PACK.routes) {
  for (const slot of route.members) {
    MINI_PACK.stations.push({
      lc: route.lc, name_ja: route.name_ja, name_en: route.name_en,
      order: slot.order, st_ja: slot.name_ja, st_en: slot.name_en,
      color: route.color, file: `${route.lc}_${slot.order}`,
      ...slot,
    });
  }
}

const PLAYER_CONFIGS = [
  { name:"P1", icon:"🌊", color:"#174a7c", isHuman:false },
  { name:"P2", icon:"🌸", color:"#b52942", isHuman:false },
  { name:"P3", icon:"🌙", color:"#e6b422", isHuman:false },
  { name:"P4", icon:"🏯", color:"#745399", isHuman:false },
];

let seed = 99;
function rng() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0x100000000;
}

const gameState = initGame({ packData: MINI_PACK, playerConfigs: PLAYER_CONFIGS, rng });
const emit = () => {};

let maxTurns = 500;
while (!gameState.gameOver && maxTurns-- > 0) {
  runCpuTurn(gameState, emit);
  if (!gameState.gameOver) endTurn(gameState, emit);
}

assert(gameState.gameOver, "ゲームが終了している");

const stats = buildGameStats(gameState, MINI_PACK.stations);
assert(stats.ranking.length === 4, "ranking 4件");
assert(stats.routeStats.length === 2, "routeStats 2路線");
assert(typeof stats.turnCount === "number" && stats.turnCount > 0, `turnCount > 0 (= ${stats.turnCount})`);
assert(stats.winner !== null, "winner が存在する");
console.log(`  ℹ ゲーム終了 turnCount=${stats.turnCount}, winner=${stats.winner.playerName}(${stats.winner.total}pt)`);

// ── 結果 ──
console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
