export async function pack(packObj) {
  const { normalize } = await import("./model.js");
  return model(normalize(packObj), packObj.rules || [], packObj.entities || {});
}

export function model(m, rules = null, entitiesFallback = null, locale = "ja") {
  const issues = [];
  const raw = m.raw;
  const rulesArr = rules ?? (Array.isArray(raw.rules) ? raw.rules : []);
  const entities = entitiesFallback ?? raw.entities ?? {};
  const collections = raw.collections ?? {};

  function scopedCollectionIds(scope) {
    const kinds = (scope && Array.isArray(scope.kinds)) ? scope.kinds : [];
    return Object.entries(collections)
      .filter(([, c]) => kinds.length === 0 || kinds.includes(c.kind))
      .map(([id]) => id);
  }

  for (const r of rulesArr) {
    const level = r.level || "error";
    const scopeIds = scopedCollectionIds(r.scope);
    // 詳細なルール検証は後で拡張可能（今回は簡易化のため空実装）
  }
  return issues;
}