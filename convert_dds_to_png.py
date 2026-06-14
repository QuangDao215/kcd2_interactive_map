"""
convert_dds_to_png.py — Convert DDS files (including split CryEngine format) to PNG.

Usage:
    python convert_dds_to_png.py raw/banner
    python convert_dds_to_png.py raw/banner --output raw/banner/png
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


def convert_single_dds(dds_path, output_path):
    """Convert a regular single-file DDS to PNG."""
    try:
        img = Image.open(dds_path)
        img.save(output_path, "PNG")
        return img.size
    except Exception as e:
        return None


def convert_split_dds(header_path, mip_paths, output_path):
    """Convert a split CryEngine DDS (header + mip files) to PNG."""
    header_data = bytearray(header_path.read_bytes())

    # Patch mipMapCount to 1
    if len(header_data) >= 32:
        struct.pack_into('<I', header_data, 28, 1)

    # Detect DX10 header
    header_size = 128
    if len(header_data) >= 88 and header_data[84:88] == b'DX10':
        header_size = 148

    # Use largest mip only
    largest_mip = mip_paths[-1].read_bytes() if mip_paths else b''
    dds_data = bytes(header_data[:header_size]) + largest_mip

    try:
        img = Image.open(BytesIO(dds_data))
        img.convert("RGBA").save(output_path, "PNG")
        return img.size
    except Exception as e:
        print(f"    Error: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Convert DDS files to PNG")
    parser.add_argument("input", type=Path, help="Input directory with DDS files")
    parser.add_argument("--output", "-o", type=Path, default=None,
                        help="Output directory (default: same as input)")
    args = parser.parse_args()

    output_dir = args.output or args.input
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all DDS headers (files ending in .dds but NOT .dds.N)
    dds_files = {}
    for f in sorted(args.input.iterdir()):
        if not f.is_file():
            continue
        if f.suffix == '.dds' and '.dds.' not in f.name:
            # Check for split mips
            mips = []
            for i in range(1, 20):
                mip = args.input / f"{f.name}.{i}"
                if mip.exists():
                    mips.append(mip)
                else:
                    break
            dds_files[f.stem] = {'header': f, 'mips': mips}

    if not dds_files:
        print(f"No DDS files found in {args.input}")
        sys.exit(1)

    print(f"Found {len(dds_files)} DDS files")

    for name, info in sorted(dds_files.items()):
        out_path = output_dir / f"{name}.png"
        header = info['header']
        mips = info['mips']

        if mips:
            # Split DDS
            size = convert_split_dds(header, mips, out_path)
            fmt = f"split ({len(mips)} mips)"
        else:
            # Single DDS
            size = convert_single_dds(header, out_path)
            fmt = "single"

        if size:
            print(f"  ✓ {name}.png  {size[0]}×{size[1]}  ({fmt})")
        else:
            print(f"  ✗ {name}  FAILED ({fmt})")

    print(f"\nDone. PNGs saved to {output_dir}")


if __name__ == "__main__":
    main()