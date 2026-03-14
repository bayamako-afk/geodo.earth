/**
 * map_canvas.js — GUNOS V1 SVG Map Canvas
 *
 * Phase 4: Geographic map visualization layer.
 *
 * Renders a real SVG map from station_graph data:
 *   - Base edges (route lines, city-specific colors)
 *   - Station nodes (sized by hub_degree)
 *   - Owned station overlay (player colors)
 *   - Recent action highlight (pulse animation)
 *   - Network connection emphasis (owned adjacency)
 *
 * Coordinate system:
 *   lat/lon → normalized SVG viewport (0..SVG_W, 0..SVG_H)
 *   with padding to keep stations inside the frame.
 *
 * Player color palette:
 *   P1: #4fc3f7 (cyan-blue)
 *   P2: #ef9a9a (soft red)
 *   P3: #a5d6a7 (soft green)
 *   P4: #ffcc80 (amber)
 */

const SVG_W   = 900;
const SVG_H   = 560;
const PAD     = 36;   // padding from edge

// Player ownership colors
const PLAYER_COLORS = {
  P1: '#4fc3f7',
  P2: '#ef9a9a',
  P3: '#a5d6a7',
  P4: '#ffcc80',
};

// Line colors (matches map_panel.js palette)
const LINE_COLORS = {
  JY: '#80c080', G: '#f0a020', M: '#e04040', T: '#40a0c0', Z: '#8060c0',
  Y: '#40b0a0',  HK: '#c08040', OC: '#e06060',
  CEN: '#e05020', NOR: '#606060', PIC: '#2040a0', DIS: '#408040', CIR: '#c0c020',
  L1: '#c04040',  L4: '#408040', LA: '#4060c0', LN: '#c0c040', L7: '#8040c0',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render or update the SVG map canvas.
 *
 * @param {HTMLElement} container  - DOM element to render into
 * @param {Object}      graph      - station_graph JSON { nodes, edges }
 * @param {Object}      renderOpts - {
 *   players:       Array<{ id, ownedStations: string[] }>
 *   currentCardId: string | null   (station_global_id of most recent play)
 *   uiMode:        'idle' | 'running' | 'finished'
 *   cityId:        string
 * }
 */
export function renderMapCanvas(container, graph, renderOpts = {}) {
  if (!container || !graph?.nodes?.length) return;

  const { players = [], currentCardId = null, uiMode = 'idle' } = renderOpts;

  // ── 1. Project lat/lon → SVG coordinates ─────────────────────────────────
  const proj = _buildProjection(graph.nodes);

  // ── 2. Build ownership map: station_global_id → playerId ─────────────────
  const ownerMap = _buildOwnerMap(players);

  // ── 3. Build adjacency set for owned stations (network emphasis) ──────────
  const ownedSet = new Set(Object.keys(ownerMap));
  const connectedPairs = _findConnectedOwnedPairs(graph.edges, ownedSet);

  // ── 4. Build SVG ──────────────────────────────────────────────────────────
  const svg = _buildSVG(graph, proj, ownerMap, connectedPairs, currentCardId, uiMode);

  container.innerHTML = '';
  container.appendChild(svg);
}

// ── SVG construction ──────────────────────────────────────────────────────────

function _buildSVG(graph, proj, ownerMap, connectedPairs, currentCardId, uiMode) {
  const svg = _el('svg', {
    viewBox: `0 0 ${SVG_W} ${SVG_H}`,
    preserveAspectRatio: 'xMidYMid meet',
    class: 'map-svg',
  });

  // ── Layer 1: Base edges (all route lines) ─────────────────────────────────
  const edgeLayer = _el('g', { class: 'map-layer map-layer--edges' });
  const edgesByLine = _groupEdgesByLine(graph.edges);

  for (const [lineId, edges] of Object.entries(edgesByLine)) {
    const color = LINE_COLORS[lineId] ?? '#3a3f47';
    const lineGroup = _el('g', { class: `map-line map-line--${lineId}` });

    for (const edge of edges) {
      const fromNode = proj.get(edge.from);
      const toNode   = proj.get(edge.to);
      if (!fromNode || !toNode) continue;

      const isConnected = connectedPairs.has(_edgeKey(edge.from, edge.to));
      const line = _el('line', {
        x1: fromNode.x, y1: fromNode.y,
        x2: toNode.x,   y2: toNode.y,
        stroke: isConnected ? color : `${color}55`,
        'stroke-width': isConnected ? 2.5 : 1.2,
        'stroke-linecap': 'round',
        class: isConnected ? 'map-edge map-edge--connected' : 'map-edge',
      });
      lineGroup.appendChild(line);
    }
    edgeLayer.appendChild(lineGroup);
  }
  svg.appendChild(edgeLayer);

  // ── Layer 2: Network emphasis (owned adjacency glow) ─────────────────────
  const networkLayer = _el('g', { class: 'map-layer map-layer--network' });
  for (const edge of graph.edges) {
    if (!connectedPairs.has(_edgeKey(edge.from, edge.to))) continue;
    const fromNode = proj.get(edge.from);
    const toNode   = proj.get(edge.to);
    if (!fromNode || !toNode) continue;

    // Determine glow color from owner
    const ownerFrom = ownerMap[edge.from];
    const ownerTo   = ownerMap[edge.to];
    const glowColor = PLAYER_COLORS[ownerFrom] ?? PLAYER_COLORS[ownerTo] ?? '#ffffff';

    const glow = _el('line', {
      x1: fromNode.x, y1: fromNode.y,
      x2: toNode.x,   y2: toNode.y,
      stroke: glowColor,
      'stroke-width': 4,
      'stroke-linecap': 'round',
      opacity: '0.25',
      class: 'map-edge-glow',
    });
    networkLayer.appendChild(glow);
  }
  svg.appendChild(networkLayer);

  // ── Layer 3: Station nodes ────────────────────────────────────────────────
  const nodeLayer = _el('g', { class: 'map-layer map-layer--nodes' });

  for (const node of graph.nodes) {
    // Support both node_id (Tokyo) and station_global_id (London/NYC/Osaka)
    const nodeId = node.node_id ?? node.station_global_id;
    const pt = proj.get(nodeId);
    if (!pt) continue;

    const owner   = ownerMap[nodeId];
    const isOwned = !!owner;
    const isHub   = (node.hub_degree_global ?? node.degree ?? 0) >= 2;
    const isCurrent = nodeId === currentCardId;

    const r = isCurrent ? 9 : isHub ? 6 : 4;

    const g = _el('g', {
      class: [
        'map-node',
        isOwned  ? `map-node--owned map-node--${owner}` : 'map-node--unowned',
        isHub    ? 'map-node--hub' : '',
        isCurrent ? 'map-node--current' : '',
      ].filter(Boolean).join(' '),
      'data-id':   node.node_id,
      'data-name': node.station_name,
    });

    // Outer ring for current card (pulse)
    if (isCurrent) {
      const pulse = _el('circle', {
        cx: pt.x, cy: pt.y,
        r: r + 6,
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 1.5,
        opacity: '0.5',
        class: 'map-node-pulse',
      });
      g.appendChild(pulse);
    }

    // Main circle
    const fill  = isOwned ? PLAYER_COLORS[owner] : (isHub ? '#3a4050' : '#252a32');
    const stroke = isOwned ? PLAYER_COLORS[owner] : (isHub ? '#5a6070' : '#3a4050');

    const circle = _el('circle', {
      cx: pt.x, cy: pt.y,
      r,
      fill,
      stroke,
      'stroke-width': isOwned ? 0 : 1,
      opacity: isOwned ? '1' : '0.7',
    });
    g.appendChild(circle);

    // Label for hub or owned stations
    if ((isHub || isOwned || isCurrent) && uiMode !== 'idle') {
      const label = _el('text', {
        x: pt.x,
        y: pt.y - r - 3,
        'text-anchor': 'middle',
        'font-size': '8',
        fill: isOwned ? PLAYER_COLORS[owner] : '#8b949e',
        class: 'map-node-label',
      });
      label.textContent = node.station_name;
      g.appendChild(label);
    }

    nodeLayer.appendChild(g);
  }
  svg.appendChild(nodeLayer);

  // ── Layer 4: Recent action highlight ─────────────────────────────────────
  if (currentCardId && uiMode === 'running') {
    const pt = proj.get(currentCardId);
    if (pt) {
      const highlightLayer = _el('g', { class: 'map-layer map-layer--highlight' });
      const ring = _el('circle', {
        cx: pt.x, cy: pt.y,
        r: 16,
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 1,
        opacity: '0.3',
        class: 'map-highlight-ring',
      });
      highlightLayer.appendChild(ring);
      svg.appendChild(highlightLayer);
    }
  }

  // ── Layer 5: Player legend ────────────────────────────────────────────────
  if (uiMode !== 'idle') {
    const legendLayer = _buildLegend(ownerMap);
    svg.appendChild(legendLayer);
  }

  return svg;
}

// ── Legend ────────────────────────────────────────────────────────────────────

function _buildLegend(ownerMap) {
  const g = _el('g', { class: 'map-legend' });

  // Count owned stations per player
  const counts = {};
  for (const playerId of Object.values(ownerMap)) {
    counts[playerId] = (counts[playerId] ?? 0) + 1;
  }

  const players = Object.keys(counts).sort();
  const startX  = SVG_W - 10;
  const startY  = 10;

  players.forEach((pid, i) => {
    const y = startY + i * 18;
    const color = PLAYER_COLORS[pid] ?? '#aaaaaa';

    const dot = _el('circle', {
      cx: startX - 60, cy: y + 5,
      r: 5, fill: color,
    });
    const label = _el('text', {
      x: startX - 50, y: y + 9,
      'font-size': '10',
      fill: color,
      class: 'map-legend-label',
    });
    label.textContent = `${pid}  ${counts[pid]}`;
    g.appendChild(dot);
    g.appendChild(label);
  });

  return g;
}

// ── Projection ────────────────────────────────────────────────────────────────

/**
 * Build a Map<node_id, {x, y}> by normalizing lat/lon to SVG viewport.
 */
function _buildProjection(nodes) {
  const lats = nodes.map(n => n.lat).filter(Boolean);
  const lons = nodes.map(n => n.lon).filter(Boolean);

  if (!lats.length || !lons.length) return new Map();

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latRange = maxLat - minLat || 1;
  const lonRange = maxLon - minLon || 1;

  const proj = new Map();
  for (const node of nodes) {
    if (node.lat == null || node.lon == null) continue;
    const x = PAD + ((node.lon - minLon) / lonRange) * (SVG_W - PAD * 2);
    // lat increases northward, SVG y increases downward → invert
    const y = PAD + ((maxLat - node.lat) / latRange) * (SVG_H - PAD * 2);
    // Support both node_id (Tokyo) and station_global_id (London/NYC/Osaka)
    const id = node.node_id ?? node.station_global_id;
    if (id) proj.set(id, { x, y });
  }
  return proj;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _buildOwnerMap(players) {
  const map = {};
  for (const player of players) {
    for (const stationId of (player.ownedStations ?? [])) {
      map[stationId] = player.id;
    }
  }
  return map;
}

function _findConnectedOwnedPairs(edges, ownedSet) {
  const pairs = new Set();
  for (const edge of edges) {
    if (ownedSet.has(edge.from) && ownedSet.has(edge.to)) {
      pairs.add(_edgeKey(edge.from, edge.to));
    }
  }
  return pairs;
}

function _edgeKey(from, to) {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function _groupEdgesByLine(edges) {
  const groups = {};
  for (const edge of edges) {
    // Support both line_id (Tokyo) and line_ids[0] (London/NYC/Osaka)
    const lid = edge.line_id ?? (Array.isArray(edge.line_ids) ? edge.line_ids[0] : null) ?? 'unknown';
    if (!groups[lid]) groups[lid] = [];
    groups[lid].push(edge);
  }
  return groups;
}

function _el(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}
