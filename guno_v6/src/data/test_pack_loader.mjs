/**
 * guno_v6/src/data/test_pack_loader.mjs
 * pack_loader.js の動作確認スクリプト（Node.js ESM）
 *
 * 実行方法:
 *   node guno_v6/src/data/test_pack_loader.mjs
 */

import { loadPackFromJson, summarizePack, toStationsDB, toTeidenFiles } from "./pack_loader.js";

// ===== テスト用 GUNO Pack v1.0 サンプル =====
// V5 の実際のデータ（JY・M・G・T 4路線）を模したミニパック
const SAMPLE_PACK_V1 = {
  pack_meta: {
    pack_id: "test-tokyo-4lines",
    pack_version: "1.0",
    name: "東京4路線テストパック",
    description: "pack_loader.js 動作確認用"
  },
  entities: {
    "st-tokyo": {
      type: "station",
      name_ja: "東京",
      name_en: "Tokyo",
      cross_lines: ["M", "G", "T"]  // JY + M + G + T = degree 4 (global S)
    },
    "st-shinjuku": {
      type: "station",
      name_ja: "新宿",
      name_en: "Shinjuku",
      cross_lines: ["M"]  // JY + M = degree 2 (B)
    },
    "st-shibuya": {
      type: "station",
      name_ja: "渋谷",
      name_en: "Shibuya",
      cross_lines: ["G"]  // JY + G = degree 2 (B)
    },
    "st-ueno": {
      type: "station",
      name_ja: "上野",
      name_en: "Ueno",
      cross_lines: ["G"]  // JY + G = degree 2 (B)
    },
    "st-ikebukuro": {
      type: "station",
      name_ja: "池袋",
      name_en: "Ikebukuro",
      cross_lines: ["M"]  // JY + M = degree 2 (B)
    },
    "st-kanda": {
      type: "station",
      name_ja: "神田",
      name_en: "Kanda",
      cross_lines: ["G"]  // JY + G = degree 2 (B)
    },
    "st-meguro": {
      type: "station",
      name_ja: "目黒",
      name_en: "Meguro",
      cross_lines: []
    },
    "st-shinagawa": {
      type: "station",
      name_ja: "品川",
      name_en: "Shinagawa",
      cross_lines: []
    },
    "st-shimbashi": {
      type: "station",
      name_ja: "新橋",
      name_en: "Shimbashi",
      cross_lines: ["G"]  // JY + G = degree 2 (B)
    },
    "st-takadanobaba": {
      type: "station",
      name_ja: "高田馬場",
      name_en: "Takadanobaba",
      cross_lines: ["T"]  // JY + T = degree 2 (B)
    },
    // 丸ノ内線
    "st-korakuen": {
      type: "station",
      name_ja: "後楽園",
      name_en: "Korakuen",
      cross_lines: []
    },
    "st-ochanomizu": {
      type: "station",
      name_ja: "御茶ノ水",
      name_en: "Ochanomizu",
      cross_lines: []
    },
    "st-otemachi": {
      type: "station",
      name_ja: "大手町",
      name_en: "Otemachi",
      cross_lines: ["T"]  // M + T = degree 2 (B)
    },
    "st-ginza": {
      type: "station",
      name_ja: "銀座",
      name_en: "Ginza",
      cross_lines: ["G"]  // M + G = degree 2 (B)
    },
    "st-akasaka": {
      type: "station",
      name_ja: "赤坂見附",
      name_en: "Akasaka-mitsuke",
      cross_lines: ["G"]  // M + G = degree 2 (B)
    },
    "st-yotsuya": {
      type: "station",
      name_ja: "四ツ谷",
      name_en: "Yotsuya",
      cross_lines: []
    },
    "st-nakano-sakaue": {
      type: "station",
      name_ja: "中野坂上",
      name_en: "Nakano-sakaue",
      cross_lines: []
    }
  },
  collections: {
    "JY": {
      kind: "route",
      lc: "JY",
      name_ja: "山手線",
      name_en: "Yamanote",
      color: "#00AA00",
      size: 10,
      members: [
        "st-tokyo", "st-kanda", "st-ueno", "st-ikebukuro",
        "st-takadanobaba", "st-shinjuku", "st-shibuya",
        "st-meguro", "st-shinagawa", "st-shimbashi"
      ]
    },
    "M": {
      kind: "route",
      lc: "M",
      name_ja: "丸ノ内線",
      name_en: "Marunouchi",
      color: "#F62E36",
      size: 10,
      members: [
        "st-ikebukuro", "st-korakuen", "st-ochanomizu", "st-otemachi",
        "st-tokyo", "st-ginza", "st-akasaka", "st-yotsuya",
        "st-shinjuku", "st-nakano-sakaue"
      ]
    }
  },
  layouts: {
    default: {
      slots: [
        { collection_id: "JY" },
        { collection_id: "M" }
      ]
    }
  },
  rules: {
    hand_size: 7,
    guno_point: 10
  }
};

