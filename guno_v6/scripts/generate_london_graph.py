"""
generate_london_graph.py
Generate station_graph.json for London.
"""
import json, math, os

MASTER_DIR = "cities/london/data/master"
OUT_DIR    = "cities/london/data/graph"
os.makedirs(OUT_DIR, exist_ok=True)

with open(f"{MASTER_DIR}/stations_master.json", encoding="utf-8") as f:
    stations = json.load(f)
with open(f"{MASTER_DIR}/station_lines.json", encoding="utf-8") as f:
    station_lines = json.load(f)
with open(f"{MASTER_DIR}/lines_master.json", encoding="utf-8") as f:
    lines = json.load(f)

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

# Build lookup
id_to_station = {s["station_global_id"]: s for s in stations}

# Build edges from adjacent pairs in station_lines
edges = {}
for row in station_lines:
    sid = row["station_global_id"]
    lid = row["line_id"]
    for neighbor_id in [row["adjacent_prev_station_id"], row["adjacent_next_station_id"]]:
        if neighbor_id is None:
            continue
        key = tuple(sorted([sid, neighbor_id]))
        if key not in edges:
            s1 = id_to_station[sid]
            s2 = id_to_station[neighbor_id]
            dist = haversine(s1["lat"], s1["lon"], s2["lat"], s2["lon"])
            edges[key] = {
                "from": key[0],
                "to": key[1],
                "line_ids": [],
                "distance_km": round(dist, 3),
                "weight": round(1.0 / max(dist, 0.1), 4),
            }
        if lid not in edges[key]["line_ids"]:
            edges[key]["line_ids"].append(lid)

edge_list = list(edges.values())

# Build nodes
nodes = []
for s in stations:
    sid = s["station_global_id"]
    neighbor_edges = [e for e in edge_list if e["from"] == sid or e["to"] == sid]
    neighbor_ids = []
    for e in neighbor_edges:
        other = e["to"] if e["from"] == sid else e["from"]
        if other not in neighbor_ids:
            neighbor_ids.append(other)
    nodes.append({
        "station_global_id": sid,
        "station_name": s["station_name"],
        "station_name_en": s["station_name_en"],
        "lat": s["lat"],
        "lon": s["lon"],
        "line_ids": s["line_ids"],
        "degree": len(neighbor_ids),
        "neighbors": neighbor_ids,
    })

graph = {
    "graph_meta": {
        "city_id": "london",
        "version": "1.0",
        "node_count": len(nodes),
        "edge_count": len(edge_list),
    },
    "nodes": nodes,
    "edges": edge_list,
}

with open(f"{OUT_DIR}/station_graph.json", "w", encoding="utf-8") as f:
    json.dump(graph, f, ensure_ascii=False, indent=2)

print(f"station_graph: {len(nodes)} nodes, {len(edge_list)} edges")
