"""
Regenerate marker JS files from JSON.
Run this after editing markers_trosky.json or markers_kuttenberg.json.

Usage:
    python build_markers.py
"""

import json
import os

REGIONS = ["trosky", "kuttenberg"]

for region in REGIONS:
    json_path = f"data/markers_{region}.json"
    js_path = f"data/markers_{region}.js"

    if not os.path.exists(json_path):
        print(f"  SKIP: {json_path} not found")
        continue

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Match the in-app Edit Markers "Save to data" output byte-for-byte (same
    # header, raw UTF-8 via ensure_ascii=False, trailing newline) so a hook-
    # regenerated .js never drifts in format from a tool-saved one — otherwise
    # the next commit reformats the whole file and buries the real change.
    # newline="" keeps LF line endings on Windows.
    body = json.dumps(data, indent=2, ensure_ascii=False)
    js_content = (
        f"// Marker data for {region} — edited via the in-app Edit Markers tool\n"
        f"window.MARKER_DATA_{region.upper()} = {body};\n"
    )

    with open(js_path, "w", encoding="utf-8", newline="") as f:
        f.write(js_content)

    markers = len(data.get("markers", []))
    categories = len(data.get("categories", []))
    print(f"  {js_path}: {categories} categories, {markers} markers")

print("\nDone! JS files updated.")
