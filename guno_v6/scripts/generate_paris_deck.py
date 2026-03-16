"""
generate_paris_deck.py
Generate deck_v1.json and pack_v1.json for Paris RATP Métro.
Featured lines: M1, M4, M9, M13, M14 (5 most iconic/transfer-rich lines)
"""
import json, csv, os, datetime
from collections import Counter

MASTER_DIR  = "cities/paris/data/master"
DERIVED_DIR = "cities/paris/data/derived"
DECKS_DIR   = "cities/paris/data/decks"
PACKS_DIR   = "cities/paris/data/packs"
os.makedirs(DECKS_DIR, exist_ok=True)
os.makedirs(PACKS_DIR, exist_ok=True)

with open(f"{MASTER_DIR}/stations_master.json", encoding="utf-8") as f:
    stations = json.load(f)
with open(f"{MASTER_DIR}/station_lines.json", encoding="utf-8") as f:
    station_lines = json.load(f)
with open(f"{MASTER_DIR}/lines_master.json", encoding="utf-8") as f:
    lines_master_raw = json.load(f)
with open(f"{DERIVED_DIR}/station_metrics.json", encoding="utf-8") as f:
    metrics_data = json.load(f)

id_to_station = {s["station_global_id"]: s for s in stations}
id_to_metrics = {m["station_global_id"]: m for m in metrics_data["stations"]}
LINE_INFO = {l["line_id"]: l for l in lines_master_raw}

# ── Config ────────────────────────────────────────────────────────────────────
FEATURED_LINES = ["M1", "M4", "M9", "M13", "M14"]
ROUTE_SIZE = 8   # stations per route collection
DECK_SIZE  = 30
RARITY_TARGETS = {"legendary": 1, "epic": 6, "rare": 8, "common": 15}

# ── Build collections (one per featured line) ─────────────────────────────────
# For each featured line, pick the top ROUTE_SIZE stations by composite_score
collections = {}
entities = {}
station_line_membership = {}

for line_id in FEATURED_LINES:
    # Get all stations on this line
    line_station_ids = [
        row["station_global_id"]
        for row in station_lines
        if row["line_id"] == line_id
    ]
    # Deduplicate
    seen = []
    for sid in line_station_ids:
        if sid not in seen:
            seen.append(sid)
    line_station_ids = seen

    # Sort by composite_score desc, pick top ROUTE_SIZE
    scored = sorted(
        [(sid, id_to_metrics.get(sid, {}).get("composite_score", 0)) for sid in line_station_ids],
        key=lambda x: -x[1]
    )
    top_stations = [sid for sid, _ in scored[:ROUTE_SIZE]]

    member_ids = []
    for sid in top_stations:
        s = id_to_station.get(sid)
        if not s:
            continue
        entity_id = f"{line_id}-{sid}"
        m = id_to_metrics.get(sid, {})
        entities[entity_id] = {
            "entity_id": entity_id,
            "station_global_id": sid,
            "name_ja": s["station_name"],
            "name_en": s["station_name_en"],
            "composite_score": m.get("composite_score", 0),
            "score_total": m.get("score_total", 0),
            "rarity": m.get("rarity", "common"),
            "cross_lines": [],
        }
        member_ids.append(entity_id)
        if sid not in station_line_membership:
            station_line_membership[sid] = []
        station_line_membership[sid].append(line_id)

    li = LINE_INFO.get(line_id, {})
    collections[line_id] = {
        "kind": "line",
        "lc": line_id,
        "name_ja": li.get("line_name", line_id),
        "name_en": li.get("line_name_en", line_id),
        "color": li.get("color", "#888888"),
        "size": ROUTE_SIZE,
        "members": member_ids,
    }

# Fill cross_lines for interchange stations
for entity_id, entity in entities.items():
    sid = entity.get("station_global_id")
    if sid:
        entity["cross_lines"] = station_line_membership.get(sid, [])

# Build slots for layouts.default
slots = []
for lc, col in collections.items():
    slots.append({
        "collection_id": lc,
        "line_id": lc.upper(),
        "line_name": col["name_en"],
        "color": col["color"],
        "size": ROUTE_SIZE,
    })

