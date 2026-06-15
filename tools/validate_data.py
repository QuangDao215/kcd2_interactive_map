"""
Validate the marker data files.  Run from repo root:  python tools/validate_data.py
Exits non-zero on ERROR (the pre-commit hook uses this to block bad data).
WARNINGS are printed but don't block.

Per region:
  ERROR  marker missing numeric x/y, or missing category
  ERROR  duplicate category:x:y key (two markers collide)
  ERROR  category not renderable (absent from region categories, CATEGORY_GROUPS, EXTRA)
  WARN   coordinates outside the map bounds
  WARN   an auto-generated junk-name pattern has reappeared (cleanup regression)
"""

import json
import re
import sys

REGIONS = ["trosky", "kuttenberg"]
BOUNDS = {"trosky": (6144, 6144), "kuttenberg": (12288, 10240)}  # mapWidth x mapHeight
# Categories that get a definition at runtime but aren't in CATEGORY_GROUPS data.
EXTRA = {"barber", "fist_fight_arena", "player_bed", "smithy", "fast_travel_level"}
JUNK = [
    (re.compile(r"Animal Spawn", re.I), "Animal Spawn"),
    (re.compile(r"\bFast Travel\b.*\bPoi\b", re.I), "Fast Travel … Poi"),
    (re.compile(r"^Poi\d+$"), "PoiNN"),
    (re.compile(r" — "), "em-dash location suffix"),
]


def category_group_ids():
    src = open("js/config.js", encoding="utf-8").read()
    m = re.search(r"const CATEGORY_GROUPS = \[(.*?)\n\];", src, re.S)
    return set(re.findall(r'"([a-z][a-z0-9_]*)"', m.group(1) if m else ""))


errors = warnings = 0
known_base = category_group_ids() | EXTRA

for region in REGIONS:
    data = json.load(open(f"data/markers_{region}.json", encoding="utf-8"))
    markers = data.get("markers", [])
    known = {c["id"] for c in data.get("categories", [])} | known_base
    w, h = BOUNDS[region]
    seen = {}
    print(f"\n=== {region}: {len(markers)} markers ===")
    for i, mk in enumerate(markers):
        loc = f"#{i} {mk.get('name', '?')!r}"
        x, y, cat = mk.get("x"), mk.get("y"), mk.get("category")
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            print(f"  ERROR {loc}: missing/invalid x/y ({x}, {y})"); errors += 1; continue
        if not cat or not isinstance(cat, str):
            print(f"  ERROR {loc}: missing category"); errors += 1; continue
        key = f"{cat}:{x}:{y}"
        if key in seen:
            print(f"  ERROR duplicate key {key}  ({loc} collides with {seen[key]})"); errors += 1
        else:
            seen[key] = loc
        if cat not in known:
            print(f"  ERROR {loc}: unknown category {cat!r} (would be skipped at render)"); errors += 1
        if x < 0 or x > w or y < 0 or y > h:
            print(f"  WARN  {loc}: coords out of bounds ({x}, {y}) vs {w}x{h}"); warnings += 1
        for rx, label in JUNK:
            if rx.search(mk.get("name", "")):
                print(f"  WARN  {loc}: junk-name pattern '{label}'"); warnings += 1
                break

print(f"\n{errors} error(s), {warnings} warning(s)")
sys.exit(1 if errors else 0)
