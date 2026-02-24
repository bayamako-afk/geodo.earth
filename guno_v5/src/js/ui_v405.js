function setHint(text){
  const el = document.getElementById("hint-area");
  if (el) el.textContent = text;
}

function renderDeck(){
  const S = window.GUNO;
  const deckEl = document.getElementById("draw-pile-visual");
  if (deckEl){
    deckEl.className = "card";
    deckEl.style.backgroundImage = ""; // 裏面があればここに
    deckEl.textContent = "";
  }
  // DECK数は小さく表示（v4.05風）
  // （index.html側で small + div を持ってるので不要でもOK）
}

function renderDiscard(){
  const S = window.GUNO;
  const el = document.getElementById("discard-pile");
  if (!el) return;
  el.innerHTML = "";
  if (!S.discard) return;
  el.appendChild(makeCardNode(S.discard, false));
}

function makeCardNode(card, playable){
  const wrap = document.createElement("div");
  wrap.className = "guno-card";
  wrap.dataset.line = card.line;

  const corner = document.createElement("div");
  corner.className = "corner";
  corner.textContent = String(card.n);

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = window.GUNO.isJapanese ? card.ja : card.en;

  wrap.appendChild(corner);
  wrap.appendChild(name);

  if (playable) wrap.classList.add("playable");
  return wrap;
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
      if (!ok) node.style.filter = "grayscale(100%) brightness(.55)";
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
    if (h) h.textContent = `[${lc}]`; // ←長い路線名でズレる問題を根絶
    if (!g) continue;

    g.innerHTML = "";
    for (let n = 1; n <= 10; n++){
      const slot = document.createElement("div");
      slot.className = "slot";
      const placed = S.slots[lc][n];
      if (placed){
        slot.appendChild(makeCardNode(placed, false));
      }else{
        slot.innerHTML = `<div style="font-size:16px;">${n}</div>
          <div style="font-size:10px; opacity:.9;">★${window.GUNO.isJapanese ? line.stations[n-1].ja : line.stations[n-1].en}</div>`;
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