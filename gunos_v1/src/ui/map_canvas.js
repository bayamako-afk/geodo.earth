/**
 * map_canvas.js — GUNOS V1.1 SVG Map Canvas
 *
 * V1.1 Task 01: Route / Network Visibility Polish
 *
 * New in V1.1:
 *   - Route run detection: consecutive owned stations on the same line
 *     are highlighted with a dedicated thick colored segment (Layer 2b)
 *   - Network component detection: owned stations are grouped into
 *     connected components; larger groups get stronger glow
 *   - Isolated owned stations are visually distinct from connected groups
 *   - Unowned nodes further dimmed (opacity 0.35 → 0.22) to increase contrast
 *   - Owned isolated node: smaller r, dimmer glow
 *   - Owned connected node: larger r, brighter glow, component-size ring
 */

const SVG_W = 900;
const SVG_H = 560;
const PAD   = 36;

const PLAYER_COLORS = {
  P1: '#4fc3f7',
  P2: '#ef9a9a',
  P3: '#a5d6a7',
  P4: '#ffcc80',
};

const LINE_COLORS = {
  JY:  '#80c080', G:   '#f0a020', M:   '#e04040', T:   '#40a0c0', Z:   '#8060c0',
  Y:   '#40b0a0', HK:  '#c08040', OC:  '#e06060',
  CEN: '#e05020', NOR: '#606060', PIC: '#2040a0', DIS: '#408040', CIR: '#c0c020',
  L1:  '#c04040', L4:  '#408040', LA:  '#4060c0', LN:  '#c0c040', L7:  '#8040c0',
};

// ── Public API ────────────────────────────────────────────────────────────────

// V1.1 Task 04: label visibility threshold by city size
// Calibrated to actual hub_degree distributions per city:
//   Tokyo  (86 nodes):  max deg 3 → show deg≥2 (16 hubs)
//   Osaka  (85 nodes):  max deg 3 → show deg≥2  (7 hubs)
//   London (162 nodes): max deg 4 → show deg≥3 (13 hubs)
//   NYC    (152 nodes): max deg 6 → show deg≥3 (25 hubs)
function _labelThreshold(nodeCount) {
  if (nodeCount >= 100) return 3;  // London / NYC: only degree ≥3
  return 2;                         // Tokyo / Osaka: degree ≥2
}

export function renderMapCanvas(container, graph, renderOpts = {}) {
  if (!container || !graph?.nodes?.length) return;

  const { players = [], currentCardId = null, uiMode = 'idle' } = renderOpts;

  const proj           = _buildProjection(graph.nodes);
  const labelMinDeg    = _labelThreshold(graph.nodes.length);
  const ownerMap       = _buildOwnerMap(players);
  const ownedSet       = new Set(Object.keys(ownerMap));
  const connectedPairs = _findConnectedOwnedPairs(graph.edges, ownedSet);

  // V1.1: Connected components per player
  const componentMap   = _buildComponentMap(graph.edges, ownerMap);

  // V1.1: Route runs — consecutive owned segments on the same line
  const routeRuns      = _findRouteRuns(graph.edges, ownerMap);

  const ownerCounts = _countByPlayer(ownerMap);
  const leaderId    = _findLeader(ownerCounts);

  const svg = _buildSVG(
    graph, proj, ownerMap, ownedSet, connectedPairs,
    componentMap, routeRuns, currentCardId, uiMode, leaderId, labelMinDeg
  );

  container.innerHTML = '';
  container.appendChild(svg);
}

// ── SVG construction ──────────────────────────────────────────────────────────

