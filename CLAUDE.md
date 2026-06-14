# KCD2 Interactive Map — Project Context

## Overview
An interactive web map for Kingdom Come: Deliverance 2, deployed at https://quangdao215.github.io/kcd2_interactive_map/. Built with Leaflet.js, extracting POI data from game files, calibrating coordinates to stitched map images, and supplementing with community data.

Repository: `QuangDao215/kcd2_interactive_map` on GitHub Pages.

---

## File Structure

```
E:\kcd2_map\  (repo root)
├── index.html                       # Main map viewer (Leaflet.js, ~3100 lines)
├── main_icon.png                    # Favicon (game icon)
├── README.md, LICENSE, .gitignore
│
├── data/
│   ├── markers_trosky.json          # Trosky region POI markers
│   ├── markers_trosky.js            # Script-tag fallback wrapper
│   ├── markers_kuttenberg.json      # Kuttenberg region POI markers
│   ├── markers_kuttenberg.js        # Script-tag fallback wrapper
│   ├── icon_map.js                  # Maps category IDs → icon PNG paths
│   ├── settlement_labels.js         # Settlement name positions per region
│   ├── local_maps.json              # Local detail map overlay config (bounds, minZoom)
│   └── local_maps.js                # Script-tag fallback for local_maps.json
│
├── maps/
│   ├── trosky/map.png               # 6144×6144 stitched world map
│   ├── kuttenberg/map.png           # 12288×10240 (Reddit source: j5vhvv3hslie1.jpeg)
│   └── local/                       # Local detail map PNGs (23 maps)
│       ├── kutna_hora.png           # 8192×8192 (4×4 grid)
│       ├── troskovice.png           # 4096×4096 (2×2 grid)
│       ├── nomad_camp.png           # 2048×2048 (1×1 single tile)
│       └── ...                      # 21 more local maps
│
├── icons/
│   ├── *.png                        # Map POI icons (32×32 with 2px border)
│   ├── items/*.png                  # Item/loot icons
│   ├── map_label_left.png           # Banner texture left cap (cropped)
│   ├── map_label_middle.png         # Banner texture middle (repeating, cropped)
│   └── map_label_right.png          # Banner texture right cap (cropped)
│
├── tiles/
│   ├── trosky/{z}/{x}/{y}.webp      # Tile pyramid (max zoom 5)
│   └── kuttenberg/{z}/{x}/{y}.webp  # Tile pyramid (max zoom 6)
│
└── tools/                           # Dev/build scripts (Python)
    ├── extract_pois.py              # Extract POIs from game XML
    ├── calibrate_markers.py         # World→pixel coordinate transform
    ├── merge_gamerguides.py         # Fill gaps with community data
    ├── build_markers.py             # Regenerate .js from .json
    ├── generate_tiles.py            # Slice map into Leaflet tile pyramid (WebP)
    ├── stitch_maps.py               # Stitch game map tiles (with background fill)
    ├── process_local_maps.py        # Reconstruct split DDS, stitch local maps
    ├── convert_dds_to_png.py        # Convert DDS files to PNG
    ├── crop_banner.py               # Crop banner textures to visible ribbon
    ├── resize_icons.py              # Resize icons to 32×32 with padding
    └── apply_trosky_correction.py   # Apply 9-point affine correction
```

---

## Architecture & Key Decisions

### Tile-Based Map Rendering
- Switched from L.imageOverlay to L.tileLayer for performance
- Custom CRS per region: `makeMapCRS(maxZoom, mapHeight)` — transformation (1, 0, -1, mapHeight), scale = 2^(z-maxZoom)
- Trosky: max_zoom=5 (8192 canvas), Kuttenberg: max_zoom=6 (16384 canvas)
- Extra zoom +2 beyond native max (Leaflet upscales)
- `errorTileUrl` = transparent 1px PNG data URI for missing tiles
- Performance: `fadeAnimation:false, preferCanvas:true, updateWhenZooming:false, keepBuffer:3`
- Tile seam fix: CSS `outline: 1px solid transparent; backface-visibility: hidden;`
- Map must be recreated on region switch (CRS differs per region)

### Kuttenberg Map Source
- Original game tiles are incomplete (8 of 30 missing — inaccessible areas)
- Missing tiles: 1, 6, 19, 24, 25, 26, 29, 30 in a 6×5 grid
- **Decision**: Use full Reddit community map (j5vhvv3hslie1.jpeg, 12288×10240) directly as the source, bypassing game tile stitching. Complete coverage, no black areas.
- `stitch_maps.py` supports `--background` flag to use tile_0 (overview) or Reddit map as fill for missing areas

