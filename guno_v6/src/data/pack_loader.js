/**
 * guno_v6/src/data/pack_loader.js
 * GUNO Pack v1.0 ローダー
 *
 * V5 の gos/core/io.js・model.js・adapters/guno.js を参考に、
 * V6 向けにクリーンに再実装したモジュール。
 *
 * 主な責務:
 *   1. GUNO Pack JSON のバリデーションとパース
 *   2. Hub 値（global / deck）の計算・付与
 *   3. ゲームエンジンが使いやすい形式（PackData）への変換
 *
 * PackData 構造:
 *   {
 *     meta:      { pack_id, pack_version, name, description }
 *     routes:    Route[]          // 路線リスト（スロット順）
 *     stations:  StationCard[]    // 全駅カードリスト（deck生成用）
 *     teidenMap: { [lc]: string } // 停電カードファイル名マップ
 *     raw:       object           // 元のJSONオブジェクト
 *   }
 *
 * Route 構造:
 *   { lc, name_ja, name_en, color, size, members: StationSlot[] }
 *
 * StationSlot 構造:
 *   { order, id, name_ja, name_en, isHub, hub_degree_deck, hub_bonus_deck, hub_rank_deck }
 *   | null  (空スロット)
 *
 * StationCard 構造（deck生成用）:
 *   { lc, name_ja, name_en, order, st_ja, st_en, color, file,
 *     hub_degree_deck, hub_bonus_deck, hub_rank_deck,
 *     hub_degree_global, hub_bonus_global, hub_rank_global }
 */

// ===== 定数 =====
const SUPPORTED_VERSIONS = ["1.0"];
const REQUIRED_PACK_KEYS = ["entities", "collections", "layouts", "rules"];

// ===== Hub ランク計算 =====

/**
 * hub_degree から hub_rank を算出する。
 * @param {number} degree
 * @returns {"S"|"A"|"B"|"C"}
 */
function calcHubRank(degree) {
  if (degree >= 4) return "S";
  if (degree === 3) return "A";
  if (degree === 2) return "B";
  return "C";
}

// ===== 内部ユーティリティ =====

/** ★プレフィックスを除去する */
function stripStar(s) {
  return (s || "").replace(/^★+/, "");
}

/** コレクションから路線コードを取得する */
function deriveLineCode(collectionId, collectionObj) {
  return collectionObj?.lc || collectionObj?.line_code || collectionId;
}

/** デッキに含まれる路線コードのセットを返す */
function getDeckLineSet(pack) {
  const set = new Set();
  for (const col of Object.values(pack.collections || {})) {
    if (col.kind === "route" && col.lc) set.add(col.lc);
  }
  return set;
}

// ===== バリデーション =====

/**
 * GUNO Pack オブジェクトを検証する。
 * @param {object} obj
 * @throws {Error} バリデーション失敗時
 */
function validatePack(obj) {
  if (!obj?.pack_meta?.pack_version) {
    throw new Error("Invalid pack: missing pack_meta.pack_version");
  }
  if (!SUPPORTED_VERSIONS.includes(obj.pack_meta.pack_version)) {
    throw new Error(
      `Unsupported pack_version: "${obj.pack_meta.pack_version}". ` +
      `Supported: ${SUPPORTED_VERSIONS.join(", ")}`
    );
  }
  for (const key of REQUIRED_PACK_KEYS) {
    if (!obj[key]) {
      throw new Error(`Invalid pack: missing required key "${key}"`);
    }
  }
}

// ===== Hub 値計算 =====

/**
 * 全エンティティに global / deck 両方の Hub 値を付与して返す（非破壊）。
 * @param {object} pack
 * @returns {object} Hub 付与済みの pack（新しいオブジェクト）
 */
