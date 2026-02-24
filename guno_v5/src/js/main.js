window.startGame = function(){
  initState();
  dealInitial();
  renderAll();
  updateMapFromState();
};

window.toggleLog = function(){
  const el = document.getElementById("log-container");
  if (!el) return;
  el.classList.toggle("hidden");
};

window.addEventListener("DOMContentLoaded", () => {
  initMap();
  startGame();
});