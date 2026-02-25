// main.js (boot & wiring) - cleaned

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
   Layout helpers
--------------------------- */

function isMobile() {
  return window.innerWidth <= 1023;
}

function clearMapOnly() {
  // map-only が残ると header/statusBar が消えるので保険
  document.body.classList.remove("map-only");
}

function applyMobileTopBars() {
  // スマホだけ：header + statusBar の高さをCSS変数/ padding-top に反映
  if (!isMobile()) {
    // PCに戻ったら副作用を消す
    document.documentElement.style.removeProperty("--mobile-header-h");
    document.body.style.removeProperty("padding-top");
    const bar = document.getElementById("statusBar");
    if (bar) bar.style.removeProperty("top");
    return;
  }

  // header は body直下にある前提（無い場合でも落とさない）
  const header = document.querySelector("body > .header") || document.querySelector(".header");
  const bar = document.getElementById("statusBar");
  if (!header) return;

  const headerH = header.offsetHeight || 72;
  document.documentElement.style.setProperty("--mobile-header-h", headerH + "px");

  if (bar) {
    // statusBar を header の直下固定にしているCSS向け
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
  // resize連打をまとめる
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    applyMobileTopBars();
    forceMapResize();
  }, 120);
}

/* ---------------------------
   Boot
--------------------------- */

function boot() {
  clearMapOnly();

  // ログはデフォルト非表示
  document.body.classList.remove("show-log");

  // Optional demo card grid
  if (typeof renderCards === "function") {
    try { renderCards(); } catch (e) {}
  }

  // Init map then start
  initMapComponent();
  startGame();

  // 初期レイアウト調整
  applyMobileTopBars();
  setTimeout(forceMapResize, 250);
}

// DOM準備後に起動（loadより早く確実）
document.addEventListener("DOMContentLoaded", boot);

// Android Chromeの履歴復元対策（map-onlyなどが残る）
window.addEventListener("pageshow", () => {
  clearMapOnly();
  applyMobileTopBars();
  setTimeout(forceMapResize, 200);
});

// Resize
window.addEventListener("resize", onResize);