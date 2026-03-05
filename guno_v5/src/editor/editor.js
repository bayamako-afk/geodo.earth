import { createGOS } from "../gos/core/index.js?v=0.3";
import { ROUTE_MASTER } from "./route_master.js";
import { GEO_LINES, GEO_STATIONS, CROSS_STATIONS } from "./stations_data.js";

const gos = createGOS();
const LOCAL_KEY = "gos_pack_v0_2";
const IMAGE_BASE_URL = "https://geodo.earth/guno_v2/cards/";

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
function nowISO() { return new Date().toISOString(); }

// ===== geojson整備済み路線のスラッグセット =====
const GEO_LINE_CODES = new Set(GEO_LINES.map(l => l.line_code));

// ===== 路線マスターからコードと色を引く =====
function getMasterRoute(lineCode) {
  // まずgeojsonデータを優先
  const geo = GEO_LINES.find(l => l.line_code === lineCode);
  if (geo) return { line_code: geo.line_code, name_ja: geo.name_ja, color: geo.color, operator: geo.operator };
  return ROUTE_MASTER.find(r => r.line_code === lineCode) || null;
}
function getLineColor(lineCode, fallback = "#888") {
  const r = getMasterRoute(lineCode);
  return r ? r.color : fallback;
}
function getLineName(lineCode, fallback = lineCode) {
  const r = getMasterRoute(lineCode);
  return r ? r.name_ja : fallback;
}

// ===== カード画像URL =====
function getCardImageUrl(entity) {
  if (entity.file) return `${IMAGE_BASE_URL}${entity.file}.png`;
  if (entity.lc && entity.order) {
    const en = (entity.name_en || "").replace(/^★/, "").replace(/\s+/g, "-");
    return `${IMAGE_BASE_URL}${entity.lc}_${String(entity.order).padStart(2,"0")}_${en}.png`;
  }
  return null;
}

// ===== 選択路線の交差駅を計算 =====
function computeCrossStations(selectedLineCodes) {
  // 選択中の路線コードセット
  const lcSet = new Set(selectedLineCodes);
  // 交差駅：CROSS_STATIONSの中で、自分の路線以外に選択中の路線が含まれる駅
  const result = {}; // stationName -> [交差している路線コードリスト]
  for (const [name, lcs] of Object.entries(CROSS_STATIONS)) {
    const crossInSelected = lcs.filter(lc => lcSet.has(lc));
    if (crossInSelected.length >= 2) {
      result[name] = crossInSelected;
    }
  }
  return result;
}

// ===== 路線の全駅をgeojsonから取得 =====
function getStationsForLine(lineCode) {
  return GEO_STATIONS
    .filter(s => s.lc === lineCode)
    .sort((a, b) => a.order - b.order);
}

// ===== サンプルパック生成（geojsonベース4路線） =====
function makeSamplePack(slotSize = 10) {
  const iso = nowISO();
  const defaultLines = ["JY", "G", "M", "T"];
  const entities = {};
  const collections = {};
  const layoutSlots = [];

  for (let i = 0; i < defaultLines.length; i++) {
    const lc = defaultLines[i];
    const geoLine = GEO_LINES.find(l => l.line_code === lc);
    if (!geoLine) continue;
    const stations = getStationsForLine(lc);
    // 全駅をentitiesに登録
    for (const s of stations) {
      entities[s.id] = {
        type: "station", name_ja: s.name_ja, name_en: s.name_en,
        lc: s.lc, order: s.order, cross_lines: s.cross_lines || []
      };
    }
    const cid = `R${i + 1}`;
    collections[cid] = {
      kind: "route", lc, name_ja: geoLine.name_ja, name_en: geoLine.name_ja,
      color: geoLine.color, size: slotSize, members: Array(slotSize).fill(null)
    };
    layoutSlots.push({ collection_id: cid, label_ja: geoLine.name_ja, label_en: geoLine.name_ja });
  }

  return {
    pack_meta: {
      pack_version: "0.2", pack_id: "tokyo_4lines_v2",
      name: "東京4路線コース", locale_default: "ja",
      created_at: iso, updated_at: iso
    },
    entities,
    collections,
    layouts: { default: { layout_kind: "editor_nx10", slots: layoutSlots } },
    rules: [
      { rule: "collection_size_exact", scope: { kinds: ["route"] }, value: slotSize, level: "error" },
      { rule: "unique_members_across_collections", scope: { kinds: ["route"] }, level: "error" },
      { rule: "member_type_allowed", scope: { kinds: ["route"] }, allowed_types: ["station"], level: "error" }
    ]
  };
}