### Coordinate Calibration

**Trosky (9-point corrected):**
```
px' = 0.998348*x + 0.004273*y + -7.6644
py' = 0.000673*x + 0.989192*y + 32.1121
```
Applied via `apply_trosky_correction.py`.

**Kuttenberg (GG fast travel bridge, 9-point least squares):**
```
px = 0.9912*x + 0.0068*y + -16.63
py = 0.0334*x + -0.9963*y + 9800.12
```

### Settlement Labels
- Trosky: 8 labels, Kuttenberg: 16 labels (from ui_map_label.xml)
- English names verified against wiki
- 3-part banner textures from game: map_label_left.png + map_label_middle.png (repeating) + map_label_right.png
- Banner images cropped to visible ribbon area via `crop_banner.py`
- Adjustable via in-app "Adjust Banner Style" tool (dynamic CSS stylesheet)

### Local Detail Maps
- 23 unique local maps extracted from game DDS files
- CryEngine split-mipmap format: header (.dds) + mip levels (.dds.1 through .dds.6)
- Reconstruction: header[:128 or 148] + largest mip only, patch mipMapCount=1
- **Column-major** stitching was wrong → **row-major** is correct
- Config stored in `data/local_maps.json` + `data/local_maps.js` (script-tag fallback)
- Visibility: viewport-center containment check + zoom threshold (minZoom: 5.5)
- Calibration tool: Tools → Calibrate Local Map → select map → drag to move, scale % to resize → Export Config downloads both JSON+JS
- Calibrated bounds persist in localStorage + exportable to JSON files

**Local Map Name Mapping:**
| File Name | English Name | Region |
|-----------|-------------|--------|
| apolena | Apollonia | Trosky |
| bohounovice | Bohunowitz | Trosky |
| bylany | Bylany | Kuttenberg |
| certovka | Devil's Den | Trosky |
| grunta | Grund | Kuttenberg |
| horany | Horschan | Trosky |
| klaster_interior | Sedletz Monastery | Kuttenberg |
| kutna_hora | Kuttenberg | Kuttenberg |
| malesov | Maleshov | Kuttenberg |
| miskovice | Miskowitz | Kuttenberg |
| nebakov | Nebakov | Trosky |
| nomad_camp | Nomad's Camp | Trosky |
| opatovice | Sigismund's Camp | Kuttenberg |
| pritoky | Pschitoky | Kuttenberg |
| ratbor | Raborsch | Trosky |
| semin | Semine | Trosky |
| stara_kutna | Old Kutna | Kuttenberg |
| suchdol | Suchdol | Kuttenberg |
| tachov | Tachov | Trosky |
| troskovice | Troskowitz | Trosky |
| trosky | Trosky Castle | Trosky |
| vysoka | Wysoka | Kuttenberg |
| zelejov | Zhelejov | Trosky |

---

## Frontend Features (index.html)

### Sidebar
- 11+ collapsible category groups with real game icons (from ICON_MAP)
- Per-category progress stats: `discovered/total` for PROGRESS_CATEGORIES, plain count for NPCs/facilities
- Group-level percentage: `12/45 (27%)`
- Three tabs: Markers, My Markers, Tools

### Categories
**PROGRESS_CATEGORIES** (tracked with discovered/total):
- All loot_* items, quest_main, quest_side, quest_task
- shrine, conc_cross, grave, interesting_site
- nest, cart_stash, lootable_corpse

**NOT tracked** (plain count only):
- NPCs/merchants, facilities, locations, hunting/fishing spots

**EXTRA_CATEGORIES** (always available even without marker data):
- barber, fist_fight_arena, player_bed, smithy

**Removed classes**: bailiff, pillory (not in game)

**smithy vs blacksmith**: separate categories with separate icons. All original "blacksmith" markers were renamed to "smithy".

### Search
- Type 2+ chars to search markers by name across all categories
- Dropdown with real icons, click → flyTo + open popup
- Also filters category checkboxes simultaneously
- Click outside to close results

### Progress Tracking
- Discovered markers: opacity 0.5
- "Hide discovered" toggle: opacity 0 + pointer-events none (fully invisible)
- Progress stats refresh live on mark/unmark
- User markers included in progress counts

### Custom User Markers
- Right-click to add, custom icon dropdown with real game icons + search filter
- Edit button in popup (inline form with same icon dropdown)
- Delete with confirmation
- Drag to reposition
- flyToMarker from My Markers sidebar list (with real icons)

