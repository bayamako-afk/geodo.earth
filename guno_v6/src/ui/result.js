/**
 * guno_v6/src/ui/result.js
 * 結果オーバーレイ UI コンポーネント
 *
 * 責務:
 *   - ゲーム終了時にランキングテーブルを表示する
 *   - 結果オーバーレイの表示/非表示を制御する
 *
 * スコア内訳表示列:
 *   順位 | Player | Total | 駅数 | 駅pt | GUNO | GUNO pt | Hub
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

    // RankEntry fields: playerIcon, playerName, stationCount, stationPoints, guno, gunoPoints, hubBonus, total
    // Safe fallbacks for icon and name only — score fields are always present in RankEntry
    const icon  = r.playerIcon ?? r.player?.icon ?? "🎮";
    const name  = r.playerName ?? r.player?.name ?? "Player";

    // Score breakdown values (always defined in RankEntry from calcScoreDetail)
    const stCount  = r.stationCount  ?? 0;
    const stPts    = r.stationPoints ?? stCount;   // stationPoints = stationCount × 1pt
    const guno     = r.guno          ?? 0;
    const gunoPts  = r.gunoPoints    ?? 0;
    const hub      = r.hubBonus      ?? 0;
    const total    = r.total         ?? (stPts + gunoPts + hub);

    const hubCell  = hub > 0 ? `+${hub}` : "-";

    rows += `
      <tr ${styleAttr}>
        <td>${isWinner ? "🏆" : i + 1}</td>
        <td>${icon} ${name} ${aliveIcon}</td>
        <td><b>${total}</b></td>
        <td>${stCount}</td>
        <td>${stPts}</td>
        <td>${guno}</td>
        <td>${gunoPts}</td>
        <td>${hubCell}</td>
      </tr>
    `;
  });

  tableEl.innerHTML = `
    <thead>
      <tr>
        <th>順位</th>
        <th>Player</th>
        <th>Total</th>
        <th title="所有駅数">駅数</th>
        <th title="駅ポイント（駅数×1pt）">駅pt</th>
        <th title="GUNO達成回数">GUNO</th>
        <th title="GUNOポイント（回数×10pt）">GUNO pt</th>
        <th title="乗換駅ボーナス">Hub</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;

  // 「もう一度」ボタンのイベント（IDで取得）
  const restartBtn = overlayEl.querySelector("#btn-restart") || overlayEl.querySelector(".btn-restart");
  if (restartBtn && onRestart) {
    // 既存のリスナーを避けるためonclickで設定
    restartBtn.onclick = onRestart;
  }

  overlayEl.style.display = "flex";

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
  overlayEl.style.display = "none";
}
