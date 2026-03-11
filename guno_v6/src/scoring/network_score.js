/**
 * network_score.js
 * GUNO V6 — Network Score Module
 *
 * プレイヤーが占有している駅が station_graph 上で連結している場合に
 * ネットワークボーナスを与える。
 *
 * 設計思想:
 *   - 大きなネットワーク（連結成分）を作るほど高得点
 *   - 異なる路線をまたいで連結することで追加ボーナス
 *   - 単独駅（孤立ノード）はボーナスなし
 *
 * ボーナステーブル（連結成分サイズ別）:
 *   size=1: 0pt（孤立駅）
 *   size=2: 2pt
 *   size=3: 4pt
 *   size=4: 7pt
 *   size=5: 10pt
 *   size=6: 14pt
 *   size=7: 18pt
 *   size=8: 23pt
 *   size=9: 28pt
 *   size=10+: 35pt
 *
 * 路線またぎボーナス（連結成分内に複数路線の駅が含まれる場合）:
 *   2路線: +3pt
 *   3路線: +6pt
 *   4路線以上: +10pt
 *
 * 使用方法:
 *   import { computeNetworkScoreFromMapState } from './network_score.js';
 *   const result = computeNetworkScoreFromMapState(mapState, playerIdx, packData, stationGraph);
 */

// ─────────────────────────────────────────────────────────────────────────────
// ボーナステーブル
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 連結成分サイズに基づくネットワークボーナスを返す。
 * @param {number} size - 連結成分の駅数
 * @returns {number} ボーナスポイント
 */
export function getNetworkSizeBonus(size) {
  if (size >= 10) return 35;
  if (size === 9)  return 28;
  if (size === 8)  return 23;
  if (size === 7)  return 18;
  if (size === 6)  return 14;
  if (size === 5)  return 10;
  if (size === 4)  return 7;
  if (size === 3)  return 4;
  if (size === 2)  return 2;
  return 0; // size=1（孤立）
}

/**
 * 連結成分内の路線数に基づくクロスラインボーナスを返す。
 * @param {number} lineCount - 連結成分内の異なる路線数
 * @returns {number} ボーナスポイント
 */
