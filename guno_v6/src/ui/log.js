// guno_v6/src/ui/log.js
// GUNO V6 Log UI Component
//
// Responsibility:
//   - Render the game log (event history) to a DOM element
//   - Auto-scroll to the latest entry

"use strict";

/**
 * Render the game log into the given container element.
 * @param {HTMLElement} el
 * @param {import("../core/game_engine.js").LogEntry[]} logEntries
 */
export function renderLog(el, logEntries) {
  if (!el) return;
  el.innerHTML = logEntries
    .map((entry) => `<div class="log-entry">${entry.message}</div>`)
    .join("");
  el.scrollTop = el.scrollHeight;
}

/**
 * Append a single log entry without re-rendering the full list.
 * @param {HTMLElement} el
 * @param {string} message
 */
export function appendLog(el, message) {
  if (!el) return;
  const div = document.createElement("div");
  div.className = "log-entry";
  div.textContent = message;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}
