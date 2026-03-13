"""
generate_nyc_metrics.py
Generate station_metrics.json and line_metrics.json for NYC.
Schema aligned with Tokyo / Osaka / London.
"""
import json, csv, os
from collections import defaultdict, Counter

MASTER_DIR  = "cities/nyc/data/master"
GRAPH_DIR   = "cities/nyc/data/graph"
OUT_DIR     = "cities/nyc/data/derived"
os.makedirs(OUT_DIR, exist_ok=True)

with open(f"{MASTER_DIR}/stations_master.json", encoding="utf-8") as f:
    stations = json.load(f)
with open(f"{MASTER_DIR}/station_lines.json", encoding="utf-8") as f:
    station_lines_data = json.load(f)
with open(f"{MASTER_DIR}/lines_master.json", encoding="utf-8") as f:
    lines = json.load(f)
with open(f"{GRAPH_DIR}/station_graph.json", encoding="utf-8") as f:
    graph = json.load(f)

id_to_station = {s["station_global_id"]: s for s in stations}
id_to_node    = {n["station_global_id"]: n for n in graph["nodes"]}

# ── Per-station line count and line_ids
station_line_ids   = defaultdict(list)
station_line_count = defaultdict(int)
for row in station_lines_data:
    gid = row["station_global_id"]
    lid = row["line_id"]
    if lid not in station_line_ids[gid]:
        station_line_ids[gid].append(lid)
    station_line_count[gid] += 1

# ── Degree from graph
degrees = {n["station_global_id"]: n["degree"] for n in graph["nodes"]}
max_degree = max(degrees.values()) if degrees else 1
max_lc     = max(station_line_count.values()) if station_line_count else 1

def norm(val, lo, hi):
    if hi == lo:
        return 0.0
    return (val - lo) / (hi - lo)

# ── Build station_metrics
station_metrics_list = []
for s in stations:
    sid   = s["station_global_id"]
    lc    = station_line_count.get(sid, 1)
    deg   = degrees.get(sid, 0)
    lids  = station_line_ids.get(sid, [])

    hub_score        = round(norm(lc, 1, max_lc) * 5.0, 4)
    centrality_score = round(norm(deg, 0, max_degree) * 5.0, 4)
    composite_score  = round(hub_score * 0.6 + centrality_score * 0.4, 4)

    station_metrics_list.append({
        "station_global_id": sid,
        "station_name": s["station_name"],
        "station_name_en": s["station_name_en"],
        "line_ids": lids,
        "line_count": lc,
        "hub_score": hub_score,
        "centrality_score": centrality_score,
        "composite_score": composite_score,
        "rarity": "common",  # placeholder
        "degree": deg,
    })

# Percentile-based rarity assignment
all_scores = sorted([m["composite_score"] for m in station_metrics_list])
n = len(all_scores)
p95 = all_scores[int(n * 0.95)]
p80 = all_scores[int(n * 0.80)]
p60 = all_scores[int(n * 0.60)]
for m in station_metrics_list:
    sc = m["composite_score"]
    if sc >= p95:
        m["rarity"] = "legendary"
    elif sc >= p80:
        m["rarity"] = "epic"
    elif sc >= p60:
        m["rarity"] = "rare"
    else:
        m["rarity"] = "common"

station_metrics_list.sort(key=lambda x: -x["composite_score"])

# ── Build line_metrics
line_metrics_list = []
for line in lines:
    lid = line["line_id"]
    ls  = [s for s in stations if lid in station_line_ids.get(s["station_global_id"], [])]
    if not ls:
        continue
    scores = [next((m["composite_score"] for m in station_metrics_list
                    if m["station_global_id"] == s["station_global_id"]), 0) for s in ls]
    avg_score = round(sum(scores) / len(scores), 4) if scores else 0
    max_score = round(max(scores), 4) if scores else 0
    transfer_count = sum(1 for s in ls if station_line_count.get(s["station_global_id"], 1) > 1)
    line_metrics_list.append({
        "line_id": lid,
        "line_name": line["line_name"],
        "color": line["color"],
        "station_count": len(ls),
        "transfer_count": transfer_count,
        "avg_composite_score": avg_score,
        "max_composite_score": max_score,
        "line_strength_score": round(avg_score * 0.7 + max_score * 0.3, 4),
    })

line_metrics_list.sort(key=lambda x: -x["line_strength_score"])

# ── Write JSON
station_metrics = {
    "dataset_meta": {
        "city_id": "nyc",
        "version": "1.0",
        "station_count": len(station_metrics_list),
    },
    "stations": station_metrics_list,
}
line_metrics = {
    "dataset_meta": {
        "city_id": "nyc",
        "version": "1.0",
        "line_count": len(line_metrics_list),
    },
    "lines": line_metrics_list,
}

with open(f"{OUT_DIR}/station_metrics.json", "w", encoding="utf-8") as f:
    json.dump(station_metrics, f, ensure_ascii=False, indent=2)
with open(f"{OUT_DIR}/line_metrics.json", "w", encoding="utf-8") as f:
    json.dump(line_metrics, f, ensure_ascii=False, indent=2)

# ── Write CSV
sm_fields = list(station_metrics_list[0].keys())
with open(f"{OUT_DIR}/station_metrics.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=sm_fields)
    w.writeheader()
    for row in station_metrics_list:
        w.writerow({k: ("|".join(v) if isinstance(v, list) else v) for k, v in row.items()})

lm_fields = list(line_metrics_list[0].keys())
with open(f"{OUT_DIR}/line_metrics.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=lm_fields)
    w.writeheader()
    for row in line_metrics_list:
        w.writerow(row)

print(f"station_metrics: {len(station_metrics_list)} stations")
print(f"line_metrics: {len(line_metrics_list)} lines")
rarity_dist = Counter(m["rarity"] for m in station_metrics_list)
print(f"rarity distribution: {dict(rarity_dist)}")
print("Top 10 stations by composite_score:")
for m in station_metrics_list[:10]:
    print(f"  {m['station_name_en']} ({', '.join(m['line_ids'])}) score={m['composite_score']} rarity={m['rarity']}")
print("Line strength ranking:")
for l in line_metrics_list:
    print(f"  {l['line_id']} {l['line_name']}: strength={l['line_strength_score']} stations={l['station_count']} transfers={l['transfer_count']}")
