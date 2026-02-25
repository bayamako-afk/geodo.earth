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