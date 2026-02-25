import { createGOS } from "../gos/core/index.js";

const gos = createGOS();
const LOCAL_KEY = "gos_pack_v0_1";

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
function nowISO() { return new Date().toISOString(); }

// サンプルデータ
function makeSamplePack() {
  const iso = nowISO();
  return {
    pack_meta: { pack_version: "0.1", pack_id: "sample_tokyo_4lines_v1", name: "Sample GUNO Pack", locale_default: "ja", created_at: iso, updated_at: iso },
    entities: {
      S001: { type: "station", name_ja: "渋谷", name_en: "Shibuya", geo: { lat: 35.6580, lon: 139.7016 } },
      S002: { type: "station", name_ja: "表参道", name_en: "Omote-sando", geo: { lat: 35.6652, lon: 139.7124 } },
      S003: { type: "station", name_ja: "青山一丁目", name_en: "Aoyama-itchome", geo: { lat: 35.6728, lon: 139.7246 } },
      S004: { type: "station", name_ja: "永田町", name_en: "Nagatacho", geo: { lat: 35.6786, lon: 139.7406 } },
      S005: { type: "station", name_ja: "銀座", name_en: "Ginza", geo: { lat: 35.6717, lon: 139.7650 } },
      S006: { type: "station", name_ja: "上野", name_en: "Ueno", geo: { lat: 35.7138, lon: 139.7773 } },
      S007: { type: "station", name_ja: "池袋", name_en: "Ikebukuro", geo: { lat: 35.7289, lon: 139.7100 } },
      S008: { type: "station", name_ja: "新宿", name_en: "Shinjuku", geo: { lat: 35.6909, lon: 139.7003 } },
      S009: { type: "station", name_ja: "東京", name_en: "Tokyo", geo: { lat: 35.6812, lon: 139.7671 } },
      S010: { type: "station", name_ja: "秋葉原", name_en: "Akihabara", geo: { lat: 35.6984, lon: 139.7730 } }
    },
    collections: {
      R1: { kind: "route", lc: "JY", name_ja: "路線A", name_en: "Route A", color: "#00B48D", size: 10, members: Array(10).fill(null) },
      R2: { kind: "route", lc: "M", name_ja: "路線B", name_en: "Route B", color: "#F59E0B", size: 10, members: Array(10).fill(null) },
      R3: { kind: "route", lc: "G", name_ja: "路線C", name_en: "Route C", color: "#60A5FA", size: 10, members: Array(10).fill(null) },
      R4: { kind: "route", lc: "T", name_ja: "路線D", name_en: "Route D", color: "#A78BFA", size: 10, members: Array(10).fill(null) }
    },
    layouts: {
      default: {
        layout_kind: "editor_4x10",
        slots: [
          { collection_id: "R1", label_ja: "路線1", label_en: "Route 1" },
          { collection_id: "R2", label_ja: "路線2", label_en: "Route 2" },
          { collection_id: "R3", label_ja: "路線3", label_en: "Route 3" },
          { collection_id: "R4", label_ja: "路線4", label_en: "Route 4" }
        ]
      }
    },
    rules: [
      { rule: "collection_size_exact", scope: { kinds: ["route"] }, value: 10, level: "error" },
      { rule: "unique_members_across_collections", scope: { kinds: ["route"] }, level: "error" },
      { rule: "member_type_allowed", scope: { kinds: ["route"] }, allowed_types: ["station"], level: "error" }
    ]
  };
}

const state = { pack: makeSamplePack(), model: null, locale: "ja", filterType: "", query: "", selectedEntityId: null, selectedRouteId: null };

function setStatus(msg) { $("status").textContent = msg; }
function rebuildModel() { state.model = gos.model.normalize(state.pack); }
function updatePackFromModel() { state.pack = state.model.raw; state.pack.pack_meta.updated_at = nowISO(); }

// プレイ可能判定（10駅揃っているか）
function canPlayNow() {
  const issues = gos.validate.model(state.model, state.pack.rules, state.pack.entities, state.locale);
  if (issues.some(x => x.level === "error")) return { ok: false, reason: "Fix errors in Issues before playing." };
  
  const slotDefs = Array.isArray(state.pack.layouts?.default?.slots) ? state.pack.layouts.default.slots : [];
  if (slotDefs.length === 0) return { ok: false, reason: "No routes in layout." };

  for (const s of slotDefs) {
    const c = state.pack.collections?.[s.collection_id];
    if (!c) return { ok: false, reason: `Missing collection: ${s.collection_id}` };
    const members = Array.isArray(c.members) ? c.members : [];
    if (members.length < 10 || members.includes(null)) return { ok: false, reason: `Fill all 10 slots for ${c.name_ja}` };
  }
  return { ok: true, reason: "OK" };
}

