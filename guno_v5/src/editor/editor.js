import { createGOS } from "../gos/core/index.js?v=fix1";

const gos = createGOS();
const LOCAL_KEY = "gos_pack_v0_1";
const IMAGE_BASE_URL = "https://geodo.earth/guno_v2/cards/";

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
function nowISO() { return new Date().toISOString(); }

// ===== 路線カラーマップ =====
const LINE_COLORS = {
  JY: "#00AA00",
  M:  "#F62E36",
  G:  "#FF9500",
  T:  "#009BBF",
};

// ===== 路線名マップ =====
const LINE_NAMES = {
  JY: "山手線",
  M:  "丸ノ内線",
  G:  "銀座線",
  T:  "東西線",
};

// ===== stations_tokyo_4lines.js の全駅データ（ファイル名マップ用） =====
// エンティティIDからカード画像ファイル名を引くためのマップ
// GOS Pack の entities に lc と order が入っていれば使える
// なければ name_en から推定する
function getCardImageUrl(entity, entityId) {
  // entity に file フィールドがあれば使う
  if (entity.file) return `${IMAGE_BASE_URL}${entity.file}.png`;
  // lc と order があれば生成
  if (entity.lc && entity.order) {
    const en = (entity.name_en || "").replace(/^★/, "").replace(/\s+/g, "-");
    return `${IMAGE_BASE_URL}${entity.lc}_${String(entity.order).padStart(2,"0")}_${en}.png`;
  }
  return null;
}

