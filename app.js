// ═══════════════════════════════════════════════
// ██ CONFIG
// ═══════════════════════════════════════════════

const CONFIG = {
  // Per-region map dimensions and settings
  regions: {
    trosky: {
      mapWidth: 6144,       // 3 cols × 2048
      mapHeight: 6144,      // 3 rows × 2048
      max_zoom: 5,          // tile pyramid max zoom (8192-canvas / 256)
      tilesUrl: 'tiles/trosky/{z}/{x}/{y}.webp',
      markers: 'data/markers_trosky.json',
    },
    kuttenberg: {
      mapWidth: 12288,      // 6 cols × 2048
      mapHeight: 10240,     // 5 rows × 2048
      max_zoom: 6,          // tile pyramid max zoom (16384-canvas / 256)
      tilesUrl: 'tiles/kuttenberg/{z}/{x}/{y}.webp',
      markers: 'data/markers_kuttenberg.json',
    },
  },

  // localStorage keys
  storageKeys: {
    userMarkers: 'kcd2_user_markers',
    activeCategories: 'kcd2_active_categories',
    lastRegion: 'kcd2_last_region',
    discoveredMarkers: 'kcd2_discovered_markers',
  }
};


// ═══════════════════════════════════════════════
// ██ STATE
// ═══════════════════════════════════════════════

let map = null;
let currentRegion = 'trosky';
let imageOverlay = null;
let categories = [];
let activeCategories = new Set();
let markerLayers = {};       // category_id -> L.layerGroup
let markersByKey = {};       // markerKey -> L.marker (for opacity control)
let userMarkerLayer = null;
let settlementLabelLayer = null;  // text labels for settlement names
let labelEditing = false;         // when true, settlement names are drag-to-position
let localMapOverlays = [];       // local detail map overlays
let showLocalMaps = true;
let localMapsConfig = {};        // loaded from data/local_maps.json
let allMarkerData = {};      // region -> { categories, markers }
let userMarkers = {};        // region -> [{ id, name, description, category, x, y }]
let tempMarker = null;
let nextUserMarkerId = 1;
let collapsedGroups = {};    // group_name -> bool (collapsed state)
let discoveredMarkers = {};  // region -> Set of marker keys

// Categories that use "Collected" label (items); everything else uses "Discovered"
const ITEM_CATEGORIES = new Set([
  "loot_sword", "loot_polearm", "loot_heavy_weapon", "loot_bow", "loot_ammo",
  "loot_shield", "loot_dagger", "loot_armour_body", "loot_armour_head",
  "loot_armour_legs", "loot_armour_arms", "loot_armour_jewellery",
  "loot_armour_belt", "loot_armour_pouch", "loot_potion", "loot_poison",
  "loot_skill_book", "loot_recipe", "loot_lore_book", "loot_map", "loot_letter",
  "loot_food", "loot_herb", "loot_blacksmithing", "loot_alchemy_mat",
  "loot_usable", "loot_misc", "loot_utility", "loot_dice", "loot_badge",
  "loot_tack", "loot_saddle", "loot_horseshoe", "loot_bridle",
]);

// Categories that count toward progress stats (collectible/discoverable only).
// NPCs, facilities, and persistent map fixtures are excluded.
const PROGRESS_CATEGORIES = new Set([
  // All loot items
  ...ITEM_CATEGORIES,
  // Quests
  "quest_main", "quest_side", "quest_task",
  // Discoverable landmarks
  "shrine", "conc_cross", "grave", "interesting_site",
  // One-time lootable
  "nest", "cart_stash", "lootable_corpse",
]);

// ── Category Groups (sidebar organization) ──
const CATEGORY_GROUPS = [
  { name: "Armour", collapsed: true, categories: [
    "loot_armour_arms", "loot_armour_belt", "loot_armour_body",
    "loot_armour_head", "loot_armour_jewellery", "loot_armour_legs",
    "loot_armour_pouch"
  ]},
  { name: "Books", collapsed: true, categories: [
    "loot_letter", "loot_lore_book", "loot_map", "loot_recipe", "loot_skill_book"
  ]},
  { name: "Food", collapsed: true, categories: ["loot_food"] },
  { name: "Materials", collapsed: true, categories: [
    "loot_alchemy_mat", "loot_blacksmithing", "loot_herb"
  ]},
  { name: "NPCs", collapsed: true, categories: [
    "apothecary", "armourer", "baker", "barber", "baths", "blacksmith",
    "butchery", "cobbler", "fisherman", "grocer", "gunsmith", "herbalist",
    "horse_trader", "huntsman", "miller", "saddler", "scribe", "shield_painter",
    "skill_trainer", "smithy", "tailor", "tanner", "tavern", "trader", "weaponsmith"
  ]},
  { name: "Poisons", collapsed: true, categories: ["loot_poison"] },
  { name: "Potions", collapsed: true, categories: ["loot_potion"] },
  { name: "Quests", collapsed: true, categories: [
    "quest_main", "quest_side", "quest_task"
  ]},
  { name: "Tack", collapsed: true, categories: [
    "loot_bridle", "loot_horseshoe", "loot_saddle", "loot_tack"
  ]},
  { name: "Weapons", collapsed: true, categories: [
    "loot_ammo", "loot_bow", "loot_dagger", "loot_heavy_weapon",
    "loot_polearm", "loot_shield", "loot_sword"
  ]},
  { name: "Points of Interest", collapsed: true, categories: [
    "alchemy_bench", "archery_range", "bandit_camp", "beehive",
    "camp", "cart_stash", "combat_arena", "conc_cross", "dice_table",
    "dog", "drying_rack", "fast_travel", "fist_fight_arena", "grave", "home",
    "hunting_spot", "hunting_boar", "hunting_deer", "hunting_wolf",
    "indulgence_box", "interesting_site", "lodgings", "loot_badge",
    "loot_dice", "loot_misc", "loot_usable", "loot_utility",
    "lootable_corpse", "nest", "player_bed", "selling_chest",
    "sharpening_wheel", "shrine", "smokehouse", "underground", "washing",
    "woodland_garden"
  ]},
];

// Per-group accent colours — used to tint marker glows and the legend group
// titles, so categories are distinguishable at a glance.
const GROUP_COLORS = {
  "Armour": "#9aa7b5",            // steel
  "Books": "#c9954c",            // parchment
  "Food": "#8fae5a",            // green
  "Materials": "#b5764c",        // copper
  "NPCs": "#c9a84c",            // gold
  "Poisons": "#6fae7a",          // venom green
  "Potions": "#a06ab5",          // violet
  "Quests": "#e0c24c",          // bright gold
  "Tack": "#a98c6a",            // leather
  "Weapons": "#c25a5a",          // blood red
  "Points of Interest": "#5a9ec9", // blue
};
const DEFAULT_GROUP_COLOR = "#c9a84c";
const _catGroupColorCache = {};
function categoryGroupColor(catId) {
  if (catId in _catGroupColorCache) return _catGroupColorCache[catId];
  const group = CATEGORY_GROUPS.find(g => g.categories.includes(catId));
  const color = group ? (GROUP_COLORS[group.name] || DEFAULT_GROUP_COLOR) : DEFAULT_GROUP_COLOR;
  _catGroupColorCache[catId] = color;
  return color;
}


// ═══════════════════════════════════════════════
// ██ INITIALIZATION
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// ██ CUSTOM CRS FOR TILE LAYERS
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


