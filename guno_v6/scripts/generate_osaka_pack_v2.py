"""
generate_osaka_pack_v2.py
Regenerate Osaka pack_v1.json using the same schema as Tokyo pack_v1.json.

Tokyo schema:
  pack_meta: { pack_version, pack_id, name, description, generated_by, generated_at }
  entities:  { station_code: { type, name_ja, name_en, station_code, cross_lines } }
  collections: { lc: { kind, lc, name_ja, name_en, color, size, members: [station_code, ...] } }
  layouts:   {}
  rules:     { deck_size, hand_size, guno_threshold, max_players }
"""

import json
from datetime import date
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
OSAKA = ROOT / 'cities' / 'osaka' / 'data'

# ── Load master data ──────────────────────────────────────────────────────────

with open(OSAKA / 'master' / 'stations_master.json') as f:
    stations_list = json.load(f)  # list of station dicts

with open(OSAKA / 'master' / 'station_lines.json') as f:
    station_lines = json.load(f)  # list of { station_global_id, line_id, order_on_line, ... }

with open(OSAKA / 'master' / 'lines_master.json') as f:
    lines_list = json.load(f)  # list of { line_id, line_name, line_name_en, color, station_count, ... }

# ── Build lookup maps ─────────────────────────────────────────────────────────

# station_global_id → station dict
station_by_id = { s['station_global_id']: s for s in stations_list }

# line_id → line dict
line_by_id = { l['line_id']: l for l in lines_list }

# line_id → sorted list of (order_on_line, station_global_id)
line_to_slots = defaultdict(list)
for row in station_lines:
    line_to_slots[row['line_id']].append((row['order_on_line'], row['station_global_id']))
for lc in line_to_slots:
    line_to_slots[lc].sort(key=lambda x: x[0])

# ── Build entities ────────────────────────────────────────────────────────────
# station_code format: lowercase(line_id) + zero-padded order, e.g. m01, m02
# For transfer stations, include cross_lines

# Build station_global_id → list of (line_id, order) for cross-line detection
station_to_lines = defaultdict(list)
for row in station_lines:
    station_to_lines[row['station_global_id']].append(row['line_id'])

entities = {}
# We'll assign station_code per line slot; for transfer stations, use the first line's code
# But entities should be unique per station (not per slot)
# Use station_global_id as key, pick a canonical station_code

# First pass: assign canonical station_code (first line alphabetically + order)
station_canonical_code = {}
for lc in sorted(line_to_slots.keys()):
    for order, gid in line_to_slots[lc]:
        if gid not in station_canonical_code:
            station_canonical_code[gid] = f"{lc.lower()}{order:02d}"

# Build entities
for gid, station in station_by_id.items():
    code = station_canonical_code.get(gid, gid)
    cross = [l for l in station_to_lines[gid] if l != station_to_lines[gid][0]]
    entities[code] = {
        "type":         "station",
        "name_ja":      station['station_name'],
        "name_en":      station.get('station_name_en', station['station_name']),
        "station_code": code,
        "cross_lines":  list(set(station_to_lines[gid]) - {station_to_lines[gid][0]})
    }

# ── Build collections ─────────────────────────────────────────────────────────
# IMPORTANT: ROUTE_SIZE = 10 is hardcoded in the game engine (rules.js).
# All collections must use size=10 and exactly 10 members.
# For lines with more than 10 stations, we select the 10 most representative
# stations (hub stations prioritized, then evenly spaced).

ROUTE_SIZE = 10

# Load station metrics for hub-aware selection
try:
    with open(OSAKA / 'derived' / 'station_metrics.json') as f:
        metrics_data = json.load(f)
    # station_global_id -> composite_score
    station_score = {}
    for s in metrics_data.get('stations', []):
        station_score[s.get('station_global_id', '')] = s.get('composite_score', 0)
except Exception:
    station_score = {}


def select_10_stations(slots, station_score_map):
    """Select 10 representative stations from a line's slots.
    Strategy: always include first and last, then fill with highest-scoring stations.
    Returns list of (order, gid) tuples with re-numbered order 1-10.
    """
    if len(slots) <= ROUTE_SIZE:
        return slots  # already <= 10, use as-is

    # Score each slot by station composite score
    scored = [(station_score_map.get(gid, 0), order, gid) for order, gid in slots]

    # Always include first and last station
    must_include = {slots[0][1], slots[-1][1]}  # gids

    # Sort remaining by score descending, pick top (ROUTE_SIZE - 2)
    remaining = [(sc, ord_, gid) for sc, ord_, gid in scored if gid not in must_include]
    remaining.sort(key=lambda x: -x[0])
    selected_gids = must_include | {gid for _, _, gid in remaining[:ROUTE_SIZE - 2]}

    # Filter original slots to selected, preserving order
    selected = [(order, gid) for order, gid in slots if gid in selected_gids]
    # Re-number order 1..N
    return [(i + 1, gid) for i, (_, gid) in enumerate(selected)]


collections = {}
for lc, slots in line_to_slots.items():
    line = line_by_id[lc]
    # Select exactly ROUTE_SIZE stations
    selected_slots = select_10_stations(slots, station_score)
    # members: list of station_codes in order
    members = []
    for order, gid in selected_slots:
        code = station_canonical_code.get(gid, gid)
        members.append(code)
    lc_lower = lc.lower()
    collections[lc_lower] = {
        "kind":     "line",
        "lc":       lc_lower,
        "name_ja":  line['line_name'],
        "name_en":  line['line_name_en'],
        "color":    line['color'],
        "size":     ROUTE_SIZE,
        "members":  members[:ROUTE_SIZE]  # enforce exactly 10
    }

# ── Assemble pack ─────────────────────────────────────────────────────────────

pack = {
    "pack_meta": {
        "pack_version":  "1.0",
        "pack_id":       "osaka_core",
        "name":          "Osaka Core Lines",
        "description":   "御堂筋線・谷町線・四つ橋線・阪急京都線・JR大阪環状線",
        "generated_by":  "generate_osaka_pack_v2.py",
        "generated_at":  str(date.today())
    },
    "entities":    entities,
    "collections": collections,
    "layouts": {
        "default": {
            "slots": [
                {"collection_id": lc_key}
                for lc_key in sorted(collections.keys())
            ]
        }
    },
    "rules": {
        "deck_size":       10,
        "hand_size":       7,
        "guno_threshold":  10,
        "max_players":     4
    }
}

# ── Write output ──────────────────────────────────────────────────────────────

out_path = OSAKA / 'packs' / 'pack_v1.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(pack, f, ensure_ascii=False, indent=2)

print(f"Written: {out_path}")
print(f"  entities:    {len(entities)}")
print(f"  collections: {len(collections)}")
for lc, col in collections.items():
    print(f"    {lc}: {col['name_ja']} ({col['size']} stations)")
