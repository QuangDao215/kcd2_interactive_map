// ═══════════════════════════════════════════════
// ██ INITIALIZATION
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// ██ CUSTOM CRS FOR TILE LAYERS
// ═══════════════════════════════════════════════
// Transformation (1, 0, -1, mapHeight): flips lat so positive lat goes UP
// (matching default L.CRS.Simple convention) but offsets by mapHeight so all
// pixel y values stay non-negative within the image bounds. This preserves
// the existing marker code (`L.marker([y, x])`) without flipping visuals.
// At z = max_zoom, scale = 1 (1 latlng unit = 1 source pixel).
// At z = 0, scale = 1/2^max_zoom (whole map fits in one 256px tile).
function makeMapCRS(maxZoom, mapHeight) {
  return L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(1, 0, -1, mapHeight),
    scale: function (zoom) {
      return Math.pow(2, zoom - maxZoom);
    },
    zoom: function (scale) {
      return Math.log(scale) / Math.LN2 + maxZoom;
    },
  });
}


// Cache-busting: reuse the ?v= version stamped on our data <script> tags in
// index.html so fetch()ed JSON uses the same query string (single source of
// truth = the HTML). Returning visitors then get fresh data after each deploy.
const DATA_VERSION = (() => {
  const s = document.querySelector('script[src*="icon_map.js"]');
  const m = s && (s.getAttribute('src') || '').match(/[?&]v=([^&]+)/);
  return m ? m[1] : '';
})();
function withVersion(url) {
  return DATA_VERSION ? url + (url.includes('?') ? '&' : '?') + 'v=' + DATA_VERSION : url;
}

async function init() {
  // Restore state
  currentRegion = localStorage.getItem(CONFIG.storageKeys.lastRegion) || 'trosky';
  loadUserMarkersFromStorage();
  loadActiveCategoriesFromStorage();
  loadDiscoveredFromStorage();

  // Load local maps config
  try {
    if (window.location.protocol !== 'file:') {
      const resp = await fetch(withVersion('data/local_maps.json'));
      if (resp.ok) localMapsConfig = await resp.json();
    }
  } catch (e) {
    console.warn('[KCD2 Map] Fetch local_maps.json failed:', e);
  }
  // Fallback to script-tag loaded data
  if (Object.keys(localMapsConfig).length === 0 && window.LOCAL_MAPS_DATA) {
    localMapsConfig = window.LOCAL_MAPS_DATA;
  }

  // Set active region button
  document.querySelectorAll('.region-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.region === currentRegion);
  });

  // Load region (creates the map)
  await loadRegion(currentRegion);

  // Restore from URL hash if present
  restoreFromHash();
}

function attachMapEventHandlers() {
  map.on('mousemove', onMouseMove);
  map.on('contextmenu', onRightClick);
  map.on('moveend', updateHash);
  map.on('zoomend', updateLocalMapVisibility);
  map.on('moveend', updateLocalMapVisibility);
  map.on('zoomend', updateLabelScale);
  map.on('zoom', updateZoomDisplay);
  map.on('zoomend', updateZoomDisplay);
  updateZoomDisplay();
}

function updateZoomDisplay() {
  const el = document.getElementById('zoom-display');
  if (el && map) el.textContent = `Zoom ${+map.getZoom().toFixed(2)}`;
}

function onMouseMove(e) {
  const x = Math.round(e.latlng.lng);
  const y = Math.round(e.latlng.lat);
  document.getElementById('coords-display').textContent = `X: ${x}  Y: ${y}`;
}

