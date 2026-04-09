"""
KCD2 Gamerguides Marker Merger
================================
Imports missing marker categories from gamerguides.com data
and converts their coordinates to our map's pixel space.

Usage:
    python merge_gamerguides.py --gg-trosky gamerguides_trosky.json --gg-kuttenberg gamerguides_kuttenberg.json --data-dir data/

Prerequisites:
    - Run extract_pois.py and calibrate_markers.py first
    - data/markers_trosky.json and data/markers_kuttenberg.json must exist with calibrated coords

Requirements:
    Python 3.8+ (no external packages)
"""

import argparse
import json
import re
import sys
from pathlib import Path


# ══════════════════════════════════════════════
# COORDINATE TRANSFORMS (GG 25000x25000 → Our pixel space)
# ══════════════════════════════════════════════

REFERENCE_POINTS = {
    "trosky": [
        # Verified shrine corrections (GG → our pixel)
        (14624, 13590, 3844, 2675),     # Shrine 1
        (8646,  16781, 1676, 1513),     # Shrine 2
        (9283,  7625,  1898, 4847),     # Shrine 3
    ],
    "kuttenberg": [
        (7303,  8313,  2679, 7919),     # Shrine 1 (+5 y-shift)
        (12841, 12057, 6374, 5419),     # Shrine 2 (+5 y-shift)
        (19008, 12358, 10484, 5223),    # Shrine 3 (+5 y-shift)
    ],
}


def solve_affine(points):
    """Solve affine transform from 3+ calibration points using least squares."""
    if len(points) < 3:
        raise ValueError(f"Need at least 3 calibration points, got {len(points)}")
    n = len(points)
    wx = [p[0] for p in points]
    wy = [p[1] for p in points]
    px = [p[2] for p in points]
    py = [p[3] for p in points]

    sxx = sum(x*x for x in wx)
    syy = sum(y*y for y in wy)
    sxy = sum(x*y for x, y in zip(wx, wy))
    s_x = sum(wx)
    s_y = sum(wy)

    def solve3(mat, vec):
        def det3(m):
            return (m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1])
                  - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0])
                  + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]))
        def replace_col(m, v, col):
            r = [row[:] for row in m]
            for i in range(3):
                r[i][col] = v[i]
            return r
        d = det3(mat)
        if abs(d) < 1e-10:
            raise ValueError("Calibration points are collinear!")
        return [det3(replace_col(mat, vec, i)) / d for i in range(3)]

    M = [[sxx, sxy, s_x], [sxy, syy, s_y], [s_x, s_y, n]]
    sdx = sum(x*d for x, d in zip(wx, px))
    sdy = sum(y*d for y, d in zip(wy, px))
    sd  = sum(px)
    a, b, c = solve3(M, [sdx, sdy, sd])

    sdx2 = sum(x*d for x, d in zip(wx, py))
    sdy2 = sum(y*d for y, d in zip(wy, py))
    sd2  = sum(py)
    d, e, f = solve3(M, [sdx2, sdy2, sd2])
    return (a, b, c, d, e, f)


def apply_transform(gg_x, gg_y, coeffs):
    a, b, c, d, e, f = coeffs
    return round(a*gg_x + b*gg_y + c), round(d*gg_x + e*gg_y + f)


# ══════════════════════════════════════════════
# GG CATEGORY → OUR CATEGORY MAPPING
# ══════════════════════════════════════════════

# All GG categories mapped to our category IDs.
# Format: "gg_cat_id": ("our_category", item_filter_or_None)
# "_utility" is special — sub-categorized by title.