async function init() {
  // Restore state
  currentRegion = localStorage.getItem(CONFIG.storageKeys.lastRegion) || 'trosky';
  loadUserMarkersFromStorage();
  loadActiveCategoriesFromStorage();
  loadDiscoveredFromStorage();

  // Load local maps config
  try {
    if (window.location.protocol !== 'file:') {
      const resp = await fetch('data/local_maps.json');
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

async function loadRegion(region) {
  const regionCfg = CONFIG.regions[region];
  const mapW = regionCfg.mapWidth;
  const mapH = regionCfg.mapHeight;
  const maxZoom = regionCfg.max_zoom;

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

  // Center on region
  map.fitBounds(bounds);
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
        const resp = await fetch(regionCfg.markers);
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

  // Merge categories (use trosky as the master list)
  const regionData = allMarkerData[region];
  if (regionData.categories && regionData.categories.length > 0) {
    categories = regionData.categories;
  }

  // Ensure extra categories exist (not in marker JSON but needed for manual markers)
  const EXTRA_CATEGORIES = [
    { id: "barber", name: "Barber", icon: "💈", color: "#c9a84c" },
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


// ═══════════════════════════════════════════════
// ██ MARKER CREATION
// ═══════════════════════════════════════════════

function createMarkerIcon(emoji, color, size = 28, categoryId = '', glowColor = '') {
  // Use extracted game icon if available — no circle background
  const iconMap = window.ICON_MAP || {};
  const iconPath = iconMap[categoryId];

  if (iconPath) {
    return L.divIcon({
      className: 'poi-marker',
      html: `<img src="${iconPath}" style="--glow:${glowColor || 'transparent'};width:${size}px;height:${size}px;object-fit:contain;display:block;" alt="">`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }

  // Fallback: emoji icon with circle
  return L.divIcon({
    className: '',
    html: `<div class="custom-marker-icon" style="background:${color};width:${size}px;height:${size}px;font-size:${size * 0.5}px;">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function addPoiMarker(markerData) {
  const cat = categories.find(c => c.id === markerData.category);
  if (!cat) {
    console.warn(`[KCD2 Map] Skipped marker "${markerData.name}" — category "${markerData.category}" not found`);
    return;
  }

  const icon = createMarkerIcon(cat.icon, cat.color, 28, cat.id, categoryGroupColor(cat.id));
  const marker = L.marker([markerData.y, markerData.x], { icon });
  marker.bindTooltip(markerData.name, { direction: 'top', offset: [0, -16], opacity: 0.95, className: 'poi-tooltip' });

  const markerKey = getMarkerKey(markerData);
  const isItem = ITEM_CATEGORIES.has(markerData.category);
  const doneLabel = isItem ? '✓ Collected' : '✓ Discovered';
  const undoneLabel = isItem ? '☐ Mark as Collected' : '☐ Mark as Discovered';
  const btnId = `prog-${markerKey.replace(/[^a-zA-Z0-9]/g, '_')}`;

  marker.on('popupopen', () => updateHashWithMarker(markerKey));
  marker.on('popupclose', () => updateHash());

  // Popup content is built at open time so it reflects the current discovered
  // state and switches to an inline edit form when the Edit Markers tool is on.
  marker._poi = markerData;
  marker._cat = cat;
  marker.bindPopup(() => poiPopupHtml(markerData, cat, markerKey, btnId, doneLabel, undoneLabel), { maxWidth: 280 });

  // Store reference for opacity control
  markersByKey[markerKey] = marker;

  // Fade discovered markers
  if (isMarkerDiscovered(markerData)) {
    marker.setOpacity(0.5);
  }

  if (markerLayers[cat.id]) {
    markerLayers[cat.id].addLayer(marker);
  }
}

// ── POI marker editing (Edit Markers tool) ──
let markerEditing = false;
const MARKER_EDIT_KEY = 'kcd2_marker_edits';
const MARKER_DELETE_KEY = 'kcd2_marker_deletes';

function loadMarkerEdits(region) {
  try { return (JSON.parse(localStorage.getItem(MARKER_EDIT_KEY) || '{}'))[region] || {}; }
  catch (e) { return {}; }
}
function loadMarkerDeletes(region) {
  try { return (JSON.parse(localStorage.getItem(MARKER_DELETE_KEY) || '{}'))[region] || []; }
  catch (e) { return []; }
}
function saveMarkerEdit(region, key, name) {
  try {
    const all = JSON.parse(localStorage.getItem(MARKER_EDIT_KEY) || '{}');
    if (!all[region]) all[region] = {};
    all[region][key] = { name };
    localStorage.setItem(MARKER_EDIT_KEY, JSON.stringify(all));
  } catch (e) { console.error('Failed to save marker edit:', e); }
}
function addMarkerDelete(region, key) {
  try {
    const all = JSON.parse(localStorage.getItem(MARKER_DELETE_KEY) || '{}');
    if (!all[region]) all[region] = [];
    if (!all[region].includes(key)) all[region].push(key);
    localStorage.setItem(MARKER_DELETE_KEY, JSON.stringify(all));
  } catch (e) { console.error('Failed to save marker deletion:', e); }
}

// Base markers for a region with local renames applied and deletions removed.
// Returns fresh copies so the pristine allMarkerData is never mutated.
function getEditedMarkers(region) {
  // Use the loaded region data, else the script-tag global (so progress can be
  // counted for a region the user hasn't opened yet).
  const g = window['MARKER_DATA_' + region.toUpperCase()];
  const base = (allMarkerData[region] && allMarkerData[region].markers)
    || (g && g.markers) || [];
  const edits = loadMarkerEdits(region);
  const deletes = new Set(loadMarkerDeletes(region));
  const out = [];
  base.forEach(m => {
    const key = getMarkerKey(m);
    if (deletes.has(key)) return;
    const e = edits[key];
    out.push(e && e.name != null ? { ...m, name: e.name } : { ...m });
  });
  return out;
}

// Popup content — normal view, or an inline edit form when the tool is active.
function poiPopupHtml(markerData, cat, markerKey, btnId, doneLabel, undoneLabel) {
  if (markerEditing) {
    const safeName = (markerData.name || '').replace(/"/g, '&quot;');
    return `<div class="popup-category">${cat.name}</div>
      <div class="marker-form" style="min-width:210px;">
        <label>Marker name</label>
        <input type="text" id="poi-edit-name" value="${safeName}">
        <div class="popup-coords" style="margin-top:6px;">X: ${markerData.x} &nbsp; Y: ${markerData.y}</div>
        <div class="form-actions">
          <button class="btn btn-del" onclick="deletePoiMarker('${markerKey}')">🗑 Delete</button>
          <button class="btn btn-save" onclick="savePoiMarkerName('${markerKey}')">Save</button>
        </div>
      </div>`;
  }
  const discovered = isMarkerDiscovered(markerData);
  return `<div class="popup-title">${markerData.name}</div>
    <div class="popup-category">${cat.name}</div>
    ${markerData.description ? `<div class="popup-desc">${markerData.description}</div>` : ''}
    <div class="popup-coords">X: ${markerData.x} &nbsp; Y: ${markerData.y}</div>
    <button class="popup-progress-btn${discovered ? ' completed' : ''}" id="${btnId}"
      data-done-label="${doneLabel}" data-undone-label="${undoneLabel}"
      onclick="toggleMarkerDiscovered('${markerKey}', '${btnId}')">${discovered ? doneLabel : undoneLabel}</button>`;
}

function savePoiMarkerName(key) {
  const input = document.getElementById('poi-edit-name');
  if (!input) return;
  const newName = input.value.trim();
  if (!newName) { showToast('Name cannot be empty'); return; }
  const marker = markersByKey[key];
  if (marker) {
    if (marker._poi) marker._poi.name = newName;
    if (marker.getTooltip()) marker.setTooltipContent(newName);
    marker.closePopup();
  }
  saveMarkerEdit(currentRegion, key, newName);
  renderCategoryList(document.getElementById('search-input')?.value || '');
  updateMarkerEditStatus();
  showToast(`Renamed to "${newName}"`);
}

function deletePoiMarker(key) {
  showConfirm('Delete this marker from the map data? You can restore it later with Reset in the Edit Markers tool.', { title: 'Delete marker', confirmText: 'Delete', danger: true }).then(ok => {
    if (!ok) return;
    const marker = markersByKey[key];
    if (marker) {
      marker.closePopup();
      const catId = key.split(':')[0];
      if (markerLayers[catId] && markerLayers[catId].hasLayer(marker)) markerLayers[catId].removeLayer(marker);
      delete markersByKey[key];
    }
    addMarkerDelete(currentRegion, key);
    renderCategoryList(document.getElementById('search-input')?.value || '');
    updateMarkerEditStatus();
    updateGameProgress();
    showToast('Marker deleted');
  });
}

// ── Edit Markers tool ──
function markerEditCounts(region) {
  return { renamed: Object.keys(loadMarkerEdits(region)).length, deleted: loadMarkerDeletes(region).length };
}
function updateMarkerEditStatus() {
  const el = document.getElementById('marker-edit-status');
  if (!el) return;
  const { renamed, deleted } = markerEditCounts(currentRegion);
  const total = renamed + deleted;
  if (total === 0) {
    el.className = 'me-status';
    el.textContent = `No unsaved changes for ${currentRegion}`;
  } else {
    el.className = 'me-status active';
    el.textContent = `${total} unsaved change${total > 1 ? 's' : ''} (${renamed} renamed · ${deleted} deleted)`;
  }
}
function markerEditOpen() {
  if (!ensureSoleTool('marker-edit-panel')) return;
  document.getElementById('marker-edit-panel').classList.add('active');
  updateMarkerEditStatus();
}
function markerEditClose() {
  if (markerEditing) markerEditToggle();  // leave edit mode cleanly
  document.getElementById('marker-edit-panel').classList.remove('active');
}
function markerEditToggle() {
  markerEditing = !markerEditing;
  const btn = document.getElementById('marker-edit-toggle');
  if (btn) {
    btn.textContent = markerEditing ? '■ Stop Editing' : '✥ Start Editing';
    btn.classList.toggle('btn-primary', markerEditing);
    btn.classList.toggle('btn-secondary', !markerEditing);
  }
  if (map) map.closePopup();  // reopen in the right mode
  showToast(markerEditing ? 'Click a marker to rename or delete it' : 'Marker editing off');
}
function markerEditReset() {
  showConfirm(`Discard all marker renames and deletions for ${currentRegion}? This restores them to the original data.`, { title: 'Reset marker edits', confirmText: 'Reset', danger: true }).then(ok => {
    if (!ok) return;
    try {
      const edits = JSON.parse(localStorage.getItem(MARKER_EDIT_KEY) || '{}');
      const deletes = JSON.parse(localStorage.getItem(MARKER_DELETE_KEY) || '{}');
      delete edits[currentRegion];
      delete deletes[currentRegion];
      localStorage.setItem(MARKER_EDIT_KEY, JSON.stringify(edits));
      localStorage.setItem(MARKER_DELETE_KEY, JSON.stringify(deletes));
    } catch (e) {}
    loadRegion(currentRegion);  // rebuild from original data
    updateMarkerEditStatus();
    showToast(`Marker edits reset for ${currentRegion}`);
  });
}
function markerEditExport() {
  const region = currentRegion;
  const { jsonStr, jsStr } = buildMarkerFiles(region);
  markerDownload(`markers_${region}.json`, jsonStr, 'application/json');
  setTimeout(() => markerDownload(`markers_${region}.js`, jsStr, 'text/javascript'), 120);
  const editCount = Object.keys(loadMarkerEdits(region)).length;
  const delCount = loadMarkerDeletes(region).length;
  showToast(`Downloaded markers_${region}.{js,json} (${editCount} renamed, ${delCount} deleted) — move both into data/`);
}
function markerDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Build the {json, js} contents for a region's marker file (edits applied).
function buildMarkerFiles(region) {
  const base = allMarkerData[region] || { region, markers: [] };
  const out = { ...base, markers: getEditedMarkers(region) };
  const jsonStr = JSON.stringify(out, null, 2);
  const jsStr = `// Marker data for ${region} — edited via the in-app Edit Markers tool\nwindow.MARKER_DATA_${region.toUpperCase()} = ${jsonStr};\n`;
  return { out, jsonStr, jsStr };
}

function clearRegionMarkerEdits(region) {
  try {
    const e = JSON.parse(localStorage.getItem(MARKER_EDIT_KEY) || '{}'); delete e[region];
    localStorage.setItem(MARKER_EDIT_KEY, JSON.stringify(e));
    const d = JSON.parse(localStorage.getItem(MARKER_DELETE_KEY) || '{}'); delete d[region];
    localStorage.setItem(MARKER_DELETE_KEY, JSON.stringify(d));
  } catch (err) {}
}

// Directly write the edited marker files into the project's data/ folder using
// the File System Access API. Requires Chrome/Edge over http://localhost (a
// secure context) and a one-time folder grant. Falls back to a download.
let dataDirHandle = null;
async function writeFileToDir(dirHandle, name, contents) {
  const fh = await dirHandle.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(contents);
  await w.close();
}
async function markerEditSaveToData() {
  const region = currentRegion;
  const { renamed, deleted } = markerEditCounts(region);
  if (renamed + deleted === 0) { showToast(`No unsaved changes for ${region}`); return; }
  if (!window.showDirectoryPicker) {
    showToast('Direct save needs Chrome/Edge over http://localhost — downloading instead');
    markerEditExport();
    return;
  }
  try {
    if (!dataDirHandle) {
      showToast('Select your project’s data/ folder…');
      dataDirHandle = await window.showDirectoryPicker({ id: 'kcd2-data', mode: 'readwrite' });
    }
    if (await dataDirHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      if (await dataDirHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
        showToast('Write permission denied'); return;
      }
    }
    const { out, jsonStr, jsStr } = buildMarkerFiles(region);
    await writeFileToDir(dataDirHandle, `markers_${region}.json`, jsonStr);
    await writeFileToDir(dataDirHandle, `markers_${region}.js`, jsStr);
    // Files are now the source of truth: fold edits into the in-memory base and
    // clear the pending-changes store so the model stays consistent.
    allMarkerData[region] = out;
    clearRegionMarkerEdits(region);
    updateMarkerEditStatus();
    showToast(`Saved markers_${region}.{js,json} to data/ ✓ (${renamed} renamed, ${deleted} deleted)`);
  } catch (e) {
    if (e && e.name === 'AbortError') return; // user cancelled the picker
    console.error('Save to data/ failed:', e);
    showToast('Save failed — see console (F12)');
  }
}

function addUserMarkerToMap(markerData) {
  const cat = categories.find(c => c.id === markerData.category);
  const icon = createMarkerIcon(
    cat ? cat.icon : '📌',
    cat ? cat.color : '#c9a84c',
    26,
    cat ? cat.id : ''
  );

  const marker = L.marker([markerData.y, markerData.x], { icon, draggable: true });

  const markerKey = getMarkerKey(markerData);
  const isItem = ITEM_CATEGORIES.has(markerData.category);
  const doneLabel = isItem ? '✓ Collected' : '✓ Discovered';
  const undoneLabel = isItem ? '☐ Mark as Collected' : '☐ Mark as Discovered';
  const btnId = `prog-user-${markerKey.replace(/[^a-zA-Z0-9]/g, '_')}`;

  marker.on('popupopen', () => {
    const btn = document.getElementById(btnId);
    if (btn) {
      const discovered = isMarkerDiscovered(markerData);
      btn.classList.toggle('completed', discovered);
      btn.textContent = discovered ? doneLabel : undoneLabel;
    }
  });

  const popupHtml = `
    <div class="popup-title">${markerData.name || 'Custom Marker'}</div>
    <div class="popup-category">${cat ? cat.name : 'Custom'} — User Marker</div>
    ${markerData.description ? `<div class="popup-desc">${markerData.description}</div>` : ''}
    <div class="popup-coords">X: ${markerData.x} &nbsp; Y: ${markerData.y}</div>
    <button class="popup-progress-btn" id="${btnId}"
      data-done-label="${doneLabel}" data-undone-label="${undoneLabel}"
      onclick="toggleMarkerDiscovered('${markerKey}', '${btnId}')">${undoneLabel}</button>
    <div class="popup-actions">
      <button class="popup-action-btn" onclick="editUserMarker(${markerData.id})">✎ Edit</button>
      <button class="popup-action-btn danger" onclick="showConfirm('Delete this marker?',{title:'Delete marker',confirmText:'Delete',danger:true}).then(ok=>ok&&deleteUserMarker(${markerData.id}))">✕ Delete</button>
    </div>
  `;
  marker.bindPopup(popupHtml, { maxWidth: 280 });

  // Store reference for opacity control
  markersByKey[markerKey] = marker;

  // Fade discovered markers
  if (isMarkerDiscovered(markerData)) {
    marker.setOpacity(0.5);
  }

  // Update position on drag
  marker.on('dragend', function(e) {
    const pos = e.target.getLatLng();
    markerData.x = Math.round(pos.lng);
    markerData.y = Math.round(pos.lat);
    saveUserMarkersToStorage();
    renderMyMarkersList();

    // Update popup with new coords (keep discover button)
    const newBtnId = `prog-user-${getMarkerKey(markerData).replace(/[^a-zA-Z0-9]/g, '_')}`;
    const newPopup = `
      <div class="popup-title">${markerData.name || 'Custom Marker'}</div>
      <div class="popup-category">${cat ? cat.name : 'Custom'} — User Marker</div>
      ${markerData.description ? `<div class="popup-desc">${markerData.description}</div>` : ''}
      <div class="popup-coords">X: ${markerData.x} &nbsp; Y: ${markerData.y}</div>
      <button class="popup-progress-btn" id="${newBtnId}"
        data-done-label="${doneLabel}" data-undone-label="${undoneLabel}"
        onclick="toggleMarkerDiscovered('${getMarkerKey(markerData)}', '${newBtnId}')">${undoneLabel}</button>
      <div class="popup-actions">
        <button class="popup-action-btn" onclick="editUserMarker(${markerData.id})">✎ Edit</button>
        <button class="popup-action-btn danger" onclick="showConfirm('Delete this marker?',{title:'Delete marker',confirmText:'Delete',danger:true}).then(ok=>ok&&deleteUserMarker(${markerData.id}))">✕ Delete</button>
      </div>
    `;
    marker.setPopupContent(newPopup);

    // Update markersByKey with new key
    delete markersByKey[markerKey];
    markersByKey[getMarkerKey(markerData)] = marker;
  });

  marker._userMarkerId = markerData.id;
  userMarkerLayer.addLayer(marker);
}


// ═══════════════════════════════════════════════
// ██ CATEGORY MANAGEMENT
// ═══════════════════════════════════════════════

function renderCategoryList(filter = '') {
  const list = document.getElementById('category-list');
  const regionMarkers = [
    ...getEditedMarkers(currentRegion),
    ...(userMarkers[currentRegion] || []),
  ];
  const filterLower = filter.toLowerCase();
  const iconMap = window.ICON_MAP || {};

  // Initialize collapsed state from defaults on first render
  if (Object.keys(collapsedGroups).length === 0) {
    CATEGORY_GROUPS.forEach(g => { collapsedGroups[g.name] = g.collapsed; });
  }

  // Build a set of all grouped category IDs
  const groupedCatIds = new Set();
  CATEGORY_GROUPS.forEach(g => g.categories.forEach(id => groupedCatIds.add(id)));

  // Collect ungrouped categories (categories in data but not in any group)
  const ungroupedCats = categories.filter(cat =>
    !groupedCatIds.has(cat.id) &&
    (!filter || cat.name.toLowerCase().includes(filterLower))
  );

  let html = '';

  // Render each group
  CATEGORY_GROUPS.forEach(group => {
    // Get categories in this group that exist in current data
    const groupCats = group.categories
      .map(id => categories.find(c => c.id === id))
      .filter(cat => cat && (!filter || cat.name.toLowerCase().includes(filterLower)));

    if (groupCats.length === 0) return; // Skip empty groups

    // Calculate group totals and discovered counts (only for progress-trackable categories)
    const groupTotal = groupCats.reduce((sum, cat) =>
      sum + regionMarkers.filter(m => m.category === cat.id).length, 0);
    const progressCats = groupCats.filter(cat => PROGRESS_CATEGORIES.has(cat.id));
    const progressTotal = progressCats.reduce((sum, cat) =>
      sum + regionMarkers.filter(m => m.category === cat.id).length, 0);
    const progressDiscovered = progressCats.reduce((sum, cat) =>
      sum + regionMarkers.filter(m => m.category === cat.id && isMarkerDiscovered(m)).length, 0);
    const groupActiveCount = groupCats.filter(cat => activeCategories.has(cat.id)).length;
    const hasProgress = progressTotal > 0;
    const groupPct = progressTotal > 0 ? Math.round(progressDiscovered / progressTotal * 100) : 0;

    const isExpanded = filter ? true : !collapsedGroups[group.name]; // Expand all when searching
    const expandedClass = isExpanded ? 'expanded' : '';

    html += `<div class="cat-group">`;
    html += `<div class="cat-group-header ${expandedClass}" onclick="toggleGroup('${group.name}')">`;
    html += `  <span class="group-arrow">▶</span>`;
    html += `  <span class="group-name">${group.name}</span>`;
    html += hasProgress
      ? `  <span class="group-progress">${progressDiscovered}/${progressTotal} (${groupPct}%)</span>`
      : `  <span class="group-progress">${groupTotal}</span>`;
    html += `  <button class="group-toggle-all${groupActiveCount === groupCats.length ? ' on' : ''}" aria-label="Toggle all ${group.name}" onclick="event.stopPropagation();toggleGroupCategories('${group.name}', ${groupActiveCount < groupCats.length})"></button>`;
    html += `</div>`;
    html += `<div class="cat-group-children ${expandedClass}">`;

    groupCats.forEach(cat => {
      const catMarkers = regionMarkers.filter(m => m.category === cat.id);
      const count = catMarkers.length;
      const trackable = PROGRESS_CATEGORIES.has(cat.id);
      const discovered = trackable ? catMarkers.filter(m => isMarkerDiscovered(m)).length : 0;
      const active = activeCategories.has(cat.id);
      const iconHtml = iconMap[cat.id]
        ? `<img src="${iconMap[cat.id]}" style="width:20px;height:20px;object-fit:contain;" alt="">`
        : cat.icon;
      const statsHtml = trackable
        ? `<span class="cat-progress"><span class="done">${discovered}</span>/${count}</span>`
        : `<span class="cat-progress">${count}</span>`;
      html += `
        <div class="category-item ${active ? 'active' : ''}" onclick="toggleCategory('${cat.id}')">
          <span class="cat-icon">${iconHtml}</span>
          <span class="cat-name">${cat.name}</span>
          ${statsHtml}
          <span class="cat-toggle"></span>
        </div>`;
    });

    html += `</div></div>`;
  });

  // Render ungrouped categories at the bottom (if any)
  if (ungroupedCats.length > 0) {
    if (collapsedGroups['Other'] === undefined) collapsedGroups['Other'] = true;
    const otherExpanded = filter ? true : !collapsedGroups['Other'];
    const otherClass = otherExpanded ? 'expanded' : '';
    const otherTotal = ungroupedCats.reduce((sum, cat) =>
      sum + regionMarkers.filter(m => m.category === cat.id).length, 0);
    const otherProgressCats = ungroupedCats.filter(cat => PROGRESS_CATEGORIES.has(cat.id));
    const otherProgressTotal = otherProgressCats.reduce((sum, cat) =>
      sum + regionMarkers.filter(m => m.category === cat.id).length, 0);
    const otherDiscovered = otherProgressCats.reduce((sum, cat) =>
      sum + regionMarkers.filter(m => m.category === cat.id && isMarkerDiscovered(m)).length, 0);
    const otherActiveCount = ungroupedCats.filter(cat => activeCategories.has(cat.id)).length;
    const otherHasProgress = otherProgressTotal > 0;
    const otherPct = otherProgressTotal > 0 ? Math.round(otherDiscovered / otherProgressTotal * 100) : 0;

    html += `<div class="cat-group">`;
    html += `<div class="cat-group-header ${otherClass}" onclick="toggleGroup('Other')">`;
    html += `  <span class="group-arrow">▶</span>`;
    html += `  <span class="group-name">Other</span>`;
    html += otherHasProgress
      ? `  <span class="group-progress">${otherDiscovered}/${otherProgressTotal} (${otherPct}%)</span>`
      : `  <span class="group-progress">${otherTotal}</span>`;
    html += `  <button class="group-toggle-all${otherActiveCount === ungroupedCats.length ? ' on' : ''}" aria-label="Toggle all Other" onclick="event.stopPropagation();toggleOtherCategories(${otherActiveCount < ungroupedCats.length})"></button>`;
    html += `</div>`;
    html += `<div class="cat-group-children ${otherClass}">`;
    ungroupedCats.forEach(cat => {
      const catMarkers = regionMarkers.filter(m => m.category === cat.id);
      const count = catMarkers.length;
      const trackable = PROGRESS_CATEGORIES.has(cat.id);
      const discovered = trackable ? catMarkers.filter(m => isMarkerDiscovered(m)).length : 0;
      const active = activeCategories.has(cat.id);
      const iconHtml = iconMap[cat.id]
        ? `<img src="${iconMap[cat.id]}" style="width:20px;height:20px;object-fit:contain;" alt="">`
        : cat.icon;
      const statsHtml = trackable
        ? `<span class="cat-progress"><span class="done">${discovered}</span>/${count}</span>`
        : `<span class="cat-progress">${count}</span>`;
      html += `
        <div class="category-item ${active ? 'active' : ''}" onclick="toggleCategory('${cat.id}')">
          <span class="cat-icon">${iconHtml}</span>
          <span class="cat-name">${cat.name}</span>
          ${statsHtml}
          <span class="cat-toggle"></span>
        </div>`;
    });
    html += `</div></div>`;
  }

  list.innerHTML = html;
}

function toggleGroup(groupName) {
  collapsedGroups[groupName] = !collapsedGroups[groupName];
  renderCategoryList(document.getElementById('search-input').value);
}

function toggleGroupCategories(groupName, show) {
  const group = CATEGORY_GROUPS.find(g => g.name === groupName);
  if (!group) return;
  group.categories.forEach(catId => {
    if (show) {
      activeCategories.add(catId);
      if (markerLayers[catId]) map.addLayer(markerLayers[catId]);
    } else {
      activeCategories.delete(catId);
      if (markerLayers[catId]) map.removeLayer(markerLayers[catId]);
    }
  });
  saveActiveCategoriesFromStorage();
  renderCategoryList(document.getElementById('search-input').value);
}

function toggleOtherCategories(show) {
  const groupedCatIds = new Set();
  CATEGORY_GROUPS.forEach(g => g.categories.forEach(id => groupedCatIds.add(id)));
  categories.forEach(cat => {
    if (groupedCatIds.has(cat.id)) return;
    if (show) {
      activeCategories.add(cat.id);
      if (markerLayers[cat.id]) map.addLayer(markerLayers[cat.id]);
    } else {
      activeCategories.delete(cat.id);
      if (markerLayers[cat.id]) map.removeLayer(markerLayers[cat.id]);
    }
  });
  saveActiveCategoriesFromStorage();
  renderCategoryList(document.getElementById('search-input').value);
}

// ── Legend overlay ──
let legendOpen = false;
function toggleLegend() {
  legendOpen = !legendOpen;
  document.getElementById('legend-panel').classList.toggle('active', legendOpen);
  if (legendOpen) renderLegend();
}
function renderLegend() {
  const iconMap = window.ICON_MAP || {};
  let html = '';
  CATEGORY_GROUPS.forEach(g => {
    const color = GROUP_COLORS[g.name] || DEFAULT_GROUP_COLOR;
    const cats = g.categories.map(id => categories.find(c => c.id === id)).filter(Boolean);
    if (!cats.length) return;
    html += `<div class="legend-group-title" style="color:${color}">${g.name}</div>`;
    cats.forEach(c => {
      const src = iconMap[c.id];
      const ic = src
        ? `<img src="${src}" onerror="this.style.display='none'">`
        : `<span style="width:18px;text-align:center">${c.icon || '📌'}</span>`;
      html += `<div class="legend-row">${ic}<span>${c.name}</span></div>`;
    });
  });
  document.getElementById('legend-content').innerHTML = html;
}

function toggleCategory(catId) {
  if (activeCategories.has(catId)) {
    activeCategories.delete(catId);
    if (markerLayers[catId]) map.removeLayer(markerLayers[catId]);
  } else {
    activeCategories.add(catId);
    if (markerLayers[catId]) map.addLayer(markerLayers[catId]);
  }
  saveActiveCategoriesFromStorage();
  renderCategoryList(document.getElementById('search-input').value);
}

function toggleAllCategories(show) {
  let totalMarkers = 0;
  categories.forEach(cat => {
    if (show) {
      activeCategories.add(cat.id);
      if (markerLayers[cat.id]) {
        map.addLayer(markerLayers[cat.id]);
        totalMarkers += markerLayers[cat.id].getLayers().length;
      }
    } else {
      activeCategories.delete(cat.id);
      if (markerLayers[cat.id]) map.removeLayer(markerLayers[cat.id]);
    }
  });
  console.log(`[KCD2 Map] Toggle all ${show ? 'ON' : 'OFF'}: ${categories.length} categories, ${totalMarkers} markers on map`);
  saveActiveCategoriesFromStorage();
  renderCategoryList(document.getElementById('search-input').value);
}

function filterCategories(query) {
  renderCategoryList(query);
}

let hideDiscovered = false;

function onSearchInput(query) {
  const q = query.trim().toLowerCase();

  // Always filter categories
  renderCategoryList(query);

  // Show marker name search results
  const resultsEl = document.getElementById('search-results');
  if (!q || q.length < 2) {
    resultsEl.classList.remove('active');
    resultsEl.innerHTML = '';
    return;
  }

  const iconMap = window.ICON_MAP || {};
  const regionMarkers = getEditedMarkers(currentRegion);
  const userMkrs = userMarkers[currentRegion] || [];

  // Search both POI markers and user markers
  const matches = [];
  regionMarkers.forEach(m => {
    if ((m.name || '').toLowerCase().includes(q)) {
      matches.push({ ...m, source: 'poi' });
    }
  });
  userMkrs.forEach(m => {
    if ((m.name || '').toLowerCase().includes(q)) {
      matches.push({ ...m, source: 'user' });
    }
  });

  if (matches.length === 0) {
    resultsEl.innerHTML = '<div class="search-no-results">No markers found</div>';
    resultsEl.classList.add('active');
    return;
  }

  // Limit to 20 results
  const limited = matches.slice(0, 20);
  resultsEl.innerHTML = limited.map(m => {
    const cat = categories.find(c => c.id === m.category);
    const iconSrc = iconMap[m.category];
    const iconHtml = iconSrc
      ? `<img src="${iconSrc}" onerror="this.style.display='none'">`
      : `<span style="width:18px;text-align:center;font-size:12px">${cat?.icon || '📌'}</span>`;
    const catName = cat ? cat.name : 'Custom';
    const tag = m.source === 'user' ? ' (mine)' : '';
    return `<div class="search-result-item" onclick="searchResultClick(${m.x}, ${m.y}, '${getMarkerKey(m)}')">
      ${iconHtml}
      <div>
        <div class="sr-name">${m.name}</div>
        <div class="sr-cat">${catName}${tag} — (${m.x}, ${m.y})</div>
      </div>
    </div>`;
  }).join('') + (matches.length > 20 ? `<div style="padding:6px 10px;font-size:11px;color:var(--text-muted);text-align:center">+${matches.length - 20} more results</div>` : '');
  resultsEl.classList.add('active');
}

function searchResultClick(x, y, markerKey) {
  // Close search results
  document.getElementById('search-results').classList.remove('active');
  document.getElementById('search-input').value = '';
  renderCategoryList('');

  // Ensure the category is visible
  const parts = markerKey.split(':');
  const catId = parts[0];
  if (!activeCategories.has(catId) && markerLayers[catId]) {
    activeCategories.add(catId);
    markerLayers[catId].addTo(map);
    saveActiveCategoriesFromStorage();
    renderCategoryList('');
  }

  // Fly to marker and open popup
  flyToMarker(x, y);

  // Update URL with marker permalink
  updateHashWithMarker(markerKey);
}

// Close search results when clicking elsewhere
document.addEventListener('click', function(e) {
  const searchBox = document.querySelector('.search-box');
  const resultsEl = document.getElementById('search-results');
  if (searchBox && resultsEl && !searchBox.contains(e.target) && !resultsEl.contains(e.target)) {
    resultsEl.classList.remove('active');
  }
});


// ── Hide Discovered Toggle ──

function toggleHideDiscovered() {
  hideDiscovered = document.getElementById('toggle-hide-discovered').checked;
  applyHideDiscovered();
}

function applyHideDiscovered() {
  Object.entries(markersByKey).forEach(([key, marker]) => {
    const set = discoveredMarkers[currentRegion];
    const discovered = set && set.has(key);
    if (hideDiscovered && discovered) {
      marker.setOpacity(0);
      if (marker._icon) marker._icon.style.pointerEvents = 'none';
    } else {
      marker.setOpacity(discovered ? 0.5 : 1.0);
      if (marker._icon) marker._icon.style.pointerEvents = '';
    }
  });
}


// ═══════════════════════════════════════════════
// ██ USER MARKERS
// ═══════════════════════════════════════════════

function onRightClick(e) {
  e.originalEvent.preventDefault();
  const x = Math.round(e.latlng.lng);
  const y = Math.round(e.latlng.lat);

  // Remove temp marker if exists
  if (tempMarker) map.removeLayer(tempMarker);

  // Category options with real icons (sorted alphabetically)
  const iconMap = window.ICON_MAP || {};
  const sortedCats = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  const catItems = sortedCats.map(c => {
    const iconSrc = iconMap[c.id] || '';
    const iconHtml = iconSrc
      ? `<img src="${iconSrc}" onerror="this.style.display='none'">`
      : `<span style="width:20px;text-align:center">${c.icon || '📦'}</span>`;
    return `<div class="icon-dropdown-item" data-value="${c.id}" onclick="selectCategory('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${iconSrc}')">${iconHtml} ${c.name}</div>`;
  }).join('');

  const formHtml = `
    <div class="marker-form">
      <h3>Add Marker</h3>
      <label>Name</label>
      <input type="text" id="new-marker-name" placeholder="Enter name..." autofocus>
      <label>Category</label>
      <input type="hidden" id="new-marker-cat" value="">
      <div class="icon-dropdown" id="cat-dropdown">
        <div class="icon-dropdown-btn" onclick="toggleCatDropdown()">
          <span style="width:20px;text-align:center">📌</span> <span id="cat-dropdown-label">Custom</span>
        </div>
        <div class="icon-dropdown-list" id="cat-dropdown-list">
          <input type="text" class="icon-dropdown-search" id="cat-search" placeholder="Search..." oninput="filterCatDropdown(this.value)">
          <div id="cat-dropdown-items">
            <div class="icon-dropdown-item" data-value="" onclick="selectCategory('', 'Custom', '')"><span style="width:20px;text-align:center">📌</span> Custom</div>
            ${catItems}
          </div>
        </div>
      </div>
      <label>Description</label>
      <textarea id="new-marker-desc" placeholder="Optional description..."></textarea>
      <div class="form-actions">
        <button class="btn btn-cancel" onclick="cancelNewMarker()">Cancel</button>
        <button class="btn btn-save" onclick="saveNewMarker(${x}, ${y})">Save</button>
      </div>
    </div>
  `;

  tempMarker = L.marker([y, x], {
    icon: createMarkerIcon('📌', '#c9a84c', 26)
  }).addTo(map);

  tempMarker.bindPopup(formHtml, { maxWidth: 300, closeOnClick: false, autoClose: false }).openPopup();
}

function toggleCatDropdown() {
  const list = document.getElementById('cat-dropdown-list');
  list.classList.toggle('open');
  if (list.classList.contains('open')) {
    const search = document.getElementById('cat-search');
    if (search) { search.value = ''; filterCatDropdown(''); search.focus(); }
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('cat-dropdown');
  const list = document.getElementById('cat-dropdown-list');
  if (dropdown && list && !dropdown.contains(e.target)) {
    list.classList.remove('open');
  }
});

function selectCategory(value, name, iconSrc) {
  document.getElementById('new-marker-cat').value = value;
  const btn = document.querySelector('.icon-dropdown-btn');
  const iconHtml = iconSrc
    ? `<img src="${iconSrc}" style="width:20px;height:20px;image-rendering:pixelated">`
    : `<span style="width:20px;text-align:center">${value ? '📦' : '📌'}</span>`;
  btn.innerHTML = `${iconHtml} <span id="cat-dropdown-label">${name}</span>`;
  document.getElementById('cat-dropdown-list').classList.remove('open');
}

function filterCatDropdown(query) {
  const items = document.querySelectorAll('#cat-dropdown-items .icon-dropdown-item');
  const q = query.toLowerCase();
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(q) ? '' : 'none';
  });
}

function saveNewMarker(x, y) {
  const name = document.getElementById('new-marker-name').value.trim() || 'Unnamed Marker';
  const category = document.getElementById('new-marker-cat').value || 'interesting_site';
  const description = document.getElementById('new-marker-desc').value.trim();

  const markerData = {
    id: nextUserMarkerId++,
    name,
    category,
    description,
    x,
    y,
  };

  if (!userMarkers[currentRegion]) userMarkers[currentRegion] = [];
  userMarkers[currentRegion].push(markerData);
  saveUserMarkersToStorage();

  // Remove temp, add permanent
  if (tempMarker) {
    map.removeLayer(tempMarker);
    tempMarker = null;
  }
  addUserMarkerToMap(markerData);
  renderMyMarkersList();
  showToast(`Marker "${name}" added`);
}

function cancelNewMarker() {
  if (tempMarker) {
    map.removeLayer(tempMarker);
    tempMarker = null;
  }
}

function deleteUserMarker(id) {
  if (!userMarkers[currentRegion]) return;
  userMarkers[currentRegion] = userMarkers[currentRegion].filter(m => m.id !== id);
  saveUserMarkersToStorage();

  // Remove from map
  userMarkerLayer.eachLayer(layer => {
    if (layer._userMarkerId === id) userMarkerLayer.removeLayer(layer);
  });

  renderMyMarkersList();
  showToast('Marker removed');
}

function editUserMarker(id) {
  const markers = userMarkers[currentRegion] || [];
  const markerData = markers.find(m => m.id === id);
  if (!markerData) return;

  // Find the Leaflet marker layer
  let leafletMarker = null;
  userMarkerLayer.eachLayer(layer => {
    if (layer._userMarkerId === id) leafletMarker = layer;
  });
  if (!leafletMarker) return;

  // Build edit form with icon dropdown
  const iconMap = window.ICON_MAP || {};
  const sortedCats = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  const currentCat = categories.find(c => c.id === markerData.category);
  const currentIconSrc = iconMap[markerData.category] || '';
  const currentCatName = currentCat ? currentCat.name : 'Custom';
  const currentIconHtml = currentIconSrc
    ? `<img src="${currentIconSrc}" style="width:20px;height:20px;image-rendering:pixelated">`
    : `<span style="width:20px;text-align:center">${currentCat?.icon || '📌'}</span>`;

  const catItems = sortedCats.map(c => {
    const iconSrc = iconMap[c.id] || '';
    const iconHtml = iconSrc
      ? `<img src="${iconSrc}" onerror="this.style.display='none'">`
      : `<span style="width:20px;text-align:center">${c.icon || '📦'}</span>`;
    return `<div class="icon-dropdown-item" data-value="${c.id}" onclick="selectCategory('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${iconSrc}')">${iconHtml} ${c.name}</div>`;
  }).join('');

  const editHtml = `
    <div class="marker-form">
      <h3>Edit Marker</h3>
      <label>Name</label>
      <input type="text" id="edit-marker-name" value="${(markerData.name || '').replace(/"/g, '&quot;')}">
      <label>Category</label>
      <input type="hidden" id="new-marker-cat" value="${markerData.category}">
      <div class="icon-dropdown" id="cat-dropdown">
        <div class="icon-dropdown-btn" onclick="toggleCatDropdown()">
          ${currentIconHtml} <span id="cat-dropdown-label">${currentCatName}</span>
        </div>
        <div class="icon-dropdown-list" id="cat-dropdown-list">
          <input type="text" class="icon-dropdown-search" id="cat-search" placeholder="Search..." oninput="filterCatDropdown(this.value)">
          <div id="cat-dropdown-items">
            <div class="icon-dropdown-item" data-value="" onclick="selectCategory('', 'Custom', '')"><span style="width:20px;text-align:center">📌</span> Custom</div>
            ${catItems}
          </div>
        </div>
      </div>
      <label>Description</label>
      <textarea id="edit-marker-desc">${markerData.description || ''}</textarea>
      <div class="form-actions">
        <button class="btn btn-cancel" onclick="cancelEditMarker(${id})">Cancel</button>
        <button class="btn btn-save" onclick="saveEditedMarker(${id})">Save</button>
      </div>
    </div>
  `;

  leafletMarker.setPopupContent(editHtml);
  leafletMarker.openPopup();
}

function saveEditedMarker(id) {
  const markers = userMarkers[currentRegion] || [];
  const markerData = markers.find(m => m.id === id);
  if (!markerData) return;

  const oldKey = getMarkerKey(markerData);

  // Read new values
  const newName = document.getElementById('edit-marker-name').value.trim() || 'Unnamed Marker';
  const newCategory = document.getElementById('new-marker-cat').value || 'interesting_site';
  const newDesc = document.getElementById('edit-marker-desc').value.trim();

  // Update discovered key if category changed
  const set = discoveredMarkers[currentRegion];
  const wasDiscovered = set && set.has(oldKey);

  // Update marker data
  markerData.name = newName;
  markerData.category = newCategory;
  markerData.description = newDesc;

  const newKey = getMarkerKey(markerData);

  // Migrate discovered state
  if (wasDiscovered && oldKey !== newKey) {
    set.delete(oldKey);
    set.add(newKey);
    saveDiscoveredToStorage();
  }

  saveUserMarkersToStorage();

  // Remove old marker from map and re-add with new icon
  userMarkerLayer.eachLayer(layer => {
    if (layer._userMarkerId === id) {
      delete markersByKey[oldKey];
      userMarkerLayer.removeLayer(layer);
    }
  });

  addUserMarkerToMap(markerData);
  renderMyMarkersList();
  showToast('Marker updated');
}

function cancelEditMarker(id) {
  // Re-add original popup by removing and re-adding the marker
  const markers = userMarkers[currentRegion] || [];
  const markerData = markers.find(m => m.id === id);
  if (!markerData) return;

  userMarkerLayer.eachLayer(layer => {
    if (layer._userMarkerId === id) {
      const key = getMarkerKey(markerData);
      delete markersByKey[key];
      userMarkerLayer.removeLayer(layer);
    }
  });

  addUserMarkerToMap(markerData);
}

function flyToMarker(x, y) {
  // Use a zoom level near the tile pyramid max for clear detail
  const targetZoom = Math.max(map.getMaxZoom() - 1, map.getZoom());
  map.flyTo([y, x], targetZoom, { duration: 0.6 });

  // After the fly animation completes, open the popup of the marker at this location
  const targetKey = `${x}:${y}`;
  setTimeout(() => {
    for (const [key, marker] of Object.entries(markersByKey)) {
      // Match by coordinates (key format: "category:x:y")
      if (key.endsWith(targetKey)) {
        marker.openPopup();
        return;
      }
    }
  }, 650);
}

function renderUserMarkersOnMap(region) {
  userMarkerLayer.clearLayers();
  const markers = userMarkers[region] || [];
  markers.forEach(m => addUserMarkerToMap(m));
}

function renderMyMarkersList() {
  const list = document.getElementById('my-markers-list');
  const markers = userMarkers[currentRegion] || [];

  if (markers.length === 0) {
    list.innerHTML = '<div class="no-markers">Right-click on the map to add a custom marker.</div>';
    return;
  }

  list.innerHTML = markers.map(m => {
    const cat = categories.find(c => c.id === m.category);
    const iconMap = window.ICON_MAP || {};
    const iconSrc = iconMap[m.category];
    const iconHtml = iconSrc
      ? `<img src="${iconSrc}" style="width:20px;height:20px;image-rendering:pixelated">`
      : `<span>${cat ? cat.icon : '📌'}</span>`;
    return `
      <div class="my-marker-item" onclick="flyToMarker(${m.x}, ${m.y})">
        <span class="mm-icon">${iconHtml}</span>
        <div class="mm-info">
          <div class="mm-name">${m.name}</div>
          <div class="mm-coords">X: ${m.x} Y: ${m.y}</div>
        </div>
        <button class="mm-delete" onclick="event.stopPropagation();deleteUserMarker(${m.id})" title="Delete">✕</button>
      </div>
    `;
  }).join('');
}


// ═══════════════════════════════════════════════
// ██ IMPORT / EXPORT
// ═══════════════════════════════════════════════

function exportMarkers() {
  const markers = userMarkers[currentRegion] || [];
  if (markers.length === 0) {
    showToast('No custom markers to export');
    return;
  }

  const data = JSON.stringify(markers, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kcd2_markers_${currentRegion}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${markers.length} markers`);
}

function showImportModal() {
  document.getElementById('import-modal').classList.add('show');
  document.getElementById('import-data').value = '';
  document.getElementById('import-file').value = '';
}

function closeImportModal() {
  document.getElementById('import-modal').classList.remove('show');
}

function loadImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('import-data').value = e.target.result;
  };
  reader.readAsText(file);
}

function importMarkers() {
  const raw = document.getElementById('import-data').value.trim();
  if (!raw) {
    showToast('No data to import');
    return;
  }

  try {
    const data = JSON.parse(raw);
    const markers = Array.isArray(data) ? data : (data.markers || []);

    if (!userMarkers[currentRegion]) userMarkers[currentRegion] = [];

    let count = 0;
    markers.forEach(m => {
      if (m.x !== undefined && m.y !== undefined) {
        const newMarker = {
          id: nextUserMarkerId++,
          name: m.name || 'Imported Marker',
          category: m.category || 'interesting_site',
          description: m.description || '',
          x: m.x,
          y: m.y,
        };
        userMarkers[currentRegion].push(newMarker);
        addUserMarkerToMap(newMarker);
        count++;
      }
    });

    saveUserMarkersToStorage();
    renderMyMarkersList();
    closeImportModal();
    showToast(`Imported ${count} markers`);
  } catch (e) {
    showToast('Invalid JSON format');
    console.error('Import error:', e);
  }
}

async function clearMyMarkers() {
  const markers = userMarkers[currentRegion] || [];
  if (markers.length === 0) {
    showToast('No markers to clear');
    return;
  }
  if (!(await showConfirm(`Delete all ${markers.length} custom markers for ${currentRegion}? This cannot be undone.`, {title:'Clear my markers', confirmText:'Delete all', danger:true}))) return;

  userMarkers[currentRegion] = [];
  saveUserMarkersToStorage();
  userMarkerLayer.clearLayers();
  renderMyMarkersList();
  showToast('All custom markers cleared');
}

// ── Progress Export / Import ──

function exportProgress() {
  const serializable = {};
  Object.entries(discoveredMarkers).forEach(([region, set]) => {
    serializable[region] = Array.from(set);
  });
  const total = Object.values(serializable).reduce((sum, arr) => sum + arr.length, 0);
  if (total === 0) {
    showToast('No progress to export');
    return;
  }
  const blob = new Blob([JSON.stringify(serializable, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kcd2_progress_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast(`Exported ${total} discovered markers`);
}

function showImportProgressModal() {
  document.getElementById('import-progress-modal').classList.add('active');
  document.getElementById('import-progress-data').value = '';
  document.getElementById('import-progress-file').value = '';
}

function closeImportProgressModal() {
  document.getElementById('import-progress-modal').classList.remove('active');
}

function loadImportProgressFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('import-progress-data').value = e.target.result;
  };
  reader.readAsText(file);
}

function importProgress() {
  try {
    const raw = document.getElementById('import-progress-data').value.trim();
    if (!raw) { showToast('No data to import'); return; }
    const data = JSON.parse(raw);
    let count = 0;

    Object.entries(data).forEach(([region, keys]) => {
      if (!discoveredMarkers[region]) {
        discoveredMarkers[region] = new Set();
      }
      const arr = Array.isArray(keys) ? keys : [];
      arr.forEach(key => {
        discoveredMarkers[region].add(key);
        count++;
      });
    });

    saveDiscoveredToStorage();

    // Update opacity for current region markers
    Object.entries(markersByKey).forEach(([key, marker]) => {
      const set = discoveredMarkers[currentRegion];
      if (set && set.has(key)) {
        marker.setOpacity(0.5);
      } else {
        marker.setOpacity(1.0);
      }
    });

    closeImportProgressModal();
    showToast(`Imported ${count} discovered markers`);
  } catch (e) {
    console.error('Import progress error:', e);
    showToast('Invalid JSON data');
  }
}

async function clearProgress() {
  const set = discoveredMarkers[currentRegion];
  const count = set ? set.size : 0;
  if (count === 0) {
    showToast('No progress to clear');
    return;
  }
  if (!(await showConfirm(`Reset ${count} discovered markers for ${currentRegion}? This cannot be undone.`, {title:'Clear progress', confirmText:'Reset', danger:true}))) return;

  discoveredMarkers[currentRegion] = new Set();
  saveDiscoveredToStorage();

  // Restore all markers to full opacity
  Object.values(markersByKey).forEach(marker => marker.setOpacity(1.0));

  renderCategoryList(document.getElementById('search-input')?.value || '');
  updateGameProgress();
  showToast('All progress cleared');
}


// ── Export / Import All Data ──

function exportAll() {
  const allData = {
    version: 2,
    exportDate: new Date().toISOString(),
    userMarkers: userMarkers,
    discoveredMarkers: {},
    labelPositions: {},                  // v2: settlement-name drag positions
    activeCategories: [...activeCategories], // v2: which category filters are on
  };

  // Serialize discovered markers (Sets → Arrays)
  Object.entries(discoveredMarkers).forEach(([region, set]) => {
    allData.discoveredMarkers[region] = Array.from(set);
  });

  // Settlement-name positions (stored separately in localStorage)
  try { allData.labelPositions = JSON.parse(localStorage.getItem(LABEL_POS_KEY) || '{}'); } catch (e) {}

  const totalMarkers = Object.values(userMarkers).reduce((sum, arr) => sum + arr.length, 0);
  const totalDiscovered = Object.values(allData.discoveredMarkers).reduce((sum, arr) => sum + arr.length, 0);
  const totalLabelPos = Object.values(allData.labelPositions).reduce((sum, obj) => sum + Object.keys(obj || {}).length, 0);

  if (totalMarkers === 0 && totalDiscovered === 0 && totalLabelPos === 0) {
    showToast('No data to export');
    return;
  }

  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kcd2_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast(`Exported ${totalMarkers} markers + ${totalDiscovered} discoveries${totalLabelPos ? ` + ${totalLabelPos} label positions` : ''}`);
}

function showImportAllModal() {
  document.getElementById('import-all-modal').classList.add('active');
  document.getElementById('import-all-data').value = '';
  document.getElementById('import-all-file').value = '';
}

function closeImportAllModal() {
  document.getElementById('import-all-modal').classList.remove('active');
}

function loadImportAllFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('import-all-data').value = e.target.result;
  };
  reader.readAsText(file);
}

async function importAll() {
  try {
    const raw = document.getElementById('import-all-data').value.trim();
    if (!raw) { showToast('No data to import'); return; }
    const data = JSON.parse(raw);

    if (!(await showConfirm('This will replace all your current markers, progress, settlement-name positions, and category filters. Continue?', {title:'Import all data', confirmText:'Replace'}))) return;

    let markerCount = 0;
    let discoveredCount = 0;

    // Restore user markers
    if (data.userMarkers) {
      Object.entries(data.userMarkers).forEach(([region, markers]) => {
        userMarkers[region] = Array.isArray(markers) ? markers : [];
        markerCount += userMarkers[region].length;
      });
      // Update nextUserMarkerId to prevent ID conflicts
      let maxId = 0;
      Object.values(userMarkers).forEach(arr => {
        arr.forEach(m => { if (m.id > maxId) maxId = m.id; });
      });
      nextUserMarkerId = maxId + 1;
      saveUserMarkersToStorage();
    }

    // Restore discovered markers
    if (data.discoveredMarkers) {
      Object.entries(data.discoveredMarkers).forEach(([region, keys]) => {
        const arr = Array.isArray(keys) ? keys : [];
        discoveredMarkers[region] = new Set(arr);
        discoveredCount += arr.length;
      });
      saveDiscoveredToStorage();
    }

    // Restore settlement-name positions (v2+ backups)
    let labelPosCount = 0;
    if (data.labelPositions && typeof data.labelPositions === 'object') {
      localStorage.setItem(LABEL_POS_KEY, JSON.stringify(data.labelPositions));
      labelPosCount = Object.values(data.labelPositions).reduce((sum, obj) => sum + Object.keys(obj || {}).length, 0);
    }

    // Restore active category filters (v2+ backups)
    if (Array.isArray(data.activeCategories)) {
      activeCategories = new Set(data.activeCategories);
      saveActiveCategoriesFromStorage();
    }

    // Rebuild the whole view so markers, progress, category filters and label
    // positions all reflect the imported state.
    await loadRegion(currentRegion);

    closeImportAllModal();
    showToast(`Imported ${markerCount} markers + ${discoveredCount} discoveries${labelPosCount ? ` + ${labelPosCount} label positions` : ''}`);
  } catch (e) {
    console.error('Import all error:', e);
    showToast('Invalid JSON data');
  }
}


// ═══════════════════════════════════════════════
// ██ LOCAL MAP CALIBRATION TOOL
// ═══════════════════════════════════════════════

let calActiveOverlay = null;  // reference to the localMapOverlays entry being calibrated
let calBounds = null;
let calDragging = false;
let calDragStart = null;
let calOriginalBounds = null;

// Only one developer tool panel may be open at a time. If another is already
// open, flash it and tell the user to save/close it first (avoids losing work).
const TOOL_PANELS = [
  { id: 'calibration-panel', name: 'Calibrate Local Map' },
  { id: 'label-edit-panel', name: 'Position Settlement Names' },
  { id: 'marker-edit-panel', name: 'Edit Markers' },
];
function ensureSoleTool(targetId) {
  for (const t of TOOL_PANELS) {
    const el = document.getElementById(t.id);
    if (t.id !== targetId && el && el.classList.contains('active')) {
      el.classList.remove('tool-flash'); void el.offsetWidth; el.classList.add('tool-flash');
      showToast(`Close "${t.name}" first — save/export your changes, then click ✓ Done.`);
      return false;
    }
  }
  return true;
}

function calOpen() {
  if (!ensureSoleTool('calibration-panel')) return;
  const panel = document.getElementById('calibration-panel');
  panel.classList.add('active');

  // Populate dropdown with current region's local maps
  const select = document.getElementById('cal-select');
  const maps = localMapsConfig[currentRegion] || [];
  select.innerHTML = '<option value="">— Select —</option>';
  maps.forEach((cfg, i) => {
    select.innerHTML += `<option value="${i}">${cfg.name}</option>`;
  });

  // Ensure all local maps are visible for calibration
  localMapOverlays.forEach(o => {
    if (!o.visible) {
      o.layer.addTo(map);
      o.visible = true;
    }
  });
}

function calClose() {
  document.getElementById('calibration-panel').classList.remove('active');
  calDetachEvents();

  // Persist calibrated bounds into the config and restore as non-interactive
  if (calActiveOverlay && calBounds) {
    const newBounds = [
      [calBounds.getSouthWest().lat, calBounds.getSouthWest().lng],
      [calBounds.getNorthEast().lat, calBounds.getNorthEast().lng]
    ];
    calActiveOverlay.config.bounds = newBounds;

    // Save to localStorage so calibration survives page refresh
    saveLocalMapBounds(currentRegion, calActiveOverlay.config.name, newBounds);

    map.removeLayer(calActiveOverlay.layer);
    calActiveOverlay.layer = L.imageOverlay(calActiveOverlay.config.image, newBounds, {
      opacity: 1,
      interactive: false,
      zIndex: 500,
    }).addTo(map);
    calActiveOverlay.visible = true;
  }

  calActiveOverlay = null;
  calBounds = null;
  calOriginalBounds = null;
  map.dragging.enable();
}

function saveLocalMapBounds(region, name, bounds) {
  try {
    const saved = JSON.parse(localStorage.getItem('kcd2_local_map_bounds') || '{}');
    if (!saved[region]) saved[region] = {};
    saved[region][name] = bounds;
    localStorage.setItem('kcd2_local_map_bounds', JSON.stringify(saved));
  } catch (e) { console.error('Failed to save local map bounds:', e); }
}

function loadLocalMapBounds(region, name) {
  try {
    const saved = JSON.parse(localStorage.getItem('kcd2_local_map_bounds') || '{}');
    return saved[region]?.[name] || null;
  } catch (e) { return null; }
}

function calSelectMap(indexStr) {
  calDetachEvents();

  if (indexStr === '') {
    calActiveOverlay = null;
    calBounds = null;
    document.getElementById('cal-bounds').textContent = 'Select a map to calibrate';
    return;
  }

  const idx = parseInt(indexStr);
  const entry = localMapOverlays[idx];
  if (!entry) return;

  // Remove the non-interactive overlay and recreate as interactive
  if (entry.layer) map.removeLayer(entry.layer);

  const opacity = document.getElementById('cal-opacity').value / 100;
  entry.layer = L.imageOverlay(entry.config.image, entry.config.bounds, {
    opacity: opacity,
    interactive: true,
    zIndex: 1000,
  }).addTo(map);

  calActiveOverlay = entry;
  calBounds = L.latLngBounds(entry.layer.getBounds().getSouthWest(), entry.layer.getBounds().getNorthEast());
  calOriginalBounds = L.latLngBounds(calBounds.getSouthWest(), calBounds.getNorthEast());

  // Wait for the element to render, then attach drag events
  setTimeout(() => {
    const el = entry.layer.getElement();
    if (el) {
      el.style.cursor = 'move';
      el.style.pointerEvents = 'auto';
      el.addEventListener('mousedown', calStartDrag);
    }
  }, 100);

  document.getElementById('cal-scale').value = 100;
  calUpdateBoundsDisplay();
}

function calDetachEvents() {
  if (calActiveOverlay && calActiveOverlay.layer.getElement()) {
    const el = calActiveOverlay.layer.getElement();
    el.style.cursor = '';
    el.removeEventListener('mousedown', calStartDrag);
  }
  // Restore full opacity
  if (calActiveOverlay) {
    calActiveOverlay.layer.setOpacity(1);
  }
}

function calStartDrag(e) {
  e.preventDefault();
  e.stopPropagation();
  calDragging = true;
  calDragStart = { x: e.clientX, y: e.clientY, bounds: L.latLngBounds(calBounds.getSouthWest(), calBounds.getNorthEast()) };
  map.dragging.disable();

  document.addEventListener('mousemove', calOnDrag);
  document.addEventListener('mouseup', calStopDrag);
}

function calOnDrag(e) {
  if (!calDragging || !calDragStart) return;

  const dx = e.clientX - calDragStart.x;
  const dy = e.clientY - calDragStart.y;

  const startPoint = map.latLngToContainerPoint(calDragStart.bounds.getCenter());
  const newPoint = L.point(startPoint.x + dx, startPoint.y + dy);
  const newCenter = map.containerPointToLatLng(newPoint);

  const oldCenter = calDragStart.bounds.getCenter();
  const dLat = newCenter.lat - oldCenter.lat;
  const dLng = newCenter.lng - oldCenter.lng;

  const sw = calDragStart.bounds.getSouthWest();
  const ne = calDragStart.bounds.getNorthEast();

  calBounds = L.latLngBounds(
    [sw.lat + dLat, sw.lng + dLng],
    [ne.lat + dLat, ne.lng + dLng]
  );

  calActiveOverlay.layer.setBounds(calBounds);
  calUpdateBoundsDisplay();
}

function calStopDrag() {
  calDragging = false;
  calDragStart = null;
  map.dragging.enable();
  document.removeEventListener('mousemove', calOnDrag);
  document.removeEventListener('mouseup', calStopDrag);
}

function calApplyScale(pct) {
  if (!calActiveOverlay || !calOriginalBounds) return;

  const scale = parseFloat(pct) / 100;
  if (isNaN(scale) || scale <= 0) return;

  // Scale from the current center position, using original dimensions
  const center = calBounds.getCenter();
  const origHalfLat = (calOriginalBounds.getNorthEast().lat - calOriginalBounds.getSouthWest().lat) / 2;
  const origHalfLng = (calOriginalBounds.getNorthEast().lng - calOriginalBounds.getSouthWest().lng) / 2;

  calBounds = L.latLngBounds(
    [center.lat - origHalfLat * scale, center.lng - origHalfLng * scale],
    [center.lat + origHalfLat * scale, center.lng + origHalfLng * scale]
  );

  calActiveOverlay.layer.setBounds(calBounds);
  calUpdateBoundsDisplay();
}

function calUpdateOpacity(value) {
  document.getElementById('cal-opacity-val').textContent = value + '%';
  if (calActiveOverlay) calActiveOverlay.layer.setOpacity(value / 100);
}

function calUpdateBoundsDisplay() {
  if (!calBounds) return;
  const sw = calBounds.getSouthWest();
  const ne = calBounds.getNorthEast();
  document.getElementById('cal-bounds').textContent =
    `[[${Math.round(sw.lat)}, ${Math.round(sw.lng)}], [${Math.round(ne.lat)}, ${Math.round(ne.lng)}]]`;
}

function calCopyBounds() {
  // Copy just the current overlay bounds
  const text = document.getElementById('cal-bounds').textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Bounds copied to clipboard');
  }).catch(() => {
    const el = document.getElementById('cal-bounds');
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    showToast('Select and copy the bounds manually');
  });
}

function calExportConfig() {
  // Build the full config from current state (including any calibrated bounds)
  const config = {};
  for (const [region, maps] of Object.entries(localMapsConfig)) {
    config[region] = maps.map(cfg => {
      const savedBounds = loadLocalMapBounds(region, cfg.name);
      return {
        name: cfg.name,
        image: cfg.image,
        bounds: savedBounds || cfg.bounds,
        minZoom: cfg.minZoom,
      };
    });
  }

  const jsonStr = JSON.stringify(config, null, 2);

  // Download as JSON
  const blob1 = new Blob([jsonStr], { type: 'application/json' });
  const a1 = document.createElement('a');
  a1.href = URL.createObjectURL(blob1);
  a1.download = 'local_maps.json';
  a1.click();

  // Also download as JS wrapper
  const jsContent = '// Local map overlay configuration\nwindow.LOCAL_MAPS_DATA = ' + jsonStr + ';\n';
  const blob2 = new Blob([jsContent], { type: 'text/javascript' });
  const a2 = document.createElement('a');
  a2.href = URL.createObjectURL(blob2);
  a2.download = 'local_maps.js';
  setTimeout(() => a2.click(), 100);

  showToast('Exported local_maps.json + local_maps.js — put both in data/');
}


// ═══════════════════════════════════════════════
// ██ LOCAL DETAIL MAPS
// ═══════════════════════════════════════════════

function loadLocalMaps(region) {
  // Remove existing overlays
  localMapOverlays.forEach(o => {
    if (o.layer) map.removeLayer(o.layer);
  });
  localMapOverlays = [];

  const maps = localMapsConfig[region] || [];
  maps.forEach(cfg => {
    // Use saved calibrated bounds if available, otherwise use JSON config
    const savedBounds = loadLocalMapBounds(region, cfg.name);
    const bounds = savedBounds || cfg.bounds;

    const layer = L.imageOverlay(cfg.image, bounds, {
      opacity: 1,
      interactive: false,
      zIndex: 500,
    });
    localMapOverlays.push({ layer, config: { ...cfg, bounds }, visible: false });
  });

  // Apply initial visibility based on current zoom
  updateLocalMapVisibility();
}

// Local maps trigger only when the viewport center is within the CENTER of the
// overlay (inner LOCAL_MAP_TRIGGER fraction of its footprint), not just anywhere
// inside it — so zooming around a town's outskirts doesn't pop the overlay over
// the detail you're inspecting.
const LOCAL_MAP_TRIGGER = 0.5;  // 1.0 = whole footprint, 0.5 = inner half, smaller = tighter

function updateLocalMapVisibility() {
  if (!showLocalMaps) return;
  const zoom = map.getZoom();
  const center = map.getCenter();

  localMapOverlays.forEach(o => {
    // Skip the overlay currently being calibrated
    if (calActiveOverlay && o === calActiveOverlay) return;

    // Show only if zoom is high enough AND the viewport center is inside the
    // overlay's centered trigger zone (its footprint shrunk by LOCAL_MAP_TRIGGER).
    const b = L.latLngBounds(o.config.bounds[0], o.config.bounds[1]);
    const c = b.getCenter();
    const halfLat = (b.getNorth() - b.getSouth()) / 2 * LOCAL_MAP_TRIGGER;
    const halfLng = (b.getEast() - b.getWest()) / 2 * LOCAL_MAP_TRIGGER;
    const triggerZone = L.latLngBounds(
      [c.lat - halfLat, c.lng - halfLng],
      [c.lat + halfLat, c.lng + halfLng]
    );
    const shouldShow = zoom >= o.config.minZoom && triggerZone.contains(center);

    if (shouldShow) {
      if (!o.visible) {
        o.layer.addTo(map);
        o.visible = true;
      }
    } else {
      if (o.visible) {
        map.removeLayer(o.layer);
        o.visible = false;
      }
    }
  });
  updateSettlementLabelVisibility();
}

function toggleLocalMaps() {
  showLocalMaps = document.getElementById('toggle-local-maps').checked;
  if (showLocalMaps) {
    updateLocalMapVisibility();
  } else {
    localMapOverlays.forEach(o => {
      if (o.visible) {
        map.removeLayer(o.layer);
        o.visible = false;
      }
    });
    updateSettlementLabelVisibility();
  }
}


// ═══════════════════════════════════════════════
// ██ SETTLEMENT LABELS
// ═══════════════════════════════════════════════

let showSettlementLabels = true;
let settlementLabelMarkers = [];  // { marker, x, y } — for show/hide over local maps

// Town crest accompanying each settlement name → banners/<file>.png.
// Kept separate from SETTLEMENT_LABELS so the positioning tool's export doesn't drop it.
const SETTLEMENT_BANNERS = {
  // Trosky
  "Apollonia": "apolena", "Nebakov Fortress": "nebakov", "Nomads' Camp": "nomad_camp",
  "Semine": "semin", "Tachov": "tachov", "Troskowitz": "troskovice",
  "Trosky Castle": "trosky", "Zhelejov": "zelejov",
  // Kuttenberg
  "Bohunowitz": "bohounovice", "Bylany": "bylany", "Devil's Den": "certovka",
  "Grund": "grunta", "Horschan": "horany", "Kuttenberg": "kutna_hora",
  "Maleshov": "malesov", "Miskowitz": "miskovice", "Old Kutna": "stara_kutna",
  "Opatowitz": "opatovice", "Pschitoky": "pritoky", "Raborsch": "ratbor",
  "Sigismund's Camp": "zikmund_camp", "Suchdol": "suchdol", "Wysoka": "vysoka",
};
// Per-town crest height override (px); others use the CSS default (28px).
const SETTLEMENT_BANNER_SIZE = { "Kuttenberg": 36 };

function renderSettlementLabels(region) {
  if (settlementLabelLayer) {
    map.removeLayer(settlementLabelLayer);
  }
  settlementLabelLayer = L.layerGroup();
  settlementLabelMarkers = [];

  const labels = (typeof SETTLEMENT_LABELS !== 'undefined') ? SETTLEMENT_LABELS[region] : null;
  if (!labels) return;

  const positions = loadLabelPositions(region);

  labels.forEach(label => {
    // Use a saved (dragged) position if one exists, else the data coordinate.
    const pos = positions[label.name] || { x: label.x, y: label.y };
    const crest = SETTLEMENT_BANNERS[label.name];
    const crestPx = SETTLEMENT_BANNER_SIZE[label.name];
    const crestStyle = crestPx ? ` style="height:${crestPx}px"` : '';
    const crestHtml = crest ? `<img class="sl-crest"${crestStyle} src="banners/${crest}.png" alt="" onerror="this.style.display='none'">` : '';
    const icon = L.divIcon({
      className: 'settlement-label' + (labelEditing ? ' label-draggable' : ''),
      html: `<span class="sl-stack">${crestHtml}<span class="sl-name">${label.name}</span></span>`,
      iconSize: null,
      iconAnchor: [0, 0],
    });
    const marker = L.marker([pos.y, pos.x], {
      icon,
      interactive: labelEditing,
      draggable: labelEditing,
      zIndexOffset: labelEditing ? 10000 : -1000,
    });
    if (labelEditing) {
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        const x = Math.round(ll.lng), y = Math.round(ll.lat);
        saveLabelPosition(region, label.name, x, y);
        showToast(`${label.name} → X:${x} Y:${y}`);
      });
    }
    marker.addTo(settlementLabelLayer);
    settlementLabelMarkers.push({ marker, x: pos.x, y: pos.y });
  });

  if (showSettlementLabels || labelEditing) {
    settlementLabelLayer.addTo(map);
  }
  updateLabelScale();
  updateSettlementLabelVisibility();
}

// QOL: hide a settlement name once the local detail map for that town is showing
// (its coordinate falls inside a visible overlay's bounds), so the floating name
// doesn't sit on top of the detailed map. Stays visible while positioning labels.
function updateSettlementLabelVisibility() {
  if (!settlementLabelMarkers.length) return;
  const coveredBounds = labelEditing ? [] : localMapOverlays
    .filter(o => o.visible)
    .map(o => L.latLngBounds(o.config.bounds[0], o.config.bounds[1]));
  settlementLabelMarkers.forEach(({ marker, x, y }) => {
    const el = marker.getElement();
    if (!el) return;
    const covered = coveredBounds.some(b => b.contains([y, x]));
    el.style.display = covered ? 'none' : '';
  });
}

// Settlement names render at base size up to LABEL_GROW_FROM_ZOOM, then grow as
// you zoom in so they stay readable against the detailed map (capped so they
// never get huge). Applied via the --label-scale var on the inner .sl-name span.
const LABEL_GROW_FROM_ZOOM = 3.5;  // at/below this zoom, names are base size (×1)
const LABEL_GROW_RATE = 0.45;      // higher = grows faster as you zoom in
const LABEL_MAX_SCALE = 2.6;       // cap on how large names can get
function updateLabelScale() {
  if (!map) return;
  const raw = Math.pow(2, (map.getZoom() - LABEL_GROW_FROM_ZOOM) * LABEL_GROW_RATE);
  const s = Math.min(LABEL_MAX_SCALE, Math.max(1, raw));
  document.documentElement.style.setProperty('--label-scale', s.toFixed(4));
}

function toggleSettlementLabels() {
  const cb = document.getElementById('toggle-labels');
  showSettlementLabels = cb ? cb.checked : !showSettlementLabels;
  if (!settlementLabelLayer) return;
  if (showSettlementLabels || labelEditing) {
    settlementLabelLayer.addTo(map);
    updateSettlementLabelVisibility();
  } else {
    map.removeLayer(settlementLabelLayer);
  }
}

// ── Settlement-name position editing (drag-to-place) ──
const LABEL_POS_KEY = 'kcd2_label_positions';

function loadLabelPositions(region) {
  try {
    const saved = JSON.parse(localStorage.getItem(LABEL_POS_KEY) || '{}');
    return saved[region] || {};
  } catch (e) { return {}; }
}

function saveLabelPosition(region, name, x, y) {
  try {
    const saved = JSON.parse(localStorage.getItem(LABEL_POS_KEY) || '{}');
    if (!saved[region]) saved[region] = {};
    saved[region][name] = { x, y };
    localStorage.setItem(LABEL_POS_KEY, JSON.stringify(saved));
  } catch (e) { console.error('Failed to save label position:', e); }
}

function labelEditOpen() {
  if (!ensureSoleTool('label-edit-panel')) return;
  document.getElementById('label-edit-panel').classList.add('active');
  if (!showSettlementLabels) {
    document.getElementById('toggle-labels').checked = true;
    toggleSettlementLabels();
  }
}

function labelEditClose() {
  if (labelEditing) labelEditToggle();  // leave drag mode cleanly
  document.getElementById('label-edit-panel').classList.remove('active');
}

function labelEditToggle() {
  labelEditing = !labelEditing;
  const btn = document.getElementById('label-edit-toggle');
  if (btn) {
    btn.textContent = labelEditing ? '■ Stop Editing' : '✥ Start Editing';
    btn.classList.toggle('btn-primary', labelEditing);
    btn.classList.toggle('btn-secondary', !labelEditing);
  }
  if (labelEditing && !showSettlementLabels) {
    document.getElementById('toggle-labels').checked = true;
    showSettlementLabels = true;
  }
  renderSettlementLabels(currentRegion);
  showToast(labelEditing ? 'Drag each name onto its spot' : 'Editing off');
}

async function labelEditReset() {
  if (!(await showConfirm(`Reset all settlement-name positions for ${currentRegion} to their original coordinates? This clears your drags for this region.`, {title:'Reset positions', confirmText:'Reset', danger:true}))) return;
  try {
    const saved = JSON.parse(localStorage.getItem(LABEL_POS_KEY) || '{}');
    delete saved[currentRegion];
    localStorage.setItem(LABEL_POS_KEY, JSON.stringify(saved));
  } catch (e) {}
  renderSettlementLabels(currentRegion);
  showToast(`Positions reset for ${currentRegion}`);
}

function labelEditExport() {
  if (typeof SETTLEMENT_LABELS === 'undefined') return;
  // Merge saved drag positions into the full label set, per region.
  const out = {};
  for (const region of Object.keys(SETTLEMENT_LABELS)) {
    const positions = loadLabelPositions(region);
    out[region] = SETTLEMENT_LABELS[region].map(l => {
      const p = positions[l.name];
      return { name: l.name, x: p ? p.x : l.x, y: p ? p.y : l.y };
    });
  }
  const jsonStr = JSON.stringify(out, null, 2);

  // JS wrapper matching data/settlement_labels.js
  const jsContent =
    '// Settlement labels — positions adjusted via the in-app Position Settlement Names tool\n' +
    'const SETTLEMENT_LABELS = ' + jsonStr + ';\n' +
    "if (typeof window !== 'undefined') window.SETTLEMENT_LABELS = SETTLEMENT_LABELS;\n";

  labelDownload('settlement_labels.js', jsContent, 'text/javascript');
  setTimeout(() => labelDownload('settlement_labels.json', jsonStr, 'application/json'), 120);
  showToast('Exported settlement_labels.js + .json — put both in data/');
}

function labelDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ═══════════════════════════════════════════════
// ██ LOCAL STORAGE
// ═══════════════════════════════════════════════

function saveUserMarkersToStorage() {
  localStorage.setItem(CONFIG.storageKeys.userMarkers, JSON.stringify(userMarkers));
}

function loadUserMarkersFromStorage() {
  try {
    const saved = localStorage.getItem(CONFIG.storageKeys.userMarkers);
    if (saved) {
      userMarkers = JSON.parse(saved);
      // Find max ID
      Object.values(userMarkers).forEach(markers => {
        markers.forEach(m => {
          if (m.id >= nextUserMarkerId) nextUserMarkerId = m.id + 1;
        });
      });
    }
  } catch (e) {
    console.warn('Could not load user markers:', e);
  }
}

function saveActiveCategoriesFromStorage() {
  localStorage.setItem(CONFIG.storageKeys.activeCategories, JSON.stringify([...activeCategories]));
}

function loadActiveCategoriesFromStorage() {
  try {
    const saved = localStorage.getItem(CONFIG.storageKeys.activeCategories);
    if (saved) {
      activeCategories = new Set(JSON.parse(saved));
    } else {
      activeCategories = new Set(['city', 'fast_travel']);
    }
  } catch (e) {
    activeCategories = new Set(['city', 'fast_travel']);
  }
}

function saveDiscoveredToStorage() {
  // Convert Sets to arrays for JSON serialization
  const serializable = {};
  Object.entries(discoveredMarkers).forEach(([region, set]) => {
    serializable[region] = [...set];
  });
  localStorage.setItem(CONFIG.storageKeys.discoveredMarkers, JSON.stringify(serializable));
}

function loadDiscoveredFromStorage() {
  try {
    const saved = localStorage.getItem(CONFIG.storageKeys.discoveredMarkers);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([region, arr]) => {
        discoveredMarkers[region] = new Set(arr);
      });
    }
  } catch (e) {
    console.warn('Could not load discovered markers:', e);
  }
}

function getMarkerKey(markerData) {
  // Unique key: category + coordinates (stable across reloads)
  return `${markerData.category}:${markerData.x}:${markerData.y}`;
}

function isMarkerDiscovered(markerData) {
  const set = discoveredMarkers[currentRegion];
  return set ? set.has(getMarkerKey(markerData)) : false;
}

// Whole-game completion = discovered / total across BOTH regions over all
// PROGRESS_CATEGORIES (quests + collectibles), including custom markers.
function computeGameProgress() {
  let total = 0, done = 0;
  ['trosky', 'kuttenberg'].forEach(region => {
    const set = discoveredMarkers[region] || new Set();
    const markers = [...getEditedMarkers(region), ...(userMarkers[region] || [])];
    markers.forEach(m => {
      if (!PROGRESS_CATEGORIES.has(m.category)) return;
      total++;
      if (set.has(getMarkerKey(m))) done++;
    });
  });
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}
function updateGameProgress() {
  const fill = document.getElementById('gp-fill');
  if (!fill) return;
  const { total, done, pct } = computeGameProgress();
  fill.style.width = pct + '%';
  document.getElementById('gp-pct').textContent = pct + '%';
  document.getElementById('gp-detail').textContent = `${done.toLocaleString()} / ${total.toLocaleString()} found`;
}

function toggleMarkerDiscovered(key, btnId) {
  if (!discoveredMarkers[currentRegion]) {
    discoveredMarkers[currentRegion] = new Set();
  }
  const set = discoveredMarkers[currentRegion];
  const btn = document.getElementById(btnId);
  const marker = markersByKey[key];
  if (set.has(key)) {
    set.delete(key);
    if (btn) {
      btn.classList.remove('completed');
      btn.textContent = btn.dataset.undoneLabel;
    }
    if (marker) {
      marker.setOpacity(1.0);
      if (marker._icon) marker._icon.style.pointerEvents = '';
    }
  } else {
    set.add(key);
    if (btn) {
      btn.classList.add('completed');
      btn.textContent = btn.dataset.doneLabel;
    }
    if (marker) {
      if (hideDiscovered) {
        marker.setOpacity(0);
        if (marker._icon) marker._icon.style.pointerEvents = 'none';
        marker.closePopup();
      } else {
        marker.setOpacity(0.5);
      }
    }
  }
  saveDiscoveredToStorage();
  // Refresh sidebar progress stats + overall game completion
  renderCategoryList(document.getElementById('search-input')?.value || '');
  updateGameProgress();
}


// ═══════════════════════════════════════════════
// ██ UI HELPERS
// ═══════════════════════════════════════════════

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function switchTab(tabName) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// Themed confirm dialog — returns a Promise<boolean>. Replaces window.confirm().
let _confirmResolve = null;
function showConfirm(message, { title = 'Are you sure?', confirmText = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const ok = document.getElementById('confirm-ok');
    ok.textContent = confirmText;
    ok.classList.toggle('btn-danger', danger);
    ok.classList.toggle('btn-primary', !danger);
    document.getElementById('confirm-modal').classList.add('show');
    ok.focus();
  });
}
function _confirmClose(result) {
  document.getElementById('confirm-modal').classList.remove('show');
  const r = _confirmResolve; _confirmResolve = null;
  if (r) r(result);
}
// Esc closes the confirm dialog (cancels)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('confirm-modal').classList.contains('show')) {
    _confirmClose(false);
  }
});


// ═══════════════════════════════════════════════
// ██ INIT
// ═══════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', init);
