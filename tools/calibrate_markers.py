"""
KCD2 Map Coordinate Calibrator
================================
Applies world→pixel coordinate transform to marker JSON files.

Usage:
    # Trosky (calibration already computed)
    python calibrate_markers.py --region trosky --input data/markers_trosky.json --output data/markers_trosky.json

    # Kuttenberg (update calibration points first)
    python calibrate_markers.py --region kuttenberg --input data/markers_kuttenberg.json --output data/markers_kuttenberg.json

Requirements:
    Python 3.8+ (no external packages)
"""

import argparse
import json
import sys
from pathlib import Path


# ══════════════════════════════════════════════
# CALIBRATION DATA
# ══════════════════════════════════════════════

CALIBRATION = {
    "trosky": {
        "points": [
            # (world_x, world_y, pixel_x, pixel_y)
            (1650.6, 2155.25, 2673, 3276),   # Zajezdni Hostinec Zelejov
            (2334.59, 2069.59, 4263, 3087),   # Hospoda Troskovice
            (1998.87, 2531.04, 3478, 4162),   # Hospoda Tachov
        ],
        "map_width": 6144,
        "map_height": 6144,
    },
    "kuttenberg": {
        "points": [
            # (world_x, world_y, pixel_x, pixel_y)
            (1746.7, 3675.9, 3254, 8134),   # Cart in pool
            (2291.4, 757.6,  8442, 4564),   # Caved in mine
            (3765.1, 1261.6, 9894, 7530),   # Cat lady
            (298.8,  2377.9, 3043, 4006),   # Abandoned Barn
        ],
        "map_width": 12288,
        "map_height": 10240,
    },
}


def solve_affine(points):
    """Solve affine transform from 3+ calibration points using least squares."""
    if len(points) < 3:
        raise ValueError(f"Need at least 3 calibration points, got {len(points)}")

    n = len(points)
    wx = [p[0] for p in points]
    wy = [p[1] for p in points]
    px = [p[2] for p in points]
    py = [p[3] for p in points]

    # Normal equations: [sxx sxy sx] [a]   [sdx]
    #                   [sxy syy sy] [b] = [sdy]
    #                   [sx  sy  n ] [c]   [sd ]
    sxx = sum(x*x for x in wx)
    syy = sum(y*y for y in wy)
    sxy = sum(x*y for x, y in zip(wx, wy))
    s_x = sum(wx)
    s_y = sum(wy)

    def solve3(mat, vec):
        def det3(m):
            return (m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1])
                  - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0])
                  + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]))
        def replace_col(m, v, col):
            r = [row[:] for row in m]
            for i in range(3):
                r[i][col] = v[i]
            return r
        d = det3(mat)
        if abs(d) < 1e-10:
            raise ValueError("Calibration points are collinear!")
        return [det3(replace_col(mat, vec, i)) / d for i in range(3)]

    M = [[sxx, sxy, s_x], [sxy, syy, s_y], [s_x, s_y, n]]

    # Solve for pixel_x coefficients
    sdx = sum(x*d for x, d in zip(wx, px))
    sdy = sum(y*d for y, d in zip(wy, px))
    sd  = sum(px)
    a, b, c = solve3(M, [sdx, sdy, sd])

    # Solve for pixel_y coefficients
    sdx2 = sum(x*d for x, d in zip(wx, py))
    sdy2 = sum(y*d for y, d in zip(wy, py))
    sd2  = sum(py)
    d, e, f = solve3(M, [sdx2, sdy2, sd2])

    return a, b, c, d, e, f


def apply_transform(world_x, world_y, coeffs):
    a, b, c, d, e, f = coeffs
    pixel_x = a * world_x + b * world_y + c
    pixel_y = d * world_x + e * world_y + f
    return round(pixel_x), round(pixel_y)


def main():
    parser = argparse.ArgumentParser(description="Apply coordinate calibration to KCD2 marker data")
    parser.add_argument("--region", "-r", required=True, choices=["trosky", "kuttenberg"])
    parser.add_argument("--input", "-i", required=True, help="Input markers JSON file")
    parser.add_argument("--output", "-o", required=True, help="Output markers JSON file")
    args = parser.parse_args()

    cal = CALIBRATION[args.region]
    if not cal["points"]:
        print(f"ERROR: No calibration data for {args.region}!")
        print(f"Edit calibrate_markers.py and fill in the calibration points.")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  KCD2 Marker Calibration — {args.region.title()}")
    print(f"{'='*60}")

    coeffs = solve_affine(cal["points"])
    a, b, c, d, e, f = coeffs
    print(f"\n  Transform:")
    print(f"    pixel_x = {a:.6f} * world_x + {b:.6f} * world_y + {c:.2f}")
    print(f"    pixel_y = {d:.6f} * world_x + {e:.6f} * world_y + {f:.2f}")

    print(f"\n  Verification:")
    for i, (wx, wy, px, py) in enumerate(cal["points"]):
        calc_px, calc_py = apply_transform(wx, wy, coeffs)
        err = max(abs(px - calc_px), abs(py - calc_py))
        print(f"    Point {i+1}: expected ({px}, {py}), got ({calc_px}, {calc_py}), error={err:.1f}px")

    print(f"\n  Loading: {args.input}")
    with open(args.input, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    markers = data.get("markers", [])
    print(f"  Markers to transform: {len(markers)}")

    map_w = cal["map_width"]
    map_h = cal["map_height"]
    out_of_bounds = 0

    for marker in markers:
        wx = marker.get("world_x", 0)
        wy = marker.get("world_y", 0)
        px, py = apply_transform(wx, wy, coeffs)
        marker["x"] = px
        marker["y"] = py
        if px < -200 or px > map_w + 200 or py < -200 or py > map_h + 200:
            out_of_bounds += 1

    if out_of_bounds > 0:
        print(f"  WARNING: {out_of_bounds} markers outside map bounds!")

    data["coordinate_system"] = "pixel"
    data["calibration"] = {
        "method": "affine_3point",
        "points": [{"world": [p[0], p[1]], "pixel": [p[2], p[3]]} for p in cal["points"]],
        "coefficients": {"a": a, "b": b, "c": c, "d": d, "e": e, "f": f},
    }
    data.pop("note", None)

    xs = [m["x"] for m in markers]
    ys = [m["y"] for m in markers]
    print(f"\n  Pixel coordinate ranges:")
    print(f"    X: {min(xs)} — {max(xs)}  (map width: {map_w})")
    print(f"    Y: {min(ys)} — {max(ys)}  (map height: {map_h})")

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    print(f"\n  ✓ Written: {out_path}")

    js_path = out_path.with_suffix(".js")
    with open(js_path, "w", encoding="utf-8") as fh:
        fh.write(f"window.MARKER_DATA_{args.region.upper()} = {json.dumps(data, indent=2, ensure_ascii=False)};")
    print(f"  ✓ Written: {js_path}")

    print(f"\n  Sample markers:")
    print(f"  {'Name':40s} {'World X,Y':>20s} {'Pixel X,Y':>15s}  Category")
    print(f"  {'-'*90}")
    for m in markers[:15]:
        name = m["name"][:38]
        print(f"  {name:40s} ({m['world_x']:8.1f},{m['world_y']:8.1f}) ({m['x']:5d},{m['y']:5d})  {m['category']}")

    print(f"\n{'='*60}")
    print(f"  DONE! Copy data/ files to your map project.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
