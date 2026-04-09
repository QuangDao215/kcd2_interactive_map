"""
KCD2 Map Tile Stitcher
=====================
Stitches regional map tiles into a single image.

Supports both grid types:
  - Trosky:     3x3 grid (tiles 1-9)  -> 6144 x 6144
  - Kuttenberg: 6x5 grid (tiles 1-30) -> 12288 x 10240
    Missing tiles (inaccessible areas) are filled black.

Usage:
    python stitch_maps.py --input <folder> --output <output.png> --region trosky
    python stitch_maps.py --input <folder> --output <output.png> --region kuttenberg

Requirements:
    pip install Pillow
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required. Install with: pip install Pillow")
    sys.exit(1)

TILE_SIZE = 2048

REGIONS = {
    "trosky": {
        "prefix": "global_map_trosecko_",
        "cols": 3,
        "rows": 3,
        "tile_start": 1,
    },
    "kuttenberg": {
        "prefix": "global_map_kutnohorsko_",
        "cols": 6,
        "rows": 5,
        "tile_start": 1,
    },
}


def get_grid_position(tile_index, cols, tile_start=1):
    idx = tile_index - tile_start
    return idx % cols, idx // cols


def find_tiles(input_dir, prefix):
    tiles = {}
    input_path = Path(input_dir)
    extensions = [".tif", ".tiff", ".png", ".jpg", ".jpeg", ".bmp"]

    for f in sorted(input_path.iterdir()):
        if not f.is_file() or f.suffix.lower() not in extensions:
            continue
        name = f.stem
        if not name.startswith(prefix):
            continue
        suffix = name[len(prefix):]
        try:
            idx = int(suffix)
        except ValueError:
            continue
        if idx == 0:
            print(f"  Skipping overview tile: {f.name}")
            continue
        tiles[idx] = str(f)

    return tiles


def find_tiles_fallback(input_dir):
    tiles = {}
    input_path = Path(input_dir)
    extensions = [".tif", ".tiff", ".png", ".jpg", ".jpeg"]

    for f in sorted(input_path.iterdir()):
        if not f.is_file() or f.suffix.lower() not in extensions:
            continue
        parts = f.stem.rsplit("_", 1)
        if len(parts) == 2:
            try:
                idx = int(parts[1])
                if idx > 0:
                    tiles[idx] = str(f)
            except ValueError:
                pass
    return tiles


def stitch(tiles, output_path, cols, rows, tile_start=1, quality=95):
    out_w = cols * TILE_SIZE
    out_h = rows * TILE_SIZE
    total_positions = cols * rows

    print(f"\nGrid: {cols} columns x {rows} rows = {total_positions} positions")
    print(f"Output: {out_w} x {out_h} pixels")
    print(f"Tiles found: {len(tiles)} / {total_positions}")

    canvas = Image.new("RGB", (out_w, out_h), (0, 0, 0))

    placed = 0
    for idx, filepath in sorted(tiles.items()):
        col, row = get_grid_position(idx, cols, tile_start)

        if col >= cols or row >= rows:
            print(f"  WARNING: Tile {idx} at ({col},{row}) outside grid - skipping")
            continue

        x = col * TILE_SIZE
        y = row * TILE_SIZE
        print(f"  Tile {idx:2d} ({Path(filepath).name}) -> grid ({col},{row}) -> pixel ({x},{y})")

        tile = Image.open(filepath)
        if tile.size != (TILE_SIZE, TILE_SIZE):
            print(f"         Resizing from {tile.size} to ({TILE_SIZE},{TILE_SIZE})")
            tile = tile.resize((TILE_SIZE, TILE_SIZE), Image.LANCZOS)
        if tile.mode != "RGB":
            tile = tile.convert("RGB")

        canvas.paste(tile, (x, y))
        tile.close()
        placed += 1

    missing = [i for i in range(tile_start, tile_start + total_positions) if i not in tiles]
    if missing:
        print(f"\n  Missing tiles (black): {missing}")

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    ext = output_path.lower()
    if ext.endswith(".png"):
        canvas.save(output_path, "PNG", optimize=True)
    elif ext.endswith((".jpg", ".jpeg")):
        canvas.save(output_path, "JPEG", quality=quality)
    elif ext.endswith(".webp"):
        canvas.save(output_path, "WEBP", quality=quality)
    else:
        canvas.save(output_path)

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nSaved: {output_path} ({file_size:.1f} MB)")
    print(f"Placed {placed} tiles, {len(missing)} black")
    canvas.close()
    return out_w, out_h


def main():
    parser = argparse.ArgumentParser(
        description="Stitch KCD2 map tiles into a single image",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Tile grid layouts (1-indexed, row-major):
  Trosky (3x3):       Kuttenberg (6x5):
  1 2 3                1  2  3  4  5  6
  4 5 6                7  8  9 10 11 12
  7 8 9               13 14 15 16 17 18
                      19 20 21 22 23 24
                      25 26 27 28 29 30
        """)
    parser.add_argument("--input", "-i", required=True, help="Folder with tile images")
    parser.add_argument("--output", "-o", required=True, help="Output path (.png/.jpg/.webp)")
    parser.add_argument("--region", "-r", required=True, choices=list(REGIONS.keys()))
    parser.add_argument("--quality", "-q", type=int, default=95, help="JPEG/WebP quality (default: 95)")
    args = parser.parse_args()

    region = REGIONS[args.region]
    tiles = find_tiles(args.input, region["prefix"])
    if not tiles:
        print(f"No '{region['prefix']}*' files found. Trying fallback...")
        tiles = find_tiles_fallback(args.input)
    if not tiles:
        print(f"ERROR: No tiles found in '{args.input}'")
        sys.exit(1)

    print(f"Region: {args.region}")
    print(f"Found {len(tiles)} tiles:")
    for idx, path in sorted(tiles.items()):
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"  [{idx:2d}] {Path(path).name} ({size_mb:.1f} MB)")

    w, h = stitch(tiles, args.output, region["cols"], region["rows"],
                  region["tile_start"], args.quality)
    print(f"\nDone! {w}x{h} px")


if __name__ == "__main__":
    main()