// ===== テスト実行 =====

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function assertEq(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message} (= ${JSON.stringify(actual)})`);
    passed++;
  } else {
    console.error(`  ✗ ${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log("\n=== GUNO V6 pack_loader.js テスト ===\n");

// ── Test 1: 正常パース ──
console.log("【Test 1】正常パース");
let packData;
try {
  packData = loadPackFromJson(JSON.stringify(SAMPLE_PACK_V1));
  assert(true, "loadPackFromJson が例外なく完了");
} catch (e) {
  assert(false, `loadPackFromJson が例外: ${e.message}`);
  process.exit(1);
}

// ── Test 2: meta ──
console.log("\n【Test 2】meta フィールド");
assertEq(packData.meta.pack_id, "test-tokyo-4lines", "pack_id");
assertEq(packData.meta.pack_version, "1.0", "pack_version");
assertEq(packData.meta.name, "東京4路線テストパック", "name");

// ── Test 3: routes ──
console.log("\n【Test 3】routes");
assertEq(packData.routes.length, 2, "路線数 = 2");
assertEq(packData.routes[0].lc, "JY", "routes[0].lc = JY");
assertEq(packData.routes[1].lc, "M", "routes[1].lc = M");
assertEq(packData.routes[0].size, 10, "JY.size = 10");
assertEq(packData.routes[0].members.length, 10, "JY.members.length = 10");
assertEq(packData.routes[0].members[0].name_ja, "東京", "JY.members[0].name_ja = 東京");

// ── Test 4: Hub 値（deck） ──
console.log("\n【Test 4】Hub 値（deck）");
// 東京駅: JY に登場、cross_lines = [M, G, T] → deck内はJY+M → hub_degree_deck = 2
const tokyoSlot = packData.routes[0].members[0]; // JY order=1 = 東京
assertEq(tokyoSlot.hub_degree_deck, 2, "東京(JY) hub_degree_deck = 2 (JY+M)");
assertEq(tokyoSlot.hub_bonus_deck, 2, "東京(JY) hub_bonus_deck = 2");
assertEq(tokyoSlot.hub_rank_deck, "B", "東京(JY) hub_rank_deck = B");

// 東京駅 global: cross_lines=[M,G,T] → degree = 4 (S)
assertEq(tokyoSlot.hub_degree_global, 4, "東京(JY) hub_degree_global = 4");
assertEq(tokyoSlot.hub_rank_global, "S", "東京(JY) hub_rank_global = S");

// 目黒駅: cross_lines=[] → hub_degree_deck = 1 (C)
const meguroSlot = packData.routes[0].members[7]; // JY order=8 = 目黒
assertEq(meguroSlot.hub_degree_deck, 1, "目黒(JY) hub_degree_deck = 1");
assertEq(meguroSlot.hub_rank_deck, "C", "目黒(JY) hub_rank_deck = C");

// ── Test 5: stations（駅カードリスト） ──
console.log("\n【Test 5】stations");
const stations = toStationsDB(packData);
// JY 10枚 + M 10枚 = 20枚
assertEq(stations.length, 20, "全駅カード数 = 20");

// 乗換駅（複数路線に登場）に ★ が付くか
const tokyoCard = stations.find(s => s.lc === "JY" && s.order === 1);
assert(tokyoCard?.st_ja.startsWith("★"), "東京(JY) st_ja に ★ が付く");

// 単独駅に ★ が付かないか
const meguroCard = stations.find(s => s.lc === "JY" && s.order === 8);
assert(!meguroCard?.st_ja.startsWith("★"), "目黒(JY) st_ja に ★ が付かない");

// hub_bonus_deck が含まれているか
assert(typeof tokyoCard?.hub_bonus_deck === "number", "東京(JY) hub_bonus_deck が数値");

// ── Test 6: teidenMap ──
console.log("\n【Test 6】teidenMap");
const teiden = toTeidenFiles(packData);
assertEq(teiden["JY"], "JY_TEIDEN", "JY の停電カード");
assertEq(teiden["M"], "M_TEIDEN", "M の停電カード");

// ── Test 7: summarizePack ──
console.log("\n【Test 7】summarizePack");
const summary = summarizePack(packData);
assert(summary.includes("東京4路線テストパック"), "summary に pack 名が含まれる");
assert(summary.includes("JY"), "summary に JY が含まれる");
console.log("  Summary:\n" + summary.split("\n").map(l => "    " + l).join("\n"));

// ── Test 8: バリデーション（不正なpack） ──
console.log("\n【Test 8】バリデーション（不正な pack）");
try {
  loadPackFromJson(JSON.stringify({ pack_meta: { pack_version: "0.1" } }));
  assert(false, "v0.1 は拒否されるべき");
} catch (e) {
  assert(e.message.includes("Unsupported"), `v0.1 が正しく拒否: ${e.message}`);
}
try {
  loadPackFromJson(JSON.stringify({ pack_meta: { pack_version: "1.0" } }));
  assert(false, "entities なしは拒否されるべき");
} catch (e) {
  assert(e.message.includes("missing required key"), `entities なしが正しく拒否: ${e.message}`);
}

// ── 結果 ──
console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
