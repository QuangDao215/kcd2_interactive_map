"""
apply_trosky_correction.py — Apply a 9-point affine correction to Trosky markers
and settlement labels.

Reads:
  data/markers_trosky.json
  data/settlement_labels.js

Writes (in place):
  data/markers_trosky.json
  data/settlement_labels.js

The correction is computed from 5 ground-truth points in the bottom-left
quadrant of Trosky, plus 4 anchor points (currently-correct landmarks) to
keep the upper/right area unchanged.

Usage:
    python apply_trosky_correction.py [--dry-run]

The --dry-run flag prints what would change without writing files.
"""

import argparse
import json
import re
import sys
from pathlib import Path

# Correction transform (9-point least squares)
# px' = a*x + b*y + c
# py' = d*x + e*y + f
A_PX, B_PX, C_PX = 0.998348, 0.004273, -7.6644
A_PY, B_PY, C_PY = 0.000673, 0.989192, 32.1121


def correct(x, y):
    """Apply correction to a single (x, y) coordinate pair."""
    nx = A_PX * x + B_PX * y + C_PX
    ny = A_PY * x + B_PY * y + C_PY
    return round(nx), round(ny)


def correct_markers_json(path: Path, dry_run: bool):
    print(f"\n--- {path} ---")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    markers = data.get("markers", []) if isinstance(data, dict) else data
    changed = 0
    max_shift = 0

    for m in markers:
        if "x" not in m or "y" not in m:
            continue
        ox, oy = m["x"], m["y"]
        nx, ny = correct(ox, oy)
        if (nx, ny) != (ox, oy):
            shift = ((nx - ox) ** 2 + (ny - oy) ** 2) ** 0.5
            max_shift = max(max_shift, shift)
            changed += 1
            m["x"] = nx
            m["y"] = ny

    print(f"  Markers: {len(markers)}, modified: {changed}, max shift: {max_shift:.1f}px")

    if not dry_run:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  ✓ Written")
    else:
        print(f"  (dry run — not written)")


def correct_settlement_labels(path: Path, dry_run: bool):
    print(f"\n--- {path} ---")
    text = path.read_text(encoding="utf-8")

    # Find the trosky array and modify each entry
    # Match: { name: "...", x: NUMBER, y: NUMBER },
    pattern = re.compile(r'(\{\s*name:\s*"[^"]*",\s*x:\s*)(-?\d+)(\s*,\s*y:\s*)(-?\d+)(\s*\},?)')

    # We only want to modify entries inside the trosky: [ ... ] block
    trosky_start = text.find("trosky:")
    trosky_end = text.find("kuttenberg:")
    if trosky_start == -1 or trosky_end == -1:
        print("  ⚠ Could not find trosky/kuttenberg blocks, skipping")
        return

    trosky_block = text[trosky_start:trosky_end]
    other_text = text[:trosky_start] + "{{TROSKY_PLACEHOLDER}}" + text[trosky_end:]

    changed = 0
    max_shift = 0

    def replace_entry(match):
        nonlocal changed, max_shift
        prefix, x_str, mid, y_str, suffix = match.groups()
        ox, oy = int(x_str), int(y_str)
        nx, ny = correct(ox, oy)
        if (nx, ny) != (ox, oy):
            shift = ((nx - ox) ** 2 + (ny - oy) ** 2) ** 0.5
            max_shift = max(max_shift, shift)
            changed += 1
        return f"{prefix}{nx}{mid}{ny}{suffix}"

    new_trosky = pattern.sub(replace_entry, trosky_block)
    new_text = other_text.replace("{{TROSKY_PLACEHOLDER}}", new_trosky)

    print(f"  Labels modified: {changed}, max shift: {max_shift:.1f}px")

    if not dry_run:
        path.write_text(new_text, encoding="utf-8")
        print(f"  ✓ Written")
    else:
        print(f"  (dry run — not written)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Print changes without writing files")
    parser.add_argument("--data-dir", default="data", type=Path,
                        help="Path to data directory (default: data)")
    args = parser.parse_args()

    print("Trosky calibration correction")
    print("=" * 50)
    print(f"Transform:")
    print(f"  px' = {A_PX:.6f}*x + {B_PX:.6f}*y + {C_PX:+.4f}")
    print(f"  py' = {A_PY:.6f}*x + {B_PY:.6f}*y + {C_PY:+.4f}")

    markers_path = args.data_dir / "markers_trosky.json"
    labels_path = args.data_dir / "settlement_labels.js"

    if not markers_path.exists():
        print(f"\nError: {markers_path} not found")
        sys.exit(1)
    if not labels_path.exists():
        print(f"\nError: {labels_path} not found")
        sys.exit(1)

    correct_markers_json(markers_path, args.dry_run)
    correct_settlement_labels(labels_path, args.dry_run)

    if args.dry_run:
        print("\nDry run complete. Run without --dry-run to apply.")
    else:
        print("\nDone. Don't forget to:")
        print("  python build_markers.py    # regenerate markers_trosky.js")


if __name__ == "__main__":
    main()