function attachHubValues(pack) {
  const p = JSON.parse(JSON.stringify(pack)); // ディープコピー
  const deckLines = getDeckLineSet(p);

  for (const [eid, entity] of Object.entries(p.entities || {})) {
    if (entity.type !== "station") continue;

    // station_code 補完（v0.2 互換）
    if (!entity.station_code) entity.station_code = eid;

    const cross = entity.cross_lines || [];

    // Global Hub（全路線での乗換規模）
    const globalDeg = 1 + cross.length;
    entity.hub_degree_global = globalDeg;
    entity.hub_bonus_global  = (globalDeg - 1) * 2;
    entity.hub_rank_global   = calcHubRank(globalDeg);

    // Deck Hub（デッキ内路線での乗換規模）— ゲームスコアに使用
    const deckCross = cross.filter(lc => deckLines.has(lc));
    const deckDeg = 1 + deckCross.length;
    entity.hub_degree_deck = deckDeg;
    entity.hub_bonus_deck  = (deckDeg - 1) * 2;
    entity.hub_rank_deck   = calcHubRank(deckDeg);

    // エイリアス（global と同値、後方互換）
    entity.hub_degree = globalDeg;
    entity.hub_bonus  = entity.hub_bonus_global;
    entity.hub_rank   = entity.hub_rank_global;
  }
  return p;
}

// ===== Pack → PackData 変換 =====

/**
 * GUNO Pack オブジェクトを V6 ゲームエンジン用の PackData に変換する。
 * @param {object} pack Hub 付与済みの pack オブジェクト
 * @returns {PackData}
 */
function convertToPackData(pack) {
  const layout = pack.layouts?.default;
  const slotDefs = Array.isArray(layout?.slots) ? layout.slots : [];

  // ── 路線リスト（スロット順） ──
  const routes = slotDefs
    .map((slot) => {
      const cid = slot.collection_id;
      const col = pack.collections?.[cid];
      if (!col) return null;

      const lc = deriveLineCode(cid, col);
      const rawMembers = Array.isArray(col.members) ? col.members : [];
      const size = Number.isInteger(col.size) ? col.size : rawMembers.length;

      // スロットメンバーを正規化（size に合わせてパディング）
      const members = Array.from({ length: size }, (_, i) => {
        const eid = rawMembers[i] ?? null;
        if (!eid) return null;
        const entity = pack.entities?.[eid];
        if (!entity) return null;

        return {
          order: i + 1,
          id: eid,
          name_ja: entity.name_ja || eid,
          name_en: entity.name_en || eid,
          isHub: (entity.hub_degree_deck ?? 1) >= 2,
          hub_degree_deck:  entity.hub_degree_deck  ?? 1,
          hub_bonus_deck:   entity.hub_bonus_deck   ?? 0,
          hub_rank_deck:    entity.hub_rank_deck     ?? "C",
          hub_degree_global: entity.hub_degree_global ?? 1,
          hub_bonus_global:  entity.hub_bonus_global  ?? 0,
          hub_rank_global:   entity.hub_rank_global   ?? "C",
        };
      });

      return {
        lc,
        name_ja: col.name_ja || lc,
        name_en: col.name_en || lc,
        color: col.color || "#ffffff",
        size,
        members,
      };
    })
    .filter(Boolean);

  // ── 乗換駅判定（複数路線に登場する駅に ★ を付ける） ──
  const stationAppearCount = new Map();
  for (const route of routes) {
    for (const slot of route.members) {
      if (!slot) continue;
      stationAppearCount.set(slot.id, (stationAppearCount.get(slot.id) ?? 0) + 1);
    }
  }

  // ── 駅カードリスト（deck 生成用） ──
  const stations = [];
  for (const route of routes) {
    for (const slot of route.members) {
      if (!slot) continue;
      const isInterchange = (stationAppearCount.get(slot.id) ?? 0) >= 2;
      const prefix = isInterchange ? "★" : "";

      stations.push({
        lc:       route.lc,
        name_ja:  route.name_ja,
        name_en:  route.name_en,
        order:    slot.order,
        st_ja:    prefix + slot.name_ja,
        st_en:    prefix + slot.name_en,
        color:    route.color,
        file:     `${route.lc}_${String(slot.order).padStart(2, "0")}_${stripStar(slot.name_en)}`,
        hub_degree_deck:   slot.hub_degree_deck,
        hub_bonus_deck:    slot.hub_bonus_deck,
        hub_rank_deck:     slot.hub_rank_deck,
        hub_degree_global: slot.hub_degree_global,
        hub_bonus_global:  slot.hub_bonus_global,
        hub_rank_global:   slot.hub_rank_global,
      });
    }
  }

  // ── 停電カードマップ ──
  const teidenMap = {};
  for (const route of routes) {
    teidenMap[route.lc] = `${route.lc}_TEIDEN`;
  }

  return {
    meta: {
      pack_id:      pack.pack_meta?.pack_id      ?? "",
      pack_version: pack.pack_meta?.pack_version ?? "1.0",
      name:         pack.pack_meta?.name         ?? "",
      description:  pack.pack_meta?.description  ?? "",
    },
    routes,
    stations,
    teidenMap,
    raw: pack,
  };
}

