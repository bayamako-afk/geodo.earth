"""
generate_london_deck.py
Generate deck_v1.json and pack_v1.json for London.
- ROUTE_SIZE = 10 (engine constraint)
- pack_v1 schema matches Tokyo: collections.members = string ID array, entities = dict
- deck_size = 30, rarity by composite_score rank
"""
import json, csv, os, datetime
from collections import Counter

MASTER_DIR  = "cities/london/data/master"
DERIVED_DIR = "cities/london/data/derived"
DECKS_DIR   = "cities/london/data/decks"
PACKS_DIR   = "cities/london/data/packs"
for d in [DECKS_DIR, PACKS_DIR]:
    os.makedirs(d, exist_ok=True)

ROUTE_SIZE = 10
DECK_SIZE  = 30
RARITY_TARGETS = {"legendary": 1, "epic": 6, "rare": 8, "common": 15}

with open(f"{MASTER_DIR}/stations_master.json", encoding="utf-8") as f:
    stations_master = json.load(f)
with open(f"{MASTER_DIR}/station_lines.json", encoding="utf-8") as f:
    station_lines = json.load(f)
with open(f"{MASTER_DIR}/lines_master.json", encoding="utf-8") as f:
    lines_master = json.load(f)
with open(f"{DERIVED_DIR}/station_metrics.json", encoding="utf-8") as f:
    station_metrics_data = json.load(f)

id_to_metrics = {m["station_global_id"]: m for m in station_metrics_data["stations"]}
id_to_station = {s["station_global_id"]: s for s in stations_master}
slug_to_id    = {s["station_slug"]: s["station_global_id"] for s in stations_master}

# ─────────────────────────────────────────────────────────────────────────────
# Line slug sequences (ordered station slugs per line)
# ─────────────────────────────────────────────────────────────────────────────
LINE_SLUGS = {
    "CEN": ["west_ruislip","ruislip_gardens","south_ruislip","northolt","greenford",
            "perivale","hanger_lane","ealing_broadway","west_acton","north_acton",
            "east_acton","white_city","shepherds_bush_mkt","goldhawk_road","shepherds_bush",
            "holland_park","notting_hill_gate","queensway","lancaster_gate","marble_arch",
            "bond_street","oxford_circus","tottenham_court_rd","holborn","chancery_lane",
            "st_pauls","bank","liverpool_street","bethnal_green","mile_end",
            "stratford","leyton","leytonstone","snaresbrook","south_woodford",
            "woodford","buckhurst_hill","loughton","debden","theydon_bois","epping"],
    "NOR": ["edgware","burnt_oak","colindale","hendon_central","brent_cross",
            "golders_green","hampstead","belsize_park","chalk_farm","camden_town",
            "mornington_crescent","euston","warren_street","goodge_street","tottenham_court_rd",
            "leicester_square","charing_cross","embankment","waterloo","kennington",
            "oval","stockwell","clapham_north","clapham_common","clapham_south",
            "balham","tooting_bec","tooting_broadway","colliers_wood","south_wimbledon","morden"],
    "PIC": ["heathrow_t5","heathrow_t123","heathrow_t4","hatton_cross","hounslow_west",
            "hounslow_central","hounslow_east","osterley","boston_manor","northfields",
            "south_ealing","acton_town","chiswick_park","turnham_green","stamford_brook",
            "ravenscourt_park","hammersmith","barons_court","west_kensington","earls_court",
            "gloucester_road","south_kensington","knightsbridge","hyde_park_corner","green_park",
            "piccadilly_circus","leicester_square","covent_garden","holborn","russell_square",
            "kings_cross","caledonian_road","holloway_road","arsenal","finsbury_park",
            "manor_house","turnpike_lane","wood_green","bounds_green","arnos_grove",
            "southgate","oakwood","cockfosters"],
    "DIS": ["richmond","kew_gardens","gunnersbury","chiswick_park","turnham_green",
            "stamford_brook","ravenscourt_park","hammersmith","barons_court","west_kensington",
            "earls_court","west_brompton","fulham_broadway","parsons_green","putney_bridge",
            "east_putney","southfields","wimbledon_park","wimbledon",
            "gloucester_road","south_kensington","sloane_square","victoria","st_james_park",
            "westminster","embankment","temple","blackfriars","mansion_house",
            "cannon_street","monument","tower_hill","aldgate_east","whitechapel",
            "stepney_green","mile_end","bow_road","bromley_by_bow","west_ham",
            "plaistow","upton_park","east_ham","barking","upney",
            "becontree","dagenham_heathway","dagenham_east","elm_park","hornchurch",
            "upminster_bridge","upminster"],
    "CIR": ["hammersmith","barons_court","west_kensington","earls_court","high_street_ken",
            "notting_hill_gate","bayswater","paddington","edgware_road","baker_street",
            "great_portland_st","euston_square","kings_cross","farringdon","barbican",
            "moorgate","liverpool_street","aldgate","tower_hill","monument",
            "cannon_street","mansion_house","blackfriars","temple","embankment",
            "westminster","st_james_park","victoria","sloane_square","south_kensington",
            "gloucester_road"],
}