// ===== 状態 =====
const state = {
  pack: makeSamplePack(10),
  model: null,
  locale: "ja",
  query: "",
  selectedEntityId: null,
  selectedRouteId: null,
  routePickerOpen: false,
  routePickerQuery: "",
  routePickerOp: "",
  slotSize: 10,  // 各路線の駅数（10〜13）
  poolTab: null,  // 駅リストのアクティブタブ（null=全路線, lc=路線コード）
};

// ===== ユーティリティ =====
function setStatus(msg) { $("status").textContent = msg; }
function rebuildModel() { state.model = gos.model.normalize(state.pack); }
function updatePackFromModel() { state.pack = state.model.raw; state.pack.pack_meta.updated_at = nowISO(); }

// ===== 路線数・駅数カウント =====
function countRoutes() { return Object.keys(state.pack.collections || {}).length; }
function countTotalSlots() {
  let n = 0;
  for (const c of Object.values(state.pack.collections || {})) n += (c.size || state.slotSize);
  return n;
}
function countFilledSlots() {
  let n = 0;
  for (const c of Object.values(state.pack.collections || {})) {
    for (const eid of (c.members || [])) if (eid) n++;
  }
  return n;
}

// ===== 現在選択中の路線コードリスト =====
function getSelectedLineCodes() {
  return Object.values(state.pack.collections || {}).map(c => c.lc).filter(Boolean);
}

// ===== 交差駅（現在の路線構成で） =====
function getCurrentCrossStations() {
  return computeCrossStations(getSelectedLineCodes());
}

// ===== 交差駅かどうか（駅名で判定） =====
function isCrossStation(stationName) {
  const cross = getCurrentCrossStations();
  return stationName in cross;
}

// ===== プレイ可能判定 =====
function canPlayNow() {
  const slotDefs = Array.isArray(state.pack.layouts?.default?.slots) ? state.pack.layouts.default.slots : [];
  if (slotDefs.length === 0) return { ok: false, reason: "路線が設定されていません。" };
  for (const s of slotDefs) {
    const c = state.pack.collections?.[s.collection_id];
    if (!c) return { ok: false, reason: `路線が見つかりません: ${s.collection_id}` };
    const members = Array.isArray(c.members) ? c.members : [];
    const size = c.size || state.slotSize;
    if (members.length < size || members.includes(null)) {
      return { ok: false, reason: `${c.name_ja} の${size}駅を全て配置してください` };
    }
  }
  return { ok: true, reason: "OK" };
}

// ===== 進捗バー更新 =====
function updateProgress() {
  const filled = countFilledSlots();
  const total = countTotalSlots();
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  $("progressText").textContent = `${filled} / ${total} 駅配置済み`;
  $("progressPercent").textContent = `${pct}%`;
  $("progressFill").style.width = `${pct}%`;
  const subtitle = $("routeSubtitle");
  if (subtitle) subtitle.textContent = `（${countRoutes()}路線 × ${state.slotSize}駅）`;
}

// ===== プレイボタン更新 =====
function updatePlayButton() {
  const btn = $("btnPlay");
  if (!btn) return;
  const verdict = canPlayNow();
  btn.disabled = !verdict.ok;
  btn.title = verdict.ok ? "このコースでゲームを開始" : verdict.reason;
}

// ===== 全体レンダリング =====
function render() {
  renderPoolTabs();
  renderPool();
  renderRoutes();
  renderRouteList();
  renderCrossInfo();
  renderIssues();
  renderSelection();
  updatePlayButton();
  updateProgress();
}

// ===== 選択情報レンダリング =====
function renderSelection() {
  const e = state.selectedEntityId ? state.pack.entities[state.selectedEntityId] : null;
  const c = state.selectedRouteId ? state.pack.collections[state.selectedRouteId] : null;
  $("selEntity").textContent = e ? `${e.name_ja || e.name_en} (${state.selectedEntityId})` : "未選択";
  $("selRoute").textContent = c ? `${c.name_ja || c.name_en || state.selectedRouteId}` : "未選択";
}

