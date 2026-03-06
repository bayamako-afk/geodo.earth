/**
 * guno_v6/src/ui/hand.js
 * 手札 UI コンポーネント
 *
 * 責務:
 *   - プレイヤーの手札カードを描画する
 *   - プレイ可能カードをハイライトし、クリックイベントを発行する
 *   - CPU プレイヤーの手札は裏面で表示する
 */

import { normStar } from "../core/rules.js";

// ===== カード HTML 生成 =====

/**
 * 駅カードの HTML を生成する。
 *
 * @param {Card} card
 * @param {object} opts
 * @param {boolean} opts.canPlay - プレイ可能か
 * @param {boolean} opts.isHuman - 人間プレイヤーか
 * @param {boolean} opts.autoPlay - オートプレイモードか
 * @param {number}  opts.cardIdx - 手札インデックス
 * @returns {string}
 */
function stationCardHtml(card, { canPlay, isHuman, autoPlay, cardIdx }) {
  const name = card.st_ja || "";
  const nameClean = normStar(name);
  const isHub = name.startsWith("★");
  const shortClass = nameClean.length <= 2 ? "short-name" : "";

  const playableClass = canPlay ? "playable" : (isHuman && !autoPlay ? "unplayable" : "");
  const clickAttr = canPlay ? `data-card-idx="${cardIdx}"` : "";

  return `
    <div class="card guno-card ${playableClass}" data-line="${card.lc}" ${clickAttr} title="${card.st_ja} (${card.st_en})">
      <div class="corner corner--tl">
        <div class="corner-bg"></div>
        <div class="corner-num">${card.order}</div>
      </div>
      <div class="corner corner--br">
        <div class="corner-bg"></div>
        <div class="corner-num corner-num--rot">${card.order}</div>
      </div>
      <div class="center">
        <div class="station-jp ${shortClass}">${isHub ? '<span class="hub-star">★</span>' : ""}${nameClean}</div>
        <div class="station-en">${normStar(card.st_en || "")}</div>
      </div>
      <div class="route-code">${card.lc}</div>
    </div>
  `;
}

/**
 * 停電カードの HTML を生成する。
 *
 * @param {Card} card
 * @param {object} opts
 * @returns {string}
 */
function teidenCardHtml(card, { canPlay, cardIdx }) {
  const playableClass = canPlay ? "playable" : "";
  const clickAttr = canPlay ? `data-card-idx="${cardIdx}"` : "";
  return `
    <div class="card guno-card guno-card--teiden ${playableClass}" data-line="${card.lc}" ${clickAttr}>
      <div class="teiden-icon">⚡</div>
      <div class="teiden-sub">停電</div>
      <div class="teiden-en">Blackout</div>
    </div>
  `;
}

/**
 * 裏面カードの HTML を生成する（CPU の手札）。
 *
 * @returns {string}
 */
function backCardHtml() {
  return `<div class="card card-back"></div>`;
}

// ===== 手札エリア描画 =====

/**
 * 全プレイヤーの手札エリアを描画する。
 *
 * @param {object} params
 * @param {HTMLElement} params.container - #players-area 要素
 * @param {Player[]}    params.players
 * @param {number}      params.turnIndex
 * @param {boolean}     params.gameOver
 * @param {number[]}    params.playableIndices - 人間プレイヤーのプレイ可能インデックス
 * @param {boolean}     params.isWaitingHuman
 * @param {boolean}     params.autoPlay
 * @param {MapState}    params.mapState
 * @param {function}    params.onCardClick - (cardIdx: number) => void
 */
export function renderHands({
  container, players, turnIndex, gameOver,
  playableIndices, isWaitingHuman, autoPlay, mapState, onCardClick,
}) {
  if (!container) return;

  container.innerHTML = players.map((p, pIdx) => {
    const isTurn = pIdx === turnIndex && !gameOver && p.status === "active";
    const stCount = Object.values(mapState).filter((o) => o === pIdx).length;
    const isHuman = p.isHuman;
    const showCards = isHuman || autoPlay;

    const cardsHtml = p.hand.map((card, ci) => {
      if (!showCards) return backCardHtml();
      const canPlay = isHuman && !autoPlay && isWaitingHuman && pIdx === 0 && playableIndices.includes(ci);
      if (card.type === "teiden") return teidenCardHtml(card, { canPlay, cardIdx: ci });
      return stationCardHtml(card, { canPlay, isHuman, autoPlay, cardIdx: ci });
    }).join("");

    return `
      <div class="player-box ${isTurn ? "active-turn" : ""} ${p.status === "eliminated" ? "eliminated" : ""}"
           style="border-left-color:${p.color}">
        <div class="player-header">
          <span class="player-icon">${p.icon}</span>
          <span class="player-name">${p.name}</span>
          <span class="player-stats">
            駅:<b>${stCount}</b> GUNO:<b>${p.guno}</b>
          </span>
          ${isTurn ? '<span class="turn-badge">▶ 手番</span>' : ""}
          ${p.status === "eliminated" ? '<span class="elim-badge">脱落</span>' : ""}
        </div>
        <div class="hand-cards">${cardsHtml}</div>
      </div>
    `;
  }).join("");

  // クリックイベントを委譲
  container.querySelectorAll("[data-card-idx]").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.cardIdx, 10);
      onCardClick(idx);
    });
  });
}

// ===== 捨て札・デッキ描画 =====

/**
 * 捨て札の最上カードを描画する。
 *
 * @param {HTMLElement} el - #discard-pile 要素
 * @param {Card|null}   topCard
 */
export function renderDiscardPile(el, topCard) {
  if (!el) return;
  if (!topCard) { el.innerHTML = ""; return; }

  if (topCard.type === "teiden") {
    el.innerHTML = `
      <div class="card guno-card guno-card--teiden" data-line="${topCard.lc}" style="--w:72px;">
        <div class="teiden-icon">⚡</div>
        <div class="teiden-sub">停電</div>
        <div class="teiden-en">Blackout</div>
      </div>
    `;
  } else {
    const name = topCard.st_ja || "";
    const nameClean = normStar(name);
    const isHub = name.startsWith("★");
    const shortClass = nameClean.length <= 2 ? "short-name" : "";
    el.innerHTML = `
      <div class="card guno-card" data-line="${topCard.lc}" style="--w:72px;">
        <div class="corner corner--tl">
          <div class="corner-bg"></div>
          <div class="corner-num">${topCard.order}</div>
        </div>
        <div class="corner corner--br">
          <div class="corner-bg"></div>
          <div class="corner-num corner-num--rot">${topCard.order}</div>
        </div>
        <div class="center">
          <div class="station-jp ${shortClass}">${isHub ? '<span class="hub-star">★</span>' : ""}${nameClean}</div>
          <div class="station-en">${normStar(topCard.st_en || "")}</div>
        </div>
        <div class="route-code">${topCard.lc}</div>
      </div>
    `;
  }
}

/**
 * デッキ枚数表示を更新する。
 *
 * @param {HTMLElement} el - #draw-pile-visual 要素
 * @param {number}      count
 * @param {boolean}     canDraw - ドロー可能か（グロー表示）
 */
export function renderDeckCount(el, count, canDraw) {
  if (!el) return;
  el.textContent = String(count);
  el.className = canDraw ? "can-draw" : (count <= 5 ? "deck-low" : "");
}
