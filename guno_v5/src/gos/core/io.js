const DEFAULT_LOCAL_KEY = "gos_pack_v0_1";

const SUPPORTED_VERSIONS = ["0.1", "0.2", "1.0"];

// ─────────────────────────────────────────
// Hub Rank計算（共通）
// ─────────────────────────────────────────

function calcHubRank(hubDegree) {
  if (hubDegree >= 4) return "S";
  if (hubDegree === 3) return "A";
  if (hubDegree === 2) return "B";
  return "C";
}

// ─────────────────────────────────────────
// Step1: Deck路線セット取得
// ─────────────────────────────────────────

function getDeckLines(packObj) {
  const deckLines = new Set();
  for (const col of Object.values(packObj.collections || {})) {
    if (col.kind === "route" && col.lc) deckLines.add(col.lc);
  }
  return deckLines;
}

// ─────────────────────────────────────────
// Step2: Global Hub計算
// ─────────────────────────────────────────

function calcGlobalHub(entity) {
  const cross = entity.cross_lines || [];
  const deg = 1 + cross.length;
  return {
    hub_degree_global: deg,
    hub_bonus_global: (deg - 1) * 2,
    hub_rank_global: calcHubRank(deg),
  };
}

// ─────────────────────────────────────────
// Step3: Deck Hub計算
// ─────────────────────────────────────────

function calcDeckHub(entity, deckLines) {
  const cross = entity.cross_lines || [];
  const deckCross = cross.filter(lc => deckLines.has(lc));
  const deg = 1 + deckCross.length;
  return {
    hub_degree_deck: deg,
    hub_bonus_deck: (deg - 1) * 2,
    hub_rank_deck: calcHubRank(deg),
  };
}

// ─────────────────────────────────────────
// Step4: Hub値付与（global + deck + エイリアス）
// ─────────────────────────────────────────

/**
 * packのentities全駅にglobal/deck両方のhub値を付与して返す（ディープコピー）
 * @param {object} packObj
 * @returns {object} Hub付与済みのpack（新しいオブジェクト）
 */
export function attachHubValues(packObj) {
  const pack = JSON.parse(JSON.stringify(packObj)); // ディープコピー
  const deckLines = getDeckLines(pack);

  for (const [eid, entity] of Object.entries(pack.entities || {})) {
    if (entity.type !== "station") continue;

    // station_code補完（v0.2互換）
    if (!entity.station_code) entity.station_code = eid;

    const g = calcGlobalHub(entity);
    const d = calcDeckHub(entity, deckLines);

    // global hub
    entity.hub_degree_global = g.hub_degree_global;
    entity.hub_bonus_global  = g.hub_bonus_global;
    entity.hub_rank_global   = g.hub_rank_global;

    // deck hub
    entity.hub_degree_deck = d.hub_degree_deck;
    entity.hub_bonus_deck  = d.hub_bonus_deck;
    entity.hub_rank_deck   = d.hub_rank_deck;

    // エイリアス（global hubと同値）
    entity.hub_degree = g.hub_degree_global;
    entity.hub_bonus  = g.hub_bonus_global;
    entity.hub_rank   = g.hub_rank_global;
  }
  return pack;
}

// ─────────────────────────────────────────
// Pack読み書き
// ─────────────────────────────────────────

export function parsePack(jsonText) {
  const obj = JSON.parse(jsonText);
  if (!obj?.pack_meta?.pack_version) throw new Error("Invalid pack: missing pack_meta.pack_version");
  if (!SUPPORTED_VERSIONS.includes(obj.pack_meta.pack_version)) {
    throw new Error(`Unsupported pack_version: ${obj.pack_meta.pack_version}`);
  }
  if (!obj.entities || !obj.collections || !obj.layouts || !obj.rules) {
    throw new Error("Invalid pack: missing entities/collections/layouts/rules");
  }
  return obj;
}

export function stringifyPack(packObj, opts = {}) {
  const pretty = opts.pretty ?? true;
  return JSON.stringify(packObj, null, pretty ? 2 : 0);
}

/**
 * packをJSONファイルとしてダウンロードする。
 * Hub派生値（global + deck）を自動付与してからエクスポートする。
 */
export function downloadPack(packObj, filename) {
  const name = filename || `${packObj.pack_meta?.pack_id || "gos-pack"}.json`;
  // Hub派生値（global + deck）を付与してからエクスポート
  const packWithHubs = attachHubValues(packObj);
  const text = stringifyPack(packWithHubs, { pretty: true });
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2500);
}

export function saveToLocalStorage(packObj, key = DEFAULT_LOCAL_KEY) {
  localStorage.setItem(key, stringifyPack(packObj, { pretty: false }));
}

export function loadFromLocalStorage(key = DEFAULT_LOCAL_KEY) {
  const s = localStorage.getItem(key);
  if (!s) return null;
  return parsePack(s);
}

export function clearLocalStorage(key = DEFAULT_LOCAL_KEY) {
  localStorage.removeItem(key);
}