GG_CATEGORIES_TO_IMPORT = {
    # ── Points of Interest (already partially extracted from game) ──
    "db-50317": ("shrine", None),
    "db-50306": ("fast_travel", None),
    "db-50314": ("skill_trainer", None),
    "db-50315": ("archery_range", None),
    "db-50310": ("_utility", None),             # Sub-categorized by title

    # ── Weapons ──
    "db-45974": ("loot_sword", None),            # Swords
    "db-45976": ("loot_polearm", None),          # Polearms
    "db-45975": ("loot_heavy_weapon", None),     # Heavy weapons (axes, maces)
    "db-45978": ("loot_bow", None),              # Ranged (bows)
    "db-45979": ("loot_ammo", None),             # Ammo (arrows)
    "db-45977": ("loot_shield", None),           # Shields
    "db-45992": ("loot_dagger", None),           # Daggers & other weapons

    # ── Armour ──
    "db-45953": ("loot_armour_body", None),      # Body armour
    "db-45954": ("loot_armour_head", None),      # Head armour
    "db-45955": ("loot_armour_legs", None),      # Leg armour
    "db-45956": ("loot_armour_arms", None),      # Arm armour
    "db-45957": ("loot_armour_jewellery", None), # Jewellery
    "db-45982": ("loot_armour_belt", None),      # Belts
    "db-45983": ("loot_armour_pouch", None),     # Pouches

    # ── Potions & Poisons ──
    "db-45967": ("loot_potion", None),           # Potions (regular)
    "db-45968": ("loot_potion", None),           # Potions (strong)
    "db-45969": ("loot_potion", None),           # Potions (weak)
    "db-45970": ("loot_potion", None),           # Potions (maximum)
    "db-45984": ("loot_poison", None),           # Poisons (regular)
    "db-45985": ("loot_poison", None),           # Poisons (strong)
    "db-45986": ("loot_poison", None),           # Poisons (weak)

    # ── Books ──
    "db-45960": ("loot_skill_book", None),       # Skill books
    "db-45959": ("loot_recipe", None),           # Recipes
    "db-45958": ("loot_lore_book", None),        # Lore books
    "db-45961": ("loot_map", None),              # Maps
    "db-45962": ("loot_letter", None),           # Letters

    # ── Food ──
    "db-45963": ("loot_food", None),             # Food

    # ── Materials ──
    "db-45964": ("loot_herb", None),             # Herbs
    "db-45965": ("loot_blacksmithing", None),    # Blacksmithing materials
    "db-45966": ("loot_alchemy_mat", None),      # Alchemy materials

    # ── Other items ──
    "db-45995": ("loot_usable", None),           # Usable (lockpicks, groschen)
    "db-45994": ("loot_misc", None),             # Miscellaneous
    "db-45996": ("loot_utility", None),          # Utility (kits, bandages)
    "db-45997": ("loot_dice", None),             # Dice
    "db-45998": ("loot_badge", None),            # Gambling badges

    # ── Horse Tack ──
    "db-45989": ("loot_tack", None),             # Tack (torso/caparison)
    "db-45990": ("loot_saddle", None),           # Saddles
    "db-45991": ("loot_horseshoe", None),        # Horseshoes
    "db-45988": ("loot_bridle", None),           # Bridles

    # ── Quests ──
    "db-45971": ("quest_main", None),            # Main quests
    "db-45972": ("quest_side", None),            # Side quests
    "db-45973": ("quest_task", None),            # Tasks/activities
}

# Sub-categorize the mixed "utilities" category by item title
UTILITY_TITLE_TO_CATEGORY = {
    "free bed": "player_bed",
    "alchemy bench": "alchemy_bench",
    "drying rack": "drying_rack",
    "sharpening wheel": "sharpening_wheel",
    "smokehouse": "smokehouse",
    "indulgence chest": "indulgence_box",
    "laundry": "washing",
    "washing": "washing",
}


def categorize_utility(title):
    title_lower = (title or "").lower().strip()
    for keyword, category in UTILITY_TITLE_TO_CATEGORY.items():
        if keyword in title_lower:
            return category
    return None


# ══════════════════════════════════════════════
# CATEGORY DISPLAY INFO (for new item categories)
# ══════════════════════════════════════════════

