/**
 * guno_v6/src/ui/result.js
 * 結果オーバーレイ UI コンポーネント
 *
 * 責務:
 *   - ゲーム終了時にランキングテーブルを表示する
 *   - 結果オーバーレイの表示/非表示を制御する
 */

import { calcRanking } from "../core/scoring.js";

// ===== ランキングテーブル描画 =====

/**
 * 結果オーバーレイを表示してランキングを描画する。
 *
 * @param {object} params
 * @param {HTMLElement} params.overlayEl - #result-overlay 要素
 * @param {HTMLElement} params.tableEl   - #result-table 要素
 * @param {Player[]}    params.players
 * @param {MapState}    params.mapState
 * @param {Card[]}      [params.stationsDB]
 * @param {function}    params.onRestart - 「もう一度」ボタンのコールバック
 */
export function showResult({ overlayEl, tableEl, players, mapState, stationsDB = [], onRestart }) {
  if (!overlayEl || !tableEl) return;

  const ranking = calcRanking(players, mapState, stationsDB);

  let rows = "";
  ranking.forEach((r, i) => {
    const isWinner = i === 0;
    const styleAttr = isWinner ? 'style="color:gold; font-weight:bold;"' : "";
    const aliveIcon = r.isAlive ? "" : '<span style="opacity:.5;">💀</span>';
    rows += `
      <tr ${styleAttr}>
        <td>${isWinner ? "🏆" : i + 1}</td>
        <td>${r.player.icon} ${r.player.name} ${aliveIcon}</td>
        <td><b>${r.total}</b></td>
        <td>${r.stationCount}</td>
        <td>${r.guno}</td>
        <td>${r.gunoPoints}</td>
        <td>${r.hubBonus > 0 ? "+" + r.hubBonus : "-"}</td>
      </tr>
    `;
  });

  tableEl.innerHTML = `
    <thead>
      <tr>
        <th>順位</th>
        <th>Player</th>
        <th>Total</th>
        <th>駅</th>
        <th>GUNO</th>
        <th>GUNO pt</th>
        <th>Hub</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;

  // 「もう一度」ボタンのイベント
  const restartBtn = overlayEl.querySelector(".btn-restart");
  if (restartBtn && onRestart) {
    restartBtn.onclick = onRestart;
  }

  overlayEl.classList.add("is-visible");

  // 紙吹雪
  if (window.confetti) {
    window.confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
  }
}

/**
 * 結果オーバーレイを非表示にする。
 *
 * @param {HTMLElement} overlayEl
 */
export function hideResult(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.remove("is-visible");
}
