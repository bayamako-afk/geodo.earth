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
