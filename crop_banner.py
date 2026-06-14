"""
crop_banner.py — Crop the 3-part banner images to their visible ribbon area.

The raw banner textures have large transparent padding. This script
detects the common visible band and crops all three to align properly.

Usage:
    python crop_banner.py raw/banner icons
"""

import sys
from pathlib import Path
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

def get_alpha_bbox(img, thresh=10):
    """Bounding box of pixels whose alpha exceeds `thresh`.

    A threshold (rather than alpha>0) avoids the faint anti-aliased halo
    ballooning the box to the full image.
    """
    a = img.getchannel('A')
    if thresh:
        a = a.point(lambda v: 255 if v > thresh else 0)
    return a.getbbox()

def main():
    if len(sys.argv) < 3:
        print("Usage: python crop_banner.py <input_dir> <output_dir>")
        sys.exit(1)

    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    names = ['map_label_left', 'map_label_middle', 'map_label_right']
    images = {}
    bboxes = {}

    for name in names:
        path = input_dir / f"{name}.png"
        if not path.exists():
            print(f"Error: {path} not found")
            sys.exit(1)
        img = Image.open(path).convert('RGBA')
        bbox = get_alpha_bbox(img)
        images[name] = img
        bboxes[name] = bbox
        print(f"{name}: {img.size} -> content bbox {bbox}")

    # Find the common vertical band.
    # All three are cropped to the SAME window so the ribbon stays aligned when
    # tiled. The window must be the UNION of every piece's content — the middle
    # band alone clips the left cap's curl (which dips below) and the right cap's
    # rolled ends (which rise above). Using only the middle band was the bug.
    crop_top = min(b[1] for b in bboxes.values())
    crop_bottom = max(b[3] for b in bboxes.values())

    # A few px of breathing room so anti-aliased edges aren't shaved.
    PAD = 4
    img_h = images['map_label_middle'].size[1]
    crop_top = max(0, crop_top - PAD)
    crop_bottom = min(img_h, crop_bottom + PAD)

    print(f"\nCropping to common vertical band (union of all pieces): "
          f"y={crop_top}..{crop_bottom} ({crop_bottom - crop_top}px)")

    for name in names:
        img = images[name]
        w = img.size[0]

        # Crop to full width but common vertical band
        cropped = img.crop((0, crop_top, w, crop_bottom))

        out_path = output_dir / f"{name}.png"
        cropped.save(out_path, "PNG")
        print(f"  {name}: {img.size} -> {cropped.size} saved to {out_path}")

    print("\nDone! Banner images cropped and saved.")


if __name__ == "__main__":
    main()