// ===== 駅リストのタブを描画 =====
function renderPoolTabs() {
  const pack = state.pack;
  const tabsEl = $("poolTabs");
  if (!tabsEl) return;
  tabsEl.innerHTML = "";

  // 全路線タブ
  const allTab = el("button", "pool-tab" + (state.poolTab === null ? " active" : ""));
  allTab.textContent = "全路線";
  allTab.onclick = () => { state.poolTab = null; renderPoolTabs(); renderPool(); };
  tabsEl.appendChild(allTab);

  // 各路線タブ
  const lines = [];
  const seen = new Set();
  for (const e of Object.values(pack.entities || {})) {
    if (e.lc && !seen.has(e.lc)) {
      seen.add(e.lc);
      lines.push({ lc: e.lc, name: getLineName(e.lc, e.lc), color: getLineColor(e.lc, e.color || "#888") });
    }
  }
  lines.sort((a, b) => a.lc.localeCompare(b.lc));

  for (const line of lines) {
    const tab = el("button", "pool-tab" + (state.poolTab === line.lc ? " active" : ""));
    tab.textContent = line.name;
    tab.style.setProperty("--tab-color", line.color);
    const lc = line.lc;
    tab.onclick = () => { state.poolTab = lc; renderPoolTabs(); renderPool(); };
    tabsEl.appendChild(tab);
  }
}

// ===== 駅リストレンダリング =====
function renderPool() {
  const pool = $("pool");
  pool.innerHTML = "";
  const pack = state.pack;
  const q = state.query.trim().toLowerCase();
  const crossNow = getCurrentCrossStations();

  const used = new Set();
  for (const c of Object.values(pack.collections || {})) {
    for (const eid of (c.members || [])) if (eid) used.add(eid);
  }

  const entries = Object.entries(pack.entities || {}).map(([id, e]) => ({ id, e }));
  entries.sort((a, b) => {
    const lcA = a.e.lc || ""; const lcB = b.e.lc || "";
    if (lcA !== lcB) return lcA.localeCompare(lcB);
    return (a.e.order || 0) - (b.e.order || 0);
  });

  let currentLc = null;
  for (const { id, e } of entries) {
    // タブフィルター
    if (state.poolTab !== null && e.lc !== state.poolTab) continue;

    const displayName = state.locale === "ja" ? (e.name_ja || e.name_en || id) : (e.name_en || e.name_ja || id);
    if (q && !displayName.toLowerCase().includes(q) && !id.toLowerCase().includes(q)) continue;

    if (e.lc && e.lc !== currentLc && state.poolTab === null) {
      currentLc = e.lc;
      const lineColor = getLineColor(e.lc, e.color || "#888");
      const header = el("div");
      header.style.cssText = `padding:4px 6px 2px; font-size:10px; font-weight:800; color:${lineColor}; letter-spacing:.5px; margin-top:4px;`;
      header.textContent = `── ${getLineName(e.lc, e.lc)} ──`;
      pool.appendChild(header);
    }

    const div = el("div", "entity");
    if (id === state.selectedEntityId) div.classList.add("selected");
    if (used.has(id)) div.classList.add("used");

    // 交差駅かどうか
    const isCross = e.name_ja in crossNow;
    if (isCross) div.classList.add("cross-station");

    const imgUrl = getCardImageUrl(e);
    let thumbEl;
    if (imgUrl) {
      thumbEl = document.createElement("img");
      thumbEl.className = "entity-thumb";
      thumbEl.src = imgUrl;
      thumbEl.alt = e.name_ja || id;
      thumbEl.onerror = () => { const ph = el("div","entity-thumb-placeholder"); ph.textContent="🚉"; thumbEl.replaceWith(ph); };
    } else {
      thumbEl = el("div", "entity-thumb-placeholder");
      thumbEl.textContent = "🚉";
    }

    const lineColor = getLineColor(e.lc, "#888");
    const crossLcs = crossNow[e.name_ja] || [];
    const crossBadge = isCross
      ? `<span class="pill cross-badge" title="乗換: ${crossLcs.join(', ')}">🔀 ${crossLcs.length}路線</span>`
      : "";

    const infoEl = el("div", "entity-info");
    infoEl.innerHTML = `
      <div class="name">${displayName}</div>
      <div class="meta">
        <span class="line-pill" style="background:${lineColor}22;border:1px solid ${lineColor}55;color:${lineColor}">${e.lc||""}</span>
        <span class="pill">${id}</span>
        ${crossBadge}
        ${used.has(id) ? '<span class="pill used-badge">配置済</span>' : ""}
      </div>`;

    div.appendChild(thumbEl);
    div.appendChild(infoEl);
    div.onclick = () => { state.selectedEntityId = id; render(); };
    pool.appendChild(div);
  }
}

