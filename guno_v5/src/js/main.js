// main.js (boot & wiring) - CLEAN FIXED

async function applyRealDegreeFromJson(){
  const res = await fetch("./degree_map.json");
  const degreeMap = await res.json(); // { "新宿": ["jr-east-yamanote", ...], ... }

  // STATIONS_DB は const でも中身は書き換え可能
  const db = (window.STATIONS_DB || (typeof STATIONS_DB !== "undefined" ? STATIONS_DB : []));
  const norm = (s) => (s || "").replaceAll("★","").trim();

  db.forEach(st => {
    const name = norm(st.st_ja);
    const routes = degreeMap[name] || [];
    st.degree_routes = routes;                    // 内訳（linesページに使える）
    st.degree_real = Math.max(1, routes.length);  // 0は1扱い（破綻防止）
    st.degree_bonus = Math.max(0, st.degree_real - 1);
  });

  console.log("REAL DEGREE APPLIED (sample):",
    db
      .filter(s => (s.degree_real||1) >= 2)
      .slice(0, 10)
      .map(s => ({ st: s.st_ja, d: s.degree_real, routes: s.degree_routes }))
  );
}

function loadV5DataFromLocalStorage() {
  const s = localStorage.getItem("guno_v5data_v1");
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

// Optional: load dynamic data from GOS Editor
const dynamicV5 = loadV5DataFromLocalStorage();
if (dynamicV5) {
  window.STATIONS_DB = dynamicV5.STATIONS_DB;
  window.STATION_DB_CARDS = dynamicV5.STATION_DB_CARDS;
  window.TEIDEN_FILES = dynamicV5.TEIDEN_FILES;
  console.log("Loaded GUNO v5 data dynamically from GOS Editor:", dynamicV5);
}

/* ---------------------------
   Helpers
--------------------------- */

function isMobile() {
  return window.innerWidth <= 1023;
}

function clearMapOnly() {
  // map-only が残ると header/statusBar が消えるので保険
  document.body.classList.remove("map-only");
}

// 元のDOM位置を保持（PCに戻すため）
const __orig = {
  header: { el: null, parent: null, next: null },
  status: { el: null, parent: null, next: null },
};

function captureOriginalPositions() {
  // 1回だけ保存
  if (!__orig.header.el) {
    const h = document.querySelector(".header");
    if (h) {
      __orig.header.el = h;
      __orig.header.parent = h.parentElement;
      __orig.header.next = h.nextElementSibling;
    }
  }
  if (!__orig.status.el) {
    const s = document.getElementById("statusBar");
    if (s) {
      __orig.status.el = s;
      __orig.status.parent = s.parentElement;
      __orig.status.next = s.nextElementSibling;
    }
  }
}

/**
 * スマホ時：header/statusBar を body 直下へ移動（固定トップバーが確実に効く）
 * PC時：元の場所へ戻す（PC設計を崩さない）
 */
function relocateTopBarsForViewport() {
  captureOriginalPositions();

  const header = __orig.header.el || document.querySelector(".header");
  const status = __orig.status.el || document.getElementById("statusBar");
  if (!header) return;

  if (isMobile()) {
    // body直下へ（先頭に header、その直後に statusBar）
    if (header.parentElement !== document.body) {
      document.body.insertBefore(header, document.body.firstChild);
    }
    if (status) {
      // headerの直後へ
      const afterHeader = header.nextSibling;
      if (status.parentElement !== document.body || status !== afterHeader) {
        document.body.insertBefore(status, header.nextSibling);
      }
    }
  } else {
    // PCに戻ったら元の位置へ戻す
    if (__orig.header.parent && header.parentElement === document.body) {
      if (__orig.header.next && __orig.header.next.parentElement === __orig.header.parent) {
        __orig.header.parent.insertBefore(header, __orig.header.next);
      } else {
        __orig.header.parent.appendChild(header);
      }
    }
    if (status && __orig.status.parent && status.parentElement === document.body) {
      if (__orig.status.next && __orig.status.next.parentElement === __orig.status.parent) {
        __orig.status.parent.insertBefore(status, __orig.status.next);
      } else {
        __orig.status.parent.appendChild(status);
      }
    }

    // PCでは body padding-top を消す（モバイル固定バー分の余白対策）
    document.body.style.paddingTop = "";
    if (status) status.style.top = "";
  }
}

/**
 * スマホ時：header + statusBar の高さを測って
 * - statusBar の top を header の直下に
 * - body padding-top を (header + statusBar) に
 */
function applyMobileTopBars() {
  if (!isMobile()) return;

  const header = document.querySelector("body > .header") || document.querySelector(".header");
  const bar = document.getElementById("statusBar");
  if (!header) return;

  const headerH = header.offsetHeight || 72;

  if (bar) {
    bar.style.top = headerH + "px";
    const barH = bar.offsetHeight || 0;
    document.body.style.paddingTop = (headerH + barH) + "px";
  } else {
    document.body.style.paddingTop = headerH + "px";
  }
}

function forceMapResize() {
  try {
    if (window.map && typeof window.map.invalidateSize === "function") {
      window.map.invalidateSize();
    } else if (typeof safeInvalidateMap === "function") {
      safeInvalidateMap();
    }
  } catch (e) {}
}

let resizeTimer = null;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    relocateTopBarsForViewport();
    applyMobileTopBars();
    forceMapResize();
  }, 120);
}

