"""
process_local_maps.py — Reconstruct split DDS local maps, convert to PNG, and stitch.

CryEngine stores textures as split mipmap DDS:
  name_N.dds       — DDS header (808 bytes)
  name_N.dds.1     — smallest mipmap
  name_N.dds.2     — next mipmap
  ...
  name_N.dds.6     — largest mipmap (full resolution)

This script:
  1. Reconstructs each split DDS into a full DDS file
  2. Converts DDS → PNG using Pillow
  3. Stitches detail tiles into a full local map image

Usage:
    python process_local_maps.py --input raw/kutna_hora --output maps/local/kutna_hora.png
    python process_local_maps.py --input raw/kutna_hora --output maps/local/kutna_hora.png --cols 4 --rows 4
    python process_local_maps.py --input raw/kutna_hora --list   # Just show tile info

Requirements:
    pip install Pillow
"""

import argparse
import struct
import sys
from pathlib import Path
from io import BytesIO

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required. Install with: pip install Pillow")
    sys.exit(1)

Image.MAX_IMAGE_PIXELS = None


def find_split_dds_tiles(input_dir: Path, prefix: str = None):
    """Find all split DDS tile sets in a directory.
    Returns dict: {tile_index: {header_path, mip_paths: [smallest..largest]}}
    """
    tiles = {}

    # Find all .dds header files
    for f in sorted(input_dir.iterdir()):
        if not f.is_file():
            continue
        name = f.name

        # Match pattern: prefix_N.dds (header) but NOT prefix_N.dds.1 (mip)
        if not name.endswith('.dds') or '.dds.' in name:
            continue

        # Extract tile index from filename
        stem = f.stem  # e.g., "kutna_hora_5"
        parts = stem.rsplit('_', 1)
        if len(parts) != 2:
            continue
        try:
            idx = int(parts[1])
        except ValueError:
            continue

        if prefix and not stem.startswith(prefix):
            continue

        # Find associated mip files
        mip_paths = []
        for mip_level in range(1, 20):  # up to 20 mip levels
            mip_file = input_dir / f"{name}.{mip_level}"
            if mip_file.exists():
                mip_paths.append(mip_file)
            else:
                break

        tiles[idx] = {
            'header': f,
            'mips': mip_paths,
            'prefix': parts[0],
        }

    return tiles


def reconstruct_dds(header_path: Path, mip_paths: list) -> bytes:
    """Reconstruct a DDS file from split header + largest mip only.

    The .dds file contains the DDS header (possibly with DX10 extension).
    We combine it with ONLY the largest mip level for the full-res image,
    and patch the header to report mipMapCount=1.
    """
    header_data = bytearray(header_path.read_bytes())

    # Patch mipMapCount to 1 (offset 28 from file start, uint32 LE)
    if len(header_data) >= 32:
        struct.pack_into('<I', header_data, 28, 1)

    # Determine header size: 128 bytes standard, or 148 if DX10 extended
    # Check fourCC at offset 84: if "DX10", add 20 bytes for DDS_HEADER_DXT10
    header_size = 128
    if len(header_data) >= 88:
        fourcc = header_data[84:88]
        if fourcc == b'DX10':
            header_size = 148

    # Use only the largest mip (last in the list = highest resolution)
    largest_mip = mip_paths[-1].read_bytes() if mip_paths else b''

    return bytes(header_data[:header_size]) + largest_mip


def dds_to_image(dds_bytes: bytes) -> Image.Image:
    """Convert DDS bytes to PIL Image."""
    return Image.open(BytesIO(dds_bytes))


def process_tile(header_path: Path, mip_paths: list) -> Image.Image:
    """Reconstruct and convert a single tile to PIL Image."""
    dds_data = reconstruct_dds(header_path, mip_paths)
    try:
        img = dds_to_image(dds_data)
        return img.convert("RGBA")
    except Exception as e:
        # If full reconstruction fails, try just the largest mip with header
        print(f"    Full reconstruction failed ({e}), trying largest mip only...")
        header_data = header_path.read_bytes()
        largest_mip = mip_paths[-1].read_bytes()
        dds_data = header_data + largest_mip
        try:
            img = dds_to_image(dds_data)
            return img.convert("RGBA")
        except Exception as e2:
            print(f"    ⚠ Could not decode: {e2}")
            return None


def auto_detect_grid(tile_count):
    """Guess grid dimensions from tile count."""
    import math
    sqrt = math.isqrt(tile_count)
    if sqrt * sqrt == tile_count:
        return sqrt, sqrt
    # Try common layouts
    for cols in range(sqrt + 1, 1, -1):
        if tile_count % cols == 0:
            return cols, tile_count // cols
    return tile_count, 1


