"""
KCD2 Map Icon Converter
=======================
Converts extracted DDS map icons to web-ready PNGs.

Usage:
    python convert_icons.py --input raw/map_icons --output icons

This will:
1. Convert all DDS files to PNG (with transparency)
2. Resize them to a consistent web-friendly size (default 32x32)
3. Print a mapping of filename -> suggested category ID
4. Generate an icon_map.js file for use in index.html

Requirements:
    pip install Pillow

Note: Pillow can read many DDS formats natively (DXT1, DXT5, BC7, etc).
      If a DDS file fails, use KCD Texture Exporter to convert to TIF first.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required. Install with: pip install Pillow")
    sys.exit(1)


# Map icon filenames to our category IDs
# Adjust these after seeing your actual filenames
ICON_NAME_TO_CATEGORY = {
    "alchemy": "alchemy_bench",
    "alchemybench": "alchemy_bench",
    "apothecary": "apothecary",
    "archery": "archery_range",
    "archer": "archery_range",
    "armour": "armourer",
    "armourer": "armourer",
    "baker": "baker",
    "bath": "baths",
    "blacksmith": "blacksmith",
    "smith": "blacksmith",
    "bowyer": "bowyer",
    "butcher": "butcher",
    "camp": "camp",
    "cave": "cave",
    "cobbler": "cobbler",
    "combat": "combat_arena",
    "arena": "combat_arena",
    "dice": "dice_table",
    "drying": "drying_rack",
    "fast_travel": "fast_travel",
    "fasttravel": "fast_travel",
    "travel": "fast_travel",
    "fence": "fence",
    "fishing": "fishing_spot",
    "grave": "grave",
    "grindstone": "grindstone",
    "grocer": "grocer",
    "herbalist": "herbalist",
    "herb": "herbalist",
    "horse": "horse_trader",
    "saddler": "horse_saddler",
    "hunt": "hunting_spot",
    "hunting": "hunting_spot",
    "huntsman": "huntsman",
    "inn": "tavern",
    "tavern": "tavern",
    "interesting": "interesting_site",
    "poi": "interesting_site",
    "lodging": "lodgings",
    "bed": "lodgings",
    "miller": "miller",
    "mill": "miller",
    "mine": "mine",
    "nest": "nest",
    "quest": "quest_main",
    "scribe": "scribe",
    "shrine": "shrine",
    "church": "shrine",
    "chapel": "shrine",
    "skill": "skill_book",
    "book": "skill_book",
    "tailor": "tailor",
    "tanner": "tanner",
    "trader": "trader",
    "merchant": "trader",
    "treasure": "treasure_chest",
    "chest": "treasure_chest",
    "weapon": "weaponsmith",
    "weaponsmith": "weaponsmith",
    "bandit": "bandit_camp",
    "castle": "castle",
    "city": "city",
    "town": "city",
    "village": "city",
    "settlement": "city",
    "caravan": "caravan",
    "gun": "interesting_site",
    "trainer": "skill_trainer",
}


def guess_category(filename: str) -> str:
    """Try to match a filename to a category ID."""
    name = filename.lower().replace("-", "_").replace(" ", "_")
    # Remove common prefixes/suffixes
    name = re.sub(r"^(map_|icon_|ico_|hud_|ui_)", "", name)
    name = re.sub(r"(_icon|_ico|_marker|_pin|_diff|_dds)$", "", name)

    # Try exact match first
    if name in ICON_NAME_TO_CATEGORY:
        return ICON_NAME_TO_CATEGORY[name]

    # Try substring match
    for key, cat_id in ICON_NAME_TO_CATEGORY.items():
        if key in name:
            return cat_id

    return ""


def convert_icons(input_dir: str, output_dir: str, size: int = 32):
    """Convert DDS icons to PNG."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    extensions = [".dds", ".tif", ".tiff", ".png", ".bmp", ".tga"]
    icon_map = {}
    converted = 0
    failed = 0

    files = sorted(input_path.iterdir())
    print(f"Scanning {input_path}: found {len(files)} files\n")

    for f in files:
        if not f.is_file():
            continue
        if f.suffix.lower() not in extensions:
            continue
        # Skip mip map files (.1, .2, .3 etc)
        if re.match(r"\.\d+$", f.suffix):
            continue

        stem = f.stem
        out_file = output_path / f"{stem}.png"

        try:
            img = Image.open(str(f))

            # Convert to RGBA for transparency support
            if img.mode != "RGBA":
                img = img.convert("RGBA")

            # Resize to consistent size
            if img.size != (size, size):
                img = img.resize((size, size), Image.LANCZOS)

            img.save(str(out_file), "PNG", optimize=True)
            img.close()

            category = guess_category(stem)
            icon_map[stem] = {
                "file": f"{stem}.png",
                "category": category,
                "original_name": f.name,
            }
            converted += 1

            status = f"  → {category}" if category else "  → (unmapped)"
            print(f"  ✓ {f.name:40s} → {stem}.png {status}")

        except Exception as e:
            failed += 1
            print(f"  ✗ {f.name:40s} FAILED: {e}")

    # Generate icon_map.js
    js_map = {}
    for stem, info in icon_map.items():
        if info["category"]:
            js_map[info["category"]] = f"icons/{info['file']}"

    js_content = f"window.ICON_MAP = {json.dumps(js_map, indent=2)};"
    js_path = output_path.parent / "data" / "icon_map.js"
    js_path.parent.mkdir(parents=True, exist_ok=True)
    with open(js_path, "w") as jf:
        jf.write(js_content)

    # Also save full mapping as JSON for reference
    json_path = output_path / "icon_mapping.json"
    with open(json_path, "w") as jf:
        json.dump(icon_map, jf, indent=2)

    print(f"\n{'='*60}")
    print(f"Converted: {converted}")
    print(f"Failed:    {failed}")
    print(f"Icon map:  {js_path}")
    print(f"Full map:  {json_path}")
    print(f"\nUnmapped icons (need manual category assignment):")
    for stem, info in icon_map.items():
        if not info["category"]:
            print(f"  {stem}")

    return icon_map


def main():
    parser = argparse.ArgumentParser(description="Convert KCD2 map icons to web-ready PNGs")
    parser.add_argument("--input", "-i", required=True,
                       help="Folder with extracted DDS/TIF icon files")
    parser.add_argument("--output", "-o", default="icons",
                       help="Output folder for PNGs (default: icons)")
    parser.add_argument("--size", "-s", type=int, default=32,
                       help="Icon size in pixels (default: 32)")
    args = parser.parse_args()

    convert_icons(args.input, args.output, args.size)
    print("\nDone! Next steps:")
    print("1. Check icons/ folder for the converted PNGs")
    print("2. Review icon_mapping.json and fix any unmapped categories")
    print("3. Add <script src=\"data/icon_map.js\"></script> to index.html")
    print("4. The map will auto-use PNG icons when ICON_MAP is available")


if __name__ == "__main__":
    main()
