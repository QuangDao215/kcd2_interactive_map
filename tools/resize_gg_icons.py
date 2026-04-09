"""
Resize GamerGuides icons to match game icon size and padding.

Game icons: 32x32 total, with the actual icon at ~80% centered inside
            a transparent boundary (~3px padding on each side).
GG icons:   140x140, icon fills the entire canvas.

This script resizes GG icons to 32x32 with matching transparent padding
so all icons render at uniform scale on the map.

Usage:
    python resize_gg_icons.py
    python resize_gg_icons.py --icon-dir icons --size 32 --padding 3

Requirements:
    pip install Pillow
"""

import argparse
from pathlib import Path
from PIL import Image


def resize_icons(icon_dir, target_size, padding):
    """Resize all GG PNGs: shrink icon content and center on padded canvas."""
    icon_path = Path(icon_dir)

    # Collect all GG icon files
    all_files = []
    all_files.extend(icon_path.glob("gg_*.png"))
    all_files.extend(icon_path.glob("gg/*.png"))

    if not all_files:
        print(f"No GG icons found in {icon_dir}/")
        print("  Looked for: gg_*.png and gg/*.png")
        return

    inner_size = target_size - 2 * padding
    print(f"Found {len(all_files)} GG icon files")
    print(f"Target: {target_size}x{target_size}px canvas, "
          f"{inner_size}x{inner_size}px icon content, "
          f"{padding}px padding\n")

    resized = 0
    skipped = 0
    errors = 0

    for filepath in sorted(all_files):
        try:
            with Image.open(filepath) as img:
                w, h = img.size
                if w <= target_size and h <= target_size:
                    skipped += 1
                    continue

                # Ensure RGBA for transparency
                img = img.convert("RGBA")

                # Resize icon content to inner_size (LANCZOS for quality)
                icon_resized = img.resize(
                    (inner_size, inner_size),
                    Image.LANCZOS
                )

                # Create transparent canvas at target_size
                canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))

                # Paste icon centered (offset by padding)
                canvas.paste(icon_resized, (padding, padding))

                canvas.save(filepath, "PNG", optimize=True)
                resized += 1
                print(f"  ✓ {filepath.name:50s} {w}x{h} → {inner_size}x{inner_size} + {padding}px pad")

        except Exception as e:
            errors += 1
            print(f"  ✗ {filepath.name}: {e}")

    print(f"\nDone! Resized: {resized}, Already ≤{target_size}px: {skipped}, Errors: {errors}")


def main():
    parser = argparse.ArgumentParser(description="Resize GG icons to match game icon style")
    parser.add_argument("--icon-dir", "-d", default="icons",
                        help="Icons directory (default: icons)")
    parser.add_argument("--size", "-s", type=int, default=32,
                        help="Total canvas size in pixels (default: 32)")
    parser.add_argument("--padding", "-p", type=int, default=3,
                        help="Transparent padding in pixels (default: 3)")
    args = parser.parse_args()

    print(f"{'='*50}")
    print(f"  GG Icon Resizer — {args.size}x{args.size}px, {args.padding}px pad")
    print(f"{'='*50}\n")

    resize_icons(args.icon_dir, args.size, args.padding)


if __name__ == "__main__":
    main()
