export function normalize(packObj) {
  const entities = packObj.entities || {};
  const collections = packObj.collections || {};

  const entitiesById = new Map(Object.entries(entities));
  const collectionsById = new Map(Object.entries(collections));
  const collectionMembers = new Map();

  for (const [cid, c] of collectionsById.entries()) {
    const members = Array.isArray(c.members) ? c.members.slice() : [];
    const size = Number.isInteger(c.size) ? c.size : null;
    if (size != null) {
      while (members.length < size) members.push(null);
      if (members.length > size) members.length = size;
    }
    collectionMembers.set(cid, members);
  }

  const indexByType = new Map();
  for (const [id, e] of entitiesById.entries()) {
    const t = e?.type || "";
    if (!indexByType.has(t)) indexByType.set(t, []);
    indexByType.get(t).push(id);
  }

  return { pack_meta: packObj.pack_meta, entitiesById, collectionsById, collectionMembers, indexes: { byType: indexByType }, raw: packObj };
}

export function denormalize(model) { return model.raw; }