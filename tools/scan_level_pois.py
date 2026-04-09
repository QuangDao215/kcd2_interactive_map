"""
KCD2 Level POI Scanner
======================
Scans extracted level.pak files for POI-related entity data.
Handles very large XML files (100MB+) by reading line-by-line.

Usage:
    python scan_level_pois.py --input <extracted_level_folder>
    python scan_level_pois.py --input <extracted_level_folder> --deep

Examples:
    python scan_level_pois.py --input "D:\kcd2_extracted\trosecko\level"
    python scan_level_pois.py --input "D:\kcd2_extracted\trosecko\level" --deep

Requirements:
    Python 3.8+ (no external packages needed)
"""

import argparse
import os
import sys
import re
from pathlib import Path
from collections import defaultdict

# ── Keywords to search for ──
# Tier 1: Very likely to identify POI placement data
TIER1_KEYWORDS = [
    "poi_type_name",
    "poi_type_id",
    "MapPoi",
    "PoiSpot",
    "PoiMarker",
    "PoiTrigger",
    "PoiEntity",
    "discoverable",
    "discovery_dist",
    "mark_type",
]

# Tier 2: Known POI type names from poi_type.xml
TIER2_KEYWORDS = [
    "smokehouse",
    "fasttravel",
    "blacksmith",
    "apothecary",
    "tavern",
    "butchery",
    "armourer",
    "weaponsmiths",
    "herbalist",
    "alchemy",
    "archeryArena",
    "horseTrader",
    "diceTable",
    "baths",
    "campEnemy",
    "shrine",
]

# Tier 3: General entity patterns (used in --deep mode)
TIER3_KEYWORDS = [
    "EntityClass=",
    "poi",
    "checkpoint",
    "fast_travel",
    "map_icon",
    "map_marker",
    "compass",
]

# ── File extensions to scan ──
SCAN_EXTENSIONS = {".xml", ".txt", ".cfg", ".ini", ".json", ".lua", ".lyr"}
# Also scan extensionless files and binary XML
BINARY_EXTENSIONS = {".pak", ".cgf", ".mtl", ".chrparams"}