// ===== サンプルデータ（stations_tokyo_4lines.js 準拠） =====
function makeSamplePack() {
  const iso = nowISO();

  // 4路線 × 10駅のエンティティを全て登録
  const stationsData = [
    // 山手線 (JY)
    { id:"JY01", lc:"JY", order:1,  name_ja:"東京",    name_en:"Tokyo",            file:"JY_01_Tokyo" },
    { id:"JY02", lc:"JY", order:2,  name_ja:"神田",    name_en:"Kanda",            file:"JY_02_Kanda" },
    { id:"JY03", lc:"JY", order:3,  name_ja:"上野",    name_en:"Ueno",             file:"JY_03_Ueno" },
    { id:"JY04", lc:"JY", order:4,  name_ja:"池袋",    name_en:"Ikebukuro",        file:"JY_04_Ikebukuro" },
    { id:"JY05", lc:"JY", order:5,  name_ja:"高田馬場",name_en:"Takadanobaba",     file:"JY_05_Takadanobaba" },
    { id:"JY06", lc:"JY", order:6,  name_ja:"新宿",    name_en:"Shinjuku",         file:"JY_06_Shinjuku" },
    { id:"JY07", lc:"JY", order:7,  name_ja:"渋谷",    name_en:"Shibuya",          file:"JY_07_Shibuya" },
    { id:"JY08", lc:"JY", order:8,  name_ja:"目黒",    name_en:"Meguro",           file:"JY_08_Meguro" },
    { id:"JY09", lc:"JY", order:9,  name_ja:"品川",    name_en:"Shinagawa",        file:"JY_09_Shinagawa" },
    { id:"JY10", lc:"JY", order:10, name_ja:"新橋",    name_en:"Shimbashi",        file:"JY_10_Shimbashi" },
    // 丸ノ内線 (M)
    { id:"M01",  lc:"M",  order:1,  name_ja:"池袋",    name_en:"Ikebukuro",        file:"M_01_Ikebukuro" },
    { id:"M02",  lc:"M",  order:2,  name_ja:"後楽園",  name_en:"Korakuen",         file:"M_02_Korakuen" },
    { id:"M03",  lc:"M",  order:3,  name_ja:"御茶ノ水",name_en:"Ochanomizu",       file:"M_03_Ochanomizu" },
    { id:"M04",  lc:"M",  order:4,  name_ja:"大手町",  name_en:"Otemachi",         file:"M_04_Otemachi" },
    { id:"M05",  lc:"M",  order:5,  name_ja:"東京",    name_en:"Tokyo",            file:"M_05_Tokyo" },
    { id:"M06",  lc:"M",  order:6,  name_ja:"銀座",    name_en:"Ginza",            file:"M_06_Ginza" },
    { id:"M07",  lc:"M",  order:7,  name_ja:"赤坂見附",name_en:"Akasaka-mitsuke",  file:"M_07_Akasaka-mitsuke" },
    { id:"M08",  lc:"M",  order:8,  name_ja:"四ツ谷",  name_en:"Yotsuya",          file:"M_08_Yotsuya" },
    { id:"M09",  lc:"M",  order:9,  name_ja:"新宿",    name_en:"Shinjuku",         file:"M_09_Shinjuku" },
    { id:"M10",  lc:"M",  order:10, name_ja:"中野坂上",name_en:"Nakano-sakaue",    file:"M_10_Nakano-sakaue" },
    // 銀座線 (G)
    { id:"G01",  lc:"G",  order:1,  name_ja:"渋谷",    name_en:"Shibuya",          file:"G_01_Shibuya" },
    { id:"G02",  lc:"G",  order:2,  name_ja:"表参道",  name_en:"Omotesando",       file:"G_02_Omotesando" },
    { id:"G03",  lc:"G",  order:3,  name_ja:"青山一丁目",name_en:"Aoyama-itchome", file:"G_03_Aoyama-itchome" },
    { id:"G04",  lc:"G",  order:4,  name_ja:"赤坂見附",name_en:"Akasaka-mitsuke",  file:"G_04_Akasaka-mitsuke" },
    { id:"G05",  lc:"G",  order:5,  name_ja:"新橋",    name_en:"Shimbashi",        file:"G_05_Shimbashi" },
    { id:"G06",  lc:"G",  order:6,  name_ja:"銀座",    name_en:"Ginza",            file:"G_06_Ginza" },
    { id:"G07",  lc:"G",  order:7,  name_ja:"日本橋",  name_en:"Nihombashi",       file:"G_07_Nihombashi" },
    { id:"G08",  lc:"G",  order:8,  name_ja:"神田",    name_en:"Kanda",            file:"G_08_Kanda" },
    { id:"G09",  lc:"G",  order:9,  name_ja:"上野",    name_en:"Ueno",             file:"G_09_Ueno" },
    { id:"G10",  lc:"G",  order:10, name_ja:"浅草",    name_en:"Asakusa",          file:"G_10_Asakusa" },
    // 東西線 (T)
    { id:"T01",  lc:"T",  order:1,  name_ja:"中野",    name_en:"Nakano",           file:"T_01_Nakano" },
    { id:"T02",  lc:"T",  order:2,  name_ja:"落合",    name_en:"Ochiai",           file:"T_02_Ochiai" },
    { id:"T03",  lc:"T",  order:3,  name_ja:"高田馬場",name_en:"Takadanobaba",     file:"T_03_Takadanobaba" },
    { id:"T04",  lc:"T",  order:4,  name_ja:"早稲田",  name_en:"Waseda",           file:"T_04_Waseda" },
    { id:"T05",  lc:"T",  order:5,  name_ja:"飯田橋",  name_en:"Iidabashi",        file:"T_05_Iidabashi" },
    { id:"T06",  lc:"T",  order:6,  name_ja:"九段下",  name_en:"Kudanshita",       file:"T_06_Kudanshita" },
    { id:"T07",  lc:"T",  order:7,  name_ja:"大手町",  name_en:"Otemachi",         file:"T_07_Otemachi" },
    { id:"T08",  lc:"T",  order:8,  name_ja:"日本橋",  name_en:"Nihombashi",       file:"T_08_Nihombashi" },
    { id:"T09",  lc:"T",  order:9,  name_ja:"門前仲町",name_en:"Monzen-nakacho",   file:"T_09_Monzen-nakacho" },
    { id:"T10",  lc:"T",  order:10, name_ja:"東陽町",  name_en:"Toyocho",          file:"T_10_Toyocho" },
  ];

  const entities = {};
  for (const s of stationsData) {
    entities[s.id] = { type: "station", name_ja: s.name_ja, name_en: s.name_en, lc: s.lc, order: s.order, file: s.file };
  }

  return {
    pack_meta: {
      pack_version: "0.1",
      pack_id: "tokyo_4lines_v1",
      name: "東京4路線コース",
      locale_default: "ja",
      created_at: iso,
      updated_at: iso
    },
    entities,
    collections: {
      R1: { kind: "route", lc: "JY", name_ja: "山手線", name_en: "Yamanote", color: LINE_COLORS.JY, size: 10, members: Array(10).fill(null) },
      R2: { kind: "route", lc: "M",  name_ja: "丸ノ内線", name_en: "Marunouchi", color: LINE_COLORS.M, size: 10, members: Array(10).fill(null) },
      R3: { kind: "route", lc: "G",  name_ja: "銀座線", name_en: "Ginza", color: LINE_COLORS.G, size: 10, members: Array(10).fill(null) },
      R4: { kind: "route", lc: "T",  name_ja: "東西線", name_en: "Tozai", color: LINE_COLORS.T, size: 10, members: Array(10).fill(null) }
    },
    layouts: {
      default: {
        layout_kind: "editor_4x10",
        slots: [
          { collection_id: "R1", label_ja: "山手線", label_en: "Yamanote" },
          { collection_id: "R2", label_ja: "丸ノ内線", label_en: "Marunouchi" },
          { collection_id: "R3", label_ja: "銀座線", label_en: "Ginza" },
          { collection_id: "R4", label_ja: "東西線", label_en: "Tozai" }
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

// ===== 状態 =====
const state = {
  pack: makeSamplePack(),
  model: null,
  locale: "ja",
  filterType: "",
  query: "",
  selectedEntityId: null,
  selectedRouteId: null
};

// ===== ユーティリティ =====
function setStatus(msg) { $("status").textContent = msg; }
function rebuildModel() { state.model = gos.model.normalize(state.pack); }
function updatePackFromModel() { state.pack = state.model.raw; state.pack.pack_meta.updated_at = nowISO(); }

// ===== 配置済み駅数カウント =====
function countFilledSlots() {
  let count = 0;
  for (const c of Object.values(state.pack.collections || {})) {
    for (const eid of (c.members || [])) { if (eid) count++; }
  }
  return count;
}

// ===== プレイ可能判定 =====
function canPlayNow() {
  const issues = gos.validate.model(state.model, state.pack.rules, state.pack.entities, state.locale);
  if (issues.some(x => x.level === "error")) return { ok: false, reason: "エラーを修正してからプレイできます。" };
  const slotDefs = Array.isArray(state.pack.layouts?.default?.slots) ? state.pack.layouts.default.slots : [];
  if (slotDefs.length === 0) return { ok: false, reason: "路線が設定されていません。" };
  for (const s of slotDefs) {
    const c = state.pack.collections?.[s.collection_id];
    if (!c) return { ok: false, reason: `路線が見つかりません: ${s.collection_id}` };
    const members = Array.isArray(c.members) ? c.members : [];
    if (members.length < 10 || members.includes(null)) return { ok: false, reason: `${c.name_ja} の10駅を全て配置してください` };
  }
  return { ok: true, reason: "OK" };
}

// ===== プレイボタン更新 =====
function updatePlayButton() {
  const btn = $("btnPlay");
  if (!btn) return;
  const verdict = canPlayNow();
  btn.disabled = !verdict.ok;
  btn.title = verdict.ok ? "このコースでゲームを開始" : verdict.reason;
}

// ===== 進捗バー更新 =====
function updateProgress() {
  const filled = countFilledSlots();
  const total = 40;
  const pct = Math.round((filled / total) * 100);
  $("progressText").textContent = `${filled} / ${total} 駅配置済み`;
  $("progressPercent").textContent = `${pct}%`;
  $("progressFill").style.width = `${pct}%`;
}

// ===== 全体レンダリング =====
function render() {
  renderPool();
  renderRoutes();
  renderIssues();
  renderSelection();
  updatePlayButton();
  updateProgress();
}

// ===== 選択情報レンダリング =====
function renderSelection() {
  const e = state.selectedEntityId ? state.pack.entities[state.selectedEntityId] : null;
  const c = state.selectedRouteId ? state.pack.collections[state.selectedRouteId] : null;
  $("selEntity").textContent = e
    ? `${e.name_ja || e.name_en} (${state.selectedEntityId})`
    : "未選択";
  $("selRoute").textContent = c
    ? `${c.name_ja || c.name_en || state.selectedRouteId}`
    : "未選択";
}

// ===== 駅リストレンダリング =====
function renderPool() {
  const pool = $("pool");
  pool.innerHTML = "";
  const pack = state.pack;

  // 使用済み駅のセット
  const used = new Set();
  for (const c of Object.values(pack.collections || {})) {
    for (const eid of (c.members || [])) if (eid) used.add(eid);
  }

  const entries = Object.entries(pack.entities || {}).map(([id, e]) => ({ id, e }));
  // 路線コード順 → 番号順でソート
  entries.sort((a, b) => {
    const lcA = a.e.lc || ""; const lcB = b.e.lc || "";
    if (lcA !== lcB) return lcA.localeCompare(lcB);
    return (a.e.order || 0) - (b.e.order || 0);
  });

  // 路線グループ別に表示
  let currentLc = null;
  for (const { id, e } of entries) {
    if (state.filterType && e.type !== state.filterType) continue;
    const displayName = state.locale === "ja" ? (e.name_ja || e.name_en) : (e.name_en || e.name_ja);
    if (state.query && !displayName.includes(state.query) && !(e.name_ja || "").includes(state.query)) continue;

    // 路線区切りヘッダー
    if (e.lc && e.lc !== currentLc) {
      currentLc = e.lc;
      const header = el("div");
      header.style.cssText = `
        padding: 4px 6px 2px;
        font-size: 10px;
        font-weight: 800;
        color: ${LINE_COLORS[e.lc] || "rgba(255,255,255,.5)"};
        letter-spacing: .5px;
        margin-top: 4px;
      `;
      header.textContent = `── ${LINE_NAMES[e.lc] || e.lc} ──`;
      pool.appendChild(header);
    }

    const div = el("div", "entity");
    if (id === state.selectedEntityId) div.classList.add("selected");
    if (used.has(id)) div.classList.add("used");

    // カード画像サムネイル
    const imgUrl = getCardImageUrl(e, id);
    let thumbEl;
    if (imgUrl) {
      thumbEl = document.createElement("img");
      thumbEl.className = "entity-thumb";
      thumbEl.src = imgUrl;
      thumbEl.alt = e.name_ja || id;
      thumbEl.onerror = () => {
        // 画像が読み込めない場合はプレースホルダーに置き換え
        const ph = el("div", "entity-thumb-placeholder");
        ph.textContent = "🚉";
        thumbEl.replaceWith(ph);
      };
    } else {
      thumbEl = el("div", "entity-thumb-placeholder");
      thumbEl.textContent = "🚉";
    }

    const infoEl = el("div", "entity-info");
    const lineColor = LINE_COLORS[e.lc] || "#fff";
    infoEl.innerHTML = `
      <div class="name">${displayName}</div>
      <div class="meta">
        <span class="line-pill" style="background:${lineColor}22; border:1px solid ${lineColor}55; color:${lineColor}">${e.lc || ""}</span>
        <span class="pill">${id}</span>
        ${used.has(id) ? '<span class="pill" style="color:rgba(251,113,133,.7)">配置済</span>' : ""}
      </div>
    `;

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

  for (const s of slotDefs) {
    const cid = s.collection_id;
    const c = state.pack.collections?.[cid];
    if (!c) continue;

    const lineCode = c.lc || cid;
    const lineColor = c.color || LINE_COLORS[lineCode] || "#fff";
    const members = Array.isArray(c.members) ? c.members : [];
    const filledCount = members.filter(Boolean).length;

    const div = el("div", "route");
    if (cid === state.selectedRouteId) div.classList.add("selected");

    // 路線ヘッダー
    const head = el("div", "route-head");
    head.innerHTML = `
      <div class="route-title">
        <div class="swatch" style="background:${lineColor}; box-shadow: 0 0 6px ${lineColor}55"></div>
        <div class="route-name">${c.name_ja || cid}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="route-progress">${filledCount}/10</div>
        <div class="route-edit">
          <label>コード <input type="text" class="input mini" value="${c.lc || cid}" data-field="lc"></label>
          <label>日本語名 <input type="text" class="input mid" value="${c.name_ja || ''}" data-field="name_ja"></label>
          <label>色 <input type="color" class="input color" value="${c.color || '#ffffff'}" data-field="color"></label>
        </div>
      </div>
    `;

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

    // スロットグリッド
    const grid = el("div", "route-grid");
    for (let i = 0; i < 10; i++) {
      const slot = el("div", `slot line-${lineCode}`);
      const eid = members[i];

      if (eid) {
        slot.classList.add("filled");
        const st = state.pack.entities[eid];
        const imgUrl = st ? getCardImageUrl(st, eid) : null;

        const idxEl = el("div", "slot-index");
        idxEl.textContent = String(i + 1);
        slot.appendChild(idxEl);

        if (imgUrl) {
          const img = document.createElement("img");
          img.className = "slot-thumb";
          img.src = imgUrl;
          img.alt = st?.name_ja || eid;
          img.onerror = () => img.remove();
          slot.appendChild(img);
        }

        const nameEl = el("div", "slot-name");
        nameEl.textContent = st ? (state.locale === "ja" ? st.name_ja : st.name_en) : eid;
        slot.appendChild(nameEl);

        // ツールチップ
        slot.title = `${st?.name_ja || eid} (${eid}) — 右クリックで削除`;
      } else {
        const idxEl = el("div", "slot-index");
        idxEl.textContent = String(i + 1);
        slot.appendChild(idxEl);

        const hintEl = el("div", "slot-empty-hint");
        hintEl.textContent = "ここに\n配置";
        slot.appendChild(hintEl);

        slot.title = `スロット ${i + 1}：駅を選択してクリックで配置`;
      }

      // クリックで配置
      slot.onclick = (e) => {
        e.stopPropagation();
        if (state.selectedEntityId) {
          state.model = gos.ops.setMember(state.model, cid, i, state.selectedEntityId);
          updatePackFromModel();
          render();
          setStatus(`✅ ${state.pack.entities[state.selectedEntityId]?.name_ja || state.selectedEntityId} を ${c.name_ja} スロット ${i+1} に配置しました`);
        } else {
          setStatus("⚠ 先に左の駅リストから駅を選択してください");
        }
      };

      // 右クリックで削除
      slot.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (eid) {
          const stName = state.pack.entities[eid]?.name_ja || eid;
          state.model = gos.ops.setMember(state.model, cid, i, null);
          updatePackFromModel();
          render();
          setStatus(`🗑 ${stName} を削除しました`);
        }
      };

      grid.appendChild(slot);
    }

    div.appendChild(grid);
    routesEl.appendChild(div);
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
    issuesEl.innerHTML = `
      <div class="issue" style="border-color:rgba(52,211,153,.3); background:rgba(52,211,153,.06)">
        <div class="top"><div class="code" style="color:rgba(52,211,153,.9)">✅ OK</div></div>
        <div class="msg">問題ありません。プレイできます！</div>
      </div>`;
    return;
  }
  for (const it of issues) {
    const d = el("div", "issue");
    d.style.borderColor = "rgba(251,113,133,.3)";
    d.innerHTML = `
      <div class="top"><div class="code" style="color:rgba(251,113,133,.9)">${it.code || it.level}</div></div>
      <div class="msg">${it.message || ""}</div>`;
    issuesEl.appendChild(d);
  }
}

// ===== UI イベント配線 =====
function wireUI() {
  $("q").addEventListener("input", (ev) => { state.query = ev.target.value || ""; renderPool(); });
  $("locale").addEventListener("change", (ev) => { state.locale = ev.target.value || "ja"; render(); });

  $("btnValidate").addEventListener("click", () => { renderIssues(); setStatus("🔍 チェック完了"); });

  $("btnClearSelectedRoute").addEventListener("click", () => {
    if (!state.selectedRouteId) return setStatus("⚠ 先に路線を選択してください");
    const c = state.pack.collections[state.selectedRouteId];
    state.model = gos.ops.clearCollection(state.model, state.selectedRouteId);
    updatePackFromModel();
    render();
    setStatus(`🗑 ${c?.name_ja || state.selectedRouteId} をクリアしました`);
  });

  $("btnSaveLocal").addEventListener("click", () => {
    gos.io.saveToLocalStorage(state.pack, LOCAL_KEY);
    setStatus("💾 ローカルに保存しました");
  });

  $("btnLoadLocal").addEventListener("click", () => {
    const p = gos.io.loadFromLocalStorage(LOCAL_KEY);
    if (!p) return setStatus("⚠ 保存データが見つかりません");
    state.pack = p;
    rebuildModel();
    render();
    setStatus("📂 保存データを読み込みました");
  });

  $("btnNew").addEventListener("click", () => {
    if (!confirm("現在のコースをリセットして新規作成しますか？")) return;
    state.pack = makeSamplePack();
    rebuildModel();
    render();
    setStatus("🆕 新規コースを作成しました");
  });

  $("btnLoadSample").addEventListener("click", () => {
    if (!confirm("サンプルデータを読み込みますか？現在のデータは失われます。")) return;
    state.pack = makeSamplePack();
    rebuildModel();
    render();
    setStatus("📋 サンプルデータを読み込みました");
  });

  $("btnExportPack").addEventListener("click", () => {
    gos.io.downloadPack(state.pack, `${state.pack.pack_meta?.pack_id || "gos-pack"}_pack.json`);
    setStatus("📤 GOS Packをエクスポートしました");
  });

  $("fileImport").addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        state.pack = data;
        rebuildModel();
        render();
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

  // 自動配置ボタン
  $("btnAutoFill").addEventListener("click", () => {
    const slotDefs = Array.isArray(state.pack.layouts?.default?.slots) ? state.pack.layouts.default.slots : [];
    const allIds = Object.keys(state.pack.entities || {});

    // 路線ごとに対応する駅IDを自動配置（lc が一致する駅を順番に）
    let changed = false;
    for (const s of slotDefs) {
      const cid = s.collection_id;
      const c = state.pack.collections?.[cid];
      if (!c) continue;
      const lc = c.lc;
      // この路線の駅を lc と order でフィルタ・ソート
      const lineStations = allIds
        .filter(id => state.pack.entities[id]?.lc === lc)
        .sort((a, b) => (state.pack.entities[a]?.order || 0) - (state.pack.entities[b]?.order || 0));

      for (let i = 0; i < 10 && i < lineStations.length; i++) {
        state.model = gos.ops.setMember(state.model, cid, i, lineStations[i]);
        changed = true;
      }
    }
    if (changed) {
      updatePackFromModel();
      render();
      setStatus("⚡ 自動配置しました");
    } else {
      setStatus("⚠ 配置できる駅がありません");
    }
  });
}

// ===== 起動 =====
function boot() {
  rebuildModel();
  wireUI();
  render();
  setStatus("準備完了。駅リストから駅を選択してコースを組んでください。");
}
boot();
