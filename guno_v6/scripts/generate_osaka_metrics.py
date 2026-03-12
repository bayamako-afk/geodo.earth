"""
generate_osaka_metrics.py
Compute station_metrics.json and line_metrics.json for Osaka.

Score formula (matches Tokyo):
  score_total = degree*1.0 + line_count*1.5 + hub_score*1.5 + betweenness*10.0

Betweenness is computed via BFS on the undirected adjacency graph.
"""

import json, csv, os, math
from datetime import datetime, timezone
from collections import deque

ROOT = os.path.join(os.path.dirname(__file__), '..')
MASTER_DIR  = os.path.join(ROOT, 'cities', 'osaka', 'data', 'master')
GRAPH_DIR   = os.path.join(ROOT, 'cities', 'osaka', 'data', 'graph')
DERIVED_DIR = os.path.join(ROOT, 'cities', 'osaka', 'data', 'derived')
os.makedirs(DERIVED_DIR, exist_ok=True)

# ── Load data ─────────────────────────────────────────────────────────────────

with open(os.path.join(GRAPH_DIR, 'station_graph.json'), encoding='utf-8') as f:
    graph_data = json.load(f)

with open(os.path.join(MASTER_DIR, 'stations_master.json'), encoding='utf-8') as f:
    stations_master = json.load(f)

with open(os.path.join(MASTER_DIR, 'lines_master.json'), encoding='utf-8') as f:
    lines_master = json.load(f)

with open(os.path.join(MASTER_DIR, 'station_lines.json'), encoding='utf-8') as f:
    station_lines = json.load(f)

nodes = graph_data['nodes']
edges = graph_data['edges']

node_ids = [n['node_id'] for n in nodes]
node_idx = {nid: i for i, nid in enumerate(node_ids)}
N = len(node_ids)

# ── Build undirected adjacency list ───────────────────────────────────────────

adj = {nid: set() for nid in node_ids}
for e in edges:
    adj[e['from']].add(e['to'])
    adj[e['to']].add(e['from'])

# ── Betweenness centrality (Brandes algorithm, unweighted) ───────────────────

betweenness = {nid: 0.0 for nid in node_ids}

for s in node_ids:
    stack = []
    pred  = {w: [] for w in node_ids}
    sigma = {w: 0.0 for w in node_ids}
    dist  = {w: -1  for w in node_ids}
    sigma[s] = 1.0
    dist[s]  = 0
    queue = deque([s])
    while queue:
        v = queue.popleft()
        stack.append(v)
        for w in adj[v]:
            if dist[w] < 0:
                queue.append(w)
                dist[w] = dist[v] + 1
            if dist[w] == dist[v] + 1:
                sigma[w] += sigma[v]
                pred[w].append(v)
    delta = {w: 0.0 for w in node_ids}
    while stack:
        w = stack.pop()
        for v in pred[w]:
            if sigma[w] > 0:
                delta[v] += (sigma[v] / sigma[w]) * (1.0 + delta[w])
        if w != s:
            betweenness[w] += delta[w]

# Normalize (undirected: divide by (N-1)(N-2))
norm = (N - 1) * (N - 2) if N > 2 else 1.0
for nid in node_ids:
    betweenness[nid] = round(betweenness[nid] / norm, 6)

# ── Build station_metrics ─────────────────────────────────────────────────────

station_map = {st['station_global_id']: st for st in stations_master}

metrics = []
for n in nodes:
    nid = n['node_id']
    st  = station_map.get(nid, {})
    degree     = len(adj[nid])
    line_count = n['line_count']
    hub_score  = line_count  # simple hub score = number of lines
    bw         = betweenness[nid]
    score      = round(degree * 1.0 + line_count * 1.5 + hub_score * 1.5 + bw * 10.0, 4)
    metrics.append({
        "station_global_id": nid,
        "station_name":  n['station_name'],
        "station_slug":  n['station_slug'],
        "degree":        degree,
        "line_count":    line_count,
        "hub_score":     hub_score,
        "betweenness":   bw,
        "score_total":   score,
        "rank":          0,  # filled below
    })

# Sort by score descending, assign rank
metrics.sort(key=lambda x: -x['score_total'])
for i, m in enumerate(metrics):
    m['rank'] = i + 1

# ── Write station_metrics.json ────────────────────────────────────────────────

dataset_meta = {
    "version": "1.0",
    "city": "osaka",
    "source_graph": "station_graph.json",
    "node_count": N,
    "edge_count": len(edges),
    "score_formula": {
        "degree": 1.0,
        "line_count": 1.5,
        "hub_score": 1.5,
        "betweenness": 10.0,
    },
    "top_station": metrics[0]['station_name'],
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}

