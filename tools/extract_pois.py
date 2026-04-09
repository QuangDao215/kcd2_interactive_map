"""
KCD2 POI Extractor
==================
Extracts all POI markers from objects_mission0.xml and cross-references
with poi_type.xml to produce marker JSON for the interactive map.

Also extracts non-POI entities (Nests, Dice Tables, Grindstones, Alchemy
Tables, Smokehouses, Drying Racks, Indulgence Boxes, Cart Stashes,
Lootable Corpses) that appear on the game map but use Entity elements
rather than POI Objects.

Usage:
    python extract_pois.py --level <path/to/objects_mission0.xml> --types <path/to/poi_type.xml> --region trosky
    python extract_pois.py --level <path/to/objects_mission0.xml> --types <path/to/poi_type.xml> --region kuttenberg

Output:
    data/markers_<region>.json   — marker data for index.html
    data/markers_<region>.js     — JS wrapper for file:// usage
    reports/poi_report_<region>.txt — human-readable report

Requirements:
    Python 3.8+ (no external packages needed)
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path


# ══════════════════════════════════════════════
# POI Type Registry (from poi_type.xml)
# ══════════════════════════════════════════════

def parse_poi_types(filepath, existing=None):
    registry = existing or {}
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    pattern = re.compile(r'<poi_type\s+(.*?)\s*/>', re.DOTALL)
    for match in pattern.finditer(content):
        attrs_str = match.group(1)
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', attrs_str))
        poi_id = attrs.get("poi_type_id", "")
        if not poi_id:
            continue
        registry[poi_id] = {
            "name": attrs.get("poi_type_name", "unknown"),
            "label": attrs.get("label", ""),
            "mark_type": int(attrs.get("mark_type", -1)),
            "discoverable_by_location": attrs.get("discoverable_by_location", "false") == "true",
            "discovery_dist": int(attrs.get("discovery_dist", 5)),
            "ui_order": int(attrs.get("ui_order", 999)),
        }
    return registry


# ══════════════════════════════════════════════
# POI Instance Extraction (from objects_mission0.xml)
# ══════════════════════════════════════════════

def extract_pois(filepath):
    pois = []
    poi_pattern = re.compile(r'<Object\s+Type="POI"\s+(.*?)/>', re.DOTALL)
    buffer = ""
    in_poi = False
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line_num, line in enumerate(f, 1):
            if 'Type="POI"' in line:
                for m in poi_pattern.finditer(line):
                    poi = parse_poi_attrs(m.group(1), line_num)
                    if poi:
                        pois.append(poi)
            if 'Type="POI"' in line and '/>' not in line:
                buffer = line
                in_poi = True
            elif in_poi:
                buffer += line
                if '/>' in line or '</Object>' in line:
                    for m in poi_pattern.finditer(buffer):
                        poi = parse_poi_attrs(m.group(1), line_num)
                        if poi:
                            pois.append(poi)
                    buffer = ""
                    in_poi = False
    return pois


def parse_poi_attrs(attrs_str, line_num):
    attrs = dict(re.findall(r'(\w+)="([^"]*)"', attrs_str))
    name = attrs.get("Name", "")
    pos_str = attrs.get("Pos", "0,0,0")
    poi_type_id = attrs.get("POITypeId", "")
    try:
        parts = pos_str.split(",")
        x = float(parts[0])
        y = float(parts[1])
        z = float(parts[2]) if len(parts) > 2 else 0
    except (ValueError, IndexError):
        print(f"  WARNING: Bad position '{pos_str}' at line {line_num}")
        return None
    return {
        "name": name, "world_x": x, "world_y": y, "world_z": z,
        "poi_type_id": poi_type_id,
        "is_discoverable": attrs.get("IsDiscoverable", "0") == "1",
        "is_fast_travel": attrs.get("IsFastTravel", "0") == "1",
        "discovery_distance": int(attrs.get("DiscoveryDistance", 0)),
        "custom_label": attrs.get("CustomLabel", ""),
        "location_id": attrs.get("LocationId", ""),
        "custom_mark_type": int(attrs.get("CustomMarkType", -1)),
        "ft_question": attrs.get("FTQuestion", ""),
        "line_num": line_num,
    }


# ══════════════════════════════════════════════
# Entity Extraction (for non-POI map items)
# ══════════════════════════════════════════════

def extract_entities_by_class(filepath, entity_class, category,
                               name_cleanup=None, name_filter=None):
    entities = []
    pattern = re.compile(
        rf'<Entity\s[^>]*EntityClass="{entity_class}"[^>]*>', re.DOTALL
    )
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line_num, line in enumerate(f, 1):
            if f'EntityClass="{entity_class}"' not in line:
                continue
            for m in pattern.finditer(line):
                attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(0)))
                raw_name = attrs.get("Name", entity_class)
                if name_filter and name_filter not in raw_name:
                    continue
                pos_str = attrs.get("Pos", "0,0,0")
                try:
                    parts = pos_str.split(",")
                    x, y, z = float(parts[0]), float(parts[1]), float(parts[2])
                except (ValueError, IndexError):
                    continue
                display_name = name_cleanup(raw_name, attrs) if name_cleanup else raw_name
                entities.append({
                    "name": display_name,
                    "world_x": round(x, 2), "world_y": round(y, 2), "world_z": round(z, 2),
                    "poi_type_id": f"_entity_{category}",
                    "is_discoverable": True, "is_fast_travel": False,
                    "discovery_distance": 5, "custom_label": "",
                    "location_id": "", "custom_mark_type": -1,
                    "ft_question": "", "line_num": line_num,
                })
    return entities


# ── Name cleanup functions ──

def _location_from_editor_layer(attrs):
    editor_layer = attrs.get("EditorLayer", "")
    if not editor_layer:
        return None
    parts = editor_layer.split("/")
    for part in parts[1:]:
        if part.startswith("_") or part in ("_common", "_script", "static", "_enviro"):
            continue
        cleaned = part
        prefix_match = re.match(r'^[a-z]{4}_(.+)$', cleaned)
        if prefix_match:
            cleaned = prefix_match.group(1)
        cleaned = re.sub(r'([a-z])([A-Z])', r'\1 \2', cleaned)
        cleaned = cleaned.replace("_", " ").strip().title()
        if cleaned and len(cleaned) > 2:
            return cleaned
    return None

def cleanup_nest_name(raw_name, attrs):
    return "Nest"

def cleanup_dice_name(raw_name, attrs):
    loc = _location_from_editor_layer(attrs)
    return f"Dice Table — {loc}" if loc else "Dice Table"

def cleanup_grindstone_name(raw_name, attrs):
    loc = _location_from_editor_layer(attrs)
    return f"Sharpening Wheel — {loc}" if loc else "Sharpening Wheel"

def cleanup_alchemy_name(raw_name, attrs):
    loc = _location_from_editor_layer(attrs)
    return f"Alchemy Bench — {loc}" if loc else "Alchemy Bench"

def cleanup_indulgence_name(raw_name, attrs):
    loc = _location_from_editor_layer(attrs)
    return f"Indulgence Box — {loc}" if loc else "Indulgence Box"

def cleanup_smokehouse_name(raw_name, attrs):
    loc = _location_from_editor_layer(attrs)
    return f"Smokehouse — {loc}" if loc else "Smokehouse"

def cleanup_dryer_name(raw_name, attrs):
    loc = _location_from_editor_layer(attrs)
    return f"Drying Rack — {loc}" if loc else "Drying Rack"

def cleanup_cartstash_name(raw_name, attrs):
    loc = _location_from_editor_layer(attrs)
    return f"Cart Stash — {loc}" if loc else "Cart Stash"

def cleanup_stashcorpse_name(raw_name, attrs):
    loc = _location_from_editor_layer(attrs)
    return f"Lootable Corpse — {loc}" if loc else "Lootable Corpse"


# ══════════════════════════════════════════════
# Label Cleanup
# ══════════════════════════════════════════════

def clean_label(raw_label, poi_name, type_name):
    if raw_label and raw_label.startswith("@"):
        label = raw_label.lstrip("@")
        for prefix in ["ui_maplegend_", "ui_maplabel_", "ui_map_", "ui_"]:
            if label.startswith(prefix):
                label = label[len(prefix):]
                break
        label = re.sub(r'([a-z])([A-Z])', r'\1 \2', label)
        label = label.replace("_", " ").strip().title()
        if label:
            return label
    if poi_name:
        name = poi_name.replace("_poi", "").replace("_", " ")
        name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
        return name.strip().title()
    return type_name.replace("_", " ").title()


# ══════════════════════════════════════════════
# Category Mapping
# ══════════════════════════════════════════════

POI_NAME_TO_CATEGORY = {
    "millerKrejzl": "miller",
}

LABEL_TO_CATEGORY = {
    "ui_maplegend_fasttravel": "fast_travel",
    "ui_maplegend_fasttravel_level": "fast_travel",
    "ui_maplegend_fasttravel_sedlec": "fast_travel",
    "ui_maplegend_pub": "tavern",
    "ui_maplegend_hotel": "tavern",
    "ui_maplegend_blacksmith": "blacksmith",
    "ui_maplegend_smithy": "blacksmith",
    "ui_maplegend_armourer": "armourer",
    "ui_maplegend_weaponsmiths": "weaponsmith",
    "ui_maplegend_tailor": "tailor",
    "ui_maplegend_shoemaker": "cobbler",
    "ui_maplegend_shop": "trader",
    "ui_maplegend_apothecary": "apothecary",
    "ui_maplegend_herbalist": "herbalist",
    "ui_maplegend_alchemy": "alchemy_bench",
    "ui_maplegend_baths": "baths",
    "ui_maplegend_arena": "combat_arena",
    "ui_maplegend_fist_fight": "combat_arena",
    "ui_maplegend_archery_arena": "archery_range",
    "ui_maplegend_horse_trader": "horse_trader",
    "ui_maplegend_horseTrafficer": "horse_trader",
    "ui_maplegend_saddler": "saddler",
    "ui_maplegend_miller": "miller",
    "ui_maplegend_baker": "baker",
    "ui_maplegend_bakery": "baker",
    "ui_maplegend_butchery": "butchery",
    "ui_maplegend_hunter": "huntsman",
    "ui_maplegend_fisherman": "fisherman",
    "ui_maplegend_tanner": "tanner",
    "ui_maplegend_scribe": "scribe",
    "ui_maplegend_bailiff": "bailiff",
    "ui_maplegend_diceTable": "dice_table",
    "ui_maplegend_camp": "camp",
    "ui_maplegend_camp_enemy": "bandit_camp",
    "ui_maplegend_shrine": "shrine",
    "ui_maplegend_conc_cross": "conc_cross",
    "ui_maplegend_church": "shrine",
    "ui_maplegend_grave": "grave",
    "ui_maplegend_nest": "nest",
    "ui_maplegend_hive": "beehive",
    "ui_maplegend_general_poi": "interesting_site",
    "ui_maplegend_bed": "lodgings",
    "ui_maplegend_bedPlayer": "player_bed",
    "ui_maplegend_home": "home",
    "ui_maplegend_forest_garden": "woodland_garden",
    "ui_maplegend_hunting_spot": "hunting_spot",
    "ui_maplegend_hunting_spot_boar": "hunting_boar",
    "ui_maplegend_hunting_spot_roe_deer": "hunting_deer",
    "ui_maplegend_hunting_spot_wolf": "hunting_wolf",
    "ui_maplegend_smokehouse": "smokehouse",
    "ui_maplegend_dryer": "drying_rack",
    "ui_maplegend_sharpeningWheel": "sharpening_wheel",
    "ui_maplegend_undegroundEntrance": "underground",
    "ui_maplegend_laundry": "washing",
    "ui_maplegend_trafficker": "trader",
    "ui_maplegend_indulgenceBox": "indulgence_box",
    "ui_maplegend_pillory": "pillory",
    "ui_maplegend_barber": "barber",
    "ui_maplegend_shieldPainter": "shield_painter",
    "ui_maplegend_gunsmith": "gunsmith",
    "ui_maplegend_sellingChest": "selling_chest",
    "ui_maplegend_vegetable_shop": "grocer",
    "ui_maplegend_dog_poi": "dog",
    "ui_maplegend_unknown": "unknown",
    "ui_maplegend_dlc2_smithing": "dlc_smithing",
    "ui_maplegend_dlc2_dice": "dlc_dice",
    "ui_maplegend_dlc2_archery": "dlc_archery",
    "ui_maplegend_dlc2_donations": "dlc_donations",
    "ui_maplegend_dlc2_duels": "dlc_duels",
    "ui_maplegend_dlc2_stealingpackages": "dlc_stealing",
    "ui_maplegend_dlc2_acquiringpackages": "dlc_acquiring",
    "ui_maplegend_dlc2_activities": "dlc_activities",
}

CATEGORY_DISPLAY = {
    "fast_travel":      {"icon": "🏁", "color": "#4a90d9", "name": "Fast Travel"},
    "tavern":           {"icon": "🍺", "color": "#c9a84c", "name": "Tavern / Inn"},
    "blacksmith":       {"icon": "⚒️", "color": "#8b7355", "name": "Blacksmith / Smithy"},
    "armourer":         {"icon": "🛡️", "color": "#7a8b99", "name": "Armourer"},
    "weaponsmith":      {"icon": "⚔️", "color": "#8b4513", "name": "Weaponsmith"},
    "tailor":           {"icon": "🧵", "color": "#9b59b6", "name": "Tailor"},
    "cobbler":          {"icon": "👢", "color": "#6d4c41", "name": "Cobbler"},
    "trader":           {"icon": "🏪", "color": "#27ae60", "name": "Trader / Shop"},
    "apothecary":       {"icon": "💊", "color": "#16a085", "name": "Apothecary"},
    "herbalist":        {"icon": "🌿", "color": "#27ae60", "name": "Herbalist"},
    "alchemy_bench":    {"icon": "⚗️", "color": "#8e44ad", "name": "Alchemy Bench"},
    "baths":            {"icon": "🛁", "color": "#3498db", "name": "Bathhouse"},
    "combat_arena":     {"icon": "👊", "color": "#e74c3c", "name": "Combat Arena"},
    "archery_range":    {"icon": "🎯", "color": "#e67e22", "name": "Archery Range"},
    "horse_trader":     {"icon": "🐴", "color": "#8b6914", "name": "Horse Trader"},
    "saddler":          {"icon": "🐎", "color": "#a0522d", "name": "Saddler"},
    "miller":           {"icon": "🌾", "color": "#daa520", "name": "Miller"},
    "baker":            {"icon": "🍞", "color": "#d4a564", "name": "Baker / Bakery"},
    "butchery":         {"icon": "🥩", "color": "#c0392b", "name": "Butchery"},
    "huntsman":         {"icon": "🏹", "color": "#5d7b3a", "name": "Huntsman"},
    "fisherman":        {"icon": "🐟", "color": "#2980b9", "name": "Fisherman"},
    "tanner":           {"icon": "🦌", "color": "#795548", "name": "Tanner"},
    "scribe":           {"icon": "📜", "color": "#7f8c8d", "name": "Scribe"},
    "bailiff":          {"icon": "⚖️", "color": "#c0392b", "name": "Bailiff"},
    "dice_table":       {"icon": "🎲", "color": "#f39c12", "name": "Dice Table"},
    "camp":             {"icon": "🏕️", "color": "#95a5a6", "name": "Camp"},
    "bandit_camp":      {"icon": "💀", "color": "#e74c3c", "name": "Enemy Camp"},
    "shrine":           {"icon": "⛪", "color": "#bdc3c7", "name": "Shrine"},
    "conc_cross":       {"icon": "✝️", "color": "#bdc3c7", "name": "Conciliation Cross"},
    "grave":            {"icon": "🪦", "color": "#7f8c8d", "name": "Grave"},
    "nest":             {"icon": "🪺", "color": "#8d6e63", "name": "Nest"},
    "beehive":          {"icon": "🐝", "color": "#f1c40f", "name": "Beehive"},
    "interesting_site": {"icon": "⭐", "color": "#f1c40f", "name": "Interesting Site"},
    "lodgings":         {"icon": "🛏️", "color": "#9b59b6", "name": "Lodgings"},
    "player_bed":       {"icon": "🛏️", "color": "#4a90d9", "name": "Player Bed"},
    "home":             {"icon": "🏠", "color": "#e67e22", "name": "Home"},
    "woodland_garden":  {"icon": "🌱", "color": "#2ecc71", "name": "Woodland Garden"},
    "hunting_spot":     {"icon": "🦌", "color": "#5d7b3a", "name": "Hunting Spot (Deer)"},
    "hunting_boar":     {"icon": "🐗", "color": "#5d7b3a", "name": "Hunting Spot (Boar)"},
    "hunting_deer":     {"icon": "🦌", "color": "#5d7b3a", "name": "Hunting Spot (Roe Deer)"},
    "hunting_wolf":     {"icon": "🐺", "color": "#5d7b3a", "name": "Hunting Spot (Wolf)"},
    "smokehouse":       {"icon": "🔥", "color": "#d35400", "name": "Smokehouse"},
    "drying_rack":      {"icon": "🧺", "color": "#b8860b", "name": "Drying Rack"},
    "sharpening_wheel": {"icon": "🔧", "color": "#95a5a6", "name": "Sharpening Wheel"},
    "underground":      {"icon": "🕳️", "color": "#34495e", "name": "Underground Entrance"},
    "washing":          {"icon": "👕", "color": "#3498db", "name": "Washing"},
    "indulgence_box":   {"icon": "📦", "color": "#d4a564", "name": "Indulgence Box"},
    "pillory":          {"icon": "⛓️", "color": "#7f8c8d", "name": "Pillory"},
    "barber":           {"icon": "✂️", "color": "#2c3e50", "name": "Barber"},
    "shield_painter":   {"icon": "🎨", "color": "#e74c3c", "name": "Shield Painter"},
    "gunsmith":         {"icon": "🔫", "color": "#7f8c8d", "name": "Gunsmith"},
    "selling_chest":    {"icon": "📦", "color": "#c9a84c", "name": "Selling Chest"},
    "grocer":           {"icon": "🥬", "color": "#27ae60", "name": "Grocer"},
    "dog":              {"icon": "🐕", "color": "#8d6e63", "name": "Dog"},
    "skill_trainer":    {"icon": "📖", "color": "#3498db", "name": "Skill Teacher"},
    "cart_stash":       {"icon": "🛒", "color": "#8b6914", "name": "Cart Stash"},
    "lootable_corpse":  {"icon": "💀", "color": "#7f8c8d", "name": "Lootable Corpse"},
    "unknown":          {"icon": "❓", "color": "#95a5a6", "name": "Unknown"},
}

DIRECT_CATEGORIES = {
    "_entity_nest": "nest",
    "_entity_dice_table": "dice_table",
    "_entity_grindstone": "sharpening_wheel",
    "_entity_alchemy_bench": "alchemy_bench",
    "_entity_indulgence_box": "indulgence_box",
    "_entity_smokehouse": "smokehouse",
    "_entity_drying_rack": "drying_rack",
    "_entity_cart_stash": "cart_stash",
    "_entity_lootable_corpse": "lootable_corpse",
}


def get_category(poi_type_info):
    if not poi_type_info:
        return "interesting_site"
    name = poi_type_info.get("name", "")
    label = poi_type_info.get("label", "")
    if name in POI_NAME_TO_CATEGORY:
        return POI_NAME_TO_CATEGORY[name]
    if label in LABEL_TO_CATEGORY:
        return LABEL_TO_CATEGORY[label]
    for lbl_key, cat in LABEL_TO_CATEGORY.items():
        if label.startswith(lbl_key):
            return cat
    name_lower = name.lower()
    for keyword, cat in [
        ("fasttravel", "fast_travel"), ("fast_travel", "fast_travel"),
        ("pub", "tavern"), ("inn", "tavern"), ("hotel", "tavern"),
        ("blacksmith", "blacksmith"), ("smithy", "blacksmith"),
        ("camp_enemy", "bandit_camp"), ("banditcamp", "bandit_camp"),
        ("camp", "camp"), ("shrine", "shrine"), ("grave", "grave"),
    ]:
        if keyword in name_lower:
            return cat
    return "interesting_site"


# ══════════════════════════════════════════════
# Main Pipeline
# ══════════════════════════════════════════════

def build_markers(pois, type_registry, region):
    markers = []
    category_counts = defaultdict(int)
    unmapped_types = set()
    for poi in pois:
        tid = poi["poi_type_id"]
        if tid in DIRECT_CATEGORIES:
            category = DIRECT_CATEGORIES[tid]
            type_info = {"name": category, "label": "", "mark_type": -1}
        else:
            type_info = type_registry.get(tid)
            if not type_info:
                unmapped_types.add(tid)
                type_info = {"name": "unknown", "label": "", "mark_type": -1}
            category = get_category(type_info)
        label = clean_label(poi["custom_label"], poi["name"], type_info["name"])
        marker = {
            "name": label, "category": category, "description": "",
            "world_x": round(poi["world_x"], 2),
            "world_y": round(poi["world_y"], 2),
            "world_z": round(poi["world_z"], 2),
            "x": 0, "y": 0,
            "poi_type_name": type_info["name"],
            "poi_type_id": tid,
            "is_fast_travel": poi["is_fast_travel"],
            "is_discoverable": poi["is_discoverable"],
        }
        if poi["custom_label"]:
            marker["label_key"] = poi["custom_label"]
        markers.append(marker)
        category_counts[category] += 1
    return markers, category_counts, unmapped_types


def build_categories(category_counts):
    categories = []
    for cat_id, count in sorted(category_counts.items(), key=lambda x: x[0]):
        display = CATEGORY_DISPLAY.get(cat_id, {
            "icon": "📍", "color": "#95a5a6", "name": cat_id.replace("_", " ").title()
        })
        categories.append({
            "id": cat_id, "name": display["name"],
            "icon": display["icon"], "color": display["color"],
        })
    return categories


def main():
    parser = argparse.ArgumentParser(
        description="Extract POI data from KCD2 level files for interactive map",
    )
    parser.add_argument("--level", "-l", required=True)
    parser.add_argument("--types", "-t", required=True)
    parser.add_argument("--system-types", "-s", default=None)
    parser.add_argument("--region", "-r", required=True, choices=["trosky", "kuttenberg"])
    parser.add_argument("--output-dir", "-o", default=".")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"  KCD2 POI Extractor — {args.region.title()}")
    print(f"{'='*60}")

    # Step 1: Parse POI type registry
    print(f"\n[1/5] Parsing POI type registry...")
    type_registry = parse_poi_types(args.types)
    print(f"  Loaded {len(type_registry)} POI types from {args.types}")
    if args.system_types and os.path.exists(args.system_types):
        type_registry = parse_poi_types(args.system_types, type_registry)
        print(f"  + system types → {len(type_registry)} total")

    # Step 2: Extract POI instances
    print(f"\n[2/5] Extracting POI instances from level data...")
    print(f"  File: {args.level}")
    size_mb = os.path.getsize(args.level) / (1024 * 1024)
    print(f"  Size: {size_mb:.1f} MB")
    pois = extract_pois(args.level)
    print(f"  Found {len(pois)} POI objects")

    # Step 3: Extract non-POI entities
    print(f"\n[3/5] Extracting non-POI entities...")

    nests = extract_entities_by_class(
        args.level, "Nest", "nest", name_cleanup=cleanup_nest_name)
    print(f"  Nests:              {len(nests)}")

    dice_tables = extract_entities_by_class(
        args.level, "DiceInteractor", "dice_table", name_cleanup=cleanup_dice_name)
    print(f"  Dice Tables:        {len(dice_tables)}")

    grindstones = extract_entities_by_class(
        args.level, "Grindstone", "grindstone", name_cleanup=cleanup_grindstone_name)
    print(f"  Sharpening Wheels:  {len(grindstones)}")

    alchemy = extract_entities_by_class(
        args.level, "AlchemyTable", "alchemy_bench", name_cleanup=cleanup_alchemy_name)
    print(f"  Alchemy Benches:    {len(alchemy)}")

    indulgence = extract_entities_by_class(
        args.level, "IndulgenceBoxTrigger", "indulgence_box", name_cleanup=cleanup_indulgence_name)
    print(f"  Indulgence Boxes:   {len(indulgence)}")

    smokehouses = extract_entities_by_class(
        args.level, "FoodProcessingTrigger", "smokehouse",
        name_cleanup=cleanup_smokehouse_name, name_filter="smokeHouse")
    print(f"  Smokehouses:        {len(smokehouses)}")

    dryers = extract_entities_by_class(
        args.level, "FoodProcessingTrigger", "drying_rack",
        name_cleanup=cleanup_dryer_name, name_filter="dryer")
    print(f"  Drying Racks:       {len(dryers)}")

    cart_stashes = extract_entities_by_class(
        args.level, "CartStash", "cart_stash", name_cleanup=cleanup_cartstash_name)
    print(f"  Cart Stashes:       {len(cart_stashes)}")

    lootable_corpses = extract_entities_by_class(
        args.level, "StashCorpse", "lootable_corpse", name_cleanup=cleanup_stashcorpse_name)
    print(f"  Lootable Corpses:   {len(lootable_corpses)}")

    all_entities = (nests + dice_tables + grindstones + alchemy + indulgence
                    + smokehouses + dryers + cart_stashes + lootable_corpses)
    pois.extend(all_entities)
    entity_count = len(all_entities)

    total_markers = len(pois)
    print(f"  ────────────────────────")
    print(f"  Total entities:     {entity_count}")
    print(f"  Total markers:      {total_markers}")

    if total_markers == 0:
        print("\n  ERROR: No markers found!")
        sys.exit(1)

    # Step 4: Build markers
    print(f"\n[4/5] Building marker data...")
    markers, category_counts, unmapped = build_markers(pois, type_registry, args.region)
    categories = build_categories(category_counts)
    print(f"  Markers: {len(markers)}")
    print(f"  Categories: {len(categories)}")
    if unmapped:
        print(f"  Unmapped type IDs: {len(unmapped)}")

    xs = [m["world_x"] for m in markers]
    ys = [m["world_y"] for m in markers]
    print(f"\n  World coordinate ranges:")
    print(f"    X: {min(xs):.1f} — {max(xs):.1f}")
    print(f"    Y: {min(ys):.1f} — {max(ys):.1f}")

    # Step 5: Write output
    print(f"\n[5/5] Writing output files...")

    data_dir = Path(args.output_dir) / "data"
    report_dir = Path(args.output_dir) / "reports"
    data_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    output_data = {
        "region": args.region,
        "coordinate_system": "world_cryengine",
        "note": "x,y are placeholder (0). Use calibrate_markers.py to compute pixel coords.",
        "categories": categories,
        "markers": markers,
    }

    json_path = data_dir / f"markers_{args.region}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    print(f"  ✓ {json_path} ({len(markers)} markers)")

    js_path = data_dir / f"markers_{args.region}.js"
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(f"window.MARKER_DATA_{args.region.upper()} = {json.dumps(output_data, indent=2, ensure_ascii=False)};")
    print(f"  ✓ {js_path}")

    report_path = report_dir / f"poi_report_{args.region}.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"KCD2 POI Report — {args.region.title()}\n{'='*60}\n\n")
        f.write(f"Total markers: {len(markers)}\n")
        f.write(f"  POI objects:        {len(markers) - entity_count}\n")
        f.write(f"  Nests:              {len(nests)}\n")
        f.write(f"  Dice Tables:        {len(dice_tables)}\n")
        f.write(f"  Sharpening Wheels:  {len(grindstones)}\n")
        f.write(f"  Alchemy Benches:    {len(alchemy)}\n")
        f.write(f"  Indulgence Boxes:   {len(indulgence)}\n")
        f.write(f"  Smokehouses:        {len(smokehouses)}\n")
        f.write(f"  Drying Racks:       {len(dryers)}\n")
        f.write(f"  Cart Stashes:       {len(cart_stashes)}\n")
        f.write(f"  Lootable Corpses:   {len(lootable_corpses)}\n")
        f.write(f"Categories: {len(categories)}\n\n")
        f.write(f"Category Breakdown:\n{'-'*40}\n")
        for cat_id, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            display = CATEGORY_DISPLAY.get(cat_id, {"name": cat_id})
            f.write(f"  {display.get('name', cat_id):30s} {count:4d}\n")
        f.write(f"\n\nAll Markers (sorted by category):\n{'-'*80}\n")
        for cat_id in sorted(category_counts.keys()):
            cat_markers = [m for m in markers if m["category"] == cat_id]
            display = CATEGORY_DISPLAY.get(cat_id, {"name": cat_id, "icon": "?"})
            f.write(f"\n{display.get('icon','')} {display.get('name', cat_id)} ({len(cat_markers)}):\n")
            for m in sorted(cat_markers, key=lambda x: x["name"]):
                f.write(f"  {m['name']:40s} world=({m['world_x']:8.1f}, {m['world_y']:8.1f})  type={m['poi_type_name']}\n")
        if unmapped:
            f.write(f"\n\nUnmapped POI Type IDs:\n{'-'*40}\n")
            for tid in sorted(unmapped):
                count = sum(1 for m in markers if m["poi_type_id"] == tid)
                f.write(f"  {tid}  ({count} instances)\n")
    print(f"  ✓ {report_path}")

    # Summary
    print(f"\n{'='*60}")
    print(f"  CATEGORY SUMMARY")
    print(f"{'='*60}")
    for cat_id, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        display = CATEGORY_DISPLAY.get(cat_id, {"name": cat_id, "icon": "?"})
        bar = "█" * min(count, 40)
        print(f"  {display.get('icon','')} {display.get('name', cat_id):28s} {count:4d}  {bar}")
    print(f"\n{'='*60}")
    print(f"  DONE! Next: python calibrate_markers.py -r {args.region} ...")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
