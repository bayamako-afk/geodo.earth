/**
 * guno_v6/src/ui/board.js
 * 盤面スロット UI コンポーネント
 *
 * 責務:
 *   - 各路線のスロット（1〜routeSize）を描画する
 *   - 停電カードエリアを描画する
 *   - 方向インジケーターを更新する
 *   - ヒントエリアを更新する
 */

import { normStar } from "../core/rules.js";

// ===== スロット HTML 生成 =====

/**
 * 所有済みスロットの HTML を生成する。
 *
 * @param {string} lc
 * @param {number} order
 * @param {object} station - { st_ja, st_en }
 * @param {Player} owner
 * @returns {string}
 */
function ownedSlotHtml(lc, order, station, owner) {
  const name = station.st_ja || "";
  const nameClean = normStar(name);
  const isHub = name.startsWith("★");
  const shortClass = nameClean.length <= 2 ? "short-name" : "";

  return `
    <div class="slot active guno-card" data-line="${lc}" style="border:2px solid ${owner.color};">
      <div class="corner corner--tl">
        <div class="corner-bg"></div>
        <div class="corner-num">${order}</div>
      </div>
      <div class="corner corner--br">
        <div class="corner-bg"></div>
        <div class="corner-num corner-num--rot">${order}</div>
      </div>
      <div class="center">
        <div class="station-jp ${shortClass}">${isHub ? '<span class="hub-star">★</span>' : ""}${nameClean}</div>
        <div class="station-en">${normStar(station.st_en || "")}</div>
      </div>
      <div class="route-code">${lc}</div>
      <div class="owner-badge" style="background:${owner.color};">${owner.icon}</div>
    </div>
  `;
}

/**
 * 空スロットの HTML を生成する。
 *
 * @param {number} order
 * @param {object} station
 * @returns {string}
 */
function emptySlotHtml(order, station) {
  const name = station.st_ja || "";
  const nameClean = normStar(name);
  const isHub = name.startsWith("★");
  return `
    <div class="slot">
      <div class="slot-order">${order}</div>
      <div class="slot-name">${isHub ? '<span class="hub-star">★</span>' : ""}${nameClean}</div>
    </div>
  `;
}

// ===== 路線スロットエリア描画 =====

/**
 * 全路線のスロットエリアを描画する。
 *
 * @param {object} params
 * @param {PackData}  params.packData
 * @param {MapState}  params.mapState
 * @param {Player[]}  params.players
 * @param {object}    params.lastHits   - { [lc]: playerIdx }
 * @param {object}    params.teidenPlayed - { [lc]: boolean }
 * @param {Card|null} params.topCard
 */
