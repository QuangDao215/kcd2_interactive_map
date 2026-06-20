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
  try { localStorage.setItem(CONFIG.storageKeys.activeTab, tabName); } catch (e) { /* private mode */ }
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
// ── Keyboard shortcuts ──
function _isTypingTarget(el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' || el.isContentEditable);
}
// Close the single topmost overlay, in priority order. Returns true if it closed one.
function closeTopmostOverlay() {
  const confirmModal = document.getElementById('confirm-modal');
  if (confirmModal && confirmModal.classList.contains('show')) { _confirmClose(false); return true; }
  for (const id of ['import-modal', 'import-progress-modal', 'import-all-modal']) {
    const m = document.getElementById(id);
    if (m && m.classList.contains('show')) { m.classList.remove('show'); return true; }
  }
  const panels = [['calibration-panel', calClose], ['label-edit-panel', labelEditClose], ['marker-edit-panel', markerEditClose]];
  for (const [id, close] of panels) {
    const p = document.getElementById(id);
    if (p && p.classList.contains('active')) { close(); return true; }
  }
  const sr = document.getElementById('search-results');
  if (sr && sr.classList.contains('active')) { sr.classList.remove('active'); return true; }
  if (typeof legendOpen !== 'undefined' && legendOpen) { toggleLegend(); return true; }
  if (map && map._popup) { map.closePopup(); return true; }
  return false;
}
document.addEventListener('keydown', e => {
  // "/" jumps to search (unless you're already typing in a field)
  if (e.key === '/' && !_isTypingTarget(e.target)) {
    const s = document.getElementById('search-input');
    if (s) { e.preventDefault(); s.focus(); s.select(); }
    return;
  }
  // Esc closes the topmost overlay (confirm → modal → tool panel → search → legend → popup)
  if (e.key === 'Escape') closeTopmostOverlay();
  // Enter / Space activates a keyboard-focused category row or group header
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList &&
      (e.target.classList.contains('category-item') || e.target.classList.contains('cat-group-header'))) {
    e.preventDefault();
    e.target.click();
  }
});

// ── Map view controls (U2/U3) ──
function resetView() {
  if (map && currentRegionBounds) map.fitBounds(currentRegionBounds);
}
function toggleFullscreen() {
  const doc = document;
  if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
    const el = doc.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  } else {
    (doc.exitFullscreen || doc.webkitExitFullscreen || (() => {})).call(doc);
  }
}
document.addEventListener('fullscreenchange', () => { if (map) map.invalidateSize(); });
function copyCurrentLink() {
  // The hash is kept in sync with the view (and the open marker), so href IS the permalink.
  const link = location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link)
      .then(() => showToast('Link copied to clipboard'))
      .catch(() => showToast('Copy failed — check browser permissions'));
  } else {
    showToast('Clipboard unavailable in this browser');
  }
}

// ── One-time "right-click to add" hint (U7) ──
function dismissMapHint() {
  const h = document.getElementById('map-hint');
  if (h) h.classList.remove('show');
  try { localStorage.setItem(CONFIG.storageKeys.mapHintDismissed, '1'); } catch (e) { /* private mode */ }
}
function maybeShowMapHint() {
  let dismissed = false;
  try { dismissed = localStorage.getItem(CONFIG.storageKeys.mapHintDismissed) === '1'; } catch (e) { /* ignore */ }
  if (dismissed) return;
  const h = document.getElementById('map-hint');
  if (h) h.classList.add('show');
}


// ═══════════════════════════════════════════════
// ██ INIT
// ═══════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', init);
