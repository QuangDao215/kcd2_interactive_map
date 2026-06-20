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

    let count = 0, skipped = 0;
    markers.forEach(m => {
      if (m && Number.isFinite(+m.x) && Number.isFinite(+m.y)) {
        const newMarker = {
          id: nextUserMarkerId++,
          name: m.name || 'Imported Marker',
          category: m.category || 'interesting_site',
          description: m.description || '',
          x: +m.x,
          y: +m.y,
        };
        userMarkers[currentRegion].push(newMarker);
        addUserMarkerToMap(newMarker);
        count++;
      } else {
        skipped++;
      }
    });

    saveUserMarkersToStorage();
    renderMyMarkersList();
    closeImportModal();
    showToast(skipped
      ? `Imported ${count} markers (${skipped} skipped — missing/invalid coordinates)`
      : `Imported ${count} markers`);
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
  document.getElementById('import-progress-modal').classList.add('show');
  document.getElementById('import-progress-data').value = '';
  document.getElementById('import-progress-file').value = '';
}

function closeImportProgressModal() {
  document.getElementById('import-progress-modal').classList.remove('show');
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

    // Refresh marker opacity, honouring the current "Hide discovered" toggle
    // (the inline 0.5 loop ignored it, leaving hidden markers visible).
    applyHideDiscovered();

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
    version: 3,
    exportDate: new Date().toISOString(),
    userMarkers: userMarkers,
    discoveredMarkers: {},
    labelPositions: {},                      // settlement-name drag positions
    activeCategories: [...activeCategories],  // which category filters are on
    markerEdits: {},                          // v3: POI renames (Edit Markers tool)
    markerDeletes: {},                        // v3: POI deletions (Edit Markers tool)
  };

  // Serialize discovered markers (Sets → Arrays)
  Object.entries(discoveredMarkers).forEach(([region, set]) => {
    allData.discoveredMarkers[region] = Array.from(set);
  });

  // State stored separately in localStorage
  try { allData.labelPositions = JSON.parse(localStorage.getItem(LABEL_POS_KEY) || '{}'); } catch (e) {}
  try { allData.markerEdits = JSON.parse(localStorage.getItem(MARKER_EDIT_KEY) || '{}'); } catch (e) {}
  try { allData.markerDeletes = JSON.parse(localStorage.getItem(MARKER_DELETE_KEY) || '{}'); } catch (e) {}

  const totalMarkers = Object.values(userMarkers).reduce((sum, arr) => sum + arr.length, 0);
  const totalDiscovered = Object.values(allData.discoveredMarkers).reduce((sum, arr) => sum + arr.length, 0);
  const totalLabelPos = Object.values(allData.labelPositions).reduce((sum, obj) => sum + Object.keys(obj || {}).length, 0);
  const totalMarkerEdits = Object.values(allData.markerEdits).reduce((s, o) => s + Object.keys(o || {}).length, 0)
    + Object.values(allData.markerDeletes).reduce((s, a) => s + (a ? a.length : 0), 0);

  if (totalMarkers === 0 && totalDiscovered === 0 && totalLabelPos === 0 && totalMarkerEdits === 0) {
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
  document.getElementById('import-all-modal').classList.add('show');
  document.getElementById('import-all-data').value = '';
  document.getElementById('import-all-file').value = '';
}

function closeImportAllModal() {
  document.getElementById('import-all-modal').classList.remove('show');
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

    // Guard against a parseable-but-wrong file silently wiping everything:
    // require at least one recognized backup key before the destructive replace.
    const KNOWN_KEYS = ['userMarkers', 'discoveredMarkers', 'labelPositions',
      'activeCategories', 'markerEdits', 'markerDeletes'];
    if (!data || typeof data !== 'object' || !KNOWN_KEYS.some(k => k in data)) {
      showToast('Unrecognized backup file — nothing imported');
      return;
    }

    if (!(await showConfirm('This will replace all your current markers, progress, settlement-name positions, category filters, and marker edits. Continue?', {title:'Import all data', confirmText:'Replace'}))) return;

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

    // Restore POI marker renames/deletions (v3+ backups)
    if (data.markerEdits && typeof data.markerEdits === 'object') {
      localStorage.setItem(MARKER_EDIT_KEY, JSON.stringify(data.markerEdits));
    }
    if (data.markerDeletes && typeof data.markerDeletes === 'object') {
      localStorage.setItem(MARKER_DELETE_KEY, JSON.stringify(data.markerDeletes));
    }
    invalidateEditedMarkers();  // imported edits/deletes affect both regions' caches

    // Rebuild the whole view so markers, progress, category filters, label
    // positions and marker edits all reflect the imported state.
    await loadRegion(currentRegion);

    closeImportAllModal();
    showToast(`Imported ${markerCount} markers + ${discoveredCount} discoveries${labelPosCount ? ` + ${labelPosCount} label positions` : ''}`);
  } catch (e) {
    console.error('Import all error:', e);
    showToast('Invalid JSON data');
  }
}


