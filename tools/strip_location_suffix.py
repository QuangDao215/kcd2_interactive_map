"""
Strip redundant " — <place>" location suffixes from marker names.

  "Drying Rack — Grunta"      -> "Drying Rack"
  "Dice Table — Kutna Hora"   -> "Dice Table"
  "Lootable Corpse — Poi"     -> "Lootable Corpse"

The marker's position on the map already conveys location, so the suffix
is noise.  Only the em-dash separator " — " (U+2014) is treated as a
location suffix; ASCII-hyphen place names like "Schdiar - West Farm" are
left alone.

Run from repo root.  Pass --apply to write; default is a dry run.
"""

import json
import sys

REGIONS = ["trosky", "kuttenberg"]
APPLY = "--apply" in sys.argv
SEP = " — "  # space + em dash + space

for region in REGIONS:
    path = f"data/markers_{region}.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    changes = 0
    print(f"\n=== {region} ===")
    for m in data.get("markers", []):
        name = m.get("name", "")
        if SEP in name:
            new = name.split(SEP, 1)[0].strip()
            if new and new != name:
                m["name"] = new
                changes += 1
    print(f"  -> {changes} markers stripped")

    if APPLY:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  WROTE {path}")

if not APPLY:
    print("\n(dry run — re-run with --apply to write)")
