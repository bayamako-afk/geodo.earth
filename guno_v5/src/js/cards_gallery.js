// js/cards_gallery.js
// Render the "GUNO Cards (Digital Overlay)" gallery using STATIONS_DB

(() => {
  "use strict";

  function adjustFontByLength(cardEl, jpText, enText){
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

  function createCard({lc, order, st_ja, st_en}, opts = {}){
    const card = document.createElement("div");
    card.className = "guno-card" + (opts.small ? " is-small" : "");
    card.dataset.line = lc;

    card.innerHTML = `
      <div class="corner corner--tl">
        <div class="corner-bg"></div>
        <div class="corner-num">${order}</div>
      </div>

      <div class="corner corner--br">
        <div class="corner-bg"></div>
        <div class="corner-num corner-num--rot">${order}</div>
      </div>

      <div class="center">
        <div class="station-jp"></div>
        <div class="station-en"></div>
      </div>

      <div class="route-code">${lc}</div>
    `;

    card.querySelector(".station-jp").textContent = st_ja;
    card.querySelector(".station-en").textContent = st_en;

    adjustFontByLength(card, st_ja, st_en);
    return card;
  }

  function renderCards(){
    const grid = document.getElementById("cardGrid");
    if (!grid || !window.STATIONS_DB) return;

    grid.innerHTML = "";
    for (const row of window.STATIONS_DB){
      grid.appendChild(createCard(row));
    }
  }

  document.addEventListener("DOMContentLoaded", renderCards);
})();