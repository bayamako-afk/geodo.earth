// js/guno_v5.js
// GUNO v5 core+ui glue (UI style: v4.05)
// - exposes global functions used by inline onclick in index.html
// - uses STATIONS_DB from stationDB.js

(() => {
  "use strict";

  // ===== State =====
  const t = (ja, en) => (state.isJapanese ? ja : en);

  const state = {
    isJapanese: true,
    autoPlay: false,
    deck: [],
    discardPile: [],
    players: [],
    mapState: {},          // key: "LC-order" -> owner idx | -1 | undefined
    lastHits: {},          // LC -> idx (first completion)
    teidenPlayed: {},      // LC -> boolean
    turnIndex: 0,
    direction: 1,
    gameOver: false,
    isWaitingHuman: false,
    turnCount: 0,
    consecutivePasses: 0,
    autoTimer: null,

    // map
    map: null,
    geoJsonLayers: {},
    stationNodes: {},      // name -> { marker, latlng, lines:[{lc,order,stData}] }
  };

  // ===== DOM helpers =====
  const $ = (id) => document.getElementById(id);

  function log(html) {
    const el = $("log");
    if (!el) return;
    el.innerHTML += `<div>${html}</div>`;
    el.scrollTop = el.scrollHeight;
  }

  function setHint(msg) {
    const el = $("hint-area");
    if (el) el.textContent = msg;
  }

  // ===== Sound =====
  let seUnlocked = false;
  function playSE(id, vol = 1.0) {
    const a = $(id);
    if (!a) return;
    const b = a.cloneNode(true);
    b.volume = vol;
    b.play().catch(() => {});
  }
  function unlockSE() {
    if (seUnlocked) return;
    seUnlocked = true;
    ["sePlay", "seDraw", "seBlackout", "seGuno"].forEach((id) => {
      const a = $(id);
      if (!a) return;
      a.volume = 0;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = 1;
        })
        .catch(() => {});
    });
  }
  document.addEventListener("pointerdown", unlockSE, { once: true });

  // ===== Map =====
  function safeInvalidateMap() {
    if (!state.map) return;
    setTimeout(() => state.map.invalidateSize(true), 100);
  }

  function initMapComponent() {
    if (!window.L) return;

    if (state.map) state.map.remove();
    state.stationNodes = {};
    state.geoJsonLayers = {};

    state.map = L.map("map", { gestureHandling: true }).setView([35.680, 139.740], 12);

    const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png").addTo(state.map);
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");

    L.control.layers({ "🌑 ダーク": dark, "🛰️ 航空写真": sat }).addTo(state.map);

    state.map.createPane("stationsPane").style.zIndex = 600;
    state.map.on("zoomend", renderAll);

    initLayers();
  }

  function initLayers() {
    ["JY", "M", "G", "T"].forEach((lc) => {
      const slug = window.LINE_SLUG[lc];
      const line = window.lineInfo(lc);
      if (!slug || !line) return;

      fetch(`./geojson/lines/${slug}.geojson`)
        .then((r) => r.json())
        .then((data) => {
          state.geoJsonLayers[lc] = L.geoJSON(data, {
            style: { color: line.color, weight: 4, opacity: 0.4 },
          }).addTo(state.map);
          updateMapVisuals();
        })
        .catch(() => {});

      fetch(`./geojson/stations/${slug}_stations.geojson`)
        .then((r) => r.json())
        .then((data) => {
          L.geoJSON(data, {
            pointToLayer: (f, latlng) => {
              const normName = window.normStar(f.properties?.name || "");
              const st = window.STATIONS_DB.find(
                (s) => s.lc === lc && window.normStar(s.st_ja) === normName
              );
              if (!st) return L.circleMarker(latlng, { radius: 0, opacity: 0 });

              if (!state.stationNodes[normName]) {
                const m = L.marker(latlng, { pane: "stationsPane" }).addTo(state.map);
                state.stationNodes[normName] = { marker: m, latlng, lines: [] };
                bindStationLabel(m, st);
              }

              state.stationNodes[normName].lines.push({ lc: st.lc, order: st.order, stData: st });
              return L.circleMarker(latlng, { radius: 0, opacity: 0 });
            },
          }).addTo(state.map);

          updateStationNodeIcons();
        })
        .catch(() => {});
    });
  }

  function bindStationLabel(marker, st) {
    const stName = state.isJapanese ? st.st_ja : st.st_en;
    const label = stName.startsWith("★")
      ? `<span style="color:gold; font-size:14px;">★</span>${stName.substring(1)}`
      : stName;

    marker.bindTooltip(label, {
      permanent: true,
      direction: "top",
      className: "station-label",
      offset: [0, -10],
    });
  }

  function updateStationNodeIcons() {
    if (!state.map) return;
    const z = state.map.getZoom();
    const rad = z < 12 ? 2 : z < 14 ? 4 : 6;

    Object.entries(state.stationNodes).forEach(([name, node]) => {
      const owners = [];
      node.lines.forEach(({ lc, order }) => {
        const owner = state.mapState[`${lc}-${order}`];
        if (owner !== undefined && owner !== -1) owners.push(owner);
      });

      const uniq = [...new Set(owners)];

      if (uniq.length === 0) {
        const col = window.lineInfo(node.lines[0].lc)?.color || "#fff";
        node.marker.setIcon(
          L.divIcon({
            className: "empty-icon",
            html: `<div style="width:${rad * 2}px; height:${rad * 2}px; background:#fff; border:2px solid ${col}; border-radius:50%;"></div>`,
            iconSize: [rad * 2, rad * 2],
            iconAnchor: [rad, rad],
          })
        );
      } else if (uniq.length === 1) {
        const p = state.players[uniq[0]];
        node.marker.setIcon(
          L.divIcon({
            className: "kamon-icon",
            html: `<div style="background:${p.color}; border:2px solid #fff; width:${rad * 4}px; height:${rad * 4}px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:${rad * 2}px; color:white;">${p.icon}</div>`,
            iconSize: [rad * 4, rad * 4],
            iconAnchor: [rad * 2, rad * 2],
          })
        );
      } else {
        const shown = uniq.slice(0, 3).map((i) => state.players[i]);
        const html =
          `<div style="display:flex; gap:2px; background:rgba(0,0,0,.35); padding:2px; border-radius:12px; border:1px solid rgba(255,255,255,.4);">` +
          shown
            .map(
              (p) =>
                `<div style="background:${p.color}; width:${rad * 3}px; height:${rad * 3}px; border-radius:50%; border:1px solid #fff; display:flex; align-items:center; justify-content:center; font-size:${rad * 1.6}px; color:white;">${p.icon}</div>`
            )
            .join("") +
          `</div>`;

        node.marker.setIcon(
          L.divIcon({
            className: "multi-icon",
            html,
            iconSize: [rad * 10, rad * 4],
            iconAnchor: [rad * 5, rad * 2],
          })
        );
      }
    });
  }

  function updateMapVisuals() {
    if (!state.map) return;

    const top = state.discardPile[state.discardPile.length - 1];
    $("map-container")?.classList.toggle("teiden-mode", !!(top && top.type === "teiden"));

    ["JY", "M", "G", "T"].forEach((lc) => {
      const layer = state.geoJsonLayers[lc];
      if (!layer) return;

      const hasOwner = Object.keys(state.mapState).some(
        (k) => k.startsWith(lc + "-") && state.mapState[k] !== -1
      );
      const isGuno = state.lastHits[lc] !== undefined;

      const baseColor = window.lineInfo(lc)?.color || "#999";
      layer.setStyle({
        weight: isGuno ? 8 : hasOwner ? 6 : 4,
        opacity: isGuno ? 1.0 : hasOwner ? 0.8 : 0.2,
        color: isGuno ? "gold" : baseColor,
      });
    });
  }

  // ===== Game logic =====
  function calculateScore(pIdx) {
    const p = state.players[pIdx];
    let stCount = 0;
    Object.values(state.mapState).forEach((owner) => {
      if (owner === pIdx) stCount++;
    });
    return p.guno * window.GUNO_POINT + stCount;
  }

  function advanceTurn() {
    state.turnCount++;
    const n = state.players.length;
    state.turnIndex = (state.turnIndex + state.direction + n) % n;
  }

  function makeDeck() {
    const deck = [];
    window.STATIONS_DB.forEach((s) => {
      for (let i = 0; i < 2; i++) deck.push({ ...s, type: "station", id: `s-${s.lc}-${s.order}-${i}` });
    });
    ["JY", "M", "G", "T"].forEach((lc) => deck.push({ lc, type: "teiden", file: window.TEIDEN_FILES[lc], id: `t-${lc}`, color: "#000" }));
    deck.sort(() => Math.random() - 0.5);
    return deck;
  }

  function getPlayableIndices(p) {
    if (!state.discardPile.length) return [];
    const top = state.discardPile[state.discardPile.length - 1];

    return p.hand
      .map((c, i) => {
        if (c.type === "teiden") {
          return (p.hand.length > 1 && (top.type === "teiden" || c.lc === top.lc)) ? i : -1;
        }
        const norm = (s) => window.normStar(s);
        if (c.lc === top.lc || norm(c.st_ja) === norm(top.st_ja) || (top.type === "station" && c.order === top.order)) return i;
        return -1;
      })
      .filter((i) => i !== -1);
  }

  function checkGuno(lc, pIdx) {
    let filled = 0;
    for (let i = 1; i <= 10; i++) {
      const owner = state.mapState[`${lc}-${i}`];
      if (owner !== undefined && owner !== -1) filled++;
    }

    if (filled === 10 && state.lastHits[lc] === undefined) {
      state.lastHits[lc] = pIdx;
      state.players[pIdx].guno++;

      log(t(`🎆 <b>${state.players[pIdx].name}</b> が ${lc} を完成！(GUNO達成)`,
            `🎆 <b>${state.players[pIdx].name}</b> completed ${lc}! (GUNO)`));
      playSE("seGuno", 1.0);
      if (window.confetti) window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

      const totalGuno = state.players.reduce((sum, p) => sum + p.guno, 0);
      if (totalGuno >= 4) endGame();
    }
  }

  function executePlay(pIdx, cardIdx) {
    const p = state.players[pIdx];
    const card = p.hand.splice(cardIdx, 1)[0];
    const top = state.discardPile[state.discardPile.length - 1];

    state.discardPile.push(card);
    state.consecutivePasses = 0;

    if (card.type === "teiden") playSE("seBlackout", 1.0);
    else playSE("sePlay", 0.8);

    if (card.type === "station") {
      const key = `${card.lc}-${card.order}`;
      const prev = state.mapState[key];

      if (prev !== undefined && prev !== -1 && prev !== pIdx) {
        log(t(`⚔️ <b>${state.players[prev].name}</b>から奪取！`, `⚔️ Captured from <b>${state.players[prev].name}</b>!`));
      }

      state.mapState[key] = pIdx;

      // reverse if station name matches last
      if (top?.type === "station" && window.normStar(card.st_ja) === window.normStar(top.st_ja)) {
        state.direction *= -1;
        log("🔄 REVERSE!");
      }

      checkGuno(card.lc, pIdx);
    } else {
      state.teidenPlayed[card.lc] = true;
      state.direction *= -1;
      log(t("⚡ 停電！逆転！", "⚡ Blackout! Reverse!"));

      state.players.forEach((o, i) => {
        if (i !== pIdx && o.status === "active" && state.deck.length) {
          o.hand.push(state.deck.pop());
          playSE("seDraw", 0.6);
          log(t(`🎴 <b>${o.name}</b> がカードを引きました`, `🎴 <b>${o.name}</b> drew a card`));
        }
      });

      checkGuno(card.lc, pIdx);
    }

    log(`[${p.icon}${p.name}] ${card.lc} ${(state.isJapanese ? (card.st_ja || "⚡") : (card.st_en || "⚡"))}`);

    if (p.hand.length === 0) {
      p.status = "eliminated";
      log(t(`❌ <b>${p.name}</b> が脱落しました（手札0）`, `❌ <b>${p.name}</b> eliminated (0 cards)`));
    }

    const activeCount = state.players.filter((x) => x.status === "active").length;
    if (activeCount <= 1) {
      log(t(`🏁 ゲーム終了！ 残りプレーヤー: ${activeCount}人`, `🏁 Game Over! Remaining players: ${activeCount}`));
      endGame();
    }
  }

  function nextTurn() {
    if (state.gameOver) return;

    const activePlayers = state.players.filter((p) => p.status === "active");
    if (activePlayers.length <= 1) {
      endGame();
      return;
    }

    if (state.consecutivePasses >= activePlayers.length * 2) {
      log(t("🏁 ゲーム終了！ 誰もプレイできるカードがありません", "🏁 Game Over! No playable cards"));
      endGame();
      return;
    }

    renderAll();

    const p = state.players[state.turnIndex];
    if (p.status !== "active") {
      advanceTurn();
      nextTurn();
      return;
    }

    const pi = getPlayableIndices(p);
    if (pi.length === 0 && state.deck.length === 0) {
      state.consecutivePasses++;
      advanceTurn();
      setTimeout(nextTurn, 350);
      return;
    }

    if (p.isHuman && !state.autoPlay) {
      state.isWaitingHuman = true;
      renderAll();
    } else {
      state.isWaitingHuman = false;
      state.autoTimer = setTimeout(playCPUTurn, 450);
    }
  }

  function playCPUTurn() {
    const p = state.players[state.turnIndex];
    let pi = getPlayableIndices(p);

    if (pi.length) {
      executePlay(state.turnIndex, pi[0]);
    } else if (state.deck.length) {
      p.hand.push(state.deck.pop());
      playSE("seDraw", 0.6);
      log(t(`🎴 <b>${p.name}</b> がカードを引きました`, `🎴 <b>${p.name}</b> drew a card`));

      pi = getPlayableIndices(p);
      if (pi.length) executePlay(state.turnIndex, pi[0]);
      else {
        // pass after draw
        state.consecutivePasses++;
      }
    } else {
      state.consecutivePasses++;
    }

    advanceTurn();
    nextTurn();
  }

  // ===== UI render =====
  function createHandCardHTML(card, className, onclickAttr) {
    // TEIDEN
    if (card.type === "teiden") {
      return `
        <div class="card guno-card guno-card--teiden ${className}" data-line="${card.lc}" style="--w:var(--card-w); margin:0;" ${onclickAttr}>
          <div class="teiden-icon" aria-label="停電">⚡</div>
          <div class="teiden-sub">停電</div>
          <div class="teiden-en">Blackout</div>
        </div>
      `;
    }

    const st = window.STATIONS_DB.find((s) => s.lc === card.lc && s.order === card.order);
    if (!st) {
      // fallback (rare)
      return `<div class="card ${className}" style="background-image:url(${window.CARD_ASSET_BASE}${card.file}.png)" ${onclickAttr}></div>`;
    }

    const shortNameClass = window.normStar(st.st_ja).length === 2 ? "short-name" : "";
    return `
      <div class="card guno-card ${className}" data-line="${card.lc}" style="--w:var(--card-w); margin:0;" ${onclickAttr}>
        <div class="corner corner--tl">
          <div class="corner-bg"></div>
          <div class="corner-num">${card.order}</div>
        </div>
        <div class="corner corner--br">
          <div class="corner-bg"></div>
          <div class="corner-num corner-num--rot">${card.order}</div>
        </div>
        <div class="center">
          <div class="station-jp ${shortNameClass}">${st.st_ja}</div>
          <div class="station-en">${st.st_en}</div>
        </div>
        <div class="route-code">${card.lc}</div>
      </div>
    `;
  }

  function createStationCardHTML(line, num, jp, en, borderColor, playerIcon) {
    const shortNameClass = window.normStar(jp).length === 2 ? "short-name" : "";
    return `
      <div class="slot active guno-card" data-line="${line}" style="border:2px solid ${borderColor}; --w:var(--card-w); margin:0;">
        <div class="corner corner--tl">
          <div class="corner-bg"></div>
          <div class="corner-num">${num}</div>
        </div>
        <div class="corner corner--br">
          <div class="corner-bg"></div>
          <div class="corner-num corner-num--rot">${num}</div>
        </div>
        <div class="center">
          <div class="station-jp ${shortNameClass}">${jp}</div>
          <div class="station-en">${en}</div>
        </div>
        <div class="route-code">${line}</div>
        <div style="position:absolute; bottom:2px; left:50%; transform:translateX(-50%); background:${borderColor}; width:20px; height:20px; border-radius:50%; border:1px solid #fff; display:flex; align-items:center; justify-content:center; font-size:10px; color:white; z-index:10;">${playerIcon}</div>
      </div>
    `;
  }

  function renderSlots() {
    ["JY", "M", "G", "T"].forEach((lc) => {
      const grid = $(`map-${lc.toLowerCase()}`);
      const header = $(`header-${lc.toLowerCase()}`);
      const line = window.lineInfo(lc);
      if (!grid || !header || !line) return;

      // NOTE: You said M line header too long sometimes → keep "[LC]" only in world later
      header.textContent = `[${lc}] ${state.isJapanese ? line.name_ja : line.name_en}`;
      header.style.backgroundColor = line.color;

      let html = "";
      for (let i = 1; i <= 10; i++) {
        const owner = state.mapState[`${lc}-${i}`];
        const s = window.STATIONS_DB.find((x) => x.lc === lc && x.order === i);
        if (!s) continue;

        if (owner !== undefined && owner !== -1) {
          html += createStationCardHTML(lc, i, s.st_ja, s.st_en, state.players[owner].color, state.players[owner].icon);
        } else {
          const name = state.isJapanese ? s.st_ja : s.st_en;
          html += `<div class="slot"><div>${i}</div><div style="font-size:8px;">${name.replace("★", '<span style="color:gold;">★</span>')}</div></div>`;
        }
      }
      grid.innerHTML = html;
    });

    // blackout area (4 cards vertical)
    const blackoutGrid = $("map-blackout");
    if (blackoutGrid) {
      let bh = "";
      ["JY", "M", "G", "T"].forEach((lc) => {
        if (state.teidenPlayed[lc]) {
          bh += `
            <div class="slot active guno-card guno-card--teiden" data-line="${lc}" style="border:2px solid #fff; --w:var(--card-w); margin:0;">
              <div class="teiden-icon" aria-label="停電">⚡</div>
              <div class="teiden-sub">停電</div>
              <div class="teiden-en">Blackout</div>
            </div>
          `;
        } else {
          bh += `
            <div class="slot" style="background:#1a1a1a;">
              <div style="position:absolute; top:8px; left:50%; transform:translateX(-50%); font-weight:bold; font-size:14px; color:${window.lineInfo(lc)?.color || "#ff6b00"};">[${lc}]</div>
              <div style="position:absolute; bottom:8px; left:50%; transform:translateX(-50%); font-size:24px;">⚡</div>
            </div>
          `;
        }
      });
      blackoutGrid.innerHTML = bh;
    }
  }

  function renderAll() {
    const playable = state.isWaitingHuman && state.turnIndex === 0 ? getPlayableIndices(state.players[0]) : [];

    if (state.isWaitingHuman && state.turnIndex === 0) {
      if (playable.length) setHint(t("💡 出せるカードをタップ", "💡 Tap a playable card"));
      else if (state.deck.length) setHint(t("💡 DECKをタップして1枚引く", "💡 Tap DECK to draw"));
    } else {
      setHint(state.gameOver ? t("対局終了", "Game Over") : t("待ち：", "Waiting: ") + state.players[state.turnIndex].name + t("の番", "'s turn"));
    }

    // players / hands
    const area = $("players-area");
    if (area) {
      area.innerHTML = state.players
        .map((p, i) => {
          const isTurn = i === state.turnIndex && !state.gameOver && p.status === "active";

          // station count
          let stCount = 0;
          Object.values(state.mapState).forEach((owner) => { if (owner === i) stCount++; });

          const cardsHtml = p.hand
            .map((c, ci) => {
              const canPlay = p.isHuman && !state.autoPlay && state.isWaitingHuman && state.turnIndex === 0 && playable.includes(ci);

              // hide CPU hands if manual
              if (!p.isHuman && !state.autoPlay) {
                return `<div class="card" style="background-image:url(${window.BACK_URL})"></div>`;
              }

              const className = canPlay ? "playable" : (p.isHuman ? "unplayable" : "");
              const onclickAttr = canPlay ? `onclick="humanPlay(${ci})"` : "";
              return createHandCardHTML(c, className, onclickAttr);
            })
            .join("");

          return `
            <div class="player-box ${isTurn ? "active-turn" : ""} ${p.status === "eliminated" ? "eliminated" : ""}" style="border-left-color:${p.color}">
              <b>${p.icon} ${p.name}</b>
              <small>Stations:${stCount} | GUNO:${p.guno} | Score:${calculateScore(i)}</small><br>
              ${cardsHtml}
            </div>
          `;
        })
        .join("");
    }

    // discard
    const top = state.discardPile[state.discardPile.length - 1];
    const discardEl = $("discard-pile");
    if (discardEl) {
      if (!top) discardEl.innerHTML = "";
      else if (top.type === "teiden") {
        discardEl.innerHTML = `
          <div class="card card-large guno-card guno-card--teiden" data-line="${top.lc}" style="--w:72px; margin:0;">
            <div class="teiden-icon" aria-label="停電">⚡</div>
            <div class="teiden-sub">停電</div>
            <div class="teiden-en">Blackout</div>
          </div>
        `;
      } else {
        const st = window.STATIONS_DB.find((s) => s.lc === top.lc && s.order === top.order);
        if (st) {
          const shortNameClass = window.normStar(st.st_ja).length === 2 ? "short-name" : "";
          discardEl.innerHTML = `
            <div class="card card-large guno-card" data-line="${top.lc}" style="--w:72px; margin:0;">
              <div class="corner corner--tl"><div class="corner-bg"></div><div class="corner-num">${top.order}</div></div>
              <div class="corner corner--br"><div class="corner-bg"></div><div class="corner-num corner-num--rot">${top.order}</div></div>
              <div class="center">
                <div class="station-jp ${shortNameClass}">${st.st_ja}</div>
                <div class="station-en">${st.st_en}</div>
              </div>
              <div class="route-code">${top.lc}</div>
            </div>
          `;
        } else {
          discardEl.innerHTML = `<div class="card card-large" style="background-image:url(${window.CARD_ASSET_BASE}${top.file}.png)"></div>`;
        }
      }
    }

    // deck count
    const deckEl = $("draw-pile-visual");
    if (deckEl) {
      deckEl.textContent = String(state.deck.length);
      deckEl.className = (state.isWaitingHuman && playable.length === 0 && state.deck.length > 0) ? "can-draw" : "";
    }

    // direction
    const dir = $("direction-arrow");
    if (dir) dir.textContent = state.direction === 1 ? "↻" : "↺";

    updateStationNodeIcons();
    updateMapVisuals();
    renderSlots();
  }

  function showRanking() {
    const data = state.players.map((p, idx) => {
      let stCount = 0;
      Object.values(state.mapState).forEach((owner) => { if (owner === idx) stCount++; });
      const gunoPts = p.guno * window.GUNO_POINT;
      const isAlive = p.status !== "eliminated";
      return { p, stCount, gunoPts, total: gunoPts + stCount, isAlive };
    });

    const ranking = data.sort((a, b) => {
      if (a.isAlive !== b.isAlive) return (b.isAlive ? 1 : 0) - (a.isAlive ? 1 : 0);
      return b.total - a.total;
    });

    let rows = "";
    ranking.forEach((r, i) => {
      const style = i === 0 ? 'style="color:gold; font-weight:bold;"' : "";
      rows += `<tr ${style}><td>${i + 1}</td><td>${r.p.icon} ${r.p.name}</td><td>${r.total}</td><td>${r.stCount}</td><td>${r.p.guno}</td><td>${r.gunoPts}</td></tr>`;
    });

    $("result-table").innerHTML =
      `<thead><tr><th>${t("順位", "Rank")}</th><th>Player</th><th>Total</th><th>Stations</th><th>GUNO</th><th>GUNO pts</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function endGame() {
    state.gameOver = true;
    if (state.autoTimer) clearTimeout(state.autoTimer);
    renderAll();

    const overlay = $("result-overlay");
    if (overlay) overlay.style.display = "flex";
    showRanking();

    if (window.confetti) window.confetti({ particleCount: 200, spread: 100 });
  }

  // ===== Public controls (called from HTML onclick) =====
  window.startGame = function startGame() {
    if (state.autoTimer) clearTimeout(state.autoTimer);

    state.gameOver = false;
    state.turnCount = 0;
    state.turnIndex = 0;
    state.direction = 1;
    state.isWaitingHuman = false;
    state.mapState = {};
    state.lastHits = {};
    state.consecutivePasses = 0;
    state.teidenPlayed = { JY: false, M: false, G: false, T: false };

    state.deck = makeDeck();

    state.players = [
      { name: "P1", isHuman: !state.autoPlay, hand: [], color: "#174a7c", icon: "🌊", status: "active", guno: 0 },
      { name: "P2", isHuman: false,           hand: [], color: "#b52942", icon: "🌸", status: "active", guno: 0 },
      { name: "P3", isHuman: false,           hand: [], color: "#e6b422", icon: "🌙", status: "active", guno: 0 },
      { name: "P4", isHuman: false,           hand: [], color: "#745399", icon: "🏯", status: "active", guno: 0 },
    ];

    state.players.forEach((p) => { for (let i = 0; i < 7; i++) p.hand.push(state.deck.pop()); });

    // init discard with first station card
    state.discardPile = [];
    while (state.deck.length) {
      const c = state.deck.pop();
      state.discardPile.push(c);
      if (c.type === "station") {
        state.mapState[`${c.lc}-${c.order}`] = -1;
        break;
      }
    }

    $("log").innerHTML = "";
    const overlay = $("result-overlay");
    if (overlay) overlay.style.display = "none";

    window.updateModeButton?.();
    nextTurn();
  };

  window.humanDraw = function humanDraw() {
    if (!state.isWaitingHuman) return;
    if (state.turnIndex !== 0) return;

    const p = state.players[0];
    if (getPlayableIndices(p).length > 0) return;
    if (!state.deck.length) return;

    p.hand.push(state.deck.pop());
    playSE("seDraw", 0.6);
    log(t(`🎴 <b>${p.name}</b> がカードを引きました`, `🎴 <b>${p.name}</b> drew a card`));

    renderAll();

    // if still no playable -> end turn
    if (getPlayableIndices(p).length === 0) {
      state.isWaitingHuman = false;
      state.consecutivePasses++;
      advanceTurn();
      nextTurn();
    }
  };

  window.humanPlay = function humanPlay(idx) {
    if (!state.isWaitingHuman) return;
    if (state.turnIndex !== 0) return;

    const p = state.players[0];
    const playable = getPlayableIndices(p);
    if (!playable.includes(idx)) return;

    state.isWaitingHuman = false;
    executePlay(0, idx);
    advanceTurn();
    nextTurn();
  };

  window.toggleAuto = function toggleAuto() {
    state.autoPlay = !state.autoPlay;
    state.players[0].isHuman = !state.autoPlay;

    updateModeButton();

    if (state.autoTimer) clearTimeout(state.autoTimer);
    if (!state.gameOver) {
      state.isWaitingHuman = state.turnIndex === 0 && !state.autoPlay;
      renderAll();
      if (state.autoPlay) nextTurn();
    }
  };

  function updateModeButton() {
    const btn = $("btn-mode");
    if (!btn) return;
    btn.textContent = state.autoPlay ? "⏸️ AUTO: ON" : "▶️ AUTO: OFF";
    btn.className = state.autoPlay ? "btn-auto-active" : "btn-manual";
  }
  window.updateModeButton = updateModeButton;

  window.toggleLog = function toggleLog() {
    document.body.classList.toggle("show-log");
    safeInvalidateMap();
  };

  window.toggleLanguage = function toggleLanguage() {
    state.isJapanese = !state.isJapanese;

    // update tooltips
    Object.values(state.stationNodes).forEach((node) => {
      const st = node.lines[0]?.stData;
      if (!st) return;
      node.marker.unbindTooltip();
      bindStationLabel(node.marker, st);
    });

    $("btn-log-text").textContent = t("ログ", "Log");
    $("btn-new-text").textContent = t("新規", "New");
    $("log-title").textContent = t("📜 ログ履歴", "📜 Log History");
    $("btn-close-log").textContent = t("閉じる", "Close");

    renderSlots();
    renderAll();
  };

  // ===== Boot =====
  function wireButtonsIfNoOnclick() {
    // In case some buttons lose onclick in future edits
    $("btn-log")?.addEventListener("click", () => window.toggleLog());
    $("btn-lang")?.addEventListener("click", () => window.toggleLanguage());
    $("btn-new")?.addEventListener("click", () => window.startGame());
    $("btn-mode")?.addEventListener("click", () => window.toggleAuto());
    $("btn-close-log")?.addEventListener("click", () => window.toggleLog());

    // result overlay buttons exist only if your HTML has them; safe check
    document.querySelector("#result-overlay button[onclick*='startGame']")?.addEventListener("click", () => window.startGame());
  }

  window.addEventListener("load", () => {
    // Map init first (so invalidateSize works after layout)
    initMapComponent();
    wireButtonsIfNoOnclick();
    updateModeButton();
    window.startGame();
  });

  window.addEventListener("resize", () => {
    safeInvalidateMap();
  });

})();