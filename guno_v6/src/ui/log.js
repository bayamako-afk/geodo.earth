/**
 * guno_v6/src/ui/log.js
 * ゲームログ UI コンポーネント
 *
 * 責務:
 *   - ゲームイベントをログエリアに追記する
 *   - ログパネルの開閉を制御する
 */

// ===== ログエントリ生成 =====

/**
 * ゲームエンジンのイベントをログメッセージに変換する。
 *
 * @param {object} event - emit() で発行されたイベント
 * @returns {string|null} HTML 文字列（null の場合はログしない）
 */
export function eventToLogHtml(event) {
  const { type } = event;

  switch (type) {
    case "card_played": {
      const { player, card } = event;
      const cardName = card.type === "teiden"
        ? `⚡ 停電(${card.lc})`
        : `${card.lc} ${card.st_ja ?? ""}`;
      return `[${player.icon}${player.name}] ${cardName}`;
    }

    case "station_captured": {
      return `⚔️ <b>${event.fromIdx + 1}P</b> から奪取！`;
    }

    case "direction_reversed": {
      return `🔄 REVERSE! (${event.direction === 1 ? "↻" : "↺"})`;
    }

    case "teiden_played": {
      return `⚡ 停電！逆転！(${event.lc})`;
    }

    case "card_drawn": {
      const { player, reason } = event;
      const reasonStr = reason === "teiden" ? "（停電ペナルティ）" : "";
      return `🎴 <b>${player.icon}${player.name}</b> がカードを引きました${reasonStr}`;
    }

    case "guno": {
      const { lc, player } = event;
      return `🎆 <b>${player.icon}${player.name}</b> が ${lc} を完成！(GUNO達成)`;
    }

    case "player_eliminated": {
      const { player, reason } = event;
      const reasonStr = reason === "empty_hand" ? "（手札0）" : "";
      return `❌ <b>${player.icon}${player.name}</b> が脱落しました${reasonStr}`;
    }

    case "turn_passed": {
      const { player } = event;
      return `⏭️ <b>${player.icon}${player.name}</b> がパス`;
    }

    case "turn_changed":
      return null; // ターン変更は頻繁すぎるのでログしない

    case "game_over": {
      const reasonMap = {
        routes_complete:    "全路線完成",
        all_routes_complete: "全路線完成",
        players_eliminated: "プレイヤー脱落",
        no_playable_cards:  "プレイ可能カードなし",
      };
      return `🏁 ゲーム終了（${reasonMap[event.reason] ?? event.reason}）`;
    }

    default:
      return null;
  }
}

// ===== ログエリア操作 =====

/**
 * ログエリアにメッセージを追記する。
 *
 * @param {HTMLElement} el - #log 要素
 * @param {string} html
 */
export function appendLog(el, html) {
  if (!el || !html) return;
  const div = document.createElement("div");
  div.innerHTML = html;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

/**
 * ゲームエンジンのイベントをログに追記する。
 *
 * @param {HTMLElement} el - #log 要素
 * @param {object} event
 */
export function logEvent(el, event) {
  const html = eventToLogHtml(event);
  if (html) appendLog(el, html);
}

/**
 * ログエリアをクリアする。
 *
 * @param {HTMLElement} el - #log 要素
 */
export function clearLog(el) {
  if (!el) return;
  el.innerHTML = "";
}

// ===== ログパネル開閉 =====

/**
 * ログパネルの表示/非表示を切り替える。
 */
export function toggleLog() {
  document.body.classList.toggle("show-log");
}
