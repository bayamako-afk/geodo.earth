// ========================================
// GUNO v5 UI (v4.05互換)
// 完全なオーバーレイカード生成対応版
// ========================================

function setHint(text){
  const el = document.getElementById("hint-area");
  if (el) el.textContent = text;
}

function renderDeck(){
  const S = window.GUNO;
  const deckEl = document.getElementById("draw-pile-visual");
  if (deckEl){
    deckEl.className = "card";
    deckEl.style.backgroundImage = "url('https://geodo.earth/guno_v2/cards/GUNO_BACK.png')";
    deckEl.style.backgroundSize = "contain";
    deckEl.style.backgroundRepeat = "no-repeat";
    deckEl.style.backgroundPosition = "center";
    deckEl.textContent = "";
  }
}

function renderDiscard(){
  const S = window.GUNO;
  const el = document.getElementById("discard-pile");
  if (!el) return;
  el.innerHTML = "";
  if (!S.discard) return;
  
  // LASTカードは72pxで表示
  const cardNode = makeCardHTML(S.discard, false, 72);
  el.innerHTML = cardNode;
}

/**
 * カードHTML生成（完全版オーバーレイ対応）
 * @param {Object} card - カードデータ
 * @param {boolean} playable - プレイ可能かどうか
 * @param {number} width - カード幅（px）、未指定の場合はCSS変数を使用
 * @returns {string} カードのHTML文字列
 */
function makeCardHTML(card, playable, width = null){
  const widthStyle = width ? `--w:${width}px;` : `--w:var(--card-w);`;
  const playableClass = playable ? 'playable' : '';
  
  // 停電カード
  if (card.type === 'teiden') {
    return `
      <div class="card guno-card guno-card--teiden ${playableClass}" data-line="${card.line}" style="${widthStyle} margin:0;">
        <div class="teiden-icon" aria-label="停電">⚡</div>
        <div class="teiden-sub">停電</div>
        <div class="teiden-en">Blackout</div>
      </div>
    `;
  }
  
  // 駅カード
  // 2文字駅名の場合はshort-nameクラスを追加（★を除外して判定）
  const shortNameClass = card.ja.replace('★', '').length === 2 ? 'short-name' : '';
  
  return `
    <div class="card guno-card ${playableClass}" data-line="${card.line}" style="${widthStyle} margin:0;">
      <div class="corner corner--tl">
        <div class="corner-bg"></div>
        <div class="corner-num">${card.n}</div>
      </div>
      <div class="corner corner--br">
        <div class="corner-bg"></div>
        <div class="corner-num corner-num--rot">${card.n}</div>
      </div>
      <div class="center">
        <div class="station-jp ${shortNameClass}">${card.ja}</div>
        <div class="station-en">${card.en}</div>
      </div>
      <div class="route-code">${card.line}</div>
    </div>
  `;
}

/**
 * カードノード生成（DOM要素版）
 * 互換性のために残しているが、内部ではHTMLを生成してinnerHTMLで挿入
 */
function makeCardNode(card, playable){
  const wrap = document.createElement("div");
  wrap.innerHTML = makeCardHTML(card, playable);
  return wrap.firstElementChild;
}

function renderPlayers(){
  const S = window.GUNO;
  const area = document.getElementById("players-area");
  if (!area) return;
  area.innerHTML = "";

  S.players.forEach((p, pi) => {
    const row = document.createElement("div");
    row.style.marginBottom = "10px";

    const title = document.createElement("div");
    title.style.fontWeight = "900";
    title.style.margin = "4px 0";
    title.textContent = `${p.id}  Stations:${p.hand.length}  Score:${p.score}` + (S.current===pi ? "  ◀" : "");
    row.appendChild(title);

    const hand = document.createElement("div");
    hand.style.display = "flex";
    hand.style.gap = "8px";
    hand.style.flexWrap = "nowrap";
    hand.style.overflow = "hidden";

    p.hand.forEach((c, hi) => {
      const ok = (S.current===pi) && canPlay(c);
      const node = makeCardNode(c, ok);
      node.style.cursor = ok ? "pointer" : "default";
      if (!ok) node.classList.add("unplayable");
      node.onclick = () => {
        if (S.current!==pi) return;
        if (playCard(pi, hi)){
          renderAll();
          updateMapFromState();
        }
      };
      hand.appendChild(node);
    });

    row.appendChild(hand);
    area.appendChild(row);
  });
}

function renderSlots(){
  const S = window.GUNO;

  const headerMap = {
    "JY":"header-jy",
    "M":"header-m",
    "G":"header-g",
    "T":"header-t",
  };
  const gridMap = {
    "JY":"map-jy",
    "M":"map-m",
    "G":"map-g",
    "T":"map-t",
  };

  for (const line of window.GUNO_LINES){
    const lc = line.line_code;
    const h = document.getElementById(headerMap[lc]);
    const g = document.getElementById(gridMap[lc]);
    if (h) h.textContent = `[${lc}]`; // 短い表記
    if (!g) continue;

    g.innerHTML = "";
    for (let n = 1; n <= 10; n++){
      const slot = document.createElement("div");
      slot.className = "slot";
      const placed = S.slots[lc][n];
      if (placed){
        // 配置されたカードを表示
        const cardHTML = makeCardHTML(placed, false);
        slot.innerHTML = cardHTML;
        slot.classList.add("active");
      }else{
        // 空スロット
        const station = line.stations[n-1];
        const stName = window.GUNO.isJapanese ? station.ja : station.en;
        slot.innerHTML = `<div style="font-size:16px;">${n}</div>
          <div style="font-size:10px; opacity:.9;">★${stName}</div>`;
      }
      g.appendChild(slot);
    }
  }
}

function renderAll(){
  renderDeck();
  renderDiscard();
  renderPlayers();
  renderSlots();
  const S = window.GUNO;
  setHint(S.current === 0 ? "出せるカードをタップ" : `待ち：${S.players[S.current].id}の番`);
}

window.toggleLanguage = function(){
  window.GUNO.isJapanese = !window.GUNO.isJapanese;
  renderAll();
  updateMapFromState();
};

window.toggleAuto = function(){
  window.GUNO.auto = !window.GUNO.auto;
  const btn = document.getElementById("btn-mode");
  if (btn){
    btn.textContent = window.GUNO.auto ? "▶️ AUTO: ON" : "▶️ AUTO: OFF";
    btn.className = window.GUNO.auto ? "btn-auto" : "btn-manual";
  }
};

window.humanDraw = function(){
  const S = window.GUNO;
  const p = S.players[S.current];
  const c = drawCard();
  if (!c) return;
  p.hand.push(c);
  renderAll();
};