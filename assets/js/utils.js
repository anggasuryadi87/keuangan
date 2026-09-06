// FinMS — Utility Helpers

const Utils = {
  // ── Currency ──────────────────────────────────────────────────
  formatRupiah(amount, short = false) {
    if (amount === null || amount === undefined) return 'Rp 0';
    if (short) {
      if (Math.abs(amount) >= 1e9) return `Rp ${(amount / 1e9).toFixed(1)}M`;
      if (Math.abs(amount) >= 1e6) return `Rp ${(amount / 1e6).toFixed(1)}jt`;
      if (Math.abs(amount) >= 1e3) return `Rp ${(amount / 1e3).toFixed(0)}rb`;
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  parseRupiah(str) {
    return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
  },

  // ── Date ──────────────────────────────────────────────────────
  formatDate(dateStr, opts = {}) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return '-';
    const defaults = { day: '2-digit', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('id-ID', { ...defaults, ...opts });
  },

  formatDateInput(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toISOString().split('T')[0];
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return '-';
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  daysUntil(dateStr) {
    if (!dateStr) return null;
    const due = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diff;
  },

  currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  monthRange(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  },

  isInRange(dateStr, start, end) {
    if (!dateStr) return false;
    return dateStr >= start && dateStr <= end;
  },

  getLast12Months() {
    const months = [];
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push({
        label: t.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
        key: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`,
      });
    }
    return months;
  },

  // ── Status Badges ─────────────────────────────────────────────
  statusBadge(status) {
    const map = {
      // Invoice
      draft: { label: 'Draft', cls: 'badge-gray' },
      sent: { label: 'Terkirim', cls: 'badge-blue' },
      partial: { label: 'Sebagian', cls: 'badge-orange' },
      paid: { label: 'Lunas', cls: 'badge-green' },
      overdue: { label: 'Jatuh Tempo', cls: 'badge-red' },
      // Expense
      pending: { label: 'Menunggu', cls: 'badge-orange' },
      approved: { label: 'Disetujui', cls: 'badge-blue' },
      rejected: { label: 'Ditolak', cls: 'badge-red' },
      disbursed: { label: 'Dibayar', cls: 'badge-green' },
      // Project
      ongoing: { label: 'Berjalan', cls: 'badge-blue' },
      completed: { label: 'Selesai', cls: 'badge-green' },
      cancelled: { label: 'Batal', cls: 'badge-red' },
      // Milestone
      invoiced: { label: 'Ditagih', cls: 'badge-blue' },
      // Reconciliation
      matched: { label: 'Cocok', cls: 'badge-green' },
      unmatched: { label: 'Tidak Cocok', cls: 'badge-red' },
      manual: { label: 'Manual', cls: 'badge-orange' },
    };
    const s = map[status] || { label: status, cls: 'badge-gray' };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
  },

  // ── Notifications / Toast ─────────────────────────────────────
  toast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const id = genId();
    const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
    const icon = icons[type] || 'info';
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.id = `toast-${id}`;
    el.innerHTML = `
      <i data-lucide="${icon}" class="toast-icon"></i>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <i data-lucide="x"></i>
      </button>
    `;
    container.appendChild(el);
    if (window.lucide) lucide.createIcons({ el });
    setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 400); }, duration);
  },

  // ── Modals ────────────────────────────────────────────────────
  showModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('open'); document.body.classList.add('modal-open'); }
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('open'); document.body.classList.remove('modal-open'); }
  },

  closeAllModals() {
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    document.body.classList.remove('modal-open');
  },

  // ── Forms ─────────────────────────────────────────────────────
  getFormData(formEl) {
    const data = {};
    const fd = new FormData(formEl);
    for (const [key, value] of fd.entries()) {
      data[key] = value;
    }
    return data;
  },

  fillForm(formEl, data) {
    if (!formEl || !data) return;
    for (const [key, value] of Object.entries(data)) {
      const el = formEl.querySelector(`[name="${key}"]`);
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!value;
      else el.value = value ?? '';
    }
  },

  // ── Confirm Dialog ────────────────────────────────────────────
  confirm(message, title = 'Konfirmasi') {
    return new Promise((resolve) => {
      const m = document.getElementById('confirm-modal');
      if (!m) { resolve(window.confirm(message)); return; }
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;
      m.classList.add('open');
      const yes = document.getElementById('confirm-yes');
      const no = document.getElementById('confirm-no');
      const cleanup = () => { m.classList.remove('open'); yes.onclick = null; no.onclick = null; };
      yes.onclick = () => { cleanup(); resolve(true); };
      no.onclick = () => { cleanup(); resolve(false); };
    });
  },

  // ── Number helpers ────────────────────────────────────────────
  sumBy(arr, key) {
    return arr.reduce((s, i) => s + (Number(i[key]) || 0), 0);
  },

  pct(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  },

  // ── CSV Export ────────────────────────────────────────────────
  exportCSV(filename, rows, columns) {
    const header = columns.map(c => `"${c.label}"`).join(',');
    const body = rows.map(row =>
      columns.map(c => {
        const val = c.fn ? c.fn(row) : (row[c.key] ?? '');
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    ).join('\n');
    const csv = header + '\n' + body;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  // ── Debounce ──────────────────────────────────────────────────
  debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  // ── Clipboard ─────────────────────────────────────────────────
  async copyText(text) {
    try { await navigator.clipboard.writeText(text); this.toast('Disalin ke clipboard', 'success'); }
    catch { this.toast('Gagal menyalin', 'error'); }
  },
};

window.Utils = Utils;