export function renderBoard({
  packData, mapState, players, lastHits, teidenPlayed, topCard,
}) {
  for (const route of packData.routes) {
    const { lc } = route;
    const gridEl = document.getElementById(`map-${lc.toLowerCase()}`);
    const headerEl = document.getElementById(`header-${lc.toLowerCase()}`);
    if (!gridEl) continue;

    if (headerEl) {
      const isGuno = lastHits[lc] !== undefined;
      headerEl.textContent = `[${lc}] ${route.name_ja}`;
      headerEl.style.backgroundColor = isGuno ? "gold" : route.color;
      headerEl.style.color = isGuno ? "#000" : "#fff";
    }

    let html = "";
    for (const slot of route.members) {
      if (!slot) continue;
      const key = `${lc}-${slot.order}`;
      const ownerIdx = mapState[key];
      if (ownerIdx !== undefined && ownerIdx !== -1 && players[ownerIdx]) {
        html += ownedSlotHtml(lc, slot.order, { st_ja: slot.name_ja, st_en: slot.name_en }, players[ownerIdx]);
      } else {
        html += emptySlotHtml(slot.order, { st_ja: slot.name_ja, st_en: slot.name_en });
      }
    }
    gridEl.innerHTML = html;
  }

  // 停電エリア
  const blackoutEl = document.getElementById("map-blackout");
  if (blackoutEl && packData.routes) {
    let bh = "";
    for (const route of packData.routes) {
      const { lc } = route;
      if (teidenPlayed[lc]) {
        bh += `
          <div class="slot active guno-card guno-card--teiden" data-line="${lc}" style="border:2px solid #fff;">
            <div class="teiden-icon">⚡</div>
            <div class="teiden-sub">停電</div>
            <div class="teiden-en">Blackout</div>
          </div>
        `;
      } else {
        bh += `
          <div class="slot" style="background:#1a1a1a;">
            <div class="slot-order" style="color:${route.color};">[${lc}]</div>
            <div style="font-size:20px; margin-top:4px;">⚡</div>
          </div>
        `;
      }
    }
    blackoutEl.innerHTML = bh;

    // 停電エリアを展開（JS描画後に max-height を解除）
    const blackoutWrapper = blackoutEl.closest(".blackout-wrapper");
    if (blackoutWrapper) blackoutWrapper.classList.add("expanded");
  }

  // 停電モード（場の最上が停電カードの場合）
  const mapContainer = document.getElementById("map-container");
  if (mapContainer) {
    mapContainer.classList.toggle("teiden-mode", !!(topCard && topCard.type === "teiden"));
  }
}

// ===== 方向インジケーター =====

/**
 * 方向インジケーターを更新する。
 *
 * @param {HTMLElement} el - #direction-arrow 要素
 * @param {1|-1} direction
 */
export function renderDirection(el, direction) {
  if (!el) return;
  el.textContent = direction === 1 ? "↻" : "↺";
  el.title = direction === 1 ? "時計回り" : "反時計回り";
}

// ===== ヒントエリア =====

/**
 * ヒントエリアのメッセージを更新する。
 *
 * @param {HTMLElement} el - #hint-area 要素
 * @param {object} params
 * @param {boolean} params.gameOver
 * @param {boolean} params.isWaitingHuman
 * @param {number[]} params.playableIndices
 * @param {number}   params.deckCount
 * @param {Player}   params.currentPlayer
 */
export function renderHint(el, { gameOver, isWaitingHuman, playableIndices, deckCount, currentPlayer }) {
  if (!el) return;

  if (gameOver) {
    el.textContent = "対局終了";
    el.className = "hint-area hint-gameover";
    return;
  }

  if (isWaitingHuman) {
    if (playableIndices.length > 0) {
      el.textContent = "💡 出せるカードをタップ";
      el.className = "hint-area hint-play";
    } else if (deckCount > 0) {
      el.textContent = "💡 DECKをタップして1枚引く";
      el.className = "hint-area hint-draw";
    } else {
      el.textContent = "💡 パス（出せるカードなし）";
      el.className = "hint-area hint-pass";
    }
  } else {
    el.textContent = `待ち：${currentPlayer?.icon ?? ""}${currentPlayer?.name ?? ""}の番`;
    el.className = "hint-area hint-waiting";
  }
}

// ===== ステータスバー =====

/**
 * ステータスバーを更新する。
 *
 * @param {HTMLElement} el - #statusBar 要素
 * @param {object} params
 * @param {number} params.turnCount
 * @param {number} params.deckCount
 * @param {number} params.direction
 * @param {Player} params.currentPlayer
 * @param {boolean} params.gameOver
 */
export function renderStatusBar(el, { turnCount, deckCount, direction, currentPlayer, gameOver }) {
  if (!el) return;
  if (gameOver) {
    el.textContent = "🏁 ゲーム終了";
    return;
  }
  const dir = direction === 1 ? "↻" : "↺";
  el.textContent = `Turn ${turnCount} | ${dir} | Deck: ${deckCount} | 手番: ${currentPlayer?.icon ?? ""}${currentPlayer?.name ?? ""}`;
}