/* ---------------------------
   Overlay (Result)
--------------------------- */

function liftOverlayToBody() {
  const overlay = document.getElementById("result-overlay");
  if (!overlay) return;
  if (overlay.parentElement === document.body) return;
  document.body.appendChild(overlay);
}

/* ---------------------------
   Boot
--------------------------- */

async function boot() {
  clearMapOnly();

  // 勝利オーバーレイはbody直下へ（fixed崩れ防止）
  liftOverlayToBody();

  document.body.classList.remove("show-log");

  // 先にトップバー位置を整える（モバイル対策）
  relocateTopBarsForViewport();
  applyMobileTopBars();

  // カードDOMが必要なら先に描画（保険）
  if (typeof renderCards === "function") {
    try { renderCards(); } catch (e) {}
  }

  // ★重要：ゲーム開始前に degree を適用（7路線版）
  try {
    await applyRealDegreeFromJson();
  } catch (e) {
    console.warn("applyRealDegreeFromJson failed:", e);
  }

  // レイアウト確定後に map 初期化 → start
  setTimeout(() => {

    initMapComponent();
    startGame();

    // さらに少し待ってから確実にサイズ再計算
    setTimeout(() => {

      if (window.map && typeof window.map.invalidateSize === "function") {
        window.map.invalidateSize();
      }

      // 初期位置を再設定（重要）
      if (window.map && typeof window.map.setView === "function") {
        const center = window.map.getCenter();
        const zoom = window.map.getZoom();
        window.map.setView(center, zoom);
      }

    }, 120);

  }, 80);
}

// DOM準備後に起動
document.addEventListener("DOMContentLoaded", boot);

// Android Chromeの履歴復元対策（classやDOM状態が残る）
window.addEventListener("pageshow", () => {
  clearMapOnly();
  relocateTopBarsForViewport();
  applyMobileTopBars();
  setTimeout(forceMapResize, 200);
});

// Resize
window.addEventListener("resize", onResize);

// ===== Result Lines Overlay (7 routes) =====
let __resultLinesLayerGroup = null;

function getLeafletMapInstance(){
  // 候補を広めに拾う（window.map が別物のケース対策）
  const cand = [];
  if (window.map) cand.push(window.map);

  // よくある別名も拾う（あれば）
  if (window.leafletMap) cand.push(window.leafletMap);
  if (window._map) cand.push(window._map);

  // グローバル変数 map があれば拾う
  try { if (typeof map !== "undefined") cand.push(map); } catch(e){}

  // Leaflet Map っぽいものを返す
  for(const m of cand){
    if (m && typeof m.addLayer === "function" && typeof m.removeLayer === "function" && typeof m.getCenter === "function") {
      return m;
    }
  }
  return null;
}

async function showResultLinesOnMainMap() {
  const m = getLeafletMapInstance();
  if (!m || typeof L === "undefined") {
    console.warn("Leaflet map instance not found for result overlay.");
    return;
  }

  // すでに表示中なら何もしない
  if (__resultLinesLayerGroup) return;

  __resultLinesLayerGroup = L.layerGroup();
  m.addLayer(__resultLinesLayerGroup);

  const lineFiles = [
    "jr-east-yamanote.geojson",
    "tokyo-metro-ginza.geojson",
    "tokyo-metro-marunouchi.geojson",
    "tokyo-metro-tozai.geojson",
    "tokyo-metro-hanzomon.geojson",
    "tokyo-metro-yurakucho.geojson",
    "tokyo-metro-namboku.geojson",
  ];

  const colorById = {
    "jr-east-yamanote": "#00AA00",
    "tokyo-metro-ginza": "#F39700",
    "tokyo-metro-marunouchi": "#E60012",
    "tokyo-metro-tozai": "#00A7DB",
    "tokyo-metro-hanzomon": "#8F76D6",
    "tokyo-metro-yurakucho": "#C1A470",
    "tokyo-metro-namboku": "#00AC9A",
  };

  const boundsAll = [];

  for (const f of lineFiles) {
    const id = f.replace(/\.geojson$/i, "");
    const url = `./geojson/lines/${f}`;

    const res = await fetch(url);
    if (!res.ok) { console.warn("line geojson load failed:", url, res.status); continue; }
    const geo = await res.json();

    const layer = L.geoJSON(geo, {
      style: () => ({
        color: colorById[id] || "#ffffff",
        weight: 6,
        opacity: 0.9
      })
    });

    // addTo(map) は使わず、LayerGroup に addLayer
    __resultLinesLayerGroup.addLayer(layer);

    const b = layer.getBounds();
    if (b && b.isValid && b.isValid()) boundsAll.push(b);
  }
/*
  // 任意：全体が見えるように寄せる（邪魔なら消してOK）
  if (boundsAll.length) {
    let merged = boundsAll[0];
    for (let i = 1; i < boundsAll.length; i++) merged = merged.extend(boundsAll[i]);
    m.fitBounds(merged.pad(0.12));
  }
*/
  
}