# ── pack_v1.json ──────────────────────────────────────────────────────────────
pack_v1 = {
    "pack_meta": {
        "pack_version": "1.0",
        "pack_id": "paris_v1",
        "name": "Paris RATP Métro Pack v1",
        "description": f"5-line Paris Métro pack: {'/'.join(FEATURED_LINES)}",
        "generated_by": "generate_paris_deck.py",
        "generated_at": datetime.date.today().isoformat(),
    },
    "layouts": {
        "default": {
            "slots": slots,
        }
    },
    "collections": collections,
    "entities": entities,
    "rules": {
        "route_size": ROUTE_SIZE,
        "allow_transfer_bonus": True,
    },
}

with open(f"{PACKS_DIR}/pack_v1.json", "w", encoding="utf-8") as f:
    json.dump(pack_v1, f, ensure_ascii=False, indent=2)

# ── deck_v1.json ──────────────────────────────────────────────────────────────
pool = []
for entity_id, entity in entities.items():
    sid = entity.get("station_global_id")
    m = id_to_metrics.get(sid, {})
    pool.append({
        "entity_id": entity_id,
        "station_global_id": sid,
        "station_name": entity["name_ja"],
        "station_name_en": entity["name_en"],
        "composite_score": m.get("composite_score", 0.0),
        "score_total": m.get("score_total", 0.0),
        "lc": entity_id.split("-")[0],
    })

pool.sort(key=lambda x: -x["composite_score"])

# Deduplicate by station_global_id (keep highest-scoring entity)
seen_sids = set()
deduped_pool = []
for item in pool:
    if item["station_global_id"] not in seen_sids:
        seen_sids.add(item["station_global_id"])
        deduped_pool.append(item)

selected_pool = deduped_pool[:DECK_SIZE]

# Assign rarity by rank
rarity_order = ["legendary", "epic", "rare", "common"]
assigned_rarities = []
for rarity in rarity_order:
    count = RARITY_TARGETS.get(rarity, 0)
    assigned_rarities.extend([rarity] * count)
while len(assigned_rarities) < len(selected_pool):
    assigned_rarities.append("common")

deck_cards = []
for i, item in enumerate(selected_pool):
    sid = item["station_global_id"]
    s = id_to_station.get(sid, {})
    assigned_rarity = assigned_rarities[i] if i < len(assigned_rarities) else "common"
    lc = item["lc"]
    col = collections.get(lc, {})
    entity_id = item["entity_id"]
    order = col.get("members", []).index(entity_id) + 1 if entity_id in col.get("members", []) else 1
    deck_cards.append({
        "card_id": f"PAR{i+1:03d}",
        "station_global_id": sid,
        "station_name": item["station_name"],
        "station_name_en": item["station_name_en"],
        "line_id": lc.upper(),
        "collection_id": lc,
        "order": order,
        "rarity": assigned_rarity,
        "composite_score": item["composite_score"],
        "score_total": item["score_total"],
    })

deck_v1 = {
    "deck_meta": {
        "deck_name": "paris_v1",
        "city_id": "paris",
        "version": "1.0",
        "deck_size": len(deck_cards),
        "generator": "generate_paris_deck.py",
        "generated_at": datetime.date.today().isoformat(),
    },
    "cards": deck_cards,
}

with open(f"{DECKS_DIR}/deck_v1.json", "w", encoding="utf-8") as f:
    json.dump(deck_v1, f, ensure_ascii=False, indent=2)

with open(f"{DECKS_DIR}/deck_v1.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(deck_cards[0].keys()))
    w.writeheader()
    w.writerows(deck_cards)

# Report
rarity_dist = Counter(c["rarity"] for c in deck_cards)
print(f"pack_v1: {len(collections)} collections, {len(entities)} entities")
print(f"deck_v1: {len(deck_cards)} cards")
print(f"rarity distribution: {dict(rarity_dist)}")
print("Top 5 deck cards:")
for c in sorted(deck_cards, key=lambda x: -x["composite_score"])[:5]:
    print(f"  {c['card_id']} {c['station_name_en']} ({c['line_id']}) score_total={c['score_total']} rarity={c['rarity']}")
