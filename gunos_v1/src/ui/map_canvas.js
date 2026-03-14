/**
 * map_canvas.js — GUNOS V1 SVG Map Canvas
 *
 * Phase 6: Network visibility + route growth polish
 *
 * Improvements over Phase 4/5:
 *   - Stronger owned-adjacency glow (opacity 0.45 → 0.65, stroke-width 4 → 6)
 *   - Owned edges rendered at full brightness (not dimmed)
 *   - Unowned edges more clearly dimmed (opacity 33%)
 *   - Player-colored edge segments for owned adjacency (separate layer)
 *   - Larger hub nodes for better readability (r=7 instead of 6)
 *   - Current card highlight: larger pulse ring + brighter ring
 *   - Legend shows station count + leading player highlight
 *   - Station labels always visible for owned/hub/current nodes
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

export function renderMapCanvas(container, graph, renderOpts = {}) {
  if (!container || !graph?.nodes?.length) return;

  const { players = [], currentCardId = null, uiMode = 'idle' } = renderOpts;

  const proj           = _buildProjection(graph.nodes);
  const ownerMap       = _buildOwnerMap(players);
  const ownedSet       = new Set(Object.keys(ownerMap));
  const connectedPairs = _findConnectedOwnedPairs(graph.edges, ownedSet);

  // Count owned stations per player for leading player detection
  const ownerCounts = _countByPlayer(ownerMap);
  const leaderId    = _findLeader(ownerCounts);

  const svg = _buildSVG(graph, proj, ownerMap, connectedPairs, currentCardId, uiMode, leaderId);

  container.innerHTML = '';
  container.appendChild(svg);
}

// ── SVG construction ──────────────────────────────────────────────────────────

function _buildSVG(graph, proj, ownerMap, connectedPairs, currentCardId, uiMode, leaderId) {
  const svg = _el('svg', {
    viewBox: `0 0 ${SVG_W} ${SVG_H}`,
    preserveAspectRatio: 'xMidYMid meet',
    class: 'map-svg',
  });

  // ── Layer 1: Base edges ───────────────────────────────────────────────────
  const edgeLayer    = _el('g', { class: 'map-layer map-layer--edges' });
  const edgesByLine  = _groupEdgesByLine(graph.edges);

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
        // Phase 6: owned edges full brightness, unowned clearly dimmed
        stroke:           isConnected ? color : `${color}44`,
        'stroke-width':   isConnected ? 2.8   : 1.0,
        'stroke-linecap': 'round',
        class: isConnected ? 'map-edge map-edge--connected' : 'map-edge',
      });
      lineGroup.appendChild(line);
    }
    edgeLayer.appendChild(lineGroup);
  }
  svg.appendChild(edgeLayer);

  // ── Layer 2: Network emphasis (owned adjacency — player-colored glow) ─────
  // Phase 6: stronger glow, player-colored edge segments
  const networkLayer = _el('g', { class: 'map-layer map-layer--network' });

  for (const edge of graph.edges) {
    if (!connectedPairs.has(_edgeKey(edge.from, edge.to))) continue;
    const fromNode = proj.get(edge.from);
    const toNode   = proj.get(edge.to);
    if (!fromNode || !toNode) continue;

    const ownerFrom  = ownerMap[edge.from];
    const ownerTo    = ownerMap[edge.to];
    const glowColor  = PLAYER_COLORS[ownerFrom] ?? PLAYER_COLORS[ownerTo] ?? '#ffffff';

    // Outer glow (wide, low opacity)
    const glow = _el('line', {
      x1: fromNode.x, y1: fromNode.y,
      x2: toNode.x,   y2: toNode.y,
      stroke:           glowColor,
      'stroke-width':   8,
      'stroke-linecap': 'round',
      opacity:          '0.18',
      class:            'map-edge-glow',
    });
    networkLayer.appendChild(glow);

    // Inner colored segment (narrow, higher opacity)
    const segment = _el('line', {
      x1: fromNode.x, y1: fromNode.y,
      x2: toNode.x,   y2: toNode.y,
      stroke:           glowColor,
      'stroke-width':   2,
      'stroke-linecap': 'round',
      opacity:          '0.55',
      class:            'map-edge-segment',
    });
    networkLayer.appendChild(segment);
  }
  svg.appendChild(networkLayer);

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

    // Phase 6: slightly larger nodes
    const r = isCurrent ? 10 : isHub ? 7 : isOwned ? 5 : 3.5;

    const g = _el('g', {
      class: [
        'map-node',
        isOwned   ? `map-node--owned map-node--${owner}` : 'map-node--unowned',
        isHub     ? 'map-node--hub'     : '',
        isCurrent ? 'map-node--current' : '',
        isLeader  ? 'map-node--leader'  : '',
      ].filter(Boolean).join(' '),
      'data-id':   nodeId,
      'data-name': node.station_name,
    });

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

      // Second ring (inner)
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

    // Leader highlight ring (Phase 6)
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
    const fill   = isOwned ? PLAYER_COLORS[owner] : (isHub ? '#3a4050' : '#252a32');
    const stroke = isOwned ? PLAYER_COLORS[owner] : (isHub ? '#5a6070' : '#3a4050');

    const circle = _el('circle', {
      cx: pt.x, cy: pt.y,
      r,
      fill,
      stroke,
      'stroke-width': isOwned ? 0 : 1,
      opacity:        isOwned ? '1' : (isHub ? '0.8' : '0.55'),
    });
    g.appendChild(circle);

    // Labels: owned, hub, or current — always in non-idle mode
    if ((isOwned || isHub || isCurrent) && uiMode !== 'idle') {
      const label = _el('text', {
        x:             pt.x,
        y:             pt.y - r - 3,
        'text-anchor': 'middle',
        'font-size':   isCurrent ? '9' : '7.5',
        fill:          isOwned ? PLAYER_COLORS[owner] : (isCurrent ? '#ffffff' : '#8b949e'),
        'font-weight': isCurrent ? 'bold' : 'normal',
        class:         'map-node-label',
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
        r:              20,
        fill:           'none',
        stroke:         '#ffffff',
        'stroke-width': 1,
        opacity:        '0.2',
        class:          'map-highlight-ring',
      });
      highlightLayer.appendChild(ring);
      svg.appendChild(highlightLayer);
    }
  }

  // ── Layer 5: Player legend ────────────────────────────────────────────────
  if (uiMode !== 'idle') {
    const legendLayer = _buildLegend(ownerMap, leaderId);
    svg.appendChild(legendLayer);
  }

  return svg;
}

// ── Legend ────────────────────────────────────────────────────────────────────

function _buildLegend(ownerMap, leaderId) {
  const g = _el('g', { class: 'map-legend' });

  const counts  = _countByPlayer(ownerMap);
  const players = Object.keys(counts).sort();
  const startX  = SVG_W - 10;
  const startY  = 10;

  players.forEach((pid, i) => {
    const y         = startY + i * 20;
    const color     = PLAYER_COLORS[pid] ?? '#aaaaaa';
    const isLeading = pid === leaderId;

    // Background pill for leader
    if (isLeading) {
      const pill = _el('rect', {
        x:      startX - 72,
        y:      y - 2,
        width:  68,
        height: 16,
        rx:     4,
        fill:   color,
        opacity: '0.12',
      });
      g.appendChild(pill);
    }

    const dot = _el('circle', {
      cx: startX - 62, cy: y + 6,
      r:    isLeading ? 6 : 4,
      fill: color,
    });

    const label = _el('text', {
      x:           startX - 52,
      y:           y + 10,
      'font-size': isLeading ? '11' : '10',
      'font-weight': isLeading ? 'bold' : 'normal',
      fill:        color,
      class:       'map-legend-label',
    });
    label.textContent = `${pid}  ${counts[pid]}`;

    g.appendChild(dot);
    g.appendChild(label);
  });

  return g;
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
