"""
resize_icons.py — Resize in-game icons to 32×32 with 1px transparent boundary.

Workflow:
1. Auto-detect and strip existing transparent boundary from each icon
2. Resize the content area to 30×30 (32 - 2×1px border)
3. Center on a 32×32 canvas with 1px transparent border on all sides

Usage:
    python resize_icons.py                          # Process icons/gg/ in-place
    python resize_icons.py --input icons/gg --output icons/gg_resized
    python resize_icons.py --padding 2              # 2px border instead of 1px
    python resize_icons.py --size 48                # Target 48×48 instead of 32×32
"""

import argparse
from pathlib import Path
from PIL import Image
import sys


def find_content_bbox(img: Image.Image) -> tuple:
    """Find bounding box of non-transparent content, ignoring transparent borders."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    alpha = img.getchannel("A")
    bbox = alpha.getbbox()

    if bbox is None:
        # Fully transparent image — return full image
        return (0, 0, img.width, img.height)

    return bbox


def resize_icon(img: Image.Image, target_size: int = 32, padding: int = 1) -> Image.Image:
    """Strip transparent border, resize content, place on target canvas with padding."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Step 1: Find and crop to content area
    bbox = find_content_bbox(img)
    content = img.crop(bbox)

    # Step 2: Resize content to fit within (target - 2*padding)
    content_size = target_size - 2 * padding
    if content_size <= 0:
        raise ValueError(f"Padding {padding}px is too large for target size {target_size}px")

    content = content.resize((content_size, content_size), Image.LANCZOS)

    # Step 3: Paste centered on transparent canvas
    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    canvas.paste(content, (padding, padding))

    return canvas


def main():
    parser = argparse.ArgumentParser(description="Resize icons to uniform size with transparent boundary")
    parser.add_argument("--input", "-i", default="icons/gg", help="Input directory (default: icons/gg)")
    parser.add_argument("--output", "-o", default=None, help="Output directory (default: overwrite in-place)")
    parser.add_argument("--size", "-s", type=int, default=32, help="Target icon size in px (default: 32)")
    parser.add_argument("--padding", "-p", type=int, default=1, help="Transparent border in px (default: 1)")
    parser.add_argument("--dry-run", action="store_true", help="Print stats without writing files")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output) if args.output else input_dir

    if not input_dir.exists():
        print(f"Error: Input directory '{input_dir}' does not exist")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    tif_files = sorted(input_dir.glob("*.tif"))
    if not tif_files:
        tif_files = sorted(input_dir.glob("*.tiff"))
    if not tif_files:
        # Fallback to PNG if no TIF found
        tif_files = sorted(input_dir.glob("*.png"))
    if not tif_files:
        print(f"No TIF/PNG files found in '{input_dir}'")
        sys.exit(1)

    content_size = args.size - 2 * args.padding
    print(f"Resizing {len(tif_files)} icons → {args.size}×{args.size} ({content_size}×{content_size} content + {args.padding}px border)")
    if args.output:
        print(f"Output: {output_dir}")
    else:
        print(f"Output: in-place")

    if args.dry_run:
        sizes = {}
        for f in tif_files:
            img = Image.open(f)
            key = f"{img.width}×{img.height}"
            sizes[key] = sizes.get(key, 0) + 1
        print(f"\nSize distribution:")
        for size, count in sorted(sizes.items(), key=lambda x: -x[1]):
            print(f"  {size}: {count} icons")
        return

    processed = 0
    errors = 0

    for f in tif_files:
        try:
            img = Image.open(f)
            result = resize_icon(img, args.size, args.padding)
            out_name = f.stem + ".png"
            result.save(output_dir / out_name, "PNG")
            processed += 1
        except Exception as e:
            print(f"  Error processing {f.name}: {e}")
            errors += 1

    print(f"\nDone: {processed} resized, {errors} errors")


if __name__ == "__main__":
    main()
