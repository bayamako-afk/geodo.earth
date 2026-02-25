function loadV5DataFromLocalStorage() {
  const s = localStorage.getItem("guno_v5data_v1");
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

const dynamicV5 = loadV5DataFromLocalStorage();
if (dynamicV5) {
  // エディタからのデータで、既存のグローバル変数を上書き
  window.STATIONS_DB = dynamicV5.STATIONS_DB;
  window.STATION_DB_CARDS = dynamicV5.STATION_DB_CARDS;
  window.TEIDEN_FILES = dynamicV5.TEIDEN_FILES;
  console.log("Loaded GUNO v5 data dynamically from GOS Editor:", dynamicV5);
}


// main.js (boot & wiring)
// Generated from guno_V4_051.html (v4.05) for V5 split

// Boot the main game
window.onload = () => {
  document.body.classList.remove('show-log');
  initMapComponent();
  startGame();
};

// Keep Leaflet sized correctly
window.addEventListener('resize', safeInvalidateMap);

// Render the demo card grid section (optional)
document.addEventListener('DOMContentLoaded', renderCards);

function applyMobileHeaderOffset(){
  if (window.innerWidth > 1023) return;
  const header = document.querySelector('body > .header');
  const gc = document.querySelector('.game-container');
  if (!header || !gc) return;
  gc.style.marginTop = header.offsetHeight + 'px';
}
function applyMobileHeaderHeight(){
  if (window.innerWidth > 1023) return;
  const h = document.querySelector('body > .header')?.offsetHeight || 72;
  document.documentElement.style.setProperty('--mobile-header-h', h + 'px');
}
window.addEventListener('load', applyMobileHeaderOffset);
window.addEventListener('resize', applyMobileHeaderOffset);