function _buildSVG(
  graph, proj, ownerMap, ownedSet, connectedPairs,
  componentMap, routeRuns, currentCardId, uiMode, leaderId, labelMinDeg
) {
  const svg = _el('svg', {
    viewBox: `0 0 ${SVG_W} ${SVG_H}`,
    preserveAspectRatio: 'xMidYMid meet',
    class: 'map-svg',
  });

  // ── Layer 1: Base edges ───────────────────────────────────────────────────
  // Unowned edges are heavily dimmed; owned-adjacent edges are brighter
  const edgeLayer   = _el('g', { class: 'map-layer map-layer--edges' });
  const edgesByLine = _groupEdgesByLine(graph.edges);

  for (const [lineId, edges] of Object.entries(edgesByLine)) {
    const color     = LINE_COLORS[lineId] ?? '#3a3f47';
    const lineGroup = _el('g', { class: `map-line map-line--${lineId}` });

    for (const edge of edges) {
      const fromNode = proj.get(edge.from);
      const toNode   = proj.get(edge.to);
      if (!fromNode || !toNode) continue;

      const isConnected = connectedPairs.has(_edgeKey(edge.from, edge.to));

      const line = _el('line', {
        x1: fromNode.x, y1: fromNode.y,
        x2: toNode.x,   y2: toNode.y,
        // V1.1: unowned edges more aggressively dimmed for contrast
        stroke:           isConnected ? color : `${color}33`,
        'stroke-width':   isConnected ? 2.5   : 0.8,
        'stroke-linecap': 'round',
        class: isConnected ? 'map-edge map-edge--connected' : 'map-edge',
      });
      lineGroup.appendChild(line);
    }
    edgeLayer.appendChild(lineGroup);
  }
  svg.appendChild(edgeLayer);

  // ── Layer 2a: Network glow (owned adjacency — component-size scaled) ──────
  // Larger connected components get stronger glow
  const networkLayer = _el('g', { class: 'map-layer map-layer--network' });

  for (const edge of graph.edges) {
    if (!connectedPairs.has(_edgeKey(edge.from, edge.to))) continue;
    const fromNode = proj.get(edge.from);
    const toNode   = proj.get(edge.to);
    if (!fromNode || !toNode) continue;

    const ownerFrom  = ownerMap[edge.from];
    const ownerTo    = ownerMap[edge.to];
    const glowColor  = PLAYER_COLORS[ownerFrom] ?? PLAYER_COLORS[ownerTo] ?? '#ffffff';

    // V1.1: component size scales glow intensity
    const compSizeFrom = componentMap.get(edge.from) ?? 1;
    const compSizeTo   = componentMap.get(edge.to)   ?? 1;
    const compSize     = Math.max(compSizeFrom, compSizeTo);
    const glowOpacity  = Math.min(0.55, 0.12 + compSize * 0.04);
    const glowWidth    = Math.min(14, 6 + compSize * 0.8);

    // Outer glow (wide, component-scaled)
    const glow = _el('line', {
      x1: fromNode.x, y1: fromNode.y,
      x2: toNode.x,   y2: toNode.y,
      stroke:           glowColor,
      'stroke-width':   glowWidth,
      'stroke-linecap': 'round',
      opacity:          glowOpacity.toFixed(2),
      class:            'map-edge-glow',
    });
    networkLayer.appendChild(glow);

    // Inner segment (narrow, high opacity)
    const innerOpacity = Math.min(0.85, 0.45 + compSize * 0.04);
    const segment = _el('line', {
      x1: fromNode.x, y1: fromNode.y,
      x2: toNode.x,   y2: toNode.y,
      stroke:           glowColor,
      'stroke-width':   2.5,
      'stroke-linecap': 'round',
      opacity:          innerOpacity.toFixed(2),
      class:            'map-edge-segment',
    });
    networkLayer.appendChild(segment);
  }
  svg.appendChild(networkLayer);

  // ── Layer 2b: Route runs (same-line consecutive ownership) ───────────────
  // V1.1: NEW — thick colored stripe on top of route runs
  if (routeRuns.length > 0) {
    const routeLayer = _el('g', { class: 'map-layer map-layer--routes' });

    for (const run of routeRuns) {
      const fromNode = proj.get(run.from);
      const toNode   = proj.get(run.to);
      if (!fromNode || !toNode) continue;

      const playerColor = PLAYER_COLORS[run.owner] ?? '#ffffff';
      const lineColor   = LINE_COLORS[run.lineId]  ?? '#888888';

      // Route run stripe — player-colored, thick, high opacity
      const stripe = _el('line', {
        x1: fromNode.x, y1: fromNode.y,
        x2: toNode.x,   y2: toNode.y,
        stroke:           playerColor,
        'stroke-width':   4.5,
        'stroke-linecap': 'round',
        opacity:          '0.75',
        class:            'map-route-run',
      });
      routeLayer.appendChild(stripe);

      // Thin line color overlay to show which line it belongs to
      const lineOverlay = _el('line', {
        x1: fromNode.x, y1: fromNode.y,
        x2: toNode.x,   y2: toNode.y,
        stroke:           lineColor,
        'stroke-width':   1.2,
        'stroke-linecap': 'round',
        opacity:          '0.45',
        class:            'map-route-run-line',
      });
      routeLayer.appendChild(lineOverlay);
    }
    svg.appendChild(routeLayer);
  }

  // ── Layer 3: Station nodes ────────────────────────────────────────────────
  const nodeLayer = _el('g', { class: 'map-layer map-layer--nodes' });

  for (const node of graph.nodes) {
    const nodeId   = node.node_id ?? node.station_global_id;
    const pt       = proj.get(nodeId);
    if (!pt) continue;

    const owner     = ownerMap[nodeId];
    const isOwned   = !!owner;
    const hubDeg    = node.hub_degree_global ?? node.degree ?? 0;
    const isHub     = hubDeg >= 2;
    const isCurrent = nodeId === currentCardId;
    const isLeader  = isOwned && owner === leaderId;

    // V1.1: connected vs isolated owned nodes have different sizes
    const compSize    = isOwned ? (componentMap.get(nodeId) ?? 1) : 0;
    const isConnected = compSize >= 2;

    // Size: current > connected-owned-hub > connected-owned > isolated-owned > hub > plain
    let r;
    if (isCurrent)              r = 10;
    else if (isOwned && isHub && isConnected) r = 9;
    else if (isOwned && isConnected) r = 6.5;
    else if (isOwned && isHub)  r = 7;
    else if (isOwned)           r = 4.5;
    else if (isHub)             r = 5.5;
    else                        r = 2.8;

    const g = _el('g', {
      class: [
        'map-node',
        isOwned     ? `map-node--owned map-node--${owner}` : 'map-node--unowned',
        isHub       ? 'map-node--hub'       : '',
        isCurrent   ? 'map-node--current'   : '',
        isLeader    ? 'map-node--leader'     : '',
        isConnected ? 'map-node--connected'  : (isOwned ? 'map-node--isolated' : ''),
      ].filter(Boolean).join(' '),
      'data-id':   nodeId,
      'data-name': node.station_name,
    });

    // V1.1: component size ring for connected owned nodes (shows network scale)
    if (isOwned && isConnected && !isCurrent && uiMode !== 'idle') {
      const ringR   = r + Math.min(6, compSize * 0.8);
      const ringOp  = Math.min(0.45, 0.15 + compSize * 0.03);
      const compRing = _el('circle', {
        cx: pt.x, cy: pt.y,
        r:              ringR,
        fill:           'none',
        stroke:         PLAYER_COLORS[owner],
        'stroke-width': 1.2,
        opacity:        ringOp.toFixed(2),
        class:          'map-node-comp-ring',
      });
      g.appendChild(compRing);
    }

    // Pulse ring for current card
    if (isCurrent) {
      const pulse = _el('circle', {
        cx: pt.x, cy: pt.y,
        r:              r + 8,
        fill:           'none',
        stroke:         '#ffffff',
        'stroke-width': 1.5,
        opacity:        '0.6',
        class:          'map-node-pulse',
      });
      g.appendChild(pulse);
      const pulse2 = _el('circle', {
        cx: pt.x, cy: pt.y,
        r:              r + 4,
        fill:           'none',
        stroke:         '#ffffff',
        'stroke-width': 0.8,
        opacity:        '0.35',
      });
      g.appendChild(pulse2);
    }

    // Leader highlight ring
    if (isLeader && !isCurrent && uiMode !== 'idle') {
      const leaderRing = _el('circle', {
        cx: pt.x, cy: pt.y,
        r:              r + 3,
        fill:           'none',
        stroke:         PLAYER_COLORS[owner],
        'stroke-width': 1,
        opacity:        '0.5',
      });
      g.appendChild(leaderRing);
    }

    // Main circle
    // V1.1: isolated owned nodes are slightly dimmer to distinguish from connected
    const ownedOpacity = isConnected ? '1' : '0.7';
    const fill   = isOwned ? PLAYER_COLORS[owner] : (isHub ? '#3a4050' : '#252a32');
    const stroke = isOwned ? PLAYER_COLORS[owner] : (isHub ? '#5a6070' : '#3a4050');

    const circle = _el('circle', {
      cx: pt.x, cy: pt.y,
      r,
      fill,
      stroke,
      'stroke-width': isOwned ? 0 : 1,
      // V1.1: unowned nodes more aggressively dimmed
      opacity: isOwned ? ownedOpacity : (isHub ? '0.65' : '0.28'),
    });
    g.appendChild(circle);

    // V1.1 Task 04: Labels — always show owned/current; hub labels filtered by degree threshold
    // Non-qualifying hub labels are rendered hidden and revealed on node hover via CSS
    const showLabel = isOwned || isCurrent || (isHub && hubDeg >= labelMinDeg);
    const hideLabel = !showLabel && isHub && uiMode !== 'idle';

    if ((showLabel || hideLabel) && uiMode !== 'idle') {
      const label = _el('text', {
        x:             pt.x,
        y:             pt.y - r - 3,
        'text-anchor': 'middle',
        'font-size':   isCurrent ? '9' : (isConnected && isOwned ? '8' : '7.5'),
        fill:          isOwned ? PLAYER_COLORS[owner] : (isCurrent ? '#ffffff' : '#8b949e'),
        'font-weight': (isCurrent || (isConnected && isOwned)) ? 'bold' : 'normal',
        opacity:       isOwned ? (isConnected ? '1' : '0.7') : '0.9',
        class:         hideLabel ? 'map-node-label map-node-label--hidden' : 'map-node-label',
      });
      label.textContent = node.station_name;
      g.appendChild(label);
    }

    nodeLayer.appendChild(g);
  }
  svg.appendChild(nodeLayer);

  // ── Layer 4: Current card action highlight ────────────────────────────────
  if (currentCardId && uiMode === 'running') {
    const pt = proj.get(currentCardId);
    if (pt) {
      const highlightLayer = _el('g', { class: 'map-layer map-layer--highlight' });
      const ring = _el('circle', {
        cx: pt.x, cy: pt.y,
        r:              22,
        fill:           'none',
        stroke:         '#ffffff',
        'stroke-width': 1,
        opacity:        '0.18',
        class:          'map-highlight-ring',
      });
      highlightLayer.appendChild(ring);
      svg.appendChild(highlightLayer);
    }
  }

  // ── Layer 5: Player legend ────────────────────────────────────────────────
  if (uiMode !== 'idle') {
    const legendLayer = _buildLegend(ownerMap, leaderId, componentMap);
    svg.appendChild(legendLayer);
  }

  return svg;
}