def format_size(size_bytes):
    """Format file size in human-readable form."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def scan_file(filepath, keywords, context_lines=2, max_matches_per_keyword=5):
    """
    Scan a single file for keyword matches.
    Reads line-by-line to handle very large files.
    Returns dict of keyword -> list of (line_number, line_text, context).
    """
    results = defaultdict(list)
    match_counts = defaultdict(int)

    # Read lines with context buffer
    buffer = []
    buffer_size = context_lines

    try:
        # Try UTF-8 first, fall back to latin-1
        try:
            f = open(filepath, "r", encoding="utf-8", errors="replace")
        except Exception:
            f = open(filepath, "r", encoding="latin-1", errors="replace")

        with f:
            for line_num, line in enumerate(f, 1):
                line_stripped = line.rstrip("\n\r")

                # Keep context buffer
                buffer.append((line_num, line_stripped))
                if len(buffer) > buffer_size * 2 + 1:
                    buffer.pop(0)

                # Check each keyword
                for kw in keywords:
                    if match_counts[kw] >= max_matches_per_keyword:
                        continue
                    if kw.lower() in line.lower():
                        # Grab context
                        context_before = [
                            (n, t) for n, t in buffer[:-1]
                        ]
                        results[kw].append({
                            "line_num": line_num,
                            "line": line_stripped[:500],  # Truncate very long lines
                            "context_before": [(n, t[:300]) for n, t in context_before[-context_lines:]],
                        })
                        match_counts[kw] += 1

    except Exception as e:
        results["__ERROR__"].append({"error": str(e)})

    return results


def scan_directory(input_dir, deep=False, context_lines=2):
    """Scan all files in directory for POI-related data."""
    input_path = Path(input_dir)

    if not input_path.exists():
        print(f"ERROR: Directory not found: {input_dir}")
        sys.exit(1)

    # Collect files to scan
    files_to_scan = []
    total_size = 0

    for root, dirs, files in os.walk(input_path):
        for fname in files:
            fpath = Path(root) / fname
            ext = fpath.suffix.lower()

            # Scan text-based files
            if ext in SCAN_EXTENSIONS or ext == "" or ext in (".dat", ".xml"):
                files_to_scan.append(fpath)
                total_size += fpath.stat().st_size

    print(f"\n{'='*70}")
    print(f"  KCD2 Level POI Scanner")
    print(f"{'='*70}")
    print(f"  Directory: {input_dir}")
    print(f"  Files to scan: {len(files_to_scan)}")
    print(f"  Total size: {format_size(total_size)}")
    print(f"  Mode: {'DEEP (all keywords)' if deep else 'STANDARD (POI keywords)'}")
    print(f"{'='*70}\n")

    # Select keywords based on mode
    keywords = TIER1_KEYWORDS + TIER2_KEYWORDS
    if deep:
        keywords += TIER3_KEYWORDS

    # Track results across all files
    all_results = {}  # filepath -> {keyword -> matches}
    files_with_hits = []
    poi_entity_candidates = []

    for i, fpath in enumerate(sorted(files_to_scan), 1):
        rel_path = fpath.relative_to(input_path)
        size = fpath.stat().st_size
        size_str = format_size(size)

        # Progress indicator
        print(f"  [{i}/{len(files_to_scan)}] Scanning: {rel_path} ({size_str})", end="")
        sys.stdout.flush()

        results = scan_file(fpath, keywords, context_lines)

        # Filter out empty results
        hits = {k: v for k, v in results.items() if v and k != "__ERROR__"}

        if hits:
            all_results[str(rel_path)] = hits
            files_with_hits.append((str(rel_path), hits, size))
            total_hits = sum(len(v) for v in hits.values())
            hit_keywords = list(hits.keys())
            print(f"  ✓ {total_hits} hits [{', '.join(hit_keywords[:5])}]")

            # Check if this file has strong POI placement indicators
            strong_indicators = [k for k in hits if k in TIER1_KEYWORDS]
            if strong_indicators:
                poi_entity_candidates.append((str(rel_path), strong_indicators, size))
        else:
            errors = results.get("__ERROR__", [])
            if errors:
                print(f"  ✗ Error: {errors[0].get('error', 'unknown')}")
            else:
                print(f"  —")

    # ── Summary Report ──
    print(f"\n\n{'='*70}")
    print(f"  SCAN RESULTS SUMMARY")
    print(f"{'='*70}")

    if not files_with_hits:
        print("\n  No matches found. Try:")
        print("  1. Make sure you extracted level.pak correctly")
        print("  2. Run with --deep flag for broader search")
        print("  3. Check if the XML files are binary-encoded")
        return

    print(f"\n  Files with matches: {len(files_with_hits)}")

    # ── Tier 1 candidates (most likely POI data) ──
    if poi_entity_candidates:
        print(f"\n  ★ HIGH-PRIORITY FILES (strong POI indicators):")
        print(f"  {'─'*60}")
        for fpath, indicators, size in poi_entity_candidates:
            print(f"    {fpath} ({format_size(size)})")
            print(f"      Keywords: {', '.join(indicators)}")
        print()

    # ── All files with hits ──
    print(f"\n  ALL FILES WITH MATCHES:")
    print(f"  {'─'*60}")
    for fpath, hits, size in sorted(files_with_hits, key=lambda x: -sum(len(v) for v in x[1].values())):
        total = sum(len(v) for v in hits.values())
        kw_summary = ", ".join(f"{k}({len(v)})" for k, v in sorted(hits.items(), key=lambda x: -len(x[1]))[:8])
        print(f"    {fpath} ({format_size(size)})")
        print(f"      {total} hits: {kw_summary}")

    # ── Detailed match output ──
    print(f"\n\n{'='*70}")
    print(f"  DETAILED MATCHES (first few per file)")
    print(f"{'='*70}")

    for fpath, hits, size in files_with_hits:
        print(f"\n  ┌─ {fpath} ({format_size(size)})")

        for keyword, matches in sorted(hits.items()):
            print(f"  │")
            print(f"  ├── Keyword: \"{keyword}\" ({len(matches)} matches)")

            for m in matches[:3]:  # Show first 3 matches
                print(f"  │   Line {m['line_num']}:")
                for ctx_num, ctx_line in m.get("context_before", []):
                    print(f"  │     {ctx_num:>8}: {ctx_line}")
                print(f"  │   → {m['line_num']:>8}: {m['line']}")

            if len(matches) > 3:
                print(f"  │   ... and {len(matches) - 3} more matches")

        print(f"  └{'─'*60}")

    # ── Extract entity patterns ──
    print(f"\n\n{'='*70}")
    print(f"  ENTITY CLASS PATTERNS FOUND")
    print(f"{'='*70}")

    entity_classes = set()
    for fpath, hits, _ in files_with_hits:
        for keyword, matches in hits.items():
            for m in matches:
                # Extract EntityClass values
                ec_matches = re.findall(r'EntityClass="([^"]+)"', m["line"])
                entity_classes.update(ec_matches)

    if entity_classes:
        print(f"\n  Found {len(entity_classes)} unique EntityClass values near POI keywords:")
        for ec in sorted(entity_classes):
            print(f"    - {ec}")
    else:
        print("\n  No EntityClass patterns found near matches.")

    print(f"\n{'='*70}")
    print(f"  NEXT STEPS")
    print(f"{'='*70}")
    print(f"""
  1. Look at the HIGH-PRIORITY files listed above
  2. Upload the most promising file(s) to Claude for parsing
  3. If files are too large (>50MB), use PowerShell to extract
     relevant sections:

     # Extract lines containing POI data:
     Select-String -Path "filename.xml" -Pattern "poi_type" -Context 5,5 | Out-File poi_matches.txt

     # Or for a specific POI type:
     Select-String -Path "filename.xml" -Pattern "smokehouse" -Context 10,10 | Out-File smokehouse_matches.txt

  4. If no matches found, the POI placement might be in binary
     format. Try searching for the GUID bytes directly:
     
     python scan_level_pois.py --input <folder> --deep
""")


def main():
    parser = argparse.ArgumentParser(
        description="Scan extracted KCD2 level.pak files for POI data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scan_level_pois.py --input "D:\\kcd2_extracted\\trosecko"
    python scan_level_pois.py --input "D:\\kcd2_extracted\\trosecko" --deep
    python scan_level_pois.py --input "D:\\kcd2_extracted\\trosecko" --context 5
        """,
    )
    parser.add_argument("--input", "-i", required=True, help="Folder with extracted level.pak contents")
    parser.add_argument("--deep", "-d", action="store_true", help="Enable deep scan with additional keywords")
    parser.add_argument("--context", "-c", type=int, default=2, help="Number of context lines to show (default: 2)")
    args = parser.parse_args()

    scan_directory(args.input, deep=args.deep, context_lines=args.context)


if __name__ == "__main__":
    main()
