// main.js (boot & wiring) - FINAL CLEAN STABLE

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
    // CSSでは mobileで fixed。ここで位置と余白を確定
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
   Boot
--------------------------- */

function boot() {
  clearMapOnly();
  function liftOverlayToBody() {
  const overlay = document.getElementById("result-overlay");
  if (!overlay) return;

  // すでにbody直下なら何もしない
  if (overlay.parentElement === document.body) return;

  // bodyの末尾に移動（常に最前面の土台になる）
  document.body.appendChild(overlay);
}

function boot() {
  clearMapOnly();

  // ★ 追加：勝利オーバーレイはbody直下に置く（fixed崩れ防止）
  liftOverlayToBody();

  document.body.classList.remove("show-log");

  if (typeof renderCards === "function") {
    try { renderCards(); } catch (e) {}
  }

  initMapComponent();
  startGame();

  applyMobileTopBars();
  setTimeout(forceMapResize, 250);
}
  document.body.classList.remove("show-log");

  if (typeof renderCards === "function") {
    try { renderCards(); } catch (e) {}
  }

  relocateTopBarsForViewport();
  applyMobileTopBars();

  // レイアウト確定後に map 初期化
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