const DEFAULT_LOCAL_KEY = "gos_pack_v0_1";

const SUPPORTED_VERSIONS = ["0.1", "0.2", "1.0"];

// ─────────────────────────────────────────
// Hub派生値計算（仕様 §7 / CLIと同等ロジック）
// ─────────────────────────────────────────

function calcHubDegree(entity) {
  const cross = entity.cross_lines || [];
  return 1 + cross.length;
}

function calcHubBonus(hubDegree) {
  return (hubDegree - 1) * 2;
}

function calcHubRank(hubDegree) {
  if (hubDegree >= 4) return "S";
  if (hubDegree === 3) return "A";
  if (hubDegree === 2) return "B";
  return "C";
}

/**
 * packのentities全駅にhub_degree/hub_bonus/hub_rankを付与して返す（破壊的変更なし）
 * @param {object} packObj
 * @returns {object} Hub付与済みのpack（新しいオブジェクト）
 */
export function attachHubValues(packObj) {
  const pack = JSON.parse(JSON.stringify(packObj)); // ディープコピー
  for (const [eid, entity] of Object.entries(pack.entities || {})) {
    if (entity.type !== "station") continue;
    // station_code補完（v0.2互換）
    if (!entity.station_code) entity.station_code = eid;
    const deg = calcHubDegree(entity);
    entity.hub_degree = deg;
    entity.hub_bonus = calcHubBonus(deg);
    entity.hub_rank = calcHubRank(deg);
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
 * Hub派生値（hub_degree/hub_bonus/hub_rank）を自動付与してからエクスポートする。
 */
export function downloadPack(packObj, filename) {
  const name = filename || `${packObj.pack_meta?.pack_id || "gos-pack"}.json`;
  // Hub派生値を付与してからエクスポート
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
