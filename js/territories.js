// ═══════════════════════════════════════════════
// ██ DISCOVERED TERRITORIES (per-marker Voronoi overlay)
// ═══════════════════════════════════════════════
//
// Every marker is a Voronoi seed: each point on the map belongs to its nearest
// marker, and that cell is tinted by whether that marker is discovered — green
// (done) vs a faint red haze (still to find). Discovered clusters merge into solid
// green "areas done"; lone finds light up their neighbourhood. Rendered as a soft,
// low-opacity canvas wash beneath the markers. Opt-in, recomputed live on discover.
//
// The partition is computed with the Jump Flood Algorithm (JFA) so cost is driven
// by the canvas size, NOT the seed count — ~1,600 markers tint as fast as 8 towns.

let showTerritories = false;
let territoryLayer = null;        // L.imageOverlay (the canvas wash)

const TERRITORY_CANVAS_W = 320;   // downsampled grid; the browser upscales it smoothly
const TERRITORY_A_DONE = 0.34;    // green tint over discovered cells
const TERRITORY_A_TODO = 0.15;    // faint red haze over undiscovered cells

// Discovered (green) cells are UNCAPPED — each fills its whole Voronoi territory,
// auto-expanding to consume the empty/un-tinted space nearest a found marker, so
// cleared areas read as broad green regions. Undiscovered (red) cells stay capped
// to this radius (world units) so a lone to-find marker is a small red dot, not a
// red wilderness.
const TERRITORY_RADIUS_TODO = 200;

// A marker seeds the overlay only if its category is "discoverable content" — the
// same PROGRESS_CATEGORIES the completion bar uses (loot, quests, shrines, graves,
// crosses, nests, stashes, corpses, interesting sites). NPCs, shops, and world
// fixtures (dice tables, sharpening wheels, smithies, camps, hunting grounds,
// fast-travel, …) are never "discovered", so they don't seed red cells.
function computeMarkerSeeds(region) {
  const discovered = discoveredMarkers[region] || new Set();
  const markers = [...getEditedMarkers(region), ...(userMarkers[region] || [])];
  const xs = [], ys = [], disc = [];
  markers.forEach(m => {
    if (!PROGRESS_CATEGORIES.has(m.category)) return;
    if (!Number.isFinite(+m.x) || !Number.isFinite(+m.y)) return;
    xs.push(+m.x);
    ys.push(+m.y);
    disc.push(discovered.has(getMarkerKey(m)) ? 1 : 0);
  });
  return { xs, ys, disc, count: xs.length };
}

