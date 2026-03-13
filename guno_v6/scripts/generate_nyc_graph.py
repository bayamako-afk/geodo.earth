"""
generate_nyc_graph.py
Generate station_graph.json for NYC.
Builds edges from ordered station sequences per line (adjacent pairs).
"""
import json, math, os

MASTER_DIR = "cities/nyc/data/master"
OUT_DIR    = "cities/nyc/data/graph"
os.makedirs(OUT_DIR, exist_ok=True)

with open(f"{MASTER_DIR}/stations_master.json", encoding="utf-8") as f:
    stations = json.load(f)
with open(f"{MASTER_DIR}/station_lines.json", encoding="utf-8") as f:
    station_lines_data = json.load(f)
with open(f"{MASTER_DIR}/lines_master.json", encoding="utf-8") as f:
    lines = json.load(f)

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2)
    return R * 2 * math.asin(math.sqrt(a))

id_to_station = {s["station_global_id"]: s for s in stations}

# Build per-line ordered station lists
line_stations = {}  # line_id -> [(order, gid), ...]
for row in station_lines_data:
    lid = row["line_id"]
    if lid not in line_stations:
        line_stations[lid] = []
    line_stations[lid].append((row["order_in_line"], row["station_global_id"]))

for lid in line_stations:
    line_stations[lid].sort(key=lambda x: x[0])

# Build edges from adjacent pairs in each line
edges = {}
for lid, ordered in line_stations.items():
    for i in range(len(ordered) - 1):
        _, sid1 = ordered[i]
        _, sid2 = ordered[i + 1]
        key = tuple(sorted([sid1, sid2]))
        if key not in edges:
            s1 = id_to_station[sid1]
            s2 = id_to_station[sid2]
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

# Build station → line_ids mapping
station_line_ids = {}
for row in station_lines_data:
    gid = row["station_global_id"]
    if gid not in station_line_ids:
        station_line_ids[gid] = []
    if row["line_id"] not in station_line_ids[gid]:
        station_line_ids[gid].append(row["line_id"])

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
        "line_ids": station_line_ids.get(sid, []),
        "degree": len(neighbor_ids),
        "neighbors": neighbor_ids,
    })

graph = {
    "graph_meta": {
        "city_id": "nyc",
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
# Show high-degree nodes (transfer hubs)
high_degree = sorted(nodes, key=lambda n: -n["degree"])[:10]
print("Top 10 hub stations by degree:")
for n in high_degree:
    print(f"  {n['station_name_en']} ({n['station_global_id']}) deg={n['degree']} lines={n['line_ids']}")