function updatePlayButton() {
  const btn = $("btnPlay");
  if (!btn) return;
  const verdict = canPlayNow();
  btn.disabled = !verdict.ok;
  btn.title = verdict.ok ? "Play" : verdict.reason;
  btn.style.opacity = btn.disabled ? "0.55" : "1";
  btn.style.cursor = btn.disabled ? "not-allowed" : "pointer";
}

function render() {
  renderPool(); renderRoutes(); renderIssues(); renderSelection(); updatePlayButton();
}

function renderSelection() {
  const e = state.selectedEntityId ? state.pack.entities[state.selectedEntityId] : null;
  const c = state.selectedRouteId ? state.pack.collections[state.selectedRouteId] : null;
  $("selEntity").textContent = e ? `${gos.query.displayName(e, state.locale)} (${state.selectedEntityId})` : "None";
  $("selRoute").textContent = c ? `${c.name_ja || c.name_en || state.selectedRouteId} (${state.selectedRouteId})` : "None";
}

function renderPool() {
  const pool = $("pool");
  pool.innerHTML = "";
  const pack = state.pack;
  const used = new Set();
  for (const c of Object.values(pack.collections || {})) {
    for (const eid of (c.members || [])) if (eid) used.add(eid);
  }

  const entries = Object.entries(pack.entities || {}).map(([id, e]) => ({ id, e }));
  entries.sort((a,b) => gos.query.displayName(a.e, state.locale).localeCompare(gos.query.displayName(b.e, state.locale), "ja"));

  for (const { id, e } of entries) {
    if (state.filterType && e.type !== state.filterType) continue;
    if (state.query && !gos.query.displayName(e, "ja").includes(state.query)) continue;
    const div = el("div", "entity");
    if (id === state.selectedEntityId) div.classList.add("selected");
    div.innerHTML = `<div class="name">${gos.query.displayName(e, state.locale)}</div><div class="meta"><span class="pill">${id}</span></div>`;
    div.onclick = () => { state.selectedEntityId = id; render(); };
    pool.appendChild(div);
  }
}

function renderRoutes() {
  const routesEl = $("routes");
  routesEl.innerHTML = "";
  const slotDefs = Array.isArray(state.pack.layouts?.default?.slots) ? state.pack.layouts.default.slots : [];

  for (const s of slotDefs) {
    const cid = s.collection_id;
    const c = state.pack.collections?.[cid];
    if (!c) continue;

    const div = el("div", "route");
    if (cid === state.selectedRouteId) div.classList.add("selected");
    
    // 路線情報の編集UI
    const head = el("div", "route-head");
    head.innerHTML = `
      <div class="route-title">
        <div class="swatch" style="background:${c.color || '#fff'}"></div>
        <div class="route-name">${c.name_ja || cid}</div>
      </div>
      <div class="route-edit">
        <label>Code <input type="text" class="input mini" value="${c.lc || cid}" data-field="lc"></label>
        <label>JA <input type="text" class="input mid" value="${c.name_ja || ''}" data-field="name_ja"></label>
        <label>EN <input type="text" class="input mid" value="${c.name_en || ''}" data-field="name_en"></label>
        <label>Color <input type="color" class="input color" value="${c.color || '#ffffff'}" data-field="color"></label>
      </div>`;
      
    head.querySelectorAll("input").forEach(inp => {
      inp.onchange = (e) => {
        const field = e.target.getAttribute("data-field");
        state.model = gos.ops.updateCollection(state.model, cid, { [field]: e.target.value });
        updatePackFromModel();
        render();
      };
      inp.onclick = (e) => e.stopPropagation();
    });
    
    head.onclick = () => { state.selectedRouteId = cid; render(); };
    div.appendChild(head);

    const grid = el("div", "route-grid");
    const members = Array.isArray(c.members) ? c.members : [];
    for(let i=0; i<10; i++) {
        const slot = el("div", "slot");
        const eid = members[i];
        if (eid) {
            slot.classList.add("filled");
            const st = state.pack.entities[eid];
            slot.innerHTML = `<div class="slot-index">${i+1}</div><div class="slot-name">${gos.query.displayName(st, state.locale)}</div>`;
        } else {
            slot.innerHTML = `<div class="slot-index">${i+1}</div>`;
        }
        slot.onclick = (e) => {
            e.stopPropagation();
            if (state.selectedEntityId) {
                state.model = gos.ops.setMember(state.model, cid, i, state.selectedEntityId);
                updatePackFromModel();
                render();
            }
        };
        // 右クリックでクリア
        slot.oncontextmenu = (e) => {
            e.preventDefault(); e.stopPropagation();
            state.model = gos.ops.setMember(state.model, cid, i, null);
            updatePackFromModel(); render();
        };
        grid.appendChild(slot);
    }
    div.appendChild(grid);
    routesEl.appendChild(div);
  }
}