LINE_INFO = {l["line_id"]: l for l in lines_master}

# ─────────────────────────────────────────────────────────────────────────────
# Select 10 representative stations per line
# Rule: first + last + top-8 by composite_score (no duplicates)
# ─────────────────────────────────────────────────────────────────────────────
def select_10_stations(line_id, slugs):
    unique_slugs = list(dict.fromkeys(slugs))
    first_slug = unique_slugs[0]
    last_slug  = unique_slugs[-1]
    fixed = {first_slug, last_slug}

    scored = []
    for slug in unique_slugs:
        sid = slug_to_id.get(slug)
        if sid is None:
            continue
        m = id_to_metrics.get(sid, {})
        scored.append((slug, m.get("composite_score", 0.0)))

    scored_sorted = sorted(scored, key=lambda x: -x[1])
    top8 = [s for s, _ in scored_sorted if s not in fixed][:8]

    selected = [first_slug] + top8 + [last_slug]
    seen = set()
    result = []
    for slug in selected:
        if slug not in seen:
            seen.add(slug)
            result.append(slug)

    if len(result) < ROUTE_SIZE:
        for slug in unique_slugs:
            if slug not in seen:
                seen.add(slug)
                result.append(slug)
            if len(result) == ROUTE_SIZE:
                break
    return result[:ROUTE_SIZE]

# ─────────────────────────────────────────────────────────────────────────────
# Build collections and entities (Tokyo-compatible schema)
# collections[lc] = { kind, lc, name_ja, name_en, color, size, members: [entity_id, ...] }
# entities = { entity_id: { type, name_ja, name_en, station_code, cross_lines } }
# ─────────────────────────────────────────────────────────────────────────────
collections = {}
entities    = {}
# Track which lines each station appears in (for cross_lines)
station_line_membership = {}  # sid -> [lc, ...]

for line_id, slugs in LINE_SLUGS.items():
    lc = line_id.lower()
    rep_slugs = select_10_stations(line_id, slugs)
    member_ids = []
    for order, slug in enumerate(rep_slugs, start=1):
        sid = slug_to_id.get(slug)
        if sid is None:
            continue
        s = id_to_station.get(sid, {})
        entity_id = f"{lc}-{order:02d}"
        member_ids.append(entity_id)
        # Build entity
        entities[entity_id] = {
            "type": "station",
            "name_ja": s.get("station_name", slug),
            "name_en": s.get("station_name_en", slug),
            "station_code": entity_id,
            "station_global_id": sid,
            "cross_lines": [],  # filled in next pass
        }
        if sid not in station_line_membership:
            station_line_membership[sid] = []
        station_line_membership[sid].append(lc)

    li = LINE_INFO.get(line_id, {})
    collections[lc] = {
        "kind": "line",
        "lc": lc,
        "name_ja": li.get("line_name", lc),
        "name_en": li.get("line_name_en", lc),
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

# ─────────────────────────────────────────────────────────────────────────────
# pack_v1.json (Tokyo-compatible schema)
# ─────────────────────────────────────────────────────────────────────────────
pack_v1 = {
    "pack_meta": {
        "pack_version": "1.0",
        "pack_id": "london_v1",
        "name": "London Underground Pack v1",
        "description": "5-line London Underground pack: CEN/NOR/PIC/DIS/CIR",
        "generated_by": "generate_london_deck.py",
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

# ─────────────────────────────────────────────────────────────────────────────
# deck_v1.json
# Pool: all entity stations sorted by composite_score desc
# ─────────────────────────────────────────────────────────────────────────────
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
    # Find order in collection
    lc = item["lc"]
    col = collections.get(lc, {})
    entity_id = item["entity_id"]
    order = col.get("members", []).index(entity_id) + 1 if entity_id in col.get("members", []) else 1
    deck_cards.append({
        "card_id": f"LDN{i+1:03d}",
        "station_global_id": sid,
        "station_name": item["station_name"],
        "station_name_en": item["station_name_en"],
        "line_id": lc.upper(),
        "collection_id": lc,
        "order": order,
        "rarity": assigned_rarity,
        "composite_score": item["composite_score"],
    })

deck_v1 = {
    "deck_meta": {
        "deck_name": "london_v1",
        "city_id": "london",
        "version": "1.0",
        "deck_size": len(deck_cards),
        "generator": "generate_london_deck.py",
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
    print(f"  {c['card_id']} {c['station_name_en']} ({c['line_id']}) score={c['composite_score']} rarity={c['rarity']}")