ITEM_CATEGORY_DISPLAY = {
    # Weapons
    "loot_sword":              {"icon": "⚔️", "color": "#8b4513", "name": "Sword"},
    "loot_polearm":            {"icon": "🔱", "color": "#6d4c41", "name": "Polearm"},
    "loot_heavy_weapon":       {"icon": "🪓", "color": "#795548", "name": "Heavy Weapon"},
    "loot_bow":                {"icon": "🏹", "color": "#5d7b3a", "name": "Bow"},
    "loot_ammo":               {"icon": "➡️", "color": "#8d6e63", "name": "Ammo / Arrows"},
    "loot_shield":             {"icon": "🛡️", "color": "#7a8b99", "name": "Shield"},
    "loot_dagger":             {"icon": "🗡️", "color": "#607d8b", "name": "Dagger"},
    # Armour
    "loot_armour_body":        {"icon": "🦺", "color": "#8b7355", "name": "Body Armour"},
    "loot_armour_head":        {"icon": "⛑️", "color": "#7a8b99", "name": "Head Armour"},
    "loot_armour_legs":        {"icon": "👢", "color": "#6d4c41", "name": "Leg Armour"},
    "loot_armour_arms":        {"icon": "🧤", "color": "#795548", "name": "Arm Armour"},
    "loot_armour_jewellery":   {"icon": "💍", "color": "#c9a84c", "name": "Jewellery"},
    "loot_armour_belt":        {"icon": "🔗", "color": "#8d6e63", "name": "Belt"},
    "loot_armour_pouch":       {"icon": "👝", "color": "#a0522d", "name": "Pouch"},
    # Potions & Poisons
    "loot_potion":             {"icon": "🧪", "color": "#16a085", "name": "Potion"},
    "loot_poison":             {"icon": "☠️", "color": "#8e44ad", "name": "Poison"},
    # Books
    "loot_skill_book":         {"icon": "📘", "color": "#2980b9", "name": "Skill Book"},
    "loot_recipe":             {"icon": "📋", "color": "#e67e22", "name": "Recipe"},
    "loot_lore_book":          {"icon": "📖", "color": "#8b6914", "name": "Lore Book"},
    "loot_map":                {"icon": "🗺️", "color": "#d4a564", "name": "Treasure Map"},
    "loot_letter":             {"icon": "✉️", "color": "#bdc3c7", "name": "Letter"},
    # Food
    "loot_food":               {"icon": "🍖", "color": "#c0392b", "name": "Food"},
    # Materials
    "loot_herb":               {"icon": "🌿", "color": "#27ae60", "name": "Herb"},
    "loot_blacksmithing":      {"icon": "⚒️", "color": "#8b7355", "name": "Blacksmithing Material"},
    "loot_alchemy_mat":        {"icon": "⚗️", "color": "#8e44ad", "name": "Alchemy Material"},
    # Other
    "loot_usable":             {"icon": "🔑", "color": "#7f8c8d", "name": "Usable Item"},
    "loot_misc":               {"icon": "📦", "color": "#95a5a6", "name": "Miscellaneous"},
    "loot_utility":            {"icon": "🧰", "color": "#607d8b", "name": "Utility Kit"},
    "loot_dice":               {"icon": "🎲", "color": "#f39c12", "name": "Dice"},
    "loot_badge":              {"icon": "🏅", "color": "#c9a84c", "name": "Gambling Badge"},
    # Tack
    "loot_tack":               {"icon": "🐴", "color": "#8b6914", "name": "Horse Tack"},
    "loot_saddle":             {"icon": "🐴", "color": "#a0522d", "name": "Saddle"},
    "loot_horseshoe":          {"icon": "🐴", "color": "#607d8b", "name": "Horseshoe"},
    "loot_bridle":             {"icon": "🐴", "color": "#795548", "name": "Bridle"},
    # Quests
    "quest_main":              {"icon": "❗", "color": "#e74c3c", "name": "Main Quest"},
    "quest_side":              {"icon": "❓", "color": "#3498db", "name": "Side Quest"},
    "quest_task":              {"icon": "📝", "color": "#e67e22", "name": "Task / Activity"},
}


# ══════════════════════════════════════════════
# MAIN MERGE LOGIC
# ══════════════════════════════════════════════

def extract_importable_markers(gg_data, region, coeffs):
    gg_markers = gg_data.get("marker_data", [])
    imported = []
    skipped = 0

    for m in gg_markers:
        cat_id = m.get("marker_cat_id") or ""
        if cat_id not in GG_CATEGORIES_TO_IMPORT:
            continue

        our_cat, item_filter = GG_CATEGORIES_TO_IMPORT[cat_id]
        title = m.get("display_title") or m.get("item_title") or ""

        # Handle utility sub-categorization
        if our_cat == "_utility":
            our_cat = categorize_utility(title)
            if our_cat is None:
                skipped += 1
                continue

        if item_filter and not item_filter(title, m.get("item_path", "")):
            skipped += 1
            continue

        gg_x = m["pos_x"]
        gg_y = m["pos_y"]
        our_x, our_y = apply_transform(gg_x, gg_y, coeffs)

        display_name = title.strip() if title.strip() else our_cat.replace("_", " ").title()

        # Get the GG icon path for reference
        gg_icon = ""
        if m.get("customIcon") and m["customIcon"].get("path"):
            gg_icon = m["customIcon"]["path"]

        imported.append({
            "name": display_name,
            "category": our_cat,
            "description": "",
            "x": our_x,
            "y": our_y,
            "world_x": 0,
            "world_y": 0,
            "world_z": 0,
            "poi_type_name": f"gg_import_{our_cat}",
            "poi_type_id": f"_gg_{cat_id}",
            "is_fast_travel": our_cat == "fast_travel",
            "is_discoverable": True,
            "source": "gamerguides",
            "gg_marker_id": m.get("marker_id"),
            "gg_icon": gg_icon,
        })

    return imported, skipped


def find_duplicates(new_markers, existing_markers, distance_threshold=80):
    duplicates = set()
    for i, new in enumerate(new_markers):
        for existing in existing_markers:
            dx = abs(new["x"] - existing["x"])
            dy = abs(new["y"] - existing["y"])
            if dx < distance_threshold and dy < distance_threshold:
                if new["category"] == existing["category"]:
                    duplicates.add(i)
                    break
    return duplicates