// ── Legend ────────────────────────────────────────────────────────────────────

function _buildLegend(ownerMap, leaderId, componentMap) {
  const g = _el('g', { class: 'map-legend' });

  const counts  = _countByPlayer(ownerMap);
  const players = Object.keys(counts).sort();
  const startX  = SVG_W - 10;
  const startY  = 10;

  // V1.1: also show max component size per player
  const maxCompByPlayer = {};
  for (const [nodeId, pid] of Object.entries(ownerMap)) {
    const cs = componentMap.get(nodeId) ?? 1;
    if (!maxCompByPlayer[pid] || cs > maxCompByPlayer[pid]) {
      maxCompByPlayer[pid] = cs;
    }
  }

  players.forEach((pid, i) => {
    const y         = startY + i * 22;
    const color     = PLAYER_COLORS[pid] ?? '#aaaaaa';
    const isLeading = pid === leaderId;
    const maxComp   = maxCompByPlayer[pid] ?? 1;

    if (isLeading) {
      const pill = _el('rect', {
        x:      startX - 80,
        y:      y - 2,
        width:  76,
        height: 18,
        rx:     4,
        fill:   color,
        opacity: '0.12',
      });
      g.appendChild(pill);
    }

    const dot = _el('circle', {
      cx: startX - 68, cy: y + 7,
      r:    isLeading ? 6 : 4,
      fill: color,
    });

    const label = _el('text', {
      x:             startX - 58,
      y:             y + 11,
      'font-size':   isLeading ? '11' : '10',
      'font-weight': isLeading ? 'bold' : 'normal',
      fill:          color,
      class:         'map-legend-label',
    });
    // V1.1: show station count + max network size
    label.textContent = `${pid}  ${counts[pid]}  (net:${maxComp})`;

    g.appendChild(dot);
    g.appendChild(label);
  });

  return g;
}

