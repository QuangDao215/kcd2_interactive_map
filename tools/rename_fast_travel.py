"""
Rename fast-travel markers to their location name.

  "Kzik Fast Travel Army Camp Poi 1"   -> "Army Camp"
  "Kgru Fast Travel Grunta Poi 1"      -> "Grund"      (localized)
  "Kkut Fast Travel River Poi 1"       -> "River"

The location sits between "... Fast Travel " and " Poi <N>".  Czech place
names that have an English settlement label on the map are localized to
match; everything else keeps its extracted name.

Run from repo root.  Pass --apply to write; default is a dry run.
"""

import json
import re
import sys

REGIONS = ["trosky", "kuttenberg"]
APPLY = "--apply" in sys.argv

# Extract the location between "Fast Travel " and " Poi <N>"
PAT = re.compile(r" Fast Travel (.+?) Poi \d+$")

# Czech raw -> English map name (only where a map equivalent exists)
LOCALIZE = {
    "Grunta": "Grund",
    "Certovka": "Devil's Den",
    "Opatovice": "Sigismund's Camp",
    "Bohounovice": "Bohunowitz",
    "Pritoky": "Pschitoky",
    "Miskovice": "Miskowitz",
    "Horany": "Horschan",
}

for region in REGIONS:
    path = f"data/markers_{region}.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    changes = 0
    print(f"\n=== {region} ===")
    for m in data.get("markers", []):
        match = PAT.search(m.get("name", ""))
        if not match:
            continue
        loc = match.group(1).strip()
        new = LOCALIZE.get(loc, loc)
        if new != m["name"]:
            print(f"  {m['name']!r:46}  ->  {new!r}")
            m["name"] = new
            changes += 1
    print(f"  -> {changes} fast-travel markers renamed")

    if APPLY:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  WROTE {path}")

if not APPLY:
    print("\n(dry run — re-run with --apply to write)")
