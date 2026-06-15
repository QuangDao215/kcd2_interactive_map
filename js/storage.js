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
  // Unique key: category + coordinates (stable across reloads). A repositioned
  // marker keeps its ORIGINAL key via _baseKey, so its rename/delete/discovered
  // records stay attached after the move (coords alone would drift).
  return markerData._baseKey || `${markerData.category}:${markerData.x}:${markerData.y}`;
}

function isMarkerDiscovered(markerData) {
  const set = discoveredMarkers[currentRegion];
  return set ? set.has(getMarkerKey(markerData)) : false;
}

// Whole-game completion = discovered / total across BOTH regions over all
// PROGRESS_CATEGORIES (quests + collectibles), including custom markers.
function computeGameProgress() {
  let total = 0, done = 0;
  const regions = {};
  ['trosky', 'kuttenberg'].forEach(region => {
    const set = discoveredMarkers[region] || new Set();
    const markers = [...getEditedMarkers(region), ...(userMarkers[region] || [])];
    let rTotal = 0, rDone = 0;
    markers.forEach(m => {
      if (!PROGRESS_CATEGORIES.has(m.category)) return;
      rTotal++;
      if (set.has(getMarkerKey(m))) rDone++;
    });
    regions[region] = { total: rTotal, done: rDone, pct: rTotal ? Math.round(rDone / rTotal * 100) : 0 };
    total += rTotal; done += rDone;
  });
  return { total, done, pct: total ? Math.round(done / total * 100) : 0, regions };
}
function updateGameProgress() {
  const fill = document.getElementById('gp-fill');
  if (!fill) return;
  const p = computeGameProgress();
  fill.style.width = p.pct + '%';
  document.getElementById('gp-pct').textContent = p.pct + '%';
  document.getElementById('gp-detail').textContent = `${p.done.toLocaleString()} / ${p.total.toLocaleString()} found`;
  ['trosky', 'kuttenberg'].forEach(region => {
    const rf = document.getElementById('gp-' + region + '-fill');
    const rp = document.getElementById('gp-' + region + '-pct');
    const row = document.getElementById('gp-' + region + '-row');
    if (rf) rf.style.width = p.regions[region].pct + '%';
    if (rp) rp.textContent = p.regions[region].pct + '%';
    if (row) row.classList.toggle('active', region === currentRegion);
  });
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


