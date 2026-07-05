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
  WARN   near-duplicate: same category+name within NEAR_PX px (likely double-entered)
  WARN   casing collision: one real name spelled with >1 capitalisation
  WARN   category has no icons/ mapping in icon_map.js (falls back to an emoji)
Cross-file:
  WARN   settlement_labels / local_maps .js out of sync with its .json
"""

import json
import re
import sys
from collections import defaultdict
from itertools import combinations

REGIONS = ["trosky", "kuttenberg"]
BOUNDS = {"trosky": (6144, 6144), "kuttenberg": (12288, 10240)}  # mapWidth x mapHeight
# Categories that get a definition at runtime but aren't in CATEGORY_GROUPS data.
EXTRA = {"barber", "fist_fight_arena", "player_bed", "smithy", "fast_travel_level"}
NEAR_PX = 8  # same category+name within this many px is almost certainly a dupe
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


def icon_map_ids():
    src = open("data/icon_map.js", encoding="utf-8").read()
    return set(re.findall(r'"([a-z0-9_]+)"\s*:\s*"icons/', src))


def load_js_object(path):
    # Pull the {...} literal out of a `window.X = {...};` / `const X = {...};` wrapper.
    txt = open(path, encoding="utf-8").read()
    return json.loads(txt[txt.index("{"):txt.rindex("}") + 1])


errors = warnings = 0
known_base = category_group_ids() | EXTRA
icon_ids = icon_map_ids()

for region in REGIONS:
    data = json.load(open(f"data/markers_{region}.json", encoding="utf-8"))
    markers = data.get("markers", [])
    known = {c["id"] for c in data.get("categories", [])} | known_base
    w, h = BOUNDS[region]
    seen = {}
    casings = defaultdict(set)             # name.lower() -> {distinct spellings}
    coords_by_catname = defaultdict(list)  # (category, name) -> [(x, y), ...]
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
        name = mk.get("name", "")
        casings[name.lower()].add(name)
        coords_by_catname[(cat, name)].append((x, y))

    # One real name spelled with different capitalisation (Dice Table / Dice table).
    for _low, variants in sorted(casings.items()):
        if len(variants) > 1:
            print(f"  WARN  casing collision: {sorted(variants)}"); warnings += 1
    # Same category+name almost on top of each other — a likely double-entry.
    for (cat, name), pts in coords_by_catname.items():
        if len(pts) < 2:
            continue
        for a, b in combinations(pts, 2):
            d = ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
            if d <= NEAR_PX:
                print(f"  WARN  near-duplicate {cat} {name!r}: {a} & {b} ({d:.1f}px)"); warnings += 1
    # Categories with no PNG in icon_map (render falls back to an emoji).
    missing = {mk.get("category") for mk in markers if isinstance(mk.get("category"), str)}
    for c in sorted(missing - icon_ids - EXTRA):
        print(f"  WARN  category {c!r}: no icons/ mapping in icon_map.js (emoji fallback)"); warnings += 1

# The .js script-tag fallbacks here aren't regenerated by a hook (unlike markers_*.js),
# so verify they still match their .json source.
for name in ("settlement_labels", "local_maps"):
    try:
        same = json.load(open(f"data/{name}.json", encoding="utf-8")) == load_js_object(f"data/{name}.js")
        print(f"\n{name}: .js {'matches' if same else 'OUT OF SYNC with'} .json")
        if not same:
            warnings += 1
    except Exception as e:  # report any parse/read failure as a warning, don't crash
        print(f"\nWARN  could not verify {name} .js/.json sync: {e}"); warnings += 1

print(f"\n{errors} error(s), {warnings} warning(s)")
sys.exit(1 if errors else 0)