def main():
    parser = argparse.ArgumentParser(description="Process CryEngine split DDS local maps")
    parser.add_argument("--input", "-i", required=True, type=Path,
                        help="Input directory with split DDS files")
    parser.add_argument("--output", "-o", type=Path, default=None,
                        help="Output PNG path (e.g., maps/local/kutna_hora.png)")
    parser.add_argument("--cols", type=int, default=None,
                        help="Grid columns (auto-detected if not specified)")
    parser.add_argument("--rows", type=int, default=None,
                        help="Grid rows (auto-detected if not specified)")
    parser.add_argument("--list", action="store_true",
                        help="Just list tiles without processing")
    parser.add_argument("--save-tiles", type=Path, default=None,
                        help="Save individual tile PNGs to this directory")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Error: {args.input} not found")
        sys.exit(1)

    # Find tiles
    tiles = find_split_dds_tiles(args.input)
    if not tiles:
        print(f"No split DDS tiles found in {args.input}")
        sys.exit(1)

    prefix = next(iter(tiles.values()))['prefix']
    print(f"Found {len(tiles)} tiles (prefix: {prefix})")

    # Separate overview (tile 0) from detail tiles
    overview = tiles.pop(0, None)
    detail_indices = sorted(tiles.keys())
    detail_count = len(detail_indices)

    print(f"  Overview (tile 0): {'yes' if overview else 'no'} ({len(overview['mips'])} mips)" if overview else "  Overview: none")
    print(f"  Detail tiles: {detail_count} (indices {detail_indices[0]}-{detail_indices[-1]})")

    for idx in sorted(tiles.keys()):
        t = tiles[idx]
        largest_mip = t['mips'][-1].stat().st_size if t['mips'] else 0
        print(f"    Tile {idx:2d}: {len(t['mips'])} mips, largest = {largest_mip / 1024:.0f} KB")

    if args.list:
        return

    if not args.output and not args.save_tiles:
        print("\nSpecify --output to stitch, or --save-tiles to export individual PNGs, or --list to just inspect.")
        return

    # Auto-detect grid if not specified
    cols = args.cols
    rows = args.rows
    if cols is None or rows is None:
        auto_cols, auto_rows = auto_detect_grid(detail_count)
        cols = cols or auto_cols
        rows = rows or auto_rows
    print(f"\nGrid: {cols}×{rows} = {cols * rows} positions")

    # Process each detail tile
    tile_images = {}
    for idx in detail_indices:
        t = tiles[idx]
        print(f"  Processing tile {idx}...")
        img = process_tile(t['header'], t['mips'])
        if img:
            tile_images[idx] = img
            print(f"    → {img.size[0]}×{img.size[1]}")
        else:
            print(f"    → FAILED")

    if not tile_images:
        print("No tiles could be decoded.")
        sys.exit(1)

    # Determine tile size from first successful tile
    sample = next(iter(tile_images.values()))
    tile_w, tile_h = sample.size
    print(f"\nTile size: {tile_w}×{tile_h}")

    # Save individual tiles if requested
    if args.save_tiles:
        args.save_tiles.mkdir(parents=True, exist_ok=True)
        for idx, img in sorted(tile_images.items()):
            out_path = args.save_tiles / f"{prefix}_{idx}.png"
            img.save(out_path, "PNG")
            print(f"  Saved {out_path.name}")

        # Also save overview if present
        if overview:
            print("  Processing overview...")
            ov_img = process_tile(overview['header'], overview['mips'])
            if ov_img:
                out_path = args.save_tiles / f"{prefix}_0.png"
                ov_img.save(out_path, "PNG")
                print(f"  Saved {out_path.name} ({ov_img.size[0]}×{ov_img.size[1]})")

    # Stitch if output specified
    if args.output:
        canvas_w = cols * tile_w
        canvas_h = rows * tile_h
        print(f"\nStitching to {canvas_w}×{canvas_h}...")

        # Use overview as background if available
        if overview:
            print("  Loading overview as background...")
            ov_img = process_tile(overview['header'], overview['mips'])
            if ov_img:
                canvas = ov_img.resize((canvas_w, canvas_h), Image.LANCZOS).convert("RGB")
            else:
                canvas = Image.new("RGB", (canvas_w, canvas_h), (0, 0, 0))
        else:
            canvas = Image.new("RGB", (canvas_w, canvas_h), (0, 0, 0))

        # Paste detail tiles (row-major: left-to-right, top-to-bottom)
        placed = 0
        for idx, img in sorted(tile_images.items()):
            grid_idx = idx - min(detail_indices)  # 0-based
            col = grid_idx % cols
            row = grid_idx // cols
            x = col * tile_w
            y = row * tile_h
            print(f"  Tile {idx} → grid ({col},{row}) → pixel ({x},{y})")
            canvas.paste(img.convert("RGB"), (x, y))
            placed += 1

        args.output.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(args.output, "PNG")
        size_mb = args.output.stat().st_size / 1024 / 1024
        print(f"\n✓ Saved: {args.output} ({canvas_w}×{canvas_h}, {size_mb:.1f} MB)")
        print(f"  Placed {placed}/{detail_count} tiles")


if __name__ == "__main__":
    main()