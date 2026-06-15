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
