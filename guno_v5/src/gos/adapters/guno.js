import { displayName } from "../core/query.js";

function stripStar(s) { return (s || "").replace(/^★+/, ""); }

function deriveLineCode(collectionId, collectionObj) {
  return (collectionObj?.lc || collectionObj?.line_code || collectionId);
}

function computeInterchangeStars(routes) {
  const counts = new Map();
  for (const r of routes) {
    for (const st of r.members) {
      if (!st) continue;
      counts.set(st.id, (counts.get(st.id) || 0) + 1);
    }
  }
  return counts;
}

export function toV5Data(model, opts = {}) {
  const locale = opts.locale || "ja";
  const pack = model.raw;
  const layout = pack.layouts?.default;
  const slotDefs = Array.isArray(layout?.slots) ? layout.slots : [];

  const routes = slotDefs.map((s) => {
    const cid = s.collection_id;
    const c = pack.collections?.[cid];
    if (!c) return null;
    return {
      collection_id: cid, lc: deriveLineCode(cid, c),
      name_ja: c.name_ja, name_en: c.name_en, color: c.color,
      members: (Array.isArray(c.members) ? c.members : []).map(eid => {
        if (!eid) return null;
        const e = pack.entities?.[eid];
        return { id: eid, type: e?.type || "", name_ja: e?.name_ja, name_en: e?.name_en };
      })
    };
  }).filter(Boolean);

  const counts = computeInterchangeStars(routes);

  // 1. STATIONS_DB
  const STATIONS_DB = [];
  for (const r of routes) {
    for (let i = 0; i < r.members.length; i++) {
      const st = r.members[i];
      if (!st) continue;
      const isStar = (counts.get(st.id) || 0) >= 2;
      const prefix = isStar ? "★" : "";
      STATIONS_DB.push({
        lc: r.lc, name_ja: r.name_ja, name_en: r.name_en, order: i + 1,
        st_ja: prefix + (st.name_ja || st.id), st_en: prefix + (st.name_en || st.id),
        color: r.color || "#fff", file: `${r.lc}_${String(i+1).padStart(2,'0')}_${stripStar(st.name_en || st.id)}`
      });
    }
  }

  // 2. STATION_DB_CARDS
  const STATION_DB_CARDS = [];
  for (const r of routes) {
    for (let i = 0; i < r.members.length; i++) {
      const st = r.members[i];
      if (!st) continue;
      STATION_DB_CARDS.push({ line: r.lc, num: i + 1, jp: stripStar(st.name_ja), en: stripStar(st.name_en) });
    }
  }

  // 3. TEIDEN_FILES
  const TEIDEN_FILES = {};
  for (const r of routes) {
    TEIDEN_FILES[r.lc] = `${r.lc}_TEIDEN`;
  }

  return { locale, pack_id: pack.pack_meta?.pack_id || "", name: pack.pack_meta?.name || "", STATIONS_DB, STATION_DB_CARDS, TEIDEN_FILES };
}