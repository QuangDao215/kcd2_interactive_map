"""
Split the monolithic app.js into ordered domain scripts under js/.

The split is purely mechanical: app.js is cut into CONTIGUOUS slices at the
existing "// ██ SECTION" banners and the pieces are written in the SAME ORDER.
Because classic <script> tags share one global scope and run in document order,
concatenating js/*.js in order reproduces app.js exactly — zero behaviour change.

A round-trip assertion (join(parts) == original) guards against any slip.
Run from repo root.  Pass --apply to write; default is a dry run.
"""

import os
import sys

APPLY = "--apply" in sys.argv
src = open("app.js", encoding="utf-8").read()
lines = src.splitlines(keepends=True)

# (output filename, banner name that STARTS this file)  — first file = start of app.js
PLAN = [
    ("config.js",        None),
    ("map.js",           "INITIALIZATION"),
    ("markers.js",       "MARKER CREATION"),
    ("sidebar.js",       "CATEGORY MANAGEMENT"),
    ("user-markers.js",  "USER MARKERS"),
    ("import-export.js", "IMPORT / EXPORT"),
    ("local-maps.js",    "LOCAL MAP CALIBRATION TOOL"),
    ("labels.js",        "SETTLEMENT LABELS"),
    ("storage.js",       "LOCAL STORAGE"),
    ("main.js",          "UI HELPERS"),
]

def banner_top(name):
    needle = f"// ██ {name}"
    for i, ln in enumerate(lines):
        if ln.strip() == needle:
            assert lines[i - 1].startswith("// ═"), f"no top border above {name!r} (line {i})"
            return i - 1            # include the top ═══ border with the section
    raise SystemExit(f"banner not found: {name!r}")

cuts = [0] + [banner_top(b) for _, b in PLAN[1:]] + [len(lines)]
parts = [("".join(lines[cuts[i]:cuts[i + 1]])) for i in range(len(PLAN))]

assert "".join(parts) == src, "ROUND-TRIP MISMATCH — aborting"
print("round-trip OK\n")

for (fname, _), chunk in zip(PLAN, parts):
    print(f"  js/{fname:18} {chunk.count(chr(10)):5} lines")
    if APPLY:
        os.makedirs("js", exist_ok=True)
        with open(os.path.join("js", fname), "w", encoding="utf-8", newline="") as f:
            f.write(chunk)

print(f"\ntotal lines: {sum(c.count(chr(10)) for c in parts)} (app.js has {src.count(chr(10))})")
if not APPLY:
    print("\n(dry run — re-run with --apply to write js/ files)")
