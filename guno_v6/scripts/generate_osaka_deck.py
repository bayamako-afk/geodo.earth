"""
generate_osaka_deck.py
Generate deck_v1.json and pack_v1.json for Osaka.

Rarity tiers (matches Tokyo schema):
  S: top 5  (score >= threshold_S)
  A: next 10
  B: next 15
  C: remaining 10
  Total: 40 cards

Pack schema matches Tokyo pack_v1.json structure.
"""

import json, os
from datetime import datetime, timezone

ROOT = os.path.join(os.path.dirname(__file__), '..')
DERIVED_DIR = os.path.join(ROOT, 'cities', 'osaka', 'data', 'derived')
MASTER_DIR  = os.path.join(ROOT, 'cities', 'osaka', 'data', 'master')
DECKS_DIR   = os.path.join(ROOT, 'cities', 'osaka', 'data', 'decks')
PACKS_DIR   = os.path.join(ROOT, 'cities', 'osaka', 'data', 'packs')
os.makedirs(DECKS_DIR, exist_ok=True)
os.makedirs(PACKS_DIR, exist_ok=True)

# ── Load data ─────────────────────────────────────────────────────────────────

with open(os.path.join(DERIVED_DIR, 'station_metrics.json'), encoding='utf-8') as f:
    metrics_data = json.load(f)

with open(os.path.join(MASTER_DIR, 'station_lines.json'), encoding='utf-8') as f:
    station_lines = json.load(f)

stations = metrics_data['stations']  # already sorted by rank

# ── Deck generation ───────────────────────────────────────────────────────────

RARITY_COUNTS = {'S': 5, 'A': 10, 'B': 15, 'C': 10}
DECK_SIZE = sum(RARITY_COUNTS.values())  # 40

# Assign rarity by rank
def assign_rarity(rank):
    if rank <= 5:
        return 'S'
    elif rank <= 15:
        return 'A'
    elif rank <= 30:
        return 'B'
    else:
        return 'C'

# Take top 40 stations
top40 = stations[:DECK_SIZE]

cards = []
for i, st in enumerate(top40):
    cards.append({
        "card_id": f"card_{i+1:03d}",
        "station_global_id": st['station_global_id'],
        "station_name": st['station_name'],
        "station_slug": st['station_slug'],
        "score_total": st['score_total'],
        "rarity": assign_rarity(st['rank']),
        "rank": st['rank'],
    })

deck = {
    "deck_meta": {
        "version": "1.0",
        "city": "osaka",
        "source_metrics": "station_metrics.json",
        "deck_size": DECK_SIZE,
        "rarity_distribution": RARITY_COUNTS,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    },
    "cards": cards,
}

with open(os.path.join(DECKS_DIR, 'deck_v1.json'), 'w', encoding='utf-8') as f:
    json.dump(deck, f, ensure_ascii=False, indent=2)
print(f"deck_v1.json: {len(cards)} cards")
from collections import Counter
rarity_dist = Counter(c['rarity'] for c in cards)
print(f"  Rarity: {dict(rarity_dist)}")
print(f"  Top card: {cards[0]['station_name']} (score={cards[0]['score_total']})")

# ── Pack generation ───────────────────────────────────────────────────────────

# Build cross-line index from station_lines
cross_lines_map = {}  # station_global_id -> [line_ids on other lines]
from collections import defaultdict
station_line_map = defaultdict(list)
for sl in station_lines:
    station_line_map[sl['station_global_id']].append(sl['line_id'])

# Build entities (stations in deck)
entities = {}
for card in cards:
    sid = card['station_global_id']
    lines_for_station = station_line_map.get(sid, [])
    # Use first line's code as station_code
    first_sl = next((sl for sl in station_lines if sl['station_global_id'] == sid), None)
    code = first_sl['line_station_code'] if first_sl else sid
    cross = [lid for lid in lines_for_station[1:]] if len(lines_for_station) > 1 else []
    entities[code.lower()] = {
        "type": "station",
        "name_ja": card['station_name'],
        "name_en": card['station_slug'].replace('-', ' ').title(),
        "station_code": code.lower(),
        "cross_lines": cross,
    }

# Build collections (one per line, stations in deck that belong to that line)
with open(os.path.join(MASTER_DIR, 'lines_master.json'), encoding='utf-8') as f:
    lines_master = json.load(f)

deck_station_ids = {c['station_global_id'] for c in cards}

collections = {}
for line_obj in lines_master:
    lid = line_obj['line_id']
    line_stations_in_deck = [
        sl['line_station_code'].lower()
        for sl in station_lines
        if sl['line_id'] == lid and sl['station_global_id'] in deck_station_ids
    ]
    if line_stations_in_deck:
        collections[lid.lower()] = {
            "line_id": lid,
            "line_name": line_obj['line_name'],
            "line_name_en": line_obj['line_name_en'],
            "color": line_obj['color'],
            "stations": line_stations_in_deck,
            "complete_bonus": len(line_stations_in_deck) * 5,
        }

# Layouts (one per line)
layouts = {}
for lid_lower, col in collections.items():
    layouts[lid_lower] = {
        "type": "line",
        "direction": "horizontal",
        "stations": col['stations'],
    }

# Rules
rules = {
    "deck_size": DECK_SIZE,
    "hand_size": 5,
    "win_condition": "highest_score",
    "scoring": {
        "station_base": "score_total",
        "route_complete_bonus": "complete_bonus",
    }
}

pack = {
    "pack_meta": {
        "pack_version": "1.0",
        "pack_id": "osaka_core",
        "city": "osaka",
        "name": "Osaka Core Lines",
        "description": "御堂筋線・谷町線・四つ橋線・阪急京都線・大阪環状線",
        "generated_by": "GUNO Deck Generator v1.0",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    },
    "entities": entities,
    "collections": collections,
    "layouts": layouts,
    "rules": rules,
}

with open(os.path.join(PACKS_DIR, 'pack_v1.json'), 'w', encoding='utf-8') as f:
    json.dump(pack, f, ensure_ascii=False, indent=2)
print(f"pack_v1.json: {len(entities)} entities, {len(collections)} collections")
print(f"  Collections: {list(collections.keys())}")
