"""
generate_paris_metrics.py
Generate station_metrics.json and line_metrics.json for Paris RATP Métro.
Uses composite_score (hub_score * 0.6 + centrality_score * 0.4) and
also generates score_total (same as composite_score scaled to Tokyo range).
"""
import json, csv, os

MASTER_DIR  = "cities/paris/data/master"
GRAPH_DIR   = "cities/paris/data/graph"
OUT_DIR     = "cities/paris/data/derived"
os.makedirs(OUT_DIR, exist_ok=True)

with open(f"{MASTER_DIR}/stations_master.json", encoding="utf-8") as f:
    stations = json.load(f)
with open(f"{MASTER_DIR}/station_lines.json", encoding="utf-8") as f:
    station_lines_raw = json.load(f)
with open(f"{MASTER_DIR}/lines_master.json", encoding="utf-8") as f:
    lines = json.load(f)
with open(f"{GRAPH_DIR}/station_graph.json", encoding="utf-8") as f:
    graph = json.load(f)

id_to_node = {n["station_global_id"]: n for n in graph["nodes"]}
degrees = {n["station_global_id"]: n["degree"] for n in graph["nodes"]}

def norm(val, lo, hi):
    if hi == lo:
        return 0.0
    return (val - lo) / (hi - lo)

raw = []
for s in stations:
    sid = s["station_global_id"]
    lc = s["line_count"]
    degree = degrees.get(sid, 0)
    raw.append({"sid": sid, "lc": lc, "degree": degree})

max_lc     = max(r["lc"] for r in raw) if raw else 1
max_degree = max(r["degree"] for r in raw) if raw else 1

station_metrics_list = []
for s in stations:
    sid = s["station_global_id"]
    lc     = s["line_count"]
    degree = degrees.get(sid, 0)
    hub_score        = round(norm(lc, 1, max_lc) * 5.0, 4)
    centrality_score = round(norm(degree, 0, max_degree) * 5.0, 4)
    composite_score  = round(hub_score * 0.6 + centrality_score * 0.4, 4)
    # score_total: scale composite_score to Tokyo range (0-18)
    # Paris max composite is 5.0, Tokyo max score_total is ~18
    # Use a 3.5x multiplier to get a similar range
    score_total = round(composite_score * 3.5, 4)
    station_metrics_list.append({
        "station_global_id": sid,
        "station_name": s["station_name"],
        "station_name_en": s["station_name_en"],
        "station_slug": s["station_slug"],
        "line_ids": s["line_ids"],
        "line_count": lc,
        "hub_score": hub_score,
        "centrality_score": centrality_score,
        "composite_score": composite_score,
        "score_total": score_total,
        "rarity": "common",  # placeholder
        "degree": degree,
    })

# Percentile-based rarity assignment
all_scores = sorted([m["composite_score"] for m in station_metrics_list])
n = len(all_scores)
p95 = all_scores[int(n * 0.95)]
p80 = all_scores[int(n * 0.80)]
p60 = all_scores[int(n * 0.60)]

for m in station_metrics_list:
    s = m["composite_score"]
    if s >= p95:
        m["rarity"] = "legendary"
    elif s >= p80:
        m["rarity"] = "epic"
    elif s >= p60:
        m["rarity"] = "rare"
    else:
        m["rarity"] = "common"

# Also assign rank
station_metrics_list.sort(key=lambda x: -x["score_total"])
for i, m in enumerate(station_metrics_list):
    m["rank"] = i + 1

# ── Build line_metrics ────────────────────────────────────────────────────────
id_to_metrics = {m["station_global_id"]: m for m in station_metrics_list}

line_metrics_list = []
for line in lines:
    lid = line["line_id"]
    line_stations = [s for s in stations if lid in s["line_ids"]]
    if not line_stations:
        continue
    scores = [id_to_metrics.get(s["station_global_id"], {}).get("composite_score", 0) for s in line_stations]
    avg_score = round(sum(scores) / len(scores), 4) if scores else 0
    max_score = round(max(scores), 4) if scores else 0
    transfer_count = sum(1 for s in line_stations if s["line_count"] > 1)
    line_metrics_list.append({
        "line_id": lid,
        "line_name": line["line_name"],
        "line_name_en": line["line_name_en"],
        "color": line["color"],
        "is_loop": line["is_loop"],
        "station_count": len(line_stations),
        "transfer_count": transfer_count,
        "avg_composite_score": avg_score,
        "max_composite_score": max_score,
        "line_strength_score": round(avg_score * 0.7 + max_score * 0.3, 4),
    })

line_metrics_list.sort(key=lambda x: -x["line_strength_score"])

# ── Write JSON ────────────────────────────────────────────────────────────────
station_metrics = {
    "dataset_meta": {
        "city_id": "paris",
        "version": "1.0",
        "station_count": len(station_metrics_list),
    },
    "stations": station_metrics_list,
}
line_metrics = {
    "dataset_meta": {
        "city_id": "paris",
        "version": "1.0",
        "line_count": len(line_metrics_list),
    },
    "lines": line_metrics_list,
}

with open(f"{OUT_DIR}/station_metrics.json", "w", encoding="utf-8") as f:
    json.dump(station_metrics, f, ensure_ascii=False, indent=2)
with open(f"{OUT_DIR}/line_metrics.json", "w", encoding="utf-8") as f:
    json.dump(line_metrics, f, ensure_ascii=False, indent=2)

# ── Write CSV ─────────────────────────────────────────────────────────────────
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
from collections import Counter
rarity_dist = Counter(m["rarity"] for m in station_metrics_list)
print(f"rarity distribution: {dict(rarity_dist)}")
print("Top 10 stations:")
for m in station_metrics_list[:10]:
    print(f"  [{m['rank']}] {m['station_name_en']} ({', '.join(m['line_ids'])}) score_total={m['score_total']} composite={m['composite_score']} rarity={m['rarity']}")
print(f"\nScore range: {min(m['score_total'] for m in station_metrics_list):.2f} - {max(m['score_total'] for m in station_metrics_list):.2f}")
print(f"Avg score_total: {sum(m['score_total'] for m in station_metrics_list)/len(station_metrics_list):.2f}")