out = {"dataset_meta": dataset_meta, "stations": metrics}
with open(os.path.join(DERIVED_DIR, 'station_metrics.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"station_metrics.json: {len(metrics)} stations")
print(f"Top 5: {[(m['station_name'], m['score_total']) for m in metrics[:5]]}")

# ── CSV companion ─────────────────────────────────────────────────────────────

with open(os.path.join(DERIVED_DIR, 'station_metrics.csv'), 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'rank','station_global_id','station_name','station_slug',
        'degree','line_count','hub_score','betweenness','score_total'
    ])
    writer.writeheader()
    writer.writerows(metrics)
print("station_metrics.csv written")

# ── Build line_metrics ────────────────────────────────────────────────────────

# Build per-line station sets
line_stations = {l['line_id']: [] for l in lines_master}
for sl in station_lines:
    lid = sl['line_id']
    if lid in line_stations:
        line_stations[lid].append(sl['station_global_id'])

# Build metrics map for quick lookup
metrics_map = {m['station_global_id']: m for m in metrics}

line_metrics_list = []
for line_obj in lines_master:
    lid = line_obj['line_id']
    sids = list(dict.fromkeys(line_stations[lid]))  # deduplicate preserving order
    station_count = len(sids)
    transfer_count = sum(1 for sid in sids if station_map.get(sid, {}).get('line_count', 1) > 1)
    terminal_count = 0 if line_obj['is_loop'] else 2

    scores = [metrics_map[sid]['score_total'] for sid in sids if sid in metrics_map]
    hub_score_sum = round(sum(scores), 4)
    avg_score     = round(hub_score_sum / len(scores), 4) if scores else 0.0

    # line_strength formula (matches Tokyo)
    line_strength = round(
        station_count * 0.5 +
        transfer_count * 2.0 +
        hub_score_sum * 0.3 +
        avg_score * 0.5,
        4
    )
    line_difficulty = round(
        station_count * 0.4 -
        transfer_count * 1.5 -
        terminal_count * 0.3,
        4
    )

    line_metrics_list.append({
        "line_id": lid,
        "line_name": line_obj['line_name'],
        "line_name_en": line_obj['line_name_en'],
        "operator_name": line_obj['operator_name'],
        "color": line_obj['color'],
        "is_loop": line_obj['is_loop'],
        "station_count": station_count,
        "transfer_station_count": transfer_count,
        "terminal_count": terminal_count,
        "hub_score_sum": hub_score_sum,
        "avg_station_score": avg_score,
        "line_strength": line_strength,
        "line_difficulty": line_difficulty,
    })

# Sort by line_strength descending
line_metrics_list.sort(key=lambda x: -x['line_strength'])

dataset_meta_lm = {
    "version": "1.0",
    "region": "osaka",
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "source_files": [
        "cities/osaka/data/master/lines_master.json",
        "cities/osaka/data/master/station_lines.json",
        "cities/osaka/data/derived/station_metrics.json",
    ],
    "formula": {
        "line_strength": "station_count*0.5 + transfer_count*2.0 + hub_score_sum*0.3 + avg_score*0.5",
        "line_difficulty": "station_count*0.4 - transfer_count*1.5 - terminal_count*0.3",
    },
    "total_lines": len(line_metrics_list),
}

validation = {
    "total_lines": len(line_metrics_list),
    "total_stations_covered": len(set(sid for sids in line_stations.values() for sid in sids)),
}

out_lm = {
    "dataset_meta": dataset_meta_lm,
    "validation": validation,
    "lines": line_metrics_list,
}

with open(os.path.join(DERIVED_DIR, 'line_metrics.json'), 'w', encoding='utf-8') as f:
    json.dump(out_lm, f, ensure_ascii=False, indent=2)
print(f"line_metrics.json: {len(line_metrics_list)} lines")

with open(os.path.join(DERIVED_DIR, 'line_metrics.csv'), 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'line_id','line_name','line_name_en','operator_name','color','is_loop',
        'station_count','transfer_station_count','terminal_count','hub_score_sum',
        'avg_station_score','line_strength','line_difficulty'
    ])
    writer.writeheader()
    writer.writerows(line_metrics_list)
print("line_metrics.csv written")

print("\nLine metrics summary:")
for lm in line_metrics_list:
    print(f"  {lm['line_id']:4s} {lm['line_name']:14s} strength={lm['line_strength']:.2f}  stations={lm['station_count']}")
