// map.js (Leaflet only)
// Updated: label mode by zoom (no permanent bubbles), refresh label language, avoid zoomend renderAll

// --- Label thresholds ---
const LABEL_ZOOM_MAJOR = 12; // 主要駅だけラベル
const LABEL_ZOOM_ALL   = 13; // 全駅ラベル

function isMajorStationName(nameJp){
  // まずは暫定（後でSTATIONS_DBにmajorフラグを足してもOK）
  return (
    nameJp.includes("東京") || nameJp.includes("新宿") || nameJp.includes("渋谷") ||
    nameJp.includes("池袋") || nameJp.includes("上野") || nameJp.includes("品川")
  );
}

function getStationLabelHTML(st){
  const stName = isJapanese ? st.st_ja : st.st_en;
  if (!stName) return "";
  // ★駅は金星
  return stName.startsWith("★")
    ? '<span style="color:gold; font-size:14px;">★</span>' + stName.substring(1)
    : stName;
}

// --- Map Functions ---
function safeInvalidateMap(){ if(!map) return; setTimeout(()=>map.invalidateSize(true), 120); }

function applyLabelModeByZoom(){
  if(!map) return;
  const z = map.getZoom();

  Object.entries(stationNodes).forEach(([name, node]) => {
    if(!node || !node.marker) return;

    // stData（駅データ）を保持している前提
    const st = node.stData || (node.lines && node.lines[0] && node.lines[0].stData);
    if(!st) return;

    // ラベル文言は常に最新の言語で更新
    const html = getStationLabelHTML(st);
    if (node.marker.getTooltip && node.marker.getTooltip()){
      node.marker.setTooltipContent(html);
    }

    // 表示判定：大ズーム=全駅 / 中ズーム=主要駅
    const nameJp = (st.st_ja || "").replace("★","");
    const show = (z >= LABEL_ZOOM_ALL) || (z >= LABEL_ZOOM_MAJOR && isMajorStationName(nameJp));

    // permanentではなく open/close で制御
    if (show) node.marker.openTooltip();
    else node.marker.closeTooltip();
  });
}

function initMapComponent() {
  if(map) map.remove();
  stationNodes = {};
  map = L.map('map', { gestureHandling: true }).setView([35.680, 139.740], 12);

  const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
  const sat  = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
  L.control.layers({ "🌑 ダーク": dark, "🛰️ 航空写真": sat }).addTo(map);

  map.createPane('stationsPane').style.zIndex = 600;

  // ★ズームで全UIをrenderAllしない（重い＆初期チラつき原因）
  map.on('zoomend', () => {
    updateStationNodeIcons();
    applyLabelModeByZoom();
  });

  initLayers();

  // 初期描画安定化（灰色/ズレ対策）
  setTimeout(() => {
    safeInvalidateMap();
    updateStationNodeIcons();
    applyLabelModeByZoom();
  }, 220);

  // フルスクリーンボタン（左下）
  const FullscreenControl = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function () {
      const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
      btn.innerHTML = '⛶';
      btn.title = 'Fullscreen';
      btn.style.backgroundColor = '#111';
      btn.style.color = '#fff';
      btn.style.border = '1px solid #666';
      btn.style.width = '34px';
      btn.style.height = '34px';
      btn.style.cursor = 'pointer';

      L.DomEvent.disableClickPropagation(btn);

      function enterMapFullscreen(){
        const mapPanel = document.querySelector('#map-container');

        // 擬似フルスクリーンをON
        document.body.classList.add('map-only');
        setTimeout(() => map.invalidateSize(), 200);

        // Fullscreen APIも試す
        const req = mapPanel.requestFullscreen
          || mapPanel.webkitRequestFullscreen
          || mapPanel.msRequestFullscreen;

        if (req) { try { req.call(mapPanel); } catch(e) {} }
      }

      function exitMapFullscreen(){
        document.body.classList.remove('map-only');
        setTimeout(() => map.invalidateSize(), 200);

        const exit = document.exitFullscreen
          || document.webkitExitFullscreen
          || document.msExitFullscreen;

        if (exit) { try { exit.call(document); } catch(e) {} }
      }

      btn.onclick = function(){
        const isPseudo = document.body.classList.contains('map-only');
        if (!isPseudo) enterMapFullscreen();
        else exitMapFullscreen();
      };

      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
          document.body.classList.remove('map-only');
          setTimeout(() => map.invalidateSize(), 200);
        }
      });

      return btn;
    }
  });

  map.addControl(new FullscreenControl());
}

