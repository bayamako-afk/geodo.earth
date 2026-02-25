function nowISO() { return new Date().toISOString(); }

export function getPackVersion(packObj) {
  return packObj?.pack_meta?.pack_version || "";
}

export function assertCompatible(packObj) {
  const v = getPackVersion(packObj);
  if (v !== "0.1") throw new Error(`Unsupported pack_version: ${v}`);
}

export function upgrade(packObj) {
  assertCompatible(packObj);
  return packObj;
}

export function stamp(packObj, patch = {}) {
  const p = structuredClone(packObj);
  p.pack_meta = p.pack_meta || {};
  p.pack_meta.updated_at = nowISO();
  for (const [k, v] of Object.entries(patch)) p.pack_meta[k] = v;
  return p;
}