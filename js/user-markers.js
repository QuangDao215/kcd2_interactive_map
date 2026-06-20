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
  const catItems = buildCategoryDropdownItems();

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

// The <div.icon-dropdown-item> rows for every category, sorted by name — shared
// by the add-marker and edit-marker forms.
function buildCategoryDropdownItems() {
  const iconMap = window.ICON_MAP || {};
  return [...categories].sort((a, b) => a.name.localeCompare(b.name)).map(c => {
    const iconSrc = iconMap[c.id] || '';
    const iconHtml = iconSrc
      ? `<img src="${iconSrc}" onerror="this.style.display='none'">`
      : `<span style="width:20px;text-align:center">${c.icon || '📦'}</span>`;
    return `<div class="icon-dropdown-item" data-value="${c.id}" onclick="selectCategory('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${iconSrc}')">${iconHtml} ${c.name}</div>`;
  }).join('');
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
  updatePromoteStatus();
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
  updatePromoteStatus();
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
  const currentCat = categoriesById[markerData.category];
  const currentIconSrc = iconMap[markerData.category] || '';
  const currentCatName = currentCat ? currentCat.name : 'Custom';
  const currentIconHtml = currentIconSrc
    ? `<img src="${currentIconSrc}" style="width:20px;height:20px;image-rendering:pixelated">`
    : `<span style="width:20px;text-align:center">${currentCat?.icon || '📌'}</span>`;

  const catItems = buildCategoryDropdownItems();

  const editHtml = `
    <div class="marker-form">
      <h3>Edit Marker</h3>
      <label>Name</label>
      <input type="text" id="edit-marker-name" value="${escapeHtml(markerData.name)}">
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
      <textarea id="edit-marker-desc">${escapeHtml(markerData.description)}</textarea>
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

function flyToMarker(x, y, markerKey) {
  // Use a zoom level near the tile pyramid max for clear detail
  const targetZoom = Math.max(map.getMaxZoom() - 1, map.getZoom());
  map.flyTo([y, x], targetZoom, { duration: 0.6 });

  // After the fly animation completes, open the target marker's popup.
  // Prefer an exact key lookup; otherwise fall back to a boundary-safe
  // coordinate match — ":x:y" so e.g. flyTo 5,6 can't match "shrine:15:6".
  setTimeout(() => {
    if (markerKey && markersByKey[markerKey]) {
      markersByKey[markerKey].openPopup();
      return;
    }
    const suffix = `:${x}:${y}`;
    for (const [key, marker] of Object.entries(markersByKey)) {
      if (key.endsWith(suffix)) {
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
    const cat = categoriesById[m.category];
    const iconMap = window.ICON_MAP || {};
    const iconSrc = iconMap[m.category];
    const iconHtml = iconSrc
      ? `<img src="${iconSrc}" style="width:20px;height:20px;image-rendering:pixelated">`
      : `<span>${cat ? cat.icon : '📌'}</span>`;
    return `
      <div class="my-marker-item" onclick="flyToMarker(${m.x}, ${m.y}, '${getMarkerKey(m)}')">
        <span class="mm-icon">${iconHtml}</span>
        <div class="mm-info">
          <div class="mm-name">${escapeHtml(m.name)}</div>
          <div class="mm-coords">X: ${m.x} Y: ${m.y}</div>
        </div>
        <button class="mm-delete" onclick="event.stopPropagation();deleteUserMarker(${m.id})" title="Delete">✕</button>
      </div>
    `;
  }).join('');
}