function restoreFromHash() {
  const hash = window.location.hash;
  if (!hash) return;

  // Format: #zoom/y/x or #zoom/y/x/category:mx:my (with marker permalink)
  const match = hash.match(/#(-?\d+\.?\d*)\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)(?:\/(.+))?/);
  if (match) {
    const zoom = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const x = parseFloat(match[3]);
    const markerKey = match[4] || null;

    map.setView([y, x], zoom);

    if (markerKey) {
      // Open the marker's popup after a short delay for rendering
      setTimeout(() => {
        const marker = markersByKey[markerKey];
        if (marker) {
          // Ensure category is visible
          const catId = markerKey.split(':')[0];
          if (!activeCategories.has(catId) && markerLayers[catId]) {
            activeCategories.add(catId);
            markerLayers[catId].addTo(map);
            renderCategoryList('');
          }
          marker.openPopup();
        }
      }, 500);
    }
  }
}

function updateHash() {
  if (window.location.protocol === 'file:') return;
  const center = map.getCenter();
  const zoom = map.getZoom();
  const hash = `#${zoom.toFixed(2)}/${center.lat.toFixed(1)}/${center.lng.toFixed(1)}`;
  history.replaceState(null, null, hash);
}

function updateHashWithMarker(markerKey) {
  if (window.location.protocol === 'file:') return;
  const center = map.getCenter();
  const zoom = map.getZoom();
  const hash = `#${zoom.toFixed(2)}/${center.lat.toFixed(1)}/${center.lng.toFixed(1)}/${markerKey}`;
  history.replaceState(null, null, hash);
}


// ═══════════════════════════════════════════════
// ██ REGION MANAGEMENT
// ═══════════════════════════════════════════════

async function loadRegion(region, opts = {}) {
  const regionCfg = CONFIG.regions[region];
  const mapW = regionCfg.mapWidth;
  const mapH = regionCfg.mapHeight;
  const maxZoom = regionCfg.max_zoom;

  // When rebuilding the same region (e.g. after saving marker edits), keep the
  // current view instead of snapping back to the full-map fitBounds.
  let savedView = null;
  if (map && opts.preserveView) savedView = { center: map.getCenter(), zoom: map.getZoom() };

  // Destroy existing map (CRS changes per region, so map must be recreated)
  if (map) {
    map.off();
    map.remove();
    map = null;
  }

  // Reset all layer state
  imageOverlay = null;
  markerLayers = {};
  markersByKey = {};
  settlementLabelLayer = null;

  // Create new map with region-specific CRS
  // maxZoom extends beyond the tile pyramid's max — Leaflet upscales the
  // highest-resolution tiles for closer inspection. +2 gives 4× extra zoom.
  const extraZoom = 2;
  map = L.map('map', {
    crs: makeMapCRS(maxZoom, mapH),
    minZoom: 0,
    maxZoom: maxZoom + extraZoom,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true,
    fadeAnimation: false,
  });

  // Bounds in image pixel coordinates
  const bounds = [[0, 0], [mapH, mapW]];
  const pad = 200;
  // Pad south/east/west but NOT north — north padding would produce
  // negative pixel y with our transformation.
  map.setMaxBounds([[-pad, -pad], [mapH, mapW + pad]]);

  // Tile layer — sharp detail where tiles exist.
  // 1×1 transparent PNG as fallback for missing/skipped tiles.
  const EMPTY_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  imageOverlay = L.tileLayer(regionCfg.tilesUrl, {
    tileSize: 256,
    minZoom: 0,
    maxZoom: maxZoom + extraZoom,
    maxNativeZoom: maxZoom,
    minNativeZoom: 0,
    noWrap: true,
    bounds: bounds,
    updateWhenZooming: false,    // don't reload tiles mid-zoom animation
    updateInterval: 150,         // throttle tile updates during pan
    keepBuffer: 3,               // keep extra tiles around viewport
    errorTileUrl: EMPTY_TILE,    // transparent fallback for missing tiles
    attribution: '© Warhorse Studios',
  }).addTo(map);

  // Center on region (or restore the prior view when preserving it)
  map.fitBounds(bounds);
  if (savedView) map.setView(savedView.center, savedView.zoom, { animate: false });
  updateLabelScale();

  // User marker layer
  userMarkerLayer = L.layerGroup().addTo(map);

  // Re-attach event handlers
  attachMapEventHandlers();

  // Load marker data
  if (!allMarkerData[region]) {
    let loaded = false;

    // Only try fetch on http/https (file:// protocol blocks fetch via CORS)
    if (window.location.protocol !== 'file:') {
      try {
        const resp = await fetch(withVersion(regionCfg.markers));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        allMarkerData[region] = await resp.json();
        console.log(`[KCD2 Map] Loaded ${region} via fetch: ${allMarkerData[region].markers?.length || 0} markers`);
        loaded = true;
      } catch (e) {
        console.warn(`[KCD2 Map] Fetch failed for ${region}, trying fallback...`);
      }
    }

    // Fallback: use data loaded via <script> tags
    if (!loaded) {
      const fallbackKey = `MARKER_DATA_${region.toUpperCase()}`;
      if (window[fallbackKey]) {
        allMarkerData[region] = window[fallbackKey];
        console.log(`[KCD2 Map] Loaded ${region} via embedded script: ${allMarkerData[region].markers?.length || 0} markers`);
      } else {
        console.error(`[KCD2 Map] No marker data found for ${region}`);
        allMarkerData[region] = { categories: [], markers: [] };
      }
    }
  }

  // Merge categories (use trosky as the master list). Clone the array so the
  // runtime augmentation below (EXTRA_CATEGORIES + group fallbacks) does NOT
  // mutate the pristine base in allMarkerData — otherwise Save-to-data would
  // bake those placeholder categories into the JSON, bloating it on every save.
  const regionData = allMarkerData[region];
  if (regionData.categories && regionData.categories.length > 0) {
    categories = regionData.categories.slice();
  }

  // Ensure extra categories exist (not in marker JSON but needed for manual markers)
  const EXTRA_CATEGORIES = [
    { id: "barber", name: "Barber", icon: "💈", color: "#c9a84c" },
    { id: "fast_travel_level", name: "Level Transition", icon: "🚪", color: "#5a9ec9" },
    { id: "fist_fight_arena", name: "Fist Fight Arena", icon: "👊", color: "#c9a84c" },
    { id: "player_bed", name: "Player Bed", icon: "🛏️", color: "#c9a84c" },
    { id: "smithy", name: "Smithy", icon: "⚒️", color: "#c9a84c" },
  ];
  EXTRA_CATEGORIES.forEach(extra => {
    if (!categories.find(c => c.id === extra.id)) {
      categories.push(extra);
    }
  });

  // Ensure every category referenced in CATEGORY_GROUPS is available for manual markers
  CATEGORY_GROUPS.forEach(group => {
    group.categories.forEach(catId => {
      if (!categories.find(c => c.id === catId)) {
        // Auto-generate a friendly name from the id
        const name = catId.replace(/^loot_/, '').replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        categories.push({ id: catId, name, icon: "📦", color: "#c9a84c" });
      }
    });
  });

  // Initialize category layers
  categories.forEach(cat => {
    markerLayers[cat.id] = L.layerGroup();
    if (activeCategories.has(cat.id)) {
      markerLayers[cat.id].addTo(map);
    }
  });

  // Add markers to layers (with local renames applied and deletions removed)
  let markerCount = 0;
  getEditedMarkers(region).forEach(m => {
    addPoiMarker(m);
    markerCount++;
  });
  console.log(`[KCD2 Map] Region: ${region}, Categories: ${categories.length}, Markers loaded: ${markerCount}, Active layers: ${activeCategories.size}`);

  // Render user markers
  renderUserMarkersOnMap(region);

  // Render settlement labels
  renderSettlementLabels(region);

  // Load local detail maps
  loadLocalMaps(region);

  // Render sidebar
  renderCategoryList();
  renderMyMarkersList();

  // Apply hide-discovered state if active
  if (hideDiscovered) applyHideDiscovered();

  // Keep the Edit Markers counter + overall game-completion bar in sync
  if (typeof updateMarkerEditStatus === 'function') updateMarkerEditStatus();
  if (typeof updateGameProgress === 'function') updateGameProgress();
}

function switchRegion(region) {
  if (region === currentRegion) return;
  currentRegion = region;
  localStorage.setItem(CONFIG.storageKeys.lastRegion, region);

  document.querySelectorAll('.region-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.region === region);
  });

  loadRegion(region);
}


