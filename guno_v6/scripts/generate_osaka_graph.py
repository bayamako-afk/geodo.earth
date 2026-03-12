"""
generate_osaka_graph.py
Build station_graph.json for Osaka from master data.

Schema matches Tokyo:
  { nodes: [...], edges: [...], graph_statistics: {...} }
"""

import json, os
from datetime import datetime, timezone

ROOT = os.path.join(os.path.dirname(__file__), '..')
MASTER_DIR = os.path.join(ROOT, 'cities', 'osaka', 'data', 'master')
GRAPH_DIR  = os.path.join(ROOT, 'cities', 'osaka', 'data', 'graph')
os.makedirs(GRAPH_DIR, exist_ok=True)

# ── Load master data ──────────────────────────────────────────────────────────

with open(os.path.join(MASTER_DIR, 'stations_master.json'), encoding='utf-8') as f:
    stations = json.load(f)

with open(os.path.join(MASTER_DIR, 'station_lines.json'), encoding='utf-8') as f:
    station_lines = json.load(f)

with open(os.path.join(MASTER_DIR, 'lines_master.json'), encoding='utf-8') as f:
    lines_master = json.load(f)

# ── Build nodes ───────────────────────────────────────────────────────────────

nodes = []
for st in stations:
    nodes.append({
        "node_id": st["station_global_id"],
        "station_global_id": st["station_global_id"],
        "station_name": st["station_name"],
        "station_slug": st["station_slug"],
        "lat": st["lat"],
        "lon": st["lon"],
        "line_count": st["line_count"],
        "hub_degree_global": st["hub_degree_global"],
    })

# ── Build edges (directed adjacency from station_lines) ───────────────────────

edges = []
seen_edges = set()

for sl in station_lines:
    from_id = sl["station_global_id"]
    to_id   = sl["adjacent_next_station_id"]
    if to_id is None:
        continue
    edge_key = (sl["line_id"], from_id, to_id)
    if edge_key in seen_edges:
        continue
    seen_edges.add(edge_key)

    line_obj = next((l for l in lines_master if l["line_id"] == sl["line_id"]), {})
    edge_id = f"{sl['line_id']}_{from_id}_{to_id}"
    edges.append({
        "edge_id": edge_id,
        "from": from_id,
        "to": to_id,
        "line_id": sl["line_id"],
        "line_name": sl["line_name"],
        "operator_name": sl["operator_name"],
    })

# ── Graph statistics ──────────────────────────────────────────────────────────

# Count transfer stations (line_count > 1)
transfer_count = sum(1 for st in stations if st["line_count"] > 1)

# Degree distribution
degree_dist = {}
for st in stations:
    d = str(st["line_count"])
    degree_dist[d] = degree_dist.get(d, 0) + 1

graph_statistics = {
    "node_count": len(nodes),
    "edge_count": len(edges),
    "transfer_station_count": transfer_count,
    "line_count": len(lines_master),
    "degree_distribution": degree_dist,
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "city": "osaka",
}

# ── Write output ──────────────────────────────────────────────────────────────

graph = {
    "nodes": nodes,
    "edges": edges,
    "graph_statistics": graph_statistics,
}

out_path = os.path.join(GRAPH_DIR, 'station_graph.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(graph, f, ensure_ascii=False, indent=2)

print(f"station_graph.json written: {len(nodes)} nodes, {len(edges)} edges")
print(f"Transfer stations: {transfer_count}")
print(f"Degree distribution: {degree_dist}")