// ── V1.1: Connected component detection ───────────────────────────────────────

/**
 * Build a map from nodeId → size of its connected component (within same player's owned stations).
 * Nodes not in any connected group (isolated) get size 1.
 */
function _buildComponentMap(edges, ownerMap) {
  // Build adjacency within same-player owned stations
  const adj = new Map();
  for (const edge of edges) {
    const ownerFrom = ownerMap[edge.from];
    const ownerTo   = ownerMap[edge.to];
    if (!ownerFrom || !ownerTo || ownerFrom !== ownerTo) continue;
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to))   adj.set(edge.to,   []);
    adj.get(edge.from).push(edge.to);
    adj.get(edge.to).push(edge.from);
  }

  const visited    = new Set();
  const compSizeMap = new Map();

  for (const nodeId of Object.keys(ownerMap)) {
    if (visited.has(nodeId)) continue;

    // BFS to find all nodes in this component
    const component = [];
    const queue     = [nodeId];
    visited.add(nodeId);

    while (queue.length) {
      const cur = queue.shift();
      component.push(cur);
      for (const neighbor of (adj.get(cur) ?? [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    const size = component.length;
    for (const id of component) {
      compSizeMap.set(id, size);
    }
  }

  return compSizeMap;
}

// ── V1.1: Route run detection ─────────────────────────────────────────────────

/**
 * Find edges where both endpoints are owned by the SAME player AND share the same line.
 * Returns array of { from, to, owner, lineId }.
 */
function _findRouteRuns(edges, ownerMap) {
  const runs = [];
  for (const edge of edges) {
    const ownerFrom = ownerMap[edge.from];
    const ownerTo   = ownerMap[edge.to];
    if (!ownerFrom || !ownerTo || ownerFrom !== ownerTo) continue;

    const lineId = edge.line_id ?? (Array.isArray(edge.line_ids) ? edge.line_ids[0] : null);
    if (!lineId) continue;

    runs.push({ from: edge.from, to: edge.to, owner: ownerFrom, lineId });
  }
  return runs;
}

// ── Projection ────────────────────────────────────────────────────────────────

function _buildProjection(nodes) {
  const lats = nodes.map(n => n.lat).filter(v => v != null);
  const lons = nodes.map(n => n.lon).filter(v => v != null);

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
    const x  = PAD + ((node.lon - minLon) / lonRange) * (SVG_W - PAD * 2);
    const y  = PAD + ((maxLat - node.lat) / latRange) * (SVG_H - PAD * 2);
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

function _countByPlayer(ownerMap) {
  const counts = {};
  for (const pid of Object.values(ownerMap)) {
    counts[pid] = (counts[pid] ?? 0) + 1;
  }
  return counts;
}

function _findLeader(counts) {
  let best = null, bestCount = -1;
  for (const [pid, n] of Object.entries(counts)) {
    if (n > bestCount) { bestCount = n; best = pid; }
  }
  return best;
}

function _edgeKey(from, to) {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function _groupEdgesByLine(edges) {
  const groups = {};
  for (const edge of edges) {
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
