export function getEntity(model, id) { return model.entitiesById.get(id) || null; }

export function listEntities(model, filter = {}) {
  const out = [];
  for (const [id, e] of model.entitiesById.entries()) {
    if (filter.type && e.type !== filter.type) continue;
    if (filter.tag && !(Array.isArray(e.tags) && e.tags.includes(filter.tag))) continue;
    out.push({ id, ...e });
  }
  return out;
}

export function getCollection(model, id) { return model.collectionsById.get(id) || null; }

export function listCollections(model, filter = {}) {
  const out = [];
  for (const [id, c] of model.collectionsById.entries()) {
    if (filter.kind && c.kind !== filter.kind) continue;
    out.push({ id, ...c });
  }
  return out;
}

export function getMembers(model, collectionId) { return model.collectionMembers.get(collectionId) || []; }

export function displayName(entity, locale = "ja") {
  if (!entity) return "";
  if (locale === "en" && entity.name_en) return entity.name_en;
  return entity.name_ja || entity.name_en || "";
}