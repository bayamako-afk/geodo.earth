// guno_v6/src/shared/constants.js
// GUNO V6 Shared Constants

"use strict";

/** Default line codes used in the built-in pack (Tokyo 4 lines). */
export const DEFAULT_LINE_CODES = ["JY", "M", "G", "T"];

/** Line metadata for the built-in Tokyo 4-line pack. */
export const LINE_INFO = {
  JY: { name_ja: "山手線",   name_en: "Yamanote",  color: "#9acd32" },
  M:  { name_ja: "丸ノ内線", name_en: "Marunouchi", color: "#e60012" },
  G:  { name_ja: "銀座線",   name_en: "Ginza",      color: "#f39700" },
  T:  { name_ja: "東西線",   name_en: "Tozai",      color: "#009bbf" },
};

/** CPU turn delay in milliseconds. */
export const CPU_TURN_DELAY_MS = 450;

/** Auto-advance delay after a pass in milliseconds. */
export const PASS_ADVANCE_DELAY_MS = 350;
