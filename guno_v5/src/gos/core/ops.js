// shallowCloneModel: モデルの浅いコピーを作成（ops内部ユーティリティ）
function shallowCloneModel(model) {
  return {
    pack_meta: model.pack_meta,
    entitiesById: new Map(model.entitiesById),
    collectionsById: new Map(model.collectionsById),
    collectionMembers: new Map(model.collectionMembers),
    indexes: { byType: new Map(model.indexes?.byType || []) },
    raw: model.raw,
  };
}

export function setMember(model, collectionId, slotIndex, entityIdOrNull) {
  const next = shallowCloneModel(model);
  const members = (next.collectionMembers.get(collectionId) || []).slice();
  while (members.length <= slotIndex) members.push(null);
  members[slotIndex] = entityIdOrNull ?? null;
  next.collectionMembers.set(collectionId, members);
  const raw = structuredClone(next.raw);
  raw.collections[collectionId].members = members.slice();
  next.raw = raw;
  return next;
}

export function moveMember(model, collectionId, fromIndex, toIndex) {
  const next = shallowCloneModel(model);
  const members = (next.collectionMembers.get(collectionId) || []).slice();
  if (fromIndex < 0 || fromIndex >= members.length) return model;
  if (toIndex < 0) toIndex = 0;
  if (toIndex >= members.length) toIndex = members.length - 1;
  const [x] = members.splice(fromIndex, 1);
  members.splice(toIndex, 0, x);
  next.collectionMembers.set(collectionId, members);
  const raw = structuredClone(next.raw);
  raw.collections[collectionId].members = members.slice();
  next.raw = raw;
  return next;
}

export function updateCollection(model, collectionId, patch) {
  const next = shallowCloneModel(model);
  const raw = structuredClone(next.raw);
  raw.collections = raw.collections || {};
  raw.collections[collectionId] = raw.collections[collectionId] || {};
  Object.assign(raw.collections[collectionId], patch);
  next.raw = raw;
  const cur = next.collectionsById.get(collectionId) || {};
  next.collectionsById.set(collectionId, { ...cur, ...patch });
  return next;
}

export function clearCollection(model, collectionId) {
  const next = shallowCloneModel(model);
  const c = next.collectionsById.get(collectionId);
  const size = c?.size || 10;
  const members = Array(size).fill(null);
  next.collectionMembers.set(collectionId, members);
  const raw = structuredClone(next.raw);
  raw.collections[collectionId].members = members.slice();
  next.raw = raw;
  return next;
}
