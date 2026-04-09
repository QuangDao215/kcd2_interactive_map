# KCD2 Interactive Map

An interactive web map for **Kingdom Come: Deliverance II**, covering both the Trosky and Kuttenberg regions. Built with [Leaflet.js](https://leafletjs.com/).

Track your progress, find merchants, locate quest objectives, and discover hidden points of interest across Bohemia.

> 🌐 **Live site:** [https://QuangDao215.github.io/kcd2-map/](https://QuangDao215.github.io/kcd2-map/)

![Screenshot placeholder](docs/screenshot.png)

---

## Features

- **Two full regions** — Trosky and Kuttenberg, with calibrated coordinates extracted directly from the game files
- **Hundreds of marker categories** — POIs, merchants, quests, loot, herbs, nests, hunting spots, and more
- **Settlement labels** — All named villages, castles, and camps
- **Progress tracking** — Mark locations as discovered or items as collected; state persists in your browser
- **Custom markers** — Right-click anywhere to add your own waypoints
- **Import / export** — Backup your progress and custom markers as JSON
- **Search and filter** — Find markers by name; toggle entire category groups on or off
- **Shareable URLs** — The URL hash updates as you pan and zoom, so you can link directly to a specific spot
- **Tile-based rendering** — Maps load fast and stay smooth even at full zoom

---

## How to Use

Just open the live site. No login, no account, no tracking. Everything is stored locally in your browser.

- **Pan** — Click and drag
- **Zoom** — Scroll wheel, pinch, or the +/− controls
- **Add a marker** — Right-click anywhere on the map
- **Toggle categories** — Use the sidebar checkboxes
- **Track progress** — Click any marker, then click "Mark as Discovered" or "Mark as Collected"
- **Switch regions** — Click "Trosky" or "Kuttenberg" at the top of the sidebar
- **Backup your data** — Tools tab → Export Progress / Export My Markers

---

## Run Locally

The site is fully static — no build step or server required. But because browsers block `file://` requests, you'll need to serve it through a local HTTP server.

```bash
git clone https://github.com/YOUR_USERNAME/kcd2-map.git
cd kcd2-map
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

Any other static server works too (Node's `http-server`, VS Code Live Server, etc.).

---

## Project Structure

```
kcd2-map/
├── index.html               # Main map viewer
├── data/                    # Marker JSON, category icons, settlement labels
├── icons/                   # Extracted in-game icons (32×32 PNG)
├── tiles/                   # Tile pyramids for both regions (WebP)
│   ├── trosky/
│   └── kuttenberg/
├── tools/                   # Development scripts (data extraction, tile generation)
└── README.md
```

---

## Credits

- **Game, art, map data, and all in-game assets** © [Warhorse Studios](https://warhorsestudios.cz/). This is an unofficial fan project — not affiliated with or endorsed by Warhorse.
- **Community marker data** sourced from [gamerguides.com](https://www.gamerguides.com/kingdom-come-deliverance-ii/maps/trosky-region-map) and verified against the [KCD2 Wiki](https://kingdomcomedeliverance2.wiki.fextralife.com/).
- **Map tiles and icons** extracted from the game files for fan reference. All rights belong to Warhorse.
- **Built with** [Leaflet.js](https://leafletjs.com/).

---

## Contributing

Spotted a missing marker, wrong location, or bug? Open an [issue](https://github.com/YOUR_USERNAME/kcd2-map/issues) or send a pull request.

Especially welcome:
- Missing markers (with coordinates if possible)
- Better English names for locations
- Bug reports with steps to reproduce
- Mobile/touch UX improvements

---

## License

The **code** in this repository is released under the [MIT License](LICENSE).

All **game assets** (icons, map imagery, location names, etc.) belong to Warhorse Studios and are included under fair-use principles for a non-commercial fan project. If you're from Warhorse and would like anything removed, please open an issue.

---

*This is a fan-made project. Kingdom Come: Deliverance II is © Warhorse Studios.*