function renderIssues() {
  const issuesEl = $("issues");
  issuesEl.innerHTML = "";
  const issues = gos.validate.model(state.model, state.pack.rules, state.pack.entities, state.locale);
  $("issueBadge").textContent = String(issues.length);

  if (issues.length === 0) {
    issuesEl.innerHTML = '<div class="issue"><div class="top"><div class="code" style="color: rgba(52,211,153,.9)">OK</div></div><div class="msg">All good.</div></div>';
    return;
  }
  for (const it of issues) {
    const d = el("div", "issue");
    d.innerHTML = `<div class="top"><div class="code" style="color: rgba(251,113,133,.95)">${it.code||it.level}</div></div><div class="msg">${it.message || ''}</div>`;
    issuesEl.appendChild(d);
  }
}

function wireUI() {
  $("q").addEventListener("input", (ev) => { state.query = ev.target.value || ""; renderPool(); });
  $("filterType").addEventListener("change", (ev) => { state.filterType = ev.target.value || ""; renderPool(); });
  $("locale").addEventListener("change", (ev) => { state.locale = ev.target.value || "ja"; render(); });
  
  $("btnValidate").addEventListener("click", () => { renderIssues(); setStatus("Validated."); });
  $("btnClearSelectedRoute").addEventListener("click", () => {
    if (!state.selectedRouteId) return setStatus("Select a route first.");
    state.model = gos.ops.clearCollection(state.model, state.selectedRouteId);
    updatePackFromModel(); render(); setStatus("Cleared route.");
  });

  $("btnSaveLocal").addEventListener("click", () => { gos.io.saveToLocalStorage(state.pack, LOCAL_KEY); setStatus("Saved."); });
  $("btnLoadLocal").addEventListener("click", () => {
    const p = gos.io.loadFromLocalStorage(LOCAL_KEY);
    if (!p) return setStatus("No LocalStorage pack found.");
    state.pack = p; rebuildModel(); render(); setStatus("Loaded.");
  });
  $("btnClearLocal").addEventListener("click", () => { gos.io.clearLocalStorage(LOCAL_KEY); setStatus("Cleared LocalStorage."); });
  $("btnNew").addEventListener("click", () => { state.pack = makeSamplePack(); rebuildModel(); render(); });
  $("btnLoadSample").addEventListener("click", () => { state.pack = makeSamplePack(); rebuildModel(); render(); });
  
  // 3つのエクスポート＆プレイボタン
  $("btnExportPack").addEventListener("click", () => {
    gos.io.downloadPack(state.pack, `${state.pack.pack_meta?.pack_id || "gos-pack"}_pack.json`);
    setStatus("Exported GOS Pack.");
  });
  
  $("btnExportRuntime").addEventListener("click", () => {
    if (!canPlayNow().ok) return alert(canPlayNow().reason);
    const v5data = gos.adapters.guno.toV5Data(state.model, { locale: state.locale });
    const text = JSON.stringify(v5data, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${state.pack.pack_meta?.pack_id || "guno"}_runtime.json`;
    a.click(); a.remove(); setStatus("Exported GUNO Runtime.");
  });
  
  $("btnPlay").addEventListener("click", () => {
    if (!canPlayNow().ok) return alert(canPlayNow().reason);
    const v5data = gos.adapters.guno.toV5Data(state.model, { locale: state.locale });
    localStorage.setItem("guno_v5data_v1", JSON.stringify(v5data));
    
    // GUNOの実際のパスへジャンプ（必要に応じて変更してください）
    window.location.href = "../index.html";
  });
}

function boot() {
  rebuildModel();
  wireUI();
  render();
  setStatus("Ready. (GOS Core) Play button is disabled until 4x10 slots are filled.");
}
boot();