function hideResultLinesOnMainMap() {
  const m = getLeafletMapInstance();
  if (!m) return;

  if (__resultLinesLayerGroup) {
    try { m.removeLayer(__resultLinesLayerGroup); } catch(e) {}
    __resultLinesLayerGroup = null;
  }
}

function renderPersistentResult(ranking){
  const el = document.getElementById("persistent-result");
  if(!el || !ranking) return;

  const normStarLocal = (s) => (s || "").replace(/^★/,"").trim();
  const isStar = (s) => ((s || "").trim().startsWith("★"));

  let html = `
  <div style="background:#111;border:1px solid #444;padding:14px;border-radius:12px;margin-top:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <div style="color:gold;font-weight:900;">📊 LAST RESULT</div>
      <button id="btn-clear-result"
        style="border:1px solid #555;background:#222;color:#ddd;border-radius:10px;padding:6px 10px;cursor:pointer;">
        クリア
      </button>
    </div>

    <div style="margin-top:10px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="opacity:.9;">
            <th style="text-align:left;padding:6px 4px;">順位</th>
            <th style="text-align:left;padding:6px 4px;">Player</th>
            <th style="text-align:right;padding:6px 4px;">Total</th>
            <th style="text-align:right;padding:6px 4px;">Base</th>
            <th style="text-align:right;padding:6px 4px;">Conn</th>
          </tr>
        </thead>
        <tbody>
  `;

  ranking.forEach((r,i)=>{
    html += `
      <tr style="${i===0?'color:gold;font-weight:900;':''}">
        <td style="padding:6px 4px;">${i+1}</td>
        <td style="padding:6px 4px;">${r.p.icon} ${r.p.name}</td>
        <td style="padding:6px 4px;text-align:right;">${r.total}</td>
        <td style="padding:6px 4px;text-align:right;">${r.base}</td>
        <td style="padding:6px 4px;text-align:right;">+${r.connPts || 0}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  // ▼ 駅詳細（駅名で集約して重複を ×n 表示）
  html += `<div style="margin-top:10px;border-top:1px solid #333;padding-top:10px;">`;

  ranking.forEach((r)=>{
    const owned = (r.ownedStations || []);

    // name -> {name, star, degree, count}
    const agg = new Map();

    owned.forEach(st => {
      const name = normStarLocal(st.st_ja);
      if (!name) return;

      if (!agg.has(name)) {
        agg.set(name, {
          name,
          star: isStar(st.st_ja),
          degree: st.degree_real || 1,
          count: 0
        });
      }
      const obj = agg.get(name);
      obj.count += 1;
      obj.degree = Math.max(obj.degree, st.degree_real || 1);
      obj.star = obj.star || isStar(st.st_ja);
    });

    const list = Array.from(agg.values())
      .sort((a,b)=> (b.degree - a.degree) || (b.count - a.count) || a.name.localeCompare(b.name,'ja'))
      .map(x => `${x.star ? "★" : ""}${x.name}（${x.degree}）${x.count >= 2 ? `×${x.count}` : ""}`)
      .join(" / ");

    // 参考：ユニーク駅数
    const uniqCount = agg.size;

    html += `
      <div style="margin-top:10px;">
        <div style="font-weight:800;">
          ${r.p.icon} ${r.p.name}
          <span style="opacity:.7;font-weight:600;font-size:12px;">（Unique ${uniqCount} / Slots ${owned.length}）</span>
        </div>
        <div style="opacity:.92;font-size:12px;line-height:1.5;word-break:break-word;">
          ${list || "-"}
        </div>
      </div>
    `;
  });

  html += `</div></div>`;

  el.innerHTML = html;

  const btn = document.getElementById("btn-clear-result");
  if (btn) btn.onclick = clearPersistentResult;
}

function clearPersistentResult(){
  const el = document.getElementById("persistent-result");
  if (el) el.innerHTML = "";
}