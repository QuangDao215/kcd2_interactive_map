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


