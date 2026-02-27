function calcConnectionBonus(stations){
  // stations: プレイヤーが取得した駅オブジェクト配列（STATIONS_DB由来）
  let bonus = 0;
  for(const st of stations){
    const d = (st.degree_real ?? 1);
    bonus += Math.max(0, d - 1);   // あなたのルール：degree-1
  }
  return bonus;
}


// guno_core.js (rules/state only; no DOM updates)
// Generated from guno_V4_051.html (v4.05) for V5 split

let isJapanese = true, autoPlay = false, deck = [], discardPile = [], players = [], mapState = {};
let turnIndex = 0, direction = 1, gameOver = false, isWaitingHuman = false, turnCount = 0;
let map, geoJsonLayers = {}, stationNodes = {}, lastHits = {}, teidenPlayed = {};
let autoTimer = null;
let consecutivePasses = 0;

// --- Logic ---
function calculateScore(pIdx) {
    const p = players[pIdx];
    let stCount = 0;
    Object.values(mapState).forEach(owner => { if(owner === pIdx) stCount++; });
    return (p.guno * GUNO_POINT) + stCount;
}
function advanceTurn() { turnCount++; const n = players.length; turnIndex = (turnIndex + direction + n) % n; }
