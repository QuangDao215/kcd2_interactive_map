"""
generate_bg.py — Create a low-res background image for each region map.

This generates a small JPEG/WebP that loads instantly and sits behind the
tile layer as L.imageOverlay. Tiles render on top for detail; the background
fills in any areas without tiles (padded edges, missing tiles).

Usage:
    python generate_bg.py maps/trosky/map.png tiles/trosky/bg.webp
    python generate_bg.py maps/kuttenberg/map.png tiles/kuttenberg/bg.webp
    python generate_bg.py maps/trosky/map.png tiles/trosky/bg.webp --max-size 1024
"""

import argparse
import sys
from pathlib import Path
from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def main():
    parser = argparse.ArgumentParser(description="Generate low-res map background")
    parser.add_argument("source", type=Path, help="Source map image (PNG)")
    parser.add_argument("output", type=Path, help="Output background image (webp/jpg/png)")
    parser.add_argument("--max-size", type=int, default=2048,
                        help="Max dimension in pixels (default: 2048)")
    parser.add_argument("--quality", type=int, default=80,
                        help="Output quality for WebP/JPEG (default: 80)")
    args = parser.parse_args()

    if not args.source.exists():
        print(f"Error: {args.source} not found")
        sys.exit(1)

    print(f"Loading {args.source}...")
    img = Image.open(args.source)
    w, h = img.size
    print(f"  Original: {w}×{h}")

    # Scale down preserving aspect ratio
    scale = min(args.max_size / w, args.max_size / h)
    if scale < 1:
        new_w = round(w * scale)
        new_h = round(h * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        print(f"  Resized:  {new_w}×{new_h}")
    else:
        print(f"  Already within {args.max_size}px, no resize needed")

    args.output.parent.mkdir(parents=True, exist_ok=True)

    ext = args.output.suffix.lower()
    if ext == ".webp":
        img.save(args.output, "WEBP", quality=args.quality)
    elif ext in (".jpg", ".jpeg"):
        img.convert("RGB").save(args.output, "JPEG", quality=args.quality)
    else:
        img.save(args.output, "PNG", optimize=True)

    size_kb = args.output.stat().st_size / 1024
    print(f"  Output:   {args.output} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()