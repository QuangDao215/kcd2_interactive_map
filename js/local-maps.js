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
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKeys.localMapBounds) || '{}');
    if (!saved[region]) saved[region] = {};
    saved[region][name] = bounds;
    localStorage.setItem(CONFIG.storageKeys.localMapBounds, JSON.stringify(saved));
  } catch (e) { console.error('Failed to save local map bounds:', e); }
}

function loadLocalMapBounds(region, name) {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKeys.localMapBounds) || '{}');
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
    // Trigger zoom adapts to the town's footprint (overrides the JSON minZoom).
    const config = { ...cfg, bounds, minZoom: adaptiveLocalMapMinZoom(bounds) };
    localMapOverlays.push({ layer, config, visible: false });
  });

  // Apply initial visibility based on current zoom
  updateLocalMapVisibility();
}

// Local maps trigger only when the viewport center is within the CENTER of the
// overlay (inner LOCAL_MAP_TRIGGER fraction of its footprint), not just anywhere
// inside it — so zooming around a town's outskirts doesn't pop the overlay over
// the detail you're inspecting.
const LOCAL_MAP_TRIGGER = 0.5;  // 1.0 = whole footprint, 0.5 = inner half, smaller = tighter

// Adaptive trigger zoom: a town's detail overlay should appear once it has grown to
// a useful on-screen size. A tiny camp is a speck until you zoom right in, so it
// needs a higher zoom; a sprawling town appears earlier. Derived from the overlay's
// world-pixel footprint relative to a reference town — halving the footprint adds one
// zoom level. (Region CRS scale differs, so this keeps cross-region behaviour as-is.)
const LOCAL_MAP_REF_SIZE = 1200;   // ~typical town footprint (world px) → baseline zoom
const LOCAL_MAP_BASE_ZOOM = 5.5;   // minZoom for a reference-sized town
const LOCAL_MAP_MIN_TRIGGER_ZOOM = 4.5;   // clamp — largest cities
const LOCAL_MAP_MAX_TRIGGER_ZOOM = 6.5;   // clamp — tiniest camps
function adaptiveLocalMapMinZoom(bounds) {
  const width = Math.abs(bounds[1][1] - bounds[0][1]);
  const height = Math.abs(bounds[1][0] - bounds[0][0]);
  const size = (width + height) / 2;
  if (!size) return LOCAL_MAP_BASE_ZOOM;
  const z = LOCAL_MAP_BASE_ZOOM + Math.log2(LOCAL_MAP_REF_SIZE / size);
  return Math.min(LOCAL_MAP_MAX_TRIGGER_ZOOM, Math.max(LOCAL_MAP_MIN_TRIGGER_ZOOM, z));
}

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