function initLayers() {
  ['JY','M','G','T'].forEach(lc => {
    const slug = {JY:'jr-east-yamanote', M:'tokyo-metro-marunouchi', G:'tokyo-metro-ginza', T:'tokyo-metro-tozai'}[lc];

    fetch(`./geojson/lines/${slug}.geojson`)
      .then(r=>r.json())
      .then(data => {
        geoJsonLayers[lc] = L.geoJSON(data, {
          style: { color:STATIONS_DB.find(s=>s.lc===lc).color, weight:4, opacity:0.4 }
        }).addTo(map);
      });

    fetch(`./geojson/stations/${slug}_stations.geojson`)
      .then(r=>r.json())
      .then(data => {
        L.geoJSON(data, {
          pointToLayer: (f, latlng) => {
            const normName = (f.properties.name||'').replace('★','');
            const st = STATIONS_DB.find(s => s.lc === lc && s.st_ja.replace('★','') === normName);
            if(!st) return L.circleMarker(latlng, { radius: 0, opacity: 0 });

            if(!stationNodes[normName]){
              const m = L.marker(latlng, { pane: 'stationsPane' }).addTo(map);

              stationNodes[normName] = {
                marker: m,
                latlng,
                lines: [],
                stData: st  // ★駅データ保持（主要判定・言語更新用）
              };

              // ★永久表示しない（ズームでopen/close制御）
              const label = getStationLabelHTML(st);
              m.bindTooltip(label, {
                permanent: false,       // ←重要
                direction: 'top',
                className: 'station-label',
                offset: [0,-10],
                opacity: 0.95,
                sticky: true            // 触ったら追随（スマホでも見やすい）
              });
            }

            stationNodes[normName].lines.push({ lc: st.lc, order: st.order, stData: st });
            return L.circleMarker(latlng, { radius: 0, opacity: 0 });
          }
        }).addTo(map);
      });
  });
}

function updateStationNodeIcons(){
  const rad = (map && map.getZoom) ? (map.getZoom() < 12 ? 2 : (map.getZoom() < 14 ? 4 : 6)) : 4;

  Object.entries(stationNodes).forEach(([name, node]) => {
    const owners = [];
    node.lines.forEach(({lc, order}) => {
      const owner = mapState[lc + "-" + order];
      if(owner !== undefined && owner !== -1) owners.push(owner);
    });
    const uniq = [...new Set(owners)];

    if(uniq.length === 0){
      const lineCol = STATIONS_DB.find(s=>s.lc===node.lines[0].lc).color;
      node.marker.setIcon(L.divIcon({
        className: 'empty-icon',
        html: '<div style="width:'+(rad*2)+'px; height:'+(rad*2)+'px; background:#fff; border:2px solid '+lineCol+'; border-radius:50%;"></div>',
        iconSize:[rad*2,rad*2],
        iconAnchor:[rad,rad]
      }));
    } else if(uniq.length === 1){
      const p = players[uniq[0]];
      node.marker.setIcon(L.divIcon({
        className: 'kamon-icon',
        html: '<div style="background:'+p.color+'; border:2px solid #fff; width:'+(rad*4)+'px; height:'+(rad*4)+'px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:'+(rad*2)+'px; color:white;">'+p.icon+'</div>',
        iconSize:[rad*4,rad*4],
        iconAnchor:[rad*2,rad*2]
      }));
    } else {
      const shown = uniq.slice(0,3).map(i=>players[i]);
      const html = '<div style="display:flex; gap:2px; background:rgba(0,0,0,.35); padding:2px; border-radius:12px; border:1px solid rgba(255,255,255,.4);">' +
        shown.map(p=>'<div style="background:'+p.color+'; width:'+(rad*3)+'px; height:'+(rad*3)+'px; border-radius:50%; border:1px solid #fff; display:flex; align-items:center; justify-content:center; font-size:'+(rad*1.6)+'px; color:white;">'+p.icon+'</div>').join('') +
        '</div>';
      node.marker.setIcon(L.divIcon({
        className: 'multi-icon',
        html,
        iconSize:[rad*10,rad*4],
        iconAnchor:[rad*5,rad*2]
      }));
    }
  });
}

function updateMapVisuals() {
  if(!map) return;
  const top = discardPile[discardPile.length-1];
  document.getElementById('map-container').classList.toggle('teiden-mode', top && top.type==='teiden');

  ['JY','M','G','T'].forEach(lc => {
    const layer = geoJsonLayers[lc];
    if(!layer) return;
    const hasOwner = Object.keys(mapState).some(k => k.startsWith(lc) && mapState[k] !== -1);
    const isGuno = (lastHits[lc] !== undefined);
    layer.setStyle({
      weight: isGuno ? 8 : (hasOwner ? 6 : 4),
      opacity: isGuno ? 1.0 : (hasOwner ? 0.8 : 0.2),
      color: isGuno ? "gold" : STATIONS_DB.find(s=>s.lc===lc).color
    });
  });
}

// フルスクリーン解除時の再描画（保険）
document.addEventListener("fullscreenchange", () => {
  if(map) setTimeout(() => map.invalidateSize(), 300);
});