export function getCrossLineBonus(lineCount) {
  if (lineCount >= 4) return 10;
  if (lineCount === 3) return 6;
  if (lineCount === 2) return 3;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// グラフ構築ユーティリティ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * station_graph から隣接リストを構築する。
 * ノードは station_name（日本語）でインデックスする。
 *
 * @param {Object} stationGraph - station_graph_tokyo.json の内容
 * @returns {{ adjacency: Map<string, Set<string>>, nodeByName: Map<string, Object> }}
 */
function buildAdjacencyFromGraph(stationGraph) {
  const adjacency = new Map(); // station_name → Set<station_name>
  const nodeByName = new Map(); // station_name → node object

  // ノードを登録
  for (const node of stationGraph.nodes) {
    const name = node.station_name;
    nodeByName.set(name, node);
    if (!adjacency.has(name)) adjacency.set(name, new Set());
  }

  // エッジを登録（双方向）
  for (const edge of stationGraph.edges) {
    // from/to は station_global_id なので、ノードから名前を引く
    const fromNode = stationGraph.nodes.find(n => n.station_global_id === edge.from);
    const toNode   = stationGraph.nodes.find(n => n.station_global_id === edge.to);
    if (!fromNode || !toNode) continue;

    const fromName = fromNode.station_name;
    const toName   = toNode.station_name;

    if (!adjacency.has(fromName)) adjacency.set(fromName, new Set());
    if (!adjacency.has(toName))   adjacency.set(toName,   new Set());

    adjacency.get(fromName).add(toName);
    adjacency.get(toName).add(fromName);
  }

  return { adjacency, nodeByName };
}

// ─────────────────────────────────────────────────────────────────────────────
// 連結成分検出（Union-Find）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union-Find データ構造
 */
class UnionFind {
  constructor(nodes) {
    this.parent = new Map();
    this.rank   = new Map();
    for (const n of nodes) {
      this.parent.set(n, n);
      this.rank.set(n, 0);
    }
  }

  find(x) {
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)));
    }
    return this.parent.get(x);
  }

  union(x, y) {
    const px = this.find(x);
    const py = this.find(y);
    if (px === py) return;
    if ((this.rank.get(px) || 0) < (this.rank.get(py) || 0)) {
      this.parent.set(px, py);
    } else if ((this.rank.get(px) || 0) > (this.rank.get(py) || 0)) {
      this.parent.set(py, px);
    } else {
      this.parent.set(py, px);
      this.rank.set(px, (this.rank.get(px) || 0) + 1);
    }
  }

  getComponents(nodes) {
    const components = new Map();
    for (const n of nodes) {
      const root = this.find(n);
      if (!components.has(root)) components.set(root, []);
      components.get(root).push(n);
    }
    return [...components.values()];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// コアスコアリング関数（mapState ベース）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mapState からプレイヤーの占有駅名リストを取得する。
 *
 * @param {Object} mapState   - { "LC-order": playerIdx | -1 }
 * @param {number} playerIdx  - 対象プレイヤーのインデックス
 * @param {Object} packData   - pack_loader.js の PackData
 * @returns {{ stationNames: string[], stationLineMap: Map<string, string[]> }}
 */
function getOwnedStationNames(mapState, playerIdx, packData) {
  // lc → route のマップを構築
  const routeByLc = new Map();
  for (const route of packData.routes) {
    routeByLc.set(route.lc, route);
  }

  const stationNames = [];
  const stationLineMap = new Map(); // station_name → [lc, ...]

  for (const [key, owner] of Object.entries(mapState)) {
    if (owner !== playerIdx) continue;
    const dashIdx = key.lastIndexOf('-');
    if (dashIdx === -1) continue;
    const lc    = key.slice(0, dashIdx);
    const order = parseInt(key.slice(dashIdx + 1), 10);
    if (isNaN(order)) continue;

    const route = routeByLc.get(lc);
    if (!route) continue;

    const member = route.members[order - 1];
    if (!member) continue;

    // ★プレフィックスを除去した駅名
    const rawName = (member.name_ja || '').replace(/^★+/, '').trim();
    if (!rawName) continue;

    if (!stationNames.includes(rawName)) {
      stationNames.push(rawName);
    }

    if (!stationLineMap.has(rawName)) stationLineMap.set(rawName, []);
    const lines = stationLineMap.get(rawName);
    if (!lines.includes(lc)) lines.push(lc);
  }

  return { stationNames, stationLineMap };
}

/**
 * Network Score を計算する（mapState ベース）。
 *
 * @param {Object} mapState      - { "LC-order": playerIdx | -1 }
 * @param {number} playerIdx     - 対象プレイヤーのインデックス
 * @param {Object} packData      - pack_loader.js の PackData
 * @param {Object} stationGraph  - station_graph_tokyo.json の内容
 * @returns {Object} Network Score 結果
 */
export function computeNetworkScoreFromMapState(mapState, playerIdx, packData, stationGraph) {
  if (!mapState || !packData || !stationGraph) {
    return {
      network_bonus: 0,
      components: [],
      total_connected_stations: 0,
      max_component_size: 0,
    };
  }

  // 1. プレイヤーの占有駅名を取得
  const { stationNames, stationLineMap } = getOwnedStationNames(mapState, playerIdx, packData);

  if (stationNames.length === 0) {
    return {
      network_bonus: 0,
      components: [],
      total_connected_stations: 0,
      max_component_size: 0,
    };
  }

  // 2. グラフの隣接リストを構築
  const { adjacency } = buildAdjacencyFromGraph(stationGraph);

  // 3. プレイヤーの占有駅のみを対象とした Union-Find
  const uf = new UnionFind(stationNames);

  for (const name of stationNames) {
    const neighbors = adjacency.get(name) || new Set();
    for (const neighbor of neighbors) {
      if (stationNames.includes(neighbor)) {
        uf.union(name, neighbor);
      }
    }
  }

  // 4. 連結成分を取得
  const rawComponents = uf.getComponents(stationNames);

  // 5. 各成分のボーナスを計算
  let totalBonus = 0;
  const componentDetails = [];

  for (const component of rawComponents) {
    const size = component.length;
    const sizeBonus = getNetworkSizeBonus(size);

    // 成分内の路線数を集計
    const linesInComponent = new Set();
    for (const name of component) {
      const lines = stationLineMap.get(name) || [];
      for (const lc of lines) linesInComponent.add(lc);
    }
    const crossBonus = getCrossLineBonus(linesInComponent.size);

    const componentBonus = sizeBonus + crossBonus;
    totalBonus += componentBonus;

    componentDetails.push({
      stations:     component.sort(),
      size,
      lines:        [...linesInComponent].sort(),
      line_count:   linesInComponent.size,
      size_bonus:   sizeBonus,
      cross_bonus:  crossBonus,
      total_bonus:  componentBonus,
    });
  }

  // 成分をボーナス降順でソート
  componentDetails.sort((a, b) => b.total_bonus - a.total_bonus);

  const connectedStations = stationNames.filter(n => {
    const comp = componentDetails.find(c => c.stations.includes(n));
    return comp && comp.size >= 2;
  });

  return {
    network_bonus:            totalBonus,
    components:               componentDetails,
    total_connected_stations: connectedStations.length,
    max_component_size:       componentDetails.length > 0 ? componentDetails[0].size : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 非同期版（ブラウザ向け）
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_GRAPH_PATH = '../../data/graph/station_graph_tokyo.json';

let _graphCache = null;

/**
 * 非同期版：station_graph を fetch して Network Score を計算する。
 *
 * @param {Object} mapState
 * @param {number} playerIdx
 * @param {Object} packData
 * @param {Object} [options]
 * @param {Object} [options.stationGraph] - Pre-loaded graph data
 * @param {string} [options.baseUrl]
 * @returns {Promise<Object>}
 */
export async function computeNetworkScore(mapState, playerIdx, packData, options = {}) {
  const stationGraph = options.stationGraph || await (async () => {
    if (_graphCache) return _graphCache;
    const url = options.baseUrl
      ? `${options.baseUrl}data/graph/station_graph_tokyo.json`
      : DEFAULT_GRAPH_PATH;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load station_graph_tokyo.json');
    _graphCache = await res.json();
    return _graphCache;
  })();

  return computeNetworkScoreFromMapState(mapState, playerIdx, packData, stationGraph);
}