### Import/Export
- **Export All / Import All**: single backup file with markers + progress + version/date
- Separate Export/Import for markers and progress individually
- Import All handles ID conflict resolution (resets nextUserMarkerId)

### URL Permalinks
- Format: `#zoom/lat/lng` or `#zoom/lat/lng/category:x:y` (with marker)
- Opening any popup updates URL with marker key
- Closing popup reverts to position-only
- Loading URL with marker → flies to it and opens popup

### Map Options
- Settlement names toggle
- Hide discovered toggle
- Detail maps toggle (local map overlays)

### Developer Tools (in Tools tab)
- Calibrate Local Map: select from dropdown → drag to move, scale % to resize → Export Config
- Adjust Banner Style: live sliders for height, offset, font size, spacing, color, cap width (uses dynamic stylesheet to avoid Leaflet conflicts)

---

## Data Pipeline (run in order)

```
stitch_maps.py    → stitch game tiles into map images (--background for missing tiles)
convert_dds_to_png.py → DDS→PNG conversion (handles split CryEngine format)
resize_icons.py   → resize icons to 32×32 with 2px transparent border
extract_pois.py   → extract POI markers from game XML (uncalibrated)
calibrate_markers.py → apply world→pixel coordinate transform
merge_gamerguides.py → fill gaps with community data
build_markers.py  → regenerate .js wrappers from .json
generate_tiles.py → slice map into Leaflet tile pyramid (WebP)
process_local_maps.py → reconstruct split DDS local maps, stitch grids
crop_banner.py    → crop banner textures to visible ribbon area
```

---

## Deployment
- GitHub Pages at https://quangdao215.github.io/kcd2_interactive_map/
- Git auth: Personal Access Token (GCM crashes with Avalonia exception)
- `git config --global --add safe.directory E:/kcd2_map` for ownership check
- Active icons committed selectively via active_icons.txt list

---

## Known Issues / Pending Work

### High Priority
- [ ] Kuttenberg calibration correction (same approach as Trosky 9-point correction — find ground-truth points, compute correction transform)
- [ ] Banner text position still needs fine-tuning via the Adjust Banner Style tool
- [ ] Verify all 23 local map calibrations are accurate in-game

### Medium Priority
- [ ] Mobile responsiveness (sidebar covers map on phones)
- [ ] Marker clustering at low zoom levels (Leaflet.markercluster)
- [ ] More detailed marker descriptions (chest contents, NPC inventories)

### Low Priority
- [ ] Keyboard shortcuts (Escape to close popups, / to focus search)
- [ ] Fullscreen button
- [ ] Reset view button
- [ ] Service worker for offline support
- [ ] Legend overlay showing all icon meanings

---

## Technical Notes

### CRS Transformation
```javascript
function makeMapCRS(maxZoom, mapHeight) {
  return L.CRS.Simple;
  // With transformation: (1, 0, -1, mapHeight) and scale: 2^(z - maxZoom)
}
```
- Marker coords: `L.marker([y, x])` where y is used as lat
- Pixel conversion: `pixel_x = lng = x`, `pixel_y = mapHeight - lat = mapHeight - y`

### localStorage Keys
- `kcd2_last_region` — last viewed region
- `kcd2_user_markers` — custom markers `{trosky: [...], kuttenberg: [...]}`
- `kcd2_discovered_markers` — discovered sets `{trosky: [...], kuttenberg: [...]}`
- `kcd2_active_categories` — enabled category checkboxes
- `kcd2_local_map_bounds` — calibrated local map bounds (temporary override)

### File Protocol Fallback
All data files have both `.json` (fetched via HTTP) and `.js` (loaded via `<script>` tag) versions. The JS wrappers set `window.MARKERS_TROSKY`, `window.MARKERS_KUTTENBERG`, `window.SETTLEMENT_LABELS`, `window.LOCAL_MAPS_DATA`, `window.ICON_MAP` globals. The init function tries fetch first, falls back to globals for `file://` protocol.

### Split DDS Reconstruction (CryEngine)
```
header.dds      → DDS header (808 bytes, includes extended data)
header.dds.1    → smallest mip (2KB)
header.dds.2    → next mip (8KB)
...
header.dds.6    → largest mip (2MB = 2048×2048 BC1)
```
Reconstruction: `header[:128 or 148] + largest_mip`, patch mipMapCount at offset 28 to 1.
Grid stitching: **row-major** (left-to-right, top-to-bottom). Column-major was tested and incorrect.