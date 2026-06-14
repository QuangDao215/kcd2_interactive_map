"""
Remove runtime-augmented (placeholder) category entries that the in-app Edit
Markers "Save to data/" baked into markers_<region>.json. Restores the
categories array from the pristine backup while KEEPING the current markers.

Anything genuinely needed is re-added at runtime (EXTRA_CATEGORIES + the
CATEGORY_GROUPS fallback in app.js), so this is lossless for the live UI.

Run from repo root. Pass --apply to write; default is a dry run.
"""

import json
import sys

REGIONS = ["trosky", "kuttenberg"]
BACKUP = "data_backup/original_2026-06-14"
APPLY = "--apply" in sys.argv

for region in REGIONS:
    cur_path = f"data/markers_{region}.json"
    bak_path = f"{BACKUP}/markers_{region}.json"
    cur = json.load(open(cur_path, encoding="utf-8"))
    bak = json.load(open(bak_path, encoding="utf-8"))

    before = len(cur.get("categories", []))
    clean = bak["categories"]            # pristine original categories
    after = len(clean)
    cur_ids = {c["id"] for c in cur.get("categories", [])}
    bak_ids = {c["id"] for c in clean}
    dropped = sorted(cur_ids - bak_ids)

    print(f"\n=== {region} ===")
    print(f"  categories: {before} -> {after}   markers kept: {len(cur.get('markers', []))}")
    print(f"  dropping {len(dropped)} baked placeholders: {dropped}")

    cur["categories"] = clean            # markers and everything else untouched

    if APPLY:
        with open(cur_path, "w", encoding="utf-8") as f:
            json.dump(cur, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  WROTE {cur_path}")

if not APPLY:
    print("\n(dry run — re-run with --apply to write)")
