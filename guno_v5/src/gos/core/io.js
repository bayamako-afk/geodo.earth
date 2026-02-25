const DEFAULT_LOCAL_KEY = "gos_pack_v0_1";

export function parsePack(jsonText) {
  const obj = JSON.parse(jsonText);
  if (!obj?.pack_meta?.pack_version) throw new Error("Invalid pack: missing pack_meta.pack_version");
  if (obj.pack_meta.pack_version !== "0.1") throw new Error(`Unsupported pack_version: ${obj.pack_meta.pack_version}`);
  if (!obj.entities || !obj.collections || !obj.layouts || !obj.rules) {
    throw new Error("Invalid pack: missing entities/collections/layouts/rules");
  }
  return obj;
}

export function stringifyPack(packObj, opts = {}) {
  const pretty = opts.pretty ?? true;
  return JSON.stringify(packObj, null, pretty ? 2 : 0);
}

export function downloadPack(packObj, filename) {
  const name = filename || `${packObj.pack_meta?.pack_id || "gos-pack"}.json`;
  const text = stringifyPack(packObj, { pretty: true });
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