// ===== 公開 API =====

/**
 * GUNO Pack の JSON 文字列をパースして PackData を返す。
 *
 * @param {string} jsonText - GUNO Pack v1.0 の JSON 文字列
 * @returns {PackData}
 * @throws {Error} バリデーション失敗時
 *
 * @example
 * const res = await fetch("/packs/tokyo_4lines.json");
 * const packData = loadPackFromJson(await res.text());
 */
export function loadPackFromJson(jsonText) {
  const obj = JSON.parse(jsonText);
  validatePack(obj);
  const packWithHubs = attachHubValues(obj);
  return convertToPackData(packWithHubs);
}

/**
 * GUNO Pack のオブジェクトを受け取って PackData を返す。
 * すでにパース済みのオブジェクトを渡す場合に使用する。
 *
 * @param {object} packObj - GUNO Pack v1.0 オブジェクト
 * @returns {PackData}
 * @throws {Error} バリデーション失敗時
 */
export function loadPackFromObject(packObj) {
  validatePack(packObj);
  const packWithHubs = attachHubValues(packObj);
  return convertToPackData(packWithHubs);
}

/**
 * URL から GUNO Pack を fetch して PackData を返す。
 *
 * @param {string} url - GUNO Pack JSON の URL
 * @returns {Promise<PackData>}
 *
 * @example
 * const packData = await loadPackFromUrl("/packs/tokyo_4lines.json");
 */
export async function loadPackFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch pack: ${res.status} ${res.statusText} (${url})`);
  }
  const text = await res.text();
  return loadPackFromJson(text);
}

/**
 * PackData から V5 互換の STATIONS_DB 形式の配列を返す。
 * V5 の window.STATIONS_DB と同じ構造なので、V5 コードとの互換性を保てる。
 *
 * @param {PackData} packData
 * @returns {StationCard[]}
 */
export function toStationsDB(packData) {
  return packData.stations;
}

/**
 * PackData から V5 互換の TEIDEN_FILES オブジェクトを返す。
 *
 * @param {PackData} packData
 * @returns {{ [lc: string]: string }}
 */
export function toTeidenFiles(packData) {
  return { ...packData.teidenMap };
}

/**
 * PackData の概要を文字列で返す（デバッグ用）。
 *
 * @param {PackData} packData
 * @returns {string}
 */
export function summarizePack(packData) {
  const { meta, routes, stations } = packData;
  const lines = [
    `Pack: ${meta.name} (${meta.pack_id}) v${meta.pack_version}`,
    `Routes: ${routes.map(r => `${r.lc}(${r.name_ja})`).join(", ")}`,
    `Total stations: ${stations.length}`,
    `Hub stations (deck): ${stations.filter(s => s.hub_degree_deck >= 2).length}`,
  ];
  return lines.join("\n");
}
