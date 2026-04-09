"""
generate_tiles.py — Slice a large map image into a Leaflet tile pyramid.

Generates 256×256 WebP tiles at multiple zoom levels following the standard
{z}/{x}/{y}.webp convention. Outputs a manifest.json with dimensions and
zoom info that the frontend can fetch.

Usage:
    python generate_tiles.py maps/trosky/map.png tiles/trosky
    python generate_tiles.py maps/kuttenberg/map.png tiles/kuttenberg --quality 80
    python generate_tiles.py maps/trosky/map.png tiles/trosky --dry-run
    python generate_tiles.py maps/trosky/map.png tiles/trosky --workers 8
    python generate_tiles.py maps/trosky/map.png tiles/trosky --skip-existing
"""

import argparse
import json
import math
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # disable DecompressionBombWarning for huge maps

TILE_SIZE = 256


def compute_max_zoom(width: int, height: int) -> int:
    """Smallest zoom level where the source image fits inside the tile grid."""
    max_dim = max(width, height)
    return max(0, math.ceil(math.log2(max_dim / TILE_SIZE)))


def count_tiles(max_zoom: int) -> int:
    """Total tiles across all zoom levels (before empty-tile skipping)."""
    return sum(4 ** z for z in range(max_zoom + 1))


def generate_level(args):
    """Worker: generate all tiles for a single zoom level. Returns (z, written, skipped)."""
    z, level_img_bytes, level_size, output_dir, fmt, quality, skip_existing = args

    # Reconstruct image from bytes (multiprocessing can't easily share PIL images)
    from io import BytesIO
    level_img = Image.open(BytesIO(level_img_bytes))

    tiles_per_side = 2 ** z
    written = 0
    skipped = 0

    level_dir = Path(output_dir) / str(z)

    for x in range(tiles_per_side):
        for y in range(tiles_per_side):
            left = x * TILE_SIZE
            top = y * TILE_SIZE

            # If this tile is entirely outside the actual image content, skip
            if left >= level_size or top >= level_size:
                skipped += 1
                continue

            tile = level_img.crop((left, top, left + TILE_SIZE, top + TILE_SIZE))

            # Skip fully-transparent tiles (saves ~30-40% space on padded images)
            if tile.mode == "RGBA" and tile.getbbox() is None:
                skipped += 1
                continue

            tile_path = level_dir / str(x) / f"{y}.{fmt}"

            if skip_existing and tile_path.exists():
                skipped += 1
                continue

            tile_path.parent.mkdir(parents=True, exist_ok=True)

            if fmt == "webp":
                tile.save(tile_path, "WEBP", quality=quality, method=4)
            elif fmt == "png":
                tile.save(tile_path, "PNG", optimize=True)
            else:
                tile.save(tile_path, quality=quality)

            written += 1

    return z, written, skipped


def serialize_image(img: Image.Image) -> bytes:
    """Serialize PIL image to bytes for cross-process transfer."""
    from io import BytesIO
    buf = BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def generate_tiles(
    source_path: Path,
    output_dir: Path,
    fmt: str = "webp",
    quality: int = 85,
    workers: int = 4,
    skip_existing: bool = False,
    dry_run: bool = False,
):
    print(f"Loading {source_path}...")
    img = Image.open(source_path).convert("RGBA")
    width, height = img.size
    print(f"  Source size: {width}×{height}")

    max_zoom = compute_max_zoom(width, height)
    canvas_size = TILE_SIZE * (2 ** max_zoom)
    print(f"  Max zoom level: {max_zoom}")
    print(f"  Padded canvas size: {canvas_size}×{canvas_size}")
    print(f"  Theoretical tile count: {count_tiles(max_zoom)}")

    if dry_run:
        print("\n--- DRY RUN — no tiles will be written ---")
        for z in range(max_zoom + 1):
            tiles_per_side = 2 ** z
            print(f"  Zoom {z}: {tiles_per_side}×{tiles_per_side} = {tiles_per_side**2} tiles")
        return

    # Pad source onto power-of-2 canvas (anchored top-left)
    print(f"  Padding source onto {canvas_size}×{canvas_size} canvas...")
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.paste(img, (0, 0))

    output_dir.mkdir(parents=True, exist_ok=True)

    # Pre-resize each zoom level (sequential — can't parallelize cleanly because
    # of memory cost of holding multiple full images, but tile cropping IS parallel)
    print(f"\nGenerating tiles ({fmt}, quality={quality}, {workers} workers)...")
    start = time.time()

    tasks = []
    for z in range(max_zoom, -1, -1):
        level_size = TILE_SIZE * (2 ** z)
        if z == max_zoom:
            level_img = canvas
        else:
            level_img = canvas.resize((level_size, level_size), Image.LANCZOS)

        # Serialize once per level for worker transfer
        level_bytes = serialize_image(level_img)
        tasks.append((z, level_bytes, level_size, str(output_dir), fmt, quality, skip_existing))

    total_written = 0
    total_skipped = 0

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(generate_level, task): task[0] for task in tasks}
        for future in as_completed(futures):
            z, written, skipped = future.result()
            total_written += written
            total_skipped += skipped
            print(f"  Zoom {z}: {written} written, {skipped} skipped")

    elapsed = time.time() - start

    # Write manifest
    manifest = {
        "source": source_path.name,
        "width": width,
        "height": height,
        "canvas_size": canvas_size,
        "tile_size": TILE_SIZE,
        "min_zoom": 0,
        "max_zoom": max_zoom,
        "format": fmt,
        "tile_url": "{z}/{x}/{y}." + fmt,
        "tiles_written": total_written,
        "tiles_skipped": total_skipped,
    }
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nDone in {elapsed:.1f}s")
    print(f"  Total: {total_written} tiles written, {total_skipped} skipped")
    print(f"  Manifest: {manifest_path}")

    # Disk usage
    total_bytes = sum(p.stat().st_size for p in output_dir.rglob("*") if p.is_file())
    print(f"  Disk usage: {total_bytes / 1024 / 1024:.1f} MB")


def main():
    parser = argparse.ArgumentParser(
        description="Generate Leaflet tile pyramid from a large map image"
    )
    parser.add_argument("source", type=Path, help="Source PNG/JPEG image")
    parser.add_argument("output", type=Path, help="Output tile directory")
    parser.add_argument("--format", "-f", default="webp", choices=["webp", "png", "jpg"],
                        help="Output tile format (default: webp)")
    parser.add_argument("--quality", "-q", type=int, default=85,
                        help="WebP/JPEG quality 1-100 (default: 85)")
    parser.add_argument("--workers", "-w", type=int, default=4,
                        help="Parallel worker processes (default: 4)")
    parser.add_argument("--skip-existing", action="store_true",
                        help="Skip tiles that already exist on disk")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print stats without writing tiles")
    args = parser.parse_args()

    if not args.source.exists():
        print(f"Error: source file '{args.source}' not found")
        sys.exit(1)

    generate_tiles(
        source_path=args.source,
        output_dir=args.output,
        fmt=args.format,
        quality=args.quality,
        workers=args.workers,
        skip_existing=args.skip_existing,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()