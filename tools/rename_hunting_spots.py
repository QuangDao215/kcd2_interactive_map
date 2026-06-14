"""
Rename hunting-spot markers to natural names derived from poi_type_name.

  huntingSpotBoar      -> Boar Hunting Spot
  huntingSpotRoeDeer   -> Roe Deer Hunting Spot
  huntingSpotDeer(_*)  -> Deer Hunting Spot
  huntingSpotWolf      -> Wolf Hunting Spot

Also normalizes the matching category labels in categories[].
Run from repo root.  Pass --apply to write; default is a dry run.
"""

import json
import sys

REGIONS = ["trosky", "kuttenberg"]
APPLY = "--apply" in sys.argv


def animal_name(poi_type_name):
    p = poi_type_name or ""
    if p.startswith("huntingSpotRoeDeer"):
        return "Roe Deer Hunting Spot"
    if p.startswith("huntingSpotBoar"):
        return "Boar Hunting Spot"
    if p.startswith("huntingSpotWolf"):
        return "Wolf Hunting Spot"
    if p.startswith("huntingSpotDeer"):
        return "Deer Hunting Spot"
    return None


CATEGORY_LABELS = {
    "hunting_boar": "Boar Hunting Spot",
    "hunting_deer": "Roe Deer Hunting Spot",   # category id is counterintuitive: hunting_deer = Roe Deer
    "hunting_spot": "Deer Hunting Spot",       # hunting_spot = Deer
    "hunting_wolf": "Wolf Hunting Spot",
}

for region in REGIONS:
    path = f"data/markers_{region}.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    marker_changes = 0
    print(f"\n=== {region} ===")

    for m in data.get("markers", []):
        new = animal_name(m.get("poi_type_name"))
        if new and m.get("name") != new:
            print(f"  marker: {m.get('name')!r:50}  ->  {new!r}")
            m["name"] = new
            marker_changes += 1

    cat_changes = 0
    for c in data.get("categories", []):
        new = CATEGORY_LABELS.get(c.get("id"))
        if new and c.get("name") != new:
            print(f"  category[{c['id']}]: {c.get('name')!r}  ->  {new!r}")
            c["name"] = new
            cat_changes += 1

    print(f"  -> {marker_changes} markers, {cat_changes} category labels")

    if APPLY:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  WROTE {path}")

if not APPLY:
    print("\n(dry run — re-run with --apply to write)")