// Paint the nearest-seed Voronoi via Jump Flood, then colour each pixel by its
// owning marker's discovered flag. Canvas is in image-pixel space (py = (mapH-y)*s)
// so it lines up with the imageOverlay's NW origin. Returns a data URL.
function buildTerritoryCanvasUrl(region, seeds) {
  const cfg = CONFIG.regions[region];
  const mapW = cfg.mapWidth, mapH = cfg.mapHeight;
  const CW = TERRITORY_CANVAS_W;
  const scale = CW / mapW;
  const CH = Math.max(1, Math.round(mapH * scale));
  const N = seeds.count;

  const sx = new Float32Array(N), sy = new Float32Array(N);
  for (let i = 0; i < N; i++) { sx[i] = seeds.xs[i] * scale; sy[i] = (mapH - seeds.ys[i]) * scale; }

  // Jump Flood: ping-pong two index buffers (read previous pass, write current);
  // distance math is inlined in the hot loop. owner index -1 = no seed yet.
  let read = new Int32Array(CW * CH).fill(-1);
  let write = new Int32Array(CW * CH);
  for (let i = 0; i < N; i++) {
    const px = Math.min(CW - 1, Math.max(0, Math.round(sx[i])));
    const py = Math.min(CH - 1, Math.max(0, Math.round(sy[i])));
    read[py * CW + px] = i;
  }

  let step = 1;
  while (step * 2 < Math.max(CW, CH)) step *= 2;
  for (; step >= 1; step = Math.floor(step / 2)) {
    for (let py = 0; py < CH; py++) {
      const rowBase = py * CW;
      for (let px = 0; px < CW; px++) {
        const p = rowBase + px;
        let best = read[p];
        let bestD;
        if (best < 0) { bestD = Infinity; }
        else { const dx = px - sx[best], dy = py - sy[best]; bestD = dx * dx + dy * dy; }
        for (let oy = -1; oy <= 1; oy++) {
          const ny = py + oy * step;
          if (ny < 0 || ny >= CH) continue;
          const nBase = ny * CW;
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const nx = px + ox * step;
            if (nx < 0 || nx >= CW) continue;
            const s = read[nBase + nx];
            if (s < 0) continue;
            const dx = px - sx[s], dy = py - sy[s];
            const dd = dx * dx + dy * dy;
            if (dd < bestD) { bestD = dd; best = s; }
          }
        }
        write[p] = best;
      }
    }
    const tmp = read; read = write; write = tmp;   // swap; result ends up in `read`
  }
  const owner = read;

  const cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(CW, CH);
  const data = img.data;
  const GREEN = [107, 158, 90], RED = [176, 82, 74];
  const ADONE = Math.round(TERRITORY_A_DONE * 255), ATODO = Math.round(TERRITORY_A_TODO * 255);
  // Red radius cap in canvas-pixel² (world radius scaled to this canvas). Green has none.
  const rTodo2 = (TERRITORY_RADIUS_TODO * scale) ** 2;

  // Colour every pixel by its owning seed. Discovered (green) is never capped, so
  // it fills its whole territory; undiscovered (red) is flagged "capped" beyond its
  // radius (a transparent candidate).
  const capped = new Uint8Array(CW * CH);
  for (let p = 0; p < CW * CH; p++) {
    const s = owner[p];
    const idx = p * 4;
    if (s < 0) { data[idx + 3] = 0; capped[p] = 1; continue; }
    if (seeds.disc[s]) {
      data[idx] = GREEN[0]; data[idx + 1] = GREEN[1]; data[idx + 2] = GREEN[2]; data[idx + 3] = ADONE;
      capped[p] = 0;   // green auto-expands to fill its full Voronoi territory
    } else {
      const px = p % CW, py = (p / CW) | 0;
      const dx = px - sx[s], dy = py - sy[s];
      capped[p] = (dx * dx + dy * dy) > rTodo2 ? 1 : 0;
      data[idx] = RED[0]; data[idx + 1] = RED[1]; data[idx + 2] = RED[2]; data[idx + 3] = ATODO;
    }
  }

  // Apply the cap only at the OUTER edge of the marker field: flood-fill the
  // exterior (capped pixels reachable from the canvas border through capped pixels)
  // and blank just those. Capped pixels enclosed by coloured cells are interior
  // gaps — they keep their owner's tint, linking neighbouring areas so the explored
  // region reads as continuous instead of pocked with holes.
  const exterior = new Uint8Array(CW * CH);
  const stack = [];
  const pushIf = q => { if (capped[q] && !exterior[q]) { exterior[q] = 1; stack.push(q); } };
  for (let x = 0; x < CW; x++) { pushIf(x); pushIf((CH - 1) * CW + x); }
  for (let y = 0; y < CH; y++) { pushIf(y * CW); pushIf(y * CW + CW - 1); }
  while (stack.length) {
    const p = stack.pop();
    const px = p % CW, py = (p / CW) | 0;
    if (px > 0) pushIf(p - 1);
    if (px < CW - 1) pushIf(p + 1);
    if (py > 0) pushIf(p - CW);
    if (py < CH - 1) pushIf(p + CW);
  }
  for (let p = 0; p < CW * CH; p++) { if (exterior[p]) data[p * 4 + 3] = 0; }

  ctx.putImageData(img, 0, 0);
  return cv.toDataURL();
}

// The overlay sits above tiles (200) but below detail-map overlays (400) and
// markers (600). Recreated per region because the map is rebuilt on each switch.
function ensureTerritoryPane() {
  if (map && !map.getPane('territoryPane')) {
    const p = map.createPane('territoryPane');
    p.style.zIndex = 350;
    p.style.pointerEvents = 'none';
  }
}

function renderTerritories(region) {
  if (!map) return;
  const seeds = computeMarkerSeeds(region);
  if (!seeds.count) { hideTerritories(); return; }

  ensureTerritoryPane();
  const cfg = CONFIG.regions[region];
  const bounds = [[0, 0], [cfg.mapHeight, cfg.mapWidth]];
  const url = buildTerritoryCanvasUrl(region, seeds);

  if (territoryLayer && map.hasLayer(territoryLayer)) {
    territoryLayer.setBounds(bounds);
    territoryLayer.setUrl(url);
  } else {
    territoryLayer = L.imageOverlay(url, bounds, {
      pane: 'territoryPane', interactive: false, opacity: 1, className: 'territory-overlay',
    }).addTo(map);
  }
}

function hideTerritories() {
  if (territoryLayer && map) map.removeLayer(territoryLayer);
  territoryLayer = null;
}

// Re-tint after the discovered set / marker set changes, but only if showing.
// Debounced so a burst of discoveries coalesces into a single repaint (the
// discovered state itself updates instantly; only the wash trails by a beat).
let _territoryTimer = null;
function refreshTerritories() {
  if (!showTerritories) return;
  if (_territoryTimer) clearTimeout(_territoryTimer);
  _territoryTimer = setTimeout(() => { _territoryTimer = null; renderTerritories(currentRegion); }, 120);
}

function toggleTerritories() {
  const cb = document.getElementById('toggle-territories');
  showTerritories = cb ? cb.checked : !showTerritories;
  try { localStorage.setItem(CONFIG.storageKeys.territories, showTerritories ? '1' : '0'); } catch (e) { /* private mode */ }
  if (showTerritories) renderTerritories(currentRegion);
  else hideTerritories();
}

function loadTerritoryPref() {
  let on = false;
  try { on = localStorage.getItem(CONFIG.storageKeys.territories) === '1'; } catch (e) { /* ignore */ }
  showTerritories = on;
  const cb = document.getElementById('toggle-territories');
  if (cb) cb.checked = on;
}
