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

    js_content = f"window.MARKER_DATA_{region.upper()} = {json.dumps(data, indent=2)};"

    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)

    markers = len(data.get("markers", []))
    categories = len(data.get("categories", []))
    print(f"  {js_path}: {categories} categories, {markers} markers")

print("\nDone! JS files updated.")