def merge_into_markers(our_data, new_markers, region):
    existing = our_data.get("markers", [])
    dupes = find_duplicates(new_markers, existing)

    added = 0
    skipped_dupes = 0
    added_by_cat = {}

    for i, marker in enumerate(new_markers):
        if i in dupes:
            skipped_dupes += 1
            continue
        existing.append(marker)
        added += 1
        cat = marker["category"]
        added_by_cat[cat] = added_by_cat.get(cat, 0) + 1

    our_data["markers"] = existing

    # Update categories list
    existing_cat_ids = {c["id"] for c in our_data.get("categories", [])}

    # Import CATEGORY_DISPLAY from extract_pois for POI categories
    try:
        from extract_pois import CATEGORY_DISPLAY
    except ImportError:
        CATEGORY_DISPLAY = {}

    # Merge both display dicts
    all_display = {}
    all_display.update(CATEGORY_DISPLAY)
    all_display.update(ITEM_CATEGORY_DISPLAY)

    for cat_id in added_by_cat:
        if cat_id not in existing_cat_ids:
            display = all_display.get(cat_id, {
                "icon": "📍", "color": "#95a5a6",
                "name": cat_id.replace("_", " ").title()
            })
            our_data["categories"].append({
                "id": cat_id,
                "name": display["name"],
                "icon": display["icon"],
                "color": display["color"],
            })
            our_data["categories"].sort(key=lambda c: c["id"])

    return added, skipped_dupes, added_by_cat


def main():
    parser = argparse.ArgumentParser(
        description="Merge missing markers from gamerguides data into KCD2 map"
    )
    parser.add_argument("--gg-trosky", required=True)
    parser.add_argument("--gg-kuttenberg", required=True)
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)

    for region, gg_path in [("trosky", args.gg_trosky), ("kuttenberg", args.gg_kuttenberg)]:
        print(f"\n{'='*60}")
        print(f"  Merging: {region.title()}")
        print(f"{'='*60}")

        with open(gg_path, "r", encoding="utf-8") as f:
            gg_data = json.load(f)
        gg_markers = gg_data.get("marker_data", [])
        print(f"  GG markers: {len(gg_markers)}")

        our_path = data_dir / f"markers_{region}.json"
        if not our_path.exists():
            print(f"  ERROR: {our_path} not found.")
            continue
        with open(our_path, "r", encoding="utf-8") as f:
            our_data = json.load(f)
        print(f"  Our markers: {len(our_data.get('markers', []))}")

        ref_points = REFERENCE_POINTS[region]
        coeffs = solve_affine(ref_points)
        print(f"  Transform computed from {len(ref_points)} reference points")

        print(f"  Verification:")
        for gx, gy, ox, oy in ref_points[:3]:
            cx, cy = apply_transform(gx, gy, coeffs)
            print(f"    GG({gx},{gy}) → ({cx},{cy}) expected ({ox},{oy}) err=({abs(ox-cx)},{abs(oy-cy)})")

        new_markers, skipped = extract_importable_markers(gg_data, region, coeffs)
        print(f"\n  Importable markers: {len(new_markers)}")
        print(f"  Skipped (unknown utility): {skipped}")

        if not new_markers:
            print(f"  Nothing to import.")
            continue

        by_cat = {}
        for m in new_markers:
            by_cat[m["category"]] = by_cat.get(m["category"], 0) + 1
        print(f"\n  By category:")
        for cat, count in sorted(by_cat.items(), key=lambda x: -x[1]):
            print(f"    {cat:30s} {count:4d}")

        added, dupes, added_by_cat = merge_into_markers(our_data, new_markers, region)
        print(f"\n  Added: {added}")
        print(f"  Skipped (duplicates): {dupes}")
        if added_by_cat:
            print(f"  Added by category:")
            for cat, count in sorted(added_by_cat.items(), key=lambda x: -x[1]):
                print(f"    {cat:30s} {count:4d}")

        if not args.dry_run:
            with open(our_path, "w", encoding="utf-8") as f:
                json.dump(our_data, f, indent=2, ensure_ascii=False)
            print(f"\n  ✓ Written: {our_path}")

            js_path = our_path.with_suffix(".js")
            with open(js_path, "w", encoding="utf-8") as f:
                f.write(f"window.MARKER_DATA_{region.upper()} = {json.dumps(our_data, indent=2, ensure_ascii=False)};")
            print(f"  ✓ Written: {js_path}")
        else:
            print(f"\n  [DRY RUN] Would write to {our_path}")

        print(f"\n  Final marker count: {len(our_data.get('markers', []))}")

    print(f"\n{'='*60}")
    print(f"  DONE!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
