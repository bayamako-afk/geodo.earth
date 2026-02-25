export function emptyPack(meta = {}) {
  const iso = new Date().toISOString();
  return {
    pack_meta: { pack_version: "0.1", pack_id: meta.pack_id || "new_pack", name: meta.name || "New Pack", locale_default: meta.locale_default || "ja", created_at: iso, updated_at: iso },
    entities: {}, collections: {}, layouts: { default: { layout_kind: "editor_4x10", slots: [] } }, rules: []
  };
}