"""Bump the ?v= cache-buster on every asset/data ref in index.html.

Replaces the old single-letter scheme (?v=2026-07-05z — only 26 values per day,
and hand-edited across ~18 lines) with a timestamp that can't collide or run out.
js/map.js scrapes DATA_VERSION from the icon_map.js <script> tag, so the exact
format is free — it only has to change on every deploy.

Usage:
    python tools/bump_cache.py                    # stamp = current YYYY-MM-DD-HHMM
    python tools/bump_cache.py 2026-07-05-2230    # explicit stamp

Run once before each deploy (and any time the data/JS/CSS changes).
"""
import re
import sys
from datetime import datetime

stamp = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y-%m-%d-%H%M")

path = "index.html"
html = open(path, encoding="utf-8", newline="").read()          # newline="" preserves LF
new, n = re.subn(r"\?v=[\w.\-]+", f"?v={stamp}", html)

if n == 0:
    print("No ?v= cache-buster refs found — nothing changed.")
    sys.exit(1)

open(path, "w", encoding="utf-8", newline="").write(new)
print(f"Bumped {n} cache-buster ref(s) to ?v={stamp}")
