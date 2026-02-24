let _map, _layer;

function initMap(){
  _map = L.map("map", { gestureHandling: true }).setView([35.6812, 139.7671], 12);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(_map);

  _layer = L.layerGroup().addTo(_map);
}

function updateMapFromState(){
  if (!_map || !_layer) return;
  _layer.clearLayers();

  const S = window.GUNO;
  for (const line of window.GUNO_LINES){
    const lc = line.line_code;
    const color = line.color;

    const pts = [];
    for (let n=1; n<=10; n++){
      const c = S.slots[lc][n];
      if (c){
        pts.push([c.lat, c.lon]);
        L.circleMarker([c.lat, c.lon], { radius:5, color, weight:2, fillOpacity:.9 })
          .bindTooltip(window.GUNO.isJapanese ? c.ja : c.en, { direction:"top" })
          .addTo(_layer);
      }
    }
    if (pts.length >= 2){
      L.polyline(pts, { color, weight:3, opacity:.8 }).addTo(_layer);
    }
  }
}