// ===== コース配置レンダリング =====
function renderRoutes() {
  const routesEl = $("routes");
  routesEl.innerHTML = "";
  const slotDefs = Array.isArray(state.pack.layouts?.default?.slots) ? state.pack.layouts.default.slots : [];
  const crossNow = getCurrentCrossStations();

  for (const s of slotDefs) {
    const cid = s.collection_id;
    const c = state.pack.collections?.[cid];
    if (!c) continue;

    const lineCode = c.lc || cid;
    const lineColor = c.color || getLineColor(lineCode, "#fff");
    const members = Array.isArray(c.members) ? c.members : [];
    const size = c.size || state.slotSize;
    const filledCount = members.filter(Boolean).length;

    const div = el("div", "route");
    if (cid === state.selectedRouteId) div.classList.add("selected");

    const nameVal = (c.name_ja || '').replace(/"/g, '&quot;');
    const colorVal = c.color || '#ffffff';
    const lcVal = (c.lc || cid).replace(/"/g, '&quot;');
    const head = el("div", "route-head");
    head.innerHTML = `
      <div class="route-title">
        <div class="swatch" style="background:${lineColor};box-shadow:0 0 6px ${lineColor}55"></div>
        <div class="route-name">${c.name_ja || cid}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <div class="route-progress">${filledCount}/${size}</div>
        <div class="route-edit">
          <label>コード <input type="text" class="input mini" value="${lcVal}" data-field="lc"></label>
          <label>日本語名 <input type="text" class="input mid" value="${nameVal}" data-field="name_ja"></label>
          <label>色 <input type="color" class="input color" value="${colorVal}" data-field="color"></label>
        </div>
        <button class="btn small danger route-clear-btn" data-cid="${cid}" title="この路線の駅配置をクリア">駅名クリア</button>
        <button class="btn small map-view-btn" data-cid="${cid}" title="guno-mapでこの路線を地図確認">🗺 地図確認</button>
      </div>`;

    // 地図確認ボタン
    head.querySelector(".map-view-btn").onclick = (e) => {
      e.stopPropagation();
      const geoLine = GEO_LINES.find(l => l.line_code === lineCode);
      const slug = geoLine ? geoLine.slug : null;
      if (!slug) {
        setStatus(`⚠ ${c.name_ja || lineCode} はまだgeojsonデータがありません`);
        return;
      }
      const url = `https://geodo.earth/guno-map/?lines=${slug}&stations=${slug}&fit=${slug}`;
      window.open(url, '_blank');
    };

    head.querySelector(".route-clear-btn").onclick = (e) => {
      e.stopPropagation();
      const name = c.name_ja || cid;
      state.model = gos.ops.clearCollection(state.model, cid);
      updatePackFromModel(); render();
      setStatus(`🗑 ${name} の駅配置をクリアしました`);
    };

    head.querySelectorAll("input").forEach(inp => {
      inp.onchange = (e) => {
        const field = e.target.getAttribute("data-field");
        state.model = gos.ops.updateCollection(state.model, cid, { [field]: e.target.value });
        updatePackFromModel(); render();
      };
      inp.onclick = (e) => e.stopPropagation();
    });
    head.onclick = () => { state.selectedRouteId = cid; render(); };
    div.appendChild(head);

    const grid = el("div", "route-grid");
    for (let i = 0; i < size; i++) {
      const slot = el("div", `slot line-${lineCode}`);
      const eid = members[i];

      if (eid) {
        slot.classList.add("filled");
        const st = state.pack.entities[eid];
        const imgUrl = st ? getCardImageUrl(st) : null;
        const isCross = st && (st.name_ja in crossNow);
        if (isCross) slot.classList.add("cross-slot");

        const idxEl = el("div", "slot-index"); idxEl.textContent = String(i+1);
        slot.appendChild(idxEl);

        if (imgUrl) {
          const img = document.createElement("img");
          img.className = "slot-thumb"; img.src = imgUrl; img.alt = st?.name_ja || eid;
          img.onerror = () => img.remove();
          slot.appendChild(img);
        }

        const nameEl = el("div", "slot-name");
        nameEl.textContent = st ? (state.locale==="ja" ? st.name_ja : st.name_en) : eid;
        slot.appendChild(nameEl);

        // 交差駅バッジ
        if (isCross) {
          const crossLcs = crossNow[st.name_ja] || [];
          const badge = el("div", "slot-cross-badge");
          badge.textContent = `🔀`;
          badge.title = `乗換: ${crossLcs.join(', ')}`;
          slot.appendChild(badge);
        }

        slot.title = `${st?.name_ja||eid} — 右クリックで削除`;
      } else {
        const idxEl = el("div", "slot-index"); idxEl.textContent = String(i+1);
        slot.appendChild(idxEl);
        const hintEl = el("div", "slot-empty-hint"); hintEl.textContent = "ここに\n配置";
        slot.appendChild(hintEl);
        slot.title = `スロット ${i+1}：駅を選択してクリックで配置`;
      }

      slot.onclick = (e) => {
        e.stopPropagation();
        if (state.selectedEntityId) {
          state.model = gos.ops.setMember(state.model, cid, i, state.selectedEntityId);
          updatePackFromModel(); render();
          setStatus(`✅ ${state.pack.entities[state.selectedEntityId]?.name_ja||state.selectedEntityId} を ${c.name_ja} スロット ${i+1} に配置しました`);
        } else {
          setStatus("⚠ 先に左の駅リストから駅を選択してください");
        }
      };
      slot.oncontextmenu = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (eid) {
          const stName = state.pack.entities[eid]?.name_ja || eid;
          state.model = gos.ops.setMember(state.model, cid, i, null);
          updatePackFromModel(); render();
          setStatus(`🗑 ${stName} を削除しました`);
        }
      };
      grid.appendChild(slot);
    }
    div.appendChild(grid);
    routesEl.appendChild(div);
  }
}

// ===== 路線リスト（右パネル）レンダリング =====
function renderRouteList() {
  const listEl = $("routeList");
  listEl.innerHTML = "";
  const slotDefs = Array.isArray(state.pack.layouts?.default?.slots) ? state.pack.layouts.default.slots : [];

  if (slotDefs.length === 0) {
    listEl.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:11px;padding:8px 4px;">路線がありません。「＋ 路線追加」で追加してください。</div>`;
    return;
  }

  for (const s of slotDefs) {
    const cid = s.collection_id;
    const c = state.pack.collections?.[cid];
    if (!c) continue;
    const lineColor = c.color || getLineColor(c.lc, "#888");
    const members = Array.isArray(c.members) ? c.members : [];
    const size = c.size || state.slotSize;
    const filled = members.filter(Boolean).length;
    const isGeo = GEO_LINE_CODES.has(c.lc);

    const row = el("div", "route-list-row");
    if (cid === state.selectedRouteId) row.classList.add("selected");
    row.innerHTML = `
      <div class="route-list-swatch" style="background:${lineColor}"></div>
      <div class="route-list-info">
        <div class="route-list-name">${c.name_ja || cid} ${isGeo ? '<span class="geo-badge" title="geojson整備済み">📍</span>' : ''}</div>
        <div class="route-list-meta">
          <span class="line-pill" style="background:${lineColor}22;border:1px solid ${lineColor}55;color:${lineColor}">${c.lc||cid}</span>
          <span class="pill">${filled}/${size}</span>
        </div>
      </div>
      <button class="btn small danger route-del-btn" data-cid="${cid}" title="この路線を削除">削除</button>`;

    row.querySelector(".route-del-btn").onclick = (e) => {
      e.stopPropagation();
      const name = c.name_ja || cid;
      if (!confirm(`「${name}」を削除しますか？\n配置済みの駅も全て削除されます。`)) return;
      removeRoute(cid);
    };
    row.onclick = () => { state.selectedRouteId = cid; render(); };
    listEl.appendChild(row);
  }
}

// ===== 交差駅情報パネルレンダリング =====
function renderCrossInfo() {
  const el2 = $("crossInfo");
  if (!el2) return;
  const crossNow = getCurrentCrossStations();
  const count = Object.keys(crossNow).length;
  const badge = $("crossBadge");
  if (badge) badge.textContent = String(count);

  el2.innerHTML = "";
  if (count === 0) {
    el2.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:11px;padding:4px;">現在の路線構成に交差駅はありません</div>`;
    return;
  }

  for (const [name, lcs] of Object.entries(crossNow).sort()) {
    const row = el("div", "cross-row");
    const dots = lcs.map(lc => {
      const color = getLineColor(lc, "#888");
      const lineName = getLineName(lc, lc);
      return `<span class="cross-dot" style="background:${color}" title="${lineName}"></span>`;
    }).join("");
    row.innerHTML = `
      <div class="cross-name">${name}</div>
      <div class="cross-lines">${dots}</div>`;
    el2.appendChild(row);
  }
}

// ===== 路線追加 =====
function addRoute(masterRoute) {
  const lc = masterRoute.line_code;
  const color = masterRoute.color;
  const name_ja = masterRoute.name_ja;

  // 既に同じ路線コードが存在する場合は確認
  const existing = Object.values(state.pack.collections || {}).find(c => c.lc === lc);
  if (existing) {
    setStatus(`⚠ 路線コード「${lc}」は既に追加されています`);
    return;
  }

  // 路線数上限チェック（最大8路線）
  if (countRoutes() >= 8) {
    setStatus("⚠ 路線は最大8路線まで追加できます");
    return;
  }

  // geojson整備済みの場合は全駅をentitiesに追加
  if (GEO_LINE_CODES.has(lc)) {
    const stations = getStationsForLine(lc);
    for (const s of stations) {
      if (!state.pack.entities[s.id]) {
        state.pack.entities[s.id] = {
          type: "station", name_ja: s.name_ja, name_en: s.name_en,
          lc: s.lc, order: s.order, cross_lines: s.cross_lines || []
        };
      }
    }
  }

  // 新しいコレクションIDを生成
  const existingIds = Object.keys(state.pack.collections || {});
  const maxNum = existingIds.reduce((m, id) => {
    const n = parseInt(id.replace(/\D/g, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const newCid = `R${maxNum + 1}`;

  // コレクション追加
  state.pack.collections[newCid] = {
    kind: "route", lc, name_ja, name_en: name_ja, color, size: state.slotSize,
    members: Array(state.slotSize).fill(null)
  };

  // レイアウトのスロットに追加
  if (!Array.isArray(state.pack.layouts?.default?.slots)) {
    state.pack.layouts = { default: { layout_kind: "editor_nx10", slots: [] } };
  }
  state.pack.layouts.default.slots.push({ collection_id: newCid, label_ja: name_ja, label_en: name_ja });

  rebuildModel();
  render();
  setStatus(`✅ 「${name_ja}」を追加しました${GEO_LINE_CODES.has(lc) ? `（${getStationsForLine(lc).length}駅）` : "（geojson未整備）"}`);
}

// ===== 路線削除 =====
function removeRoute(cid) {
  const c = state.pack.collections?.[cid];
  const name = c?.name_ja || cid;
  const lc = c?.lc;

  // このコレクションの駅IDを収集
  const memberIds = new Set((c?.members || []).filter(Boolean));

  // コレクション削除
  delete state.pack.collections[cid];

  // レイアウトのスロットから削除
  if (Array.isArray(state.pack.layouts?.default?.slots)) {
    state.pack.layouts.default.slots = state.pack.layouts.default.slots.filter(s => s.collection_id !== cid);
  }

  // この路線のentitiesを削除（他の路線で使われていないものだけ）
  const usedInOther = new Set();
  for (const col of Object.values(state.pack.collections || {})) {
    for (const eid of (col.members || [])) if (eid) usedInOther.add(eid);
  }
  // 同じ路線コードのentitiesも削除（他路線で使われていなければ）
  for (const [eid, entity] of Object.entries(state.pack.entities || {})) {
    if (entity.lc === lc && !usedInOther.has(eid)) {
      delete state.pack.entities[eid];
    }
  }

  if (state.selectedRouteId === cid) state.selectedRouteId = null;

  rebuildModel();
  render();
  setStatus(`🗑 「${name}」を削除しました`);
}

// ===== 路線ピッカーレンダリング =====
function renderRoutePicker() {
  const wrap = $("routePickerWrap");
  if (!state.routePickerOpen) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";

  const q = state.routePickerQuery.trim().toLowerCase();
  const op = state.routePickerOp;
  const addedLcs = new Set(Object.values(state.pack.collections || {}).map(c => c.lc));

  // geojson整備済み路線を先頭に表示するため、GEO_LINESとROUTE_MASTERをマージ
  const geoRoutes = GEO_LINES.map(l => ({
    line_code: l.line_code, name_ja: l.name_ja, color: l.color,
    operator: l.operator, geo: true, station_count: l.station_count
  }));
  const geoLcSet = new Set(geoRoutes.map(r => r.line_code));
  const masterRoutes = ROUTE_MASTER
    .filter(r => !geoLcSet.has(r.line_code))
    .map(r => ({ ...r, geo: false }));
  const allRoutes = [...geoRoutes, ...masterRoutes];

  let filtered = allRoutes.filter(r => {
    if (op === "geo" && !r.geo) return false;
    if (op && op !== "geo" && r.operator !== op) return false;
    if (q && !r.name_ja.toLowerCase().includes(q) && !r.line_code.toLowerCase().includes(q)) return false;
    return true;
  });

  const listEl = $("routePickerList");
  listEl.innerHTML = "";

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:11px;padding:8px;">該当する路線がありません</div>`;
    return;
  }

  for (const r of filtered) {
    const isAdded = addedLcs.has(r.line_code);
    const row = el("div", "picker-row" + (isAdded ? " added" : ""));
    const geoBadge = r.geo ? `<span class="geo-badge" title="geojson整備済み・全${r.station_count}駅">📍${r.station_count}駅</span>` : "";
    row.innerHTML = `
      <div class="picker-swatch" style="background:${r.color}"></div>
      <div class="picker-info">
        <div class="picker-name">${r.name_ja} ${geoBadge}</div>
        <div class="picker-meta">
          <span class="line-pill" style="background:${r.color}22;border:1px solid ${r.color}55;color:${r.color}">${r.line_code}</span>
          <span class="pill" style="color:rgba(255,255,255,.4)">${r.operator}</span>
        </div>
      </div>
      <button class="btn small${isAdded ? " disabled" : " accent"}" ${isAdded ? "disabled" : ""} data-lc="${r.line_code}">
        ${isAdded ? "追加済" : "追加"}
      </button>`;

    if (!isAdded) {
      row.querySelector("button").onclick = (e) => {
        e.stopPropagation();
        addRoute(r);
        renderRoutePicker();
      };
    }
    listEl.appendChild(row);
  }
}

// ===== チェック結果レンダリング =====
function renderIssues() {
  const issuesEl = $("issues");
  issuesEl.innerHTML = "";
  const issues = gos.validate.model(state.model, state.pack.rules, state.pack.entities, state.locale);
  const badge = $("issueBadge");
  badge.textContent = String(issues.length);
  badge.className = "badge " + (issues.length === 0 ? "ok" : "error");

  if (issues.length === 0) {
    issuesEl.innerHTML = `<div class="issue" style="border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.06)">
      <div class="top"><div class="code" style="color:rgba(52,211,153,.9)">✅ OK</div></div>
      <div class="msg">問題ありません。プレイできます！</div></div>`;
    return;
  }
  for (const it of issues) {
    const d = el("div", "issue");
    d.style.borderColor = "rgba(251,113,133,.3)";
    d.innerHTML = `<div class="top"><div class="code" style="color:rgba(251,113,133,.9)">${it.code||it.level}</div></div>
      <div class="msg">${it.message||""}</div>`;
    issuesEl.appendChild(d);
  }
}

// ===== 駅数変更（全路線に適用） =====
function changeSlotSize(newSize) {
  newSize = Math.max(10, Math.min(13, parseInt(newSize, 10)));
  state.slotSize = newSize;
  for (const cid of Object.keys(state.pack.collections || {})) {
    const c = state.pack.collections[cid];
    const oldMembers = Array.isArray(c.members) ? c.members : [];
    // 縮小の場合は末尾を切り捨て、拡大の場合はnullを追加
    const newMembers = Array.from({ length: newSize }, (_, i) => oldMembers[i] ?? null);
    c.size = newSize;
    c.members = newMembers;
  }
  // rulesのcollection_size_exactも更新
  if (Array.isArray(state.pack.rules)) {
    for (const rule of state.pack.rules) {
      if (rule.rule === "collection_size_exact") rule.value = newSize;
    }
  }
  rebuildModel();
  render();
  setStatus(`📐 駅数を${newSize}に変更しました`);
}

// ===== 自動配置（交差駅は必須固定） =====
function autoFill() {
  const slotDefs = Array.isArray(state.pack.layouts?.default?.slots) ? state.pack.layouts.default.slots : [];
  const crossNow = getCurrentCrossStations();
  const crossNames = new Set(Object.keys(crossNow));
  let changed = false;

  for (const s of slotDefs) {
    const cid = s.collection_id;
    const c = state.pack.collections?.[cid];
    if (!c) continue;
    const lc = c.lc;
    const size = c.size || state.slotSize;

    // この路線の全駅を順番に取得
    const lineStations = Object.entries(state.pack.entities || {})
      .filter(([, e]) => e.lc === lc)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    // 交差駅を先頭に、その後残りの駅を順番に並べる
    const crossStations = lineStations.filter(([, e]) => crossNames.has(e.name_ja));
    const normalStations = lineStations.filter(([, e]) => !crossNames.has(e.name_ja));

    // 交差駅をスロット先頭に配置、残りを埋める
    const ordered = [...crossStations, ...normalStations];
    for (let i = 0; i < size && i < ordered.length; i++) {
      state.model = gos.ops.setMember(state.model, cid, i, ordered[i][0]);
      changed = true;
    }
  }

  if (changed) {
    updatePackFromModel(); render();
    const crossCount = Object.keys(crossNow).length;
    setStatus(`⚡ 自動配置しました（交差駅${crossCount}駅を先頭に固定）`);
  } else {
    setStatus("⚠ 配置できる駅がありません");
  }
}

// ===== UI イベント配線 =====
function wireUI() {
  $("q").addEventListener("input", (ev) => { state.query = ev.target.value || ""; renderPool(); });
  $("locale").addEventListener("change", (ev) => { state.locale = ev.target.value || "ja"; render(); });
  $("btnValidate").addEventListener("click", () => { renderIssues(); setStatus("🔍 チェック完了"); });

  // 全線クリア
  $("btnClearSelectedRoute").addEventListener("click", () => {
    const cids = Object.keys(state.pack.collections || {});
    if (cids.length === 0) return setStatus("⚠ 路線がありません");
    if (!confirm("全路線の駅配置をクリアしますか？")) return;
    for (const cid of cids) {
      state.model = gos.ops.clearCollection(state.model, cid);
    }
    updatePackFromModel(); render();
    setStatus("🗑 全路線の駅配置をクリアしました");
  });

  // 駅数変更セレクタ
  const slotSizeSel = $("slotSizeSelect");
  if (slotSizeSel) {
    slotSizeSel.value = String(state.slotSize);
    slotSizeSel.addEventListener("change", (ev) => changeSlotSize(ev.target.value));
  }

  // 路線追加ボタン
  $("btnAddRoute").addEventListener("click", () => {
    state.routePickerOpen = !state.routePickerOpen;
    renderRoutePicker();
  });

  // ピッカー閉じるボタン
  $("btnRoutePickerClose").addEventListener("click", () => {
    state.routePickerOpen = false;
    renderRoutePicker();
  });

  // ピッカー検索
  $("routePickerQ").addEventListener("input", (ev) => {
    state.routePickerQuery = ev.target.value || "";
    renderRoutePicker();
  });

  // ピッカー事業者フィルター
  const opSel = $("routePickerOp");
  // geojson整備済みオプションを先頭に追加
  const geoOpt = document.createElement("option");
  geoOpt.value = "geo"; geoOpt.textContent = "📍 geojson整備済み";
  opSel.appendChild(geoOpt);
  const ops = [...new Set(ROUTE_MASTER.map(r => r.operator))];
  for (const op of ops) {
    const opt = document.createElement("option");
    opt.value = op; opt.textContent = op;
    opSel.appendChild(opt);
  }
  opSel.addEventListener("change", (ev) => {
    state.routePickerOp = ev.target.value || "";
    renderRoutePicker();
  });

  $("btnSaveLocal").addEventListener("click", () => {
    gos.io.saveToLocalStorage(state.pack, LOCAL_KEY);
    setStatus("💾 ローカルに保存しました");
  });

  $("btnLoadLocal").addEventListener("click", () => {
    const p = gos.io.loadFromLocalStorage(LOCAL_KEY);
    if (!p) return setStatus("⚠ 保存データが見つかりません");
    state.pack = p;
    state.slotSize = p.rules?.find(r => r.rule === "collection_size_exact")?.value || 10;
    rebuildModel(); render();
    setStatus("📂 保存データを読み込みました");
  });

  $("btnNew").addEventListener("click", () => {
    if (!confirm("現在のコースをリセットして新規作成しますか？")) return;
    state.pack = makeSamplePack(state.slotSize); rebuildModel(); render();
    setStatus("🆕 新規コースを作成しました");
  });

  $("btnLoadSample").addEventListener("click", () => {
    if (!confirm("サンプルデータを読み込みますか？現在のデータは失われます。")) return;
    state.pack = makeSamplePack(state.slotSize); rebuildModel(); render();
    setStatus("📋 サンプルデータを読み込みました");
  });

  $("btnExportPack").addEventListener("click", () => {
    gos.io.downloadPack(state.pack, `${state.pack.pack_meta?.pack_id||"gos-pack"}_pack.json`);
    setStatus("📤 GOS Packをエクスポートしました");
  });

  $("fileImport").addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        state.pack = JSON.parse(e.target.result);
        state.slotSize = state.pack.rules?.find(r => r.rule === "collection_size_exact")?.value || 10;
        rebuildModel(); render();
        setStatus(`📥 ${file.name} を読み込みました`);
      } catch (err) {
        setStatus(`❌ JSONの読み込みに失敗しました: ${err.message}`);
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  });

  $("btnPlay").addEventListener("click", () => {
    const verdict = canPlayNow();
    if (!verdict.ok) return setStatus(`⚠ ${verdict.reason}`);
    const v5data = gos.adapters.guno.toV5Data(state.model, { locale: state.locale });
    localStorage.setItem("guno_v5data_v1", JSON.stringify(v5data));
    setStatus("▶ ゲームを開始します...");
    setTimeout(() => { window.location.href = "../index.html"; }, 300);
  });

  $("btnAutoFill").addEventListener("click", autoFill);
}

// ===== 起動 =====
function boot() {
  rebuildModel();
  wireUI();
  render();
  setStatus("準備完了。駅リストから駅を選択してコースを組んでください。");
}
boot();
