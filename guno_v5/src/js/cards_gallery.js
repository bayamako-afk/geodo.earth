/* =========================
   GUNO v5 - cards_gallery.js
   - ギャラリー描画を STATIONS_DB（window.GUNO）に統一
   - 既存の #cardGrid に 40枚を描画
   ========================= */

(function () {
  "use strict";

  if (!window.GUNO || !Array.isArray(GUNO.STATIONS_DB)) {
    console.error("[GUNO] stationDB.js が読み込まれていません（GUNO.STATIONS_DB がありません）");
    return;
  }

  const $ = (id) => document.getElementById(id);

  /** 長い駅名だけ少し縮小（v4互換） */
  function adjustFontByLength(cardEl, jpText, enText) {
    const jpEl = cardEl.querySelector(".station-jp");
    const enEl = cardEl.querySelector(".station-en");
    if (!jpEl || !enEl) return;

    const jpLen = (jpText || "").length;
    const enLen = (enText || "").length;

    // JP
    if (jpLen <= 3) jpEl.style.fontSize = "calc(var(--w) * 0.155)";
    else if (jpLen <= 5) jpEl.style.fontSize = "calc(var(--w) * 0.142)";
    else if (jpLen <= 8) jpEl.style.fontSize = "calc(var(--w) * 0.132)";
    else jpEl.style.fontSize = "calc(var(--w) * 0.120)";

    // EN
    if (enLen <= 8) enEl.style.fontSize = "calc(var(--w) * 0.070)";
    else if (enLen <= 14) enEl.style.fontSize = "calc(var(--w) * 0.063)";
    else enEl.style.fontSize = "calc(var(--w) * 0.058)";
  }

  /** 1枚カードDOM作成（ギャラリー用） */
  function createCardFromStation(st, opts = {}) {
    const card = document.createElement("div");
    card.className = "guno-card" + (opts.small ? " is-small" : "");
    card.dataset.line = st.lc;

    // ★はギャラリーでは消してスッキリ表示（好みで変更可）
    const jp = (st.st_ja || "").replaceAll("★", "");
    const en = (st.st_en || "").replaceAll("★", "");

    card.innerHTML = `
      <div class="corner corner--tl">
        <div class="corner-bg"></div>
        <div class="corner-num">${st.order}</div>
      </div>

      <div class="corner corner--br">
        <div class="corner-bg"></div>
        <div class="corner-num corner-num--rot">${st.order}</div>
      </div>

      <div class="center">
        <div class="station-jp"></div>
        <div class="station-en"></div>
      </div>

      <div class="route-code">${st.lc}</div>
    `;

    card.querySelector(".station-jp").textContent = jp;
    card.querySelector(".station-en").textContent = en;

    adjustFontByLength(card, jp, en);

    return card;
  }

  /** pack指定が無い場合は「今の東京4路線」を描画 */
  function getDefaultStations() {
    // 基本は全DB（いま40枚）
    // 将来パック導入したら GUNO.PACKS を見て絞れるようにする
    return [...GUNO.STATIONS_DB].sort((a, b) => {
      // lc順 → order順
      if (a.lc !== b.lc) return a.lc.localeCompare(b.lc);
      return a.order - b.order;
    });
  }

  function renderGallery(opts = {}) {
    const grid = $("cardGrid");
    if (!grid) return;

    const stations = opts.stations || getDefaultStations();

    grid.innerHTML = "";
    for (const st of stations) {
      grid.appendChild(createCardFromStation(st, { small: !!opts.small }));
    }
  }

  // 公開（将来パック切替UIで使える）
  window.GUNO = window.GUNO || {};
  window.GUNO.renderGallery = renderGallery;

  document.addEventListener("DOMContentLoaded", () => renderGallery());
})();