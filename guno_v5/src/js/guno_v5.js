/* =========================
   GUNO v5 - guno_v5.js
   - v4.05のゲームロジックを外出し
   - stationDB.js (window.GUNO) を参照
   - index.htmlのonclick（startGame等）をグローバルに公開
   ========================= */

(function () {
  "use strict";

  if (!window.GUNO) {
    console.error("[GUNO] stationDB.js が先に読み込まれていません");
    return;
  }

  // ====== Config ======
  const GUNO_POINT = 10;

  // ====== State ======
  let isJapanese = true;
  let autoPlay = false;

  let deck = [];
  let discardPile = [];
  let players = [];
  let mapState = {};

  let turnIndex = 0;
  let direction = 1;
  let gameOver = false;
  let isWaitingHuman = false;
  let turnCount = 0;

  let map = null;
  let geoJsonLayers = {};
  let stationNodes = {};
  let lastHits = {};
  let teidenPlayed = {};
  let autoTimer = null;
  let consecutivePasses = 0;

  // ====== Shortcuts ======
  const $ = (id) => document.getElementById(id);
  const t = (ja, en) => (isJapanese ? ja : en);
  const norm = (s) => (s || "").replaceAll("★", "");

  // ====== Sound ======
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

  // ====== Log ======
  function log(m) {
    const l = $("log");
    if (!l) return;
    l.innerHTML += "<div>" + m + "</div>";
    l.scrollTop = l.scrollHeight;
  }

  // ====== Map ======
  function safeInvalidateMap() {
    if (!map) return;
    setTimeout(() => map.invalidateSize(true), 100);
  }

  function initMapComponent() {
    if (!window.L) {
      console.error("[GUNO] Leafletが読み込まれていません");
      return;
    }
    if (map) map.remove();

    stationNodes = {};
    geoJsonLayers = {};

    map = L.map("map", { gestureHandling: true }).setView([35.68, 139.74], 12);

    const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png").addTo(map);
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");

    L.control.layers({ "🌑 ダーク": dark, "🛰️ 航空写真": sat }).addTo(map);

    map.createPane("stationsPane").style.zIndex = 600;
    map.on("zoomend", renderAll);

    initLayers();
  }

  function initLayers() {
    const slugMap = {
      JY: "jr-east-yamanote",
      M: "tokyo-metro-marunouchi",
      G: "tokyo-metro-ginza",
      T: "tokyo-metro-tozai",
    };

    ["JY", "M", "G", "T"].forEach((lc) => {
      const slug = slugMap[lc];
      const lineMeta = GUNO.getLineMeta(lc);
      if (!slug || !lineMeta) return;

      fetch(`./geojson/lines/${slug}.geojson`)
        .then((r) => r.json())
        .then((data) => {
          geoJsonLayers[lc] = L.geoJSON(data, {
            style: { color: lineMeta.color, weight: 4, opacity: 0.4 },
          }).addTo(map);
        })
        .catch((e) => console.warn("[GUNO] line geojson load failed:", lc, e));

      fetch(`./geojson/stations/${slug}_stations.geojson`)
        .then((r) => r.json())
        .then((data) => {
          L.geoJSON(data, {
            pointToLayer: (f, latlng) => {
              const normName = norm(f?.properties?.name || "");
              const st = GUNO.STATIONS_DB.find((s) => s.lc === lc && norm(s.st_ja) === normName);
              if (!st) return L.circleMarker(latlng, { radius: 0, opacity: 0 });

              if (!stationNodes[normName]) {
                const m = L.marker(latlng, { pane: "stationsPane" }).addTo(map);
                stationNodes[normName] = { marker: m, latlng, lines: [] };

                const stName = isJapanese ? st.st_ja : st.st_en;
                const label = stName.startsWith("★")
                  ? '<span style="color:gold; font-size:14px;">★</span>' + stName.substring(1)
                  : stName;

                m.bindTooltip(label, {
                  permanent: true,
                  direction: "top",
                  className: "station-label",
                  offset: [0, -10],
                });
              }

              stationNodes[normName].lines.push({ lc: st.lc, order: st.order, stData: st });
              return L.circleMarker(latlng, { radius: 0, opacity: 0 });
            },
          }).addTo(map);
        })
        .catch((e) => console.warn("[GUNO] stations geojson load failed:", lc, e));
    });
  }

  function updateStationNodeIcons() {
    const rad = map && map.getZoom ? (map.getZoom() < 12 ? 2 : map.getZoom() < 14 ? 4 : 6) : 4;

    Object.entries(stationNodes).forEach(([name, node]) => {
      const owners = [];
      node.lines.forEach(({ lc, order }) => {
        const owner = mapState[lc + "-" + order];
        if (owner !== undefined && owner !== -1) owners.push(owner);
      });

      const uniq = [...new Set(owners)];

      if (uniq.length === 0) {
        const lineCol = GUNO.getLineMeta(node.lines[0].lc)?.color || "#fff";
        node.marker.setIcon(
          L.divIcon({
            className: "empty-icon",
            html: `<div style="width:${rad * 2}px; height:${rad * 2}px; background:#fff; border:2px solid ${lineCol}; border-radius:50%;"></div>`,
            iconSize: [rad * 2, rad * 2],
            iconAnchor: [rad, rad],
          })
        );
      } else if (uniq.length === 1) {
        const p = players[uniq[0]];
        node.marker.setIcon(
          L.divIcon({
            className: "kamon-icon",
            html: `<div style="background:${p.color}; border:2px solid #fff; width:${rad * 4}px; height:${rad * 4}px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:${rad * 2}px; color:white;">${p.icon}</div>`,
            iconSize: [rad * 4, rad * 4],
            iconAnchor: [rad * 2, rad * 2],
          })
        );
      } else {
        const shown = uniq.slice(0, 3).map((i) => players[i]);
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
    if (!map) return;
    const top = discardPile[discardPile.length - 1];

    const mc = $("map-container");
    if (mc) mc.classList.toggle("teiden-mode", !!(top && top.type === "teiden"));

    ["JY", "M", "G", "T"].forEach((lc) => {
      const layer = geoJsonLayers[lc];
      if (!layer) return;

      const hasOwner = Object.keys(mapState).some((k) => k.startsWith(lc) && mapState[k] !== -1);
      const isGuno = lastHits[lc] !== undefined;

      const baseCol = GUNO.getLineMeta(lc)?.color || "#fff";
      layer.setStyle({
        weight: isGuno ? 8 : hasOwner ? 6 : 4,
        opacity: isGuno ? 1.0 : hasOwner ? 0.8 : 0.2,
        color: isGuno ? "gold" : baseCol,
      });
    });
  }

  // ====== Game Logic ======
  function calculateScore(pIdx) {
    const p = players[pIdx];
    let stCount = 0;
    Object.values(mapState).forEach((owner) => {
      if (owner === pIdx) stCount++;
    });
    return p.guno * GUNO_POINT + stCount;
  }

  function advanceTurn() {
    turnCount++;
    const n = players.length;
    turnIndex = (turnIndex + direction + n) % n;
  }

  function getPlayableIndices(p) {
    if (!discardPile.length) return [];
    const top = discardPile[discardPile.length - 1];

    return p.hand
      .map((c, i) => {
        if (c.type === "teiden") return p.hand.length > 1 && (top.type === "teiden" || c.lc === top.lc) ? i : -1;
        if (c.lc === top.lc) return i;
        if (norm(c.st_ja) === norm(top.st_ja)) return i;
        if (top.type === "station" && c.order === top.order) return i;
        return -1;
      })
      .filter((i) => i !== -1);
  }

  function checkGuno(lc, pIdx) {
    let filledCount = 0;
    for (let i = 1; i <= 10; i++) {
      const owner = mapState[lc + "-" + i];
      if (owner !== undefined && owner !== -1) filledCount++;
    }

    // 10駅埋まった瞬間 1回だけ
    if (filledCount === 10 && lastHits[lc] === undefined) {
      lastHits[lc] = pIdx;
      players[pIdx].guno++;
      log(t(`🎆 <b>${players[pIdx].name}</b> が ${lc} を完成！(GUNO達成)`, `🎆 <b>${players[pIdx].name}</b> completed ${lc}! (GUNO)`));
      playSE("seGuno", 1.0);
      if (window.confetti) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

      const totalGuno = players.reduce((sum, p) => sum + p.guno, 0);
      if (totalGuno >= 4) endGame();
    }
  }

  function executePlay(pIdx, cardIdx) {
    const p = players[pIdx];
    const card = p.hand.splice(cardIdx, 1)[0];
    const top = discardPile[discardPile.length - 1];
    discardPile.push(card);
    consecutivePasses = 0;

    if (card.type === "teiden") playSE("seBlackout", 1.0);
    else playSE("sePlay", 0.8);

    if (card.type === "station") {
      const key = card.lc + "-" + card.order;
      const prev = mapState[key];

      if (prev !== undefined && prev !== -1 && prev !== pIdx) {
        log(t(`⚔️ <b>${players[prev].name}</b>から奪取！`, `⚔️ Captured from <b>${players[prev].name}</b>!`));
      }

      mapState[key] = pIdx;

      if (top.type === "station" && norm(card.st_ja) === norm(top.st_ja)) {
        direction *= -1;
        log("🔄 REVERSE!");
      }

      checkGuno(card.lc, pIdx);
    } else {
      teidenPlayed[card.lc] = true;
      direction *= -1;
      log(t("⚡ 停電！逆転！", "⚡ Blackout! Reverse!"));

      players.forEach((o, i) => {
        if (i !== pIdx && o.status === "active" && deck.length) {
          o.hand.push(deck.pop());
          playSE("seDraw", 0.6);
          log(t(`🎴 <b>${o.name}</b> がカードを引きました`, `🎴 <b>${o.name}</b> drew a card`));
        }
      });

      checkGuno(card.lc, pIdx);
    }

    log(`[${p.icon}${p.name}] ${card.lc} ${isJapanese ? (card.st_ja || "⚡") : (card.st_en || "⚡")}`);

    if (p.hand.length === 0) {
      p.status = "eliminated";
      log(t(`❌ <b>${p.name}</b> が脱落しました（手札0）`, `❌ <b>${p.name}</b> eliminated (0 cards)`));
    }

    const activeCount = players.filter((x) => x.status === "active").length;
    if (activeCount <= 1) {
      log(t("🏁 ゲーム終了！ 残りプレーヤー: ", "🏁 Game Over! Remaining players: ") + activeCount + t("人", ""));
      endGame();
    }
  }

  function playCPUTurn() {
    const p = players[turnIndex];
    let pi = getPlayableIndices(p);

    if (pi.length) {
      executePlay(turnIndex, pi[0]);
    } else if (deck.length) {
      p.hand.push(deck.pop());
      playSE("seDraw", 0.6);
      log(t(`🎴 <b>${p.name}</b> がカードを引きました`, `🎴 <b>${p.name}</b> drew a card`));

      pi = getPlayableIndices(p);
      if (pi.length) executePlay(turnIndex, pi[0]);
    } else {
      advanceTurn();
      nextTurn();
      return;
    }

    advanceTurn();
    nextTurn();
  }

  function nextTurn() {
    if (gameOver) return;

    const activePlayers = players.filter((p) => p.status === "active");
    if (activePlayers.length <= 1) {
      log(t("🏁 ゲーム終了！ 残りプレーヤー: ", "🏁 Game Over! Remaining players: ") + activePlayers.length + t("人", ""));
      endGame();
      return;
    }

    if (consecutivePasses >= activePlayers.length * 2) {
      log(t("🏁 ゲーム終了！ 誰もプレイできるカードがありません", "🏁 Game Over! No playable cards"));
      endGame();
      return;
    }

    renderAll();

    const p = players[turnIndex];
    if (p.status !== "active") {
      advanceTurn();
      nextTurn();
      return;
    }

    const pi = getPlayableIndices(p);
    if (pi.length === 0 && deck.length === 0) {
      consecutivePasses++;
      advanceTurn();
      setTimeout(nextTurn, 500);
      return;
    }

    if (p.isHuman && !autoPlay) {
      isWaitingHuman = true;
      renderAll();
    } else {
      isWaitingHuman = false;
      autoTimer = setTimeout(playCPUTurn, 500);
    }
  }

  function endGame() {
    gameOver = true;
    if (autoTimer) clearTimeout(autoTimer);
    renderAll();

    const overlay = $("result-overlay");
    if (overlay) overlay.style.display = "flex";
    showRanking();

    if (window.confetti) confetti({ particleCount: 200, spread: 100 });
  }

  function showRanking() {
    const data = players.map((p, idx) => {
      let stCount = 0;
      Object.values(mapState).forEach((owner) => {
        if (owner === idx) stCount++;
      });
      const gunoPts = p.guno * GUNO_POINT;
      const isAlive = p.status !== "eliminated";
      return { p, stCount, gunoPts, total: gunoPts + stCount, isAlive };
    });

    const ranking = data.sort((a, b) => {
      if (a.isAlive !== b.isAlive) return b.isAlive - a.isAlive;
      return b.total - a.total;
    });

    let rows = "";
    ranking.forEach((r, i) => {
      const style = i === 0 ? 'style="color:gold; font-weight:bold;"' : "";
      rows += `<tr ${style}><td>${i + 1}</td><td>${r.p.icon} ${r.p.name}</td><td>${r.total}</td><td>${r.stCount}</td><td>${r.p.guno}</td><td>${r.gunoPts}</td></tr>`;
    });

    const table = $("result-table");
    if (!table) return;
    table.innerHTML =
      `<thead><tr><th>${t("順位", "Rank")}</th><th>Player</th><th>Total</th><th>Stations</th><th>GUNO</th><th>GUNO pts</th></tr></thead>` +
      `<tbody>${rows}</tbody>`;
  }

  // ====== UI Rendering ======
  function setHint(text) {
    const el = $("hint-area");
    if (el) el.textContent = text;
  }

  function createHandCardHTML(card, className, onclickAttr) {
    // blackout
    if (card.type === "teiden") {
      return `
        <div class="card guno-card guno-card--teiden ${className}" data-line="${card.lc}" style="--w:var(--card-w); margin:0;" ${onclickAttr}>
          <div class="teiden-icon" aria-label="停電">⚡</div>
          <div class="teiden-sub">停電</div>
          <div class="teiden-en">Blackout</div>
        </div>
      `;
    }

    const st = GUNO.findStation(card.lc, card.order);
    if (!st) {
      return `<div class="card ${className}" style="background-image:url(${GUNO.IMAGE_BASE_URL}${card.file}.png)" ${onclickAttr}></div>`;
    }

    const shortNameClass = norm(st.st_ja).length === 2 ? "short-name" : "";

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
    const shortNameClass = norm(jp).length === 2 ? "short-name" : "";
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
      const grid = $("map-" + lc.toLowerCase());
      const header = $("header-" + lc.toLowerCase());
      const line = GUNO.getLineMeta(lc);
      if (!grid || !header || !line) return;

      header.textContent = "[" + lc + "]";
      header.style.backgroundColor = line.color;

      let h = "";
      for (let i = 1; i <= 10; i++) {
        const o = mapState[lc + "-" + i];
        const s = GUNO.findStation(lc, i);
        if (!s) continue;

        if (o !== undefined && o !== -1) {
          h += createStationCardHTML(lc, i, s.st_ja, s.st_en, players[o].color, players[o].icon);
        } else {
          h += `<div class="slot">
            <div>${i}</div>
            <div style="font-size:8px;">${(isJapanese ? s.st_ja : s.st_en).replace("★", '<span style="color:gold;">★</span>')}</div>
          </div>`;
        }
      }
      grid.innerHTML = h;
    });

    // blackout area
    const blackoutGrid = $("map-blackout");
    if (!blackoutGrid) return;

    const lineInfo = {
      JY: { color: "#00AA00", name_ja: "山手線", name_en: "Yamanote" },
      M: { color: "#F62E36", name_ja: "丸ノ内線", name_en: "Marunouchi" },
      G: { color: "#FF9500", name_ja: "銀座線", name_en: "Ginza" },
      T: { color: "#009BBF", name_ja: "東西線", name_en: "Tozai" },
    };

    let bh = "";
    ["JY", "M", "G", "T"].forEach((lc) => {
      const info = lineInfo[lc];
      const lineName = isJapanese ? info.name_ja : info.name_en;

      if (teidenPlayed[lc]) {
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
            <div style="position:absolute; top:8px; left:50%; transform:translateX(-50%); font-weight:bold; font-size:14px; color:${info.color}; text-shadow: 2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9);">[${lc}]</div>
            <div style="position:absolute; top:28px; left:50%; transform:translateX(-50%); font-size:10px; color:${info.color}; white-space:nowrap; text-shadow: 2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9);">${lineName}</div>
            <div style="position:absolute; bottom:8px; left:50%; transform:translateX(-50%); font-size:24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9);">⚡</div>
          </div>
        `;
      }
    });

    blackoutGrid.innerHTML = bh;
  }

  function renderAll() {
    const playable = isWaitingHuman && turnIndex === 0 ? getPlayableIndices(players[0]) : [];

    if (isWaitingHuman && turnIndex === 0) {
      if (playable.length) setHint(t("💡 出せるカードをタップ", "💡 Tap a playable card"));
      else if (deck.length) setHint(t("💡 DECKをタップして1枚引く", "💡 Tap DECK to draw"));
    } else {
      setHint(gameOver ? t("対局終了", "Game Over") : t("待ち：", "Waiting: ") + players[turnIndex].name + t("の番", "'s turn"));
    }

    const playersArea = $("players-area");
    if (playersArea) {
      playersArea.innerHTML = players
        .map((p, i) => {
          const isTurn = i === turnIndex && !gameOver && p.status === "active";

          let stCount = 0;
          Object.values(mapState).forEach((owner) => {
            if (owner === i) stCount++;
          });

          const cardsHtml = p.hand
            .map((c, ci) => {
              const canPlay = p.isHuman && !autoPlay && isWaitingHuman && turnIndex === 0 && playable.includes(ci);

              if (!p.isHuman && !autoPlay) {
                return `<div class="card ${canPlay ? "playable" : p.isHuman ? "unplayable" : ""}" style="background-image:url(${GUNO.BACK_URL})"></div>`;
              }

              const className = canPlay ? "playable" : p.isHuman ? "unplayable" : "";
              const onclickAttr = canPlay ? `onclick="humanPlay(${ci})"` : "";
              return createHandCardHTML(c, className, onclickAttr);
            })
            .join("");

          return `<div class="player-box ${isTurn ? "active-turn" : ""} ${p.status === "eliminated" ? "eliminated" : ""}" style="border-left-color:${p.color}">
              <b>${p.icon} ${p.name}</b>
              <small>Stations:${stCount} | GUNO:${p.guno} | Score:${calculateScore(i)}</small><br>
              ${cardsHtml}
            </div>`;
        })
        .join("");
    }

    // discard
    const top = discardPile[discardPile.length - 1];
    const discardEl = $("discard-pile");
    if (discardEl) {
      if (!top) discardEl.innerHTML = "";
      else if (top.type === "teiden") {
        discardEl.innerHTML = `
          <div class="card card-large guno-card guno-card--teiden" data-line="${top.lc}" style="--w:72px; margin:0;">
            <div class="teiden-icon" aria-label="停電">⚡</div>
            <div class="teiden-sub">停電</div>
            <div class="teiden-en">Blackout</div>
          </div>`;
      } else {
        const st = GUNO.findStation(top.lc, top.order);
        if (st) {
          const shortNameClass = norm(st.st_ja).length === 2 ? "short-name" : "";
          discardEl.innerHTML = `
            <div class="card card-large guno-card" data-line="${top.lc}" style="--w:72px; margin:0;">
              <div class="corner corner--tl"><div class="corner-bg"></div><div class="corner-num">${top.order}</div></div>
              <div class="corner corner--br"><div class="corner-bg"></div><div class="corner-num corner-num--rot">${top.order}</div></div>
              <div class="center">
                <div class="station-jp ${shortNameClass}">${st.st_ja}</div>
                <div class="station-en">${st.st_en}</div>
              </div>
              <div class="route-code">${top.lc}</div>
            </div>`;
        } else {
          discardEl.innerHTML = `<div class="card card-large" style="background-image:url(${GUNO.IMAGE_BASE_URL}${top.file}.png)"></div>`;
        }
      }
    }

    // deck display
    const deckEl = $("draw-pile-visual");
    if (deckEl) {
      deckEl.textContent = deck.length;
      deckEl.className = isWaitingHuman && playable.length === 0 && deck.length > 0 ? "can-draw" : "";
    }

    const dirEl = $("direction-arrow");
    if (dirEl) dirEl.textContent = direction === 1 ? "↻" : "↺";

    updateStationNodeIcons();
    updateMapVisuals();
    renderSlots();
  }

  // ====== Human actions ======
  function humanDraw() {
    if (!isWaitingHuman || turnIndex !== 0) return;
    if (getPlayableIndices(players[0]).length > 0) return;
    if (!deck.length) return;

    players[0].hand.push(deck.pop());
    playSE("seDraw", 0.6);
    log(t(`🎴 <b>${players[0].name}</b> がカードを引きました`, `🎴 <b>${players[0].name}</b> drew a card`));

    renderAll();

    const playable = getPlayableIndices(players[0]);
    if (playable.length > 0) return;

    isWaitingHuman = false;
    advanceTurn();
    nextTurn();
  }

  function humanPlay(idx) {
    if (!isWaitingHuman || turnIndex !== 0) return;
    if (!getPlayableIndices(players[0]).includes(idx)) return;

    isWaitingHuman = false;
    executePlay(0, idx);
    advanceTurn();
    nextTurn();
  }

  // ====== Game start ======
  function startGame() {
    if (autoTimer) clearTimeout(autoTimer);

    gameOver = false;
    turnCount = 0;
    turnIndex = 0;
    direction = 1;
    isWaitingHuman = false;

    mapState = {};
    lastHits = {};
    consecutivePasses = 0;
    teidenPlayed = { JY: false, M: false, G: false, T: false };

    deck = [];
    // stations (each x2)
    GUNO.STATIONS_DB.forEach((s) => {
      for (let i = 0; i < 2; i++) deck.push({ ...s, type: "station", id: `s-${s.lc}-${s.order}-${i}` });
    });
    // blackout (each x1)
    ["JY", "M", "G", "T"].forEach((lc) => deck.push({ lc, type: "teiden", file: GUNO.TEIDEN_FILES[lc], id: `t-${lc}`, color: "#000" }));

    deck.sort(() => Math.random() - 0.5);

    players = [
      { name: "P1", isHuman: !autoPlay, hand: [], color: "#174a7c", icon: "🌊", status: "active", guno: 0 },
      { name: "P2", isHuman: false,    hand: [], color: "#b52942", icon: "🌸", status: "active", guno: 0 },
      { name: "P3", isHuman: false,    hand: [], color: "#e6b422", icon: "🌙", status: "active", guno: 0 },
      { name: "P4", isHuman: false,    hand: [], color: "#745399", icon: "🏯", status: "active", guno: 0 },
    ];

    // deal
    players.forEach((p) => {
      for (let i = 0; i < 7; i++) p.hand.push(deck.pop());
    });

    // initial discard must be station
    discardPile = [];
    while (deck.length) {
      const c = deck.pop();
      discardPile.push(c);
      if (c.type === "station") {
        mapState[c.lc + "-" + c.order] = -1;
        break;
      }
    }

    const logEl = $("log");
    if (logEl) logEl.innerHTML = "";
    const overlay = $("result-overlay");
    if (overlay) overlay.style.display = "none";

    updateModeButton();
    nextTurn();
  }

  // ====== UI Toggles ======
  function updateModeButton() {
    const btn = $("btn-mode");
    if (!btn) return;
    btn.textContent = autoPlay ? "⏸️ AUTO: ON" : "▶️ AUTO: OFF";
    btn.className = autoPlay ? "btn-auto-active" : "btn-manual";
  }

  function toggleAuto() {
    autoPlay = !autoPlay;
    if (players[0]) players[0].isHuman = !autoPlay;
    updateModeButton();

    if (autoTimer) clearTimeout(autoTimer);

    if (!gameOver) {
      isWaitingHuman = turnIndex === 0 && !autoPlay;
      renderAll();
      if (autoPlay) nextTurn();
    }
  }

  function toggleLog() {
    document.body.classList.toggle("show-log");
    safeInvalidateMap();
  }

  function toggleLanguage() {
    isJapanese = !isJapanese;

    // update station labels
    Object.values(stationNodes).forEach((node) => {
      const st = node.lines[0].stData;
      node.marker.unbindTooltip();
      const stName = isJapanese ? st.st_ja : st.st_en;
      const label = stName.startsWith("★")
        ? '<span style="color:gold; font-size:14px;">★</span>' + stName.substring(1)
        : stName;
      node.marker.bindTooltip(label, { permanent: true, direction: "top", className: "station-label", offset: [0, -10] });
    });

    // update UI text
    const blt = $("btn-log-text");
    if (blt) blt.textContent = t("ログ", "Log");
    const bnt = $("btn-new-text");
    if (bnt) bnt.textContent = t("新規", "New");
    const lt = $("log-title");
    if (lt) lt.textContent = t("📜 ログ履歴", "📜 Log History");
    const bc = $("btn-close-log");
    if (bc) bc.textContent = t("閉じる", "Close");

    renderAll();
  }

  // ====== Public API (onclick用) ======
  window.startGame = startGame;
  window.nextTurn = nextTurn;
  window.toggleAuto = toggleAuto;
  window.toggleLog = toggleLog;
  window.toggleLanguage = toggleLanguage;
  window.humanDraw = humanDraw;
  window.humanPlay = humanPlay;

  // ====== Boot ======
  window.addEventListener("resize", safeInvalidateMap);

  window.addEventListener("load", () => {
    document.body.classList.remove("show-log");
    initMapComponent();
    startGame();
  });
})();