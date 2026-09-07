// FinMS — MySQL Engine (via PHP API) + Seed Data
//
// Data lives in MySQL and is reached over api/records.php. The DB object below
// keeps the exact method names and shapes the IndexedDB version had — getAll,
// get, put, delete, clear, getByIndex — so every page in app.js works unchanged
// and the storage swap stays contained to this file.
//
// One consequence of the move: records are shared by every browser and device
// that can reach this server, instead of being trapped in one browser's
// per-origin store.

const API_BASE = 'api';

const STORES = {
  users: 'users',
  clients: 'clients',
  projects: 'projects',
  milestones: 'milestones',
  invoices: 'invoices',
  invoice_payments: 'invoice_payments',
  expenses: 'expenses',
  accounts: 'accounts',
  transactions: 'transactions',
  categories: 'categories',
  reconciliations: 'reconciliations',
  settings: 'settings',
};

// ── Transport ─────────────────────────────────────────────────────
// Every call goes to the same PHP endpoint; the session cookie rides along
// automatically because the API is served from this same origin.
async function apiCall(path, options = {}) {
  const res = await fetch(`${API_BASE}/${path}`, {
    credentials: 'same-origin',
    ...options,
  });

  if (res.status === 401) {
    // The server session expired or was never established. Sending the user
    // back to the login screen beats letting every page render empty.
    throw new Error('Sesi berakhir. Silakan login kembali.');
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Respons server tidak terbaca (HTTP ${res.status}).`);
  }

  if (!res.ok) throw new Error(payload?.error || `Gagal menghubungi server (HTTP ${res.status}).`);
  return payload;
}

const recordUrl = (store, params = {}) => {
  const q = new URLSearchParams({ store, ...params });
  return `records.php?${q.toString()}`;
};

// Kept so bootstrap() and any older caller still have something to await.
// There is no connection to open any more — the check just proves the API and
// database are reachable before the app starts drawing pages.
async function openDB() {
  await apiCall(recordUrl('settings'));
  return true;
}

// ── Generic CRUD ──────────────────────────────────────────────────
const DB = {
  async add(store, record) {
    return this.put(store, record);
  },

  async put(store, record) {
    const res = await apiCall(recordUrl(store), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    return res.id;
  },

  async get(store, id) {
    // IndexedDB resolved undefined for a missing key; the API answers null.
    // Normalising here keeps `if (!existing)` checks elsewhere behaving.
    const row = await apiCall(recordUrl(store, { id }));
    return row === null ? undefined : row;
  },

  async getAll(store) {
    return apiCall(recordUrl(store));
  },

  async getByIndex(store, indexName, value) {
    return apiCall(recordUrl(store, { index: indexName, value }));
  },

  async delete(store, id) {
    await apiCall(recordUrl(store, { id }), { method: 'DELETE' });
  },

  async clear(store) {
    await apiCall(recordUrl(store, { all: '1' }), { method: 'DELETE' });
  },
};

// ── ID Generator ──────────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function genInvoiceNumber(year, month, seq) {
  return `INV/${year}/${String(month).padStart(2,'0')}/${String(seq).padStart(3,'0')}`;
}

// ── Categories added after the first release ──────────────────────
// seedDatabase() only runs on an empty database, so anything added here
// later also needs runMigrations() to backfill it into existing ones.
const ADDED_CATEGORIES = [
  { id: 'cat13', name: 'Project-Based Fee', flow_type: 'inflow',  section: 'operating', color: '#14b8a6' },
  { id: 'cat14', name: 'Lain-lain',         flow_type: 'outflow', section: 'operating', color: '#64748b' },
];

// ── Migrations ────────────────────────────────────────────────────
// Each entry runs once per database, tracked by id in settings.migrations.
// Deleting a category the user removed on purpose would be worse than not
// having it, so backfills only insert what is genuinely missing.
const MIGRATIONS = [
  {
    id: '2026-09-add-project-fee-and-misc-categories',
    async run() {
      for (const c of ADDED_CATEGORIES) {
        const existing = await DB.get('categories', c.id);
        if (!existing) await DB.put('categories', c);
      }
    },
  },
];

async function runMigrations() {
  const record = await DB.get('settings', 'migrations');
  const applied = new Set(record?.value || []);
  let changed = false;

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    await m.run();
    applied.add(m.id);
    changed = true;
    console.log('[DB] Migration applied:', m.id);
  }

  if (changed) {
    await DB.put('settings', { key: 'migrations', value: [...applied], updated_at: new Date().toISOString() });
  }
}

// ── Backup / Restore ──────────────────────────────────────────────
// IndexedDB is scoped per origin, so the same app served from
// localhost:5173 and 127.0.0.1:5173 keeps two unrelated databases. A file
// on disk is the only thing that moves data between them — or survives a
// cleared browser at all.
const EXPORT_FORMAT = 'finms-backup';
const EXPORT_VERSION = 1;

async function exportAllData() {
  const data = {};
  for (const store of Object.values(STORES)) {
    data[store] = await DB.getAll(store);
  }
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    origin: location.origin,
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    data,
  };
}

function validateBackup(payload) {
  if (!payload || payload.format !== EXPORT_FORMAT) return 'File ini bukan backup FinMS.';
  if (!payload.data || typeof payload.data !== 'object') return 'Isi file backup tidak terbaca.';
  const known = Object.values(STORES);
  if (!Object.keys(payload.data).some(s => known.includes(s))) {
    return 'Backup tidak memuat satu pun tabel yang dikenali.';
  }
  return null;
}

// mode 'merge'   — record dengan id sama ditimpa, sisanya dipertahankan
// mode 'replace' — seluruh isi tabel dikosongkan lebih dulu
async function importAllData(payload, { mode = 'merge' } = {}) {
  const problem = validateBackup(payload);
  if (problem) throw new Error(problem);

  const result = { mode, stores: {}, total: 0 };

  for (const store of Object.values(STORES)) {
    const rows = payload.data[store];
    if (!Array.isArray(rows)) continue;

    // Replacing users with an empty list would lock everyone out.
    const wipeFirst = mode === 'replace' && !(store === 'users' && rows.length === 0);
    if (wipeFirst) await DB.clear(store);

    for (const row of rows) await DB.put(store, row);
    result.stores[store] = rows.length;
    result.total += rows.length;
  }

  // A restored database must never look empty to seedDatabase(), or the whole
  // demo dataset lands back on top of the data we just brought in.
  if (!(await DB.get('settings', 'seeded'))) {
    await DB.put('settings', { key: 'seeded', value: true, seeded_at: new Date().toISOString() });
  }

  console.log('[DB] Backup imported:', result);
  return result;
}

// ── Demo dataset ──────────────────────────────────────────────────
// Ids created by seedDatabase(). Listing them explicitly lets the reset drop
// the demo dataset while leaving anything the user entered untouched.
const range = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

const SEED_IDS = {
  transactions:     range('tx', 1, 9),
  invoice_payments: range('ip', 1, 4),
  invoices:         range('inv', 1, 6),
  milestones:       range('ms', 1, 13),
  projects:         range('pr', 1, 4),
  clients:          range('cl', 1, 4),
  expenses:         range('ex', 1, 7),
  accounts:         range('acc', 1, 4),
};

// Stores the reset never touches. Clearing settings would drop the `seeded`
// flag and make seedDatabase() refill the whole demo dataset on next load;
// users must survive or nobody can log back in; categories are the user's
// own chart of accounts.
const RESET_KEEPS = ['settings', 'users', 'categories'];

// What a reset would remove, without changing anything.
async function previewDemoReset({ wipeAllAccounts = false } = {}) {
  const counts = {};
  for (const [store, ids] of Object.entries(SEED_IDS)) {
    if (store === 'accounts') continue;
    let n = 0;
    for (const id of ids) if (await DB.get(store, id)) n++;
    counts[store] = n;
  }

  const accounts = await DB.getAll('accounts');
  const doomedAccounts = wipeAllAccounts
    ? accounts.map(a => a.id)
    : SEED_IDS.accounts.filter(id => accounts.some(a => a.id === id));
  counts.accounts = doomedAccounts.length;

  // Transactions the user entered themselves that point at an account which
  // is about to disappear — they survive the reset but lose their link.
  const survivingTx = (await DB.getAll('transactions')).filter(t => !SEED_IDS.transactions.includes(t.id));
  counts.orphanedTransactions = survivingTx.filter(t => doomedAccounts.includes(t.account_id)).length;
  counts.keptTransactions = survivingTx.length;

  return counts;
}

async function resetDemoData({ wipeAllAccounts = false } = {}) {
  const removed = {};

  for (const [store, ids] of Object.entries(SEED_IDS)) {
    if (store === 'accounts') continue;
    let n = 0;
    for (const id of ids) {
      if (await DB.get(store, id)) { await DB.delete(store, id); n++; }
    }
    removed[store] = n;
  }

  if (wipeAllAccounts) {
    const accounts = await DB.getAll('accounts');
    for (const a of accounts) await DB.delete('accounts', a.id);
    removed.accounts = accounts.length;
  } else {
    let n = 0;
    for (const id of SEED_IDS.accounts) {
      if (await DB.get('accounts', id)) { await DB.delete('accounts', id); n++; }
    }
    removed.accounts = n;
  }

  await DB.put('settings', { key: 'demo_reset_at', value: new Date().toISOString() });
  console.log('[DB] Demo data reset:', removed);
  return removed;
}

// ── Seed Data ─────────────────────────────────────────────────────
async function seedDatabase() {
  const seeded = await DB.get('settings', 'seeded');
  if (seeded) return;

  const now = new Date().toISOString();
  const today = new Date();

  // Users
  const users = [
    { id: 'u1', name: 'Ahmad Surya', email: 'admin@company.id', password: 'admin123', role: 'admin', created_at: now, active: true },
    { id: 'u2', name: 'Budi Santoso', email: 'ceo@company.id', password: 'ceo123', role: 'ceo', created_at: now, active: true },
    { id: 'u3', name: 'Citra Dewi', email: 'finance@company.id', password: 'finance123', role: 'finance_manager', created_at: now, active: true },
    { id: 'u4', name: 'Deni Pratama', email: 'staff@company.id', password: 'staff123', role: 'finance_staff', created_at: now, active: true },
    { id: 'u5', name: 'Eka Wulandari', email: 'pm@company.id', password: 'pm123', role: 'project_manager', created_at: now, active: true },
  ];
  for (const u of users) await DB.put('users', u);

  // Categories
  const categories = [
    { id: 'cat1', name: 'Pendapatan Proyek', flow_type: 'inflow', section: 'operating', color: '#10b981' },
    { id: 'cat2', name: 'DP / Uang Muka', flow_type: 'inflow', section: 'operating', color: '#6366f1' },
    { id: 'cat3', name: 'Pembayaran Termin', flow_type: 'inflow', section: 'operating', color: '#0ea5e9' },
    { id: 'cat4', name: 'Gaji & Tunjangan', flow_type: 'outflow', section: 'operating', color: '#f59e0b' },
    { id: 'cat5', name: 'Biaya Operasional', flow_type: 'outflow', section: 'operating', color: '#ef4444' },
    { id: 'cat6', name: 'Pembelian Hardware', flow_type: 'outflow', section: 'operating', color: '#8b5cf6' },
    { id: 'cat7', name: 'Software & Lisensi', flow_type: 'outflow', section: 'operating', color: '#ec4899' },
    { id: 'cat8', name: 'Marketing & Promosi', flow_type: 'outflow', section: 'operating', color: '#f97316' },
    { id: 'cat9', name: 'Pembelian Aset', flow_type: 'outflow', section: 'investing', color: '#84cc16' },
    { id: 'cat10', name: 'Pinjaman Bank', flow_type: 'inflow', section: 'financing', color: '#06b6d4' },
    { id: 'cat11', name: 'Cicilan Pinjaman', flow_type: 'outflow', section: 'financing', color: '#f43f5e' },
    { id: 'cat12', name: 'Transfer Masuk', flow_type: 'inflow', section: 'operating', color: '#a3e635' },
    ...ADDED_CATEGORIES,
  ];
  for (const c of categories) await DB.put('categories', c);

  // Bank Accounts
  const accounts = [
    { id: 'acc1', name: 'Kas Kecil', bank: 'Kas', account_number: '-', balance: 12500000, type: 'cash', color: '#f59e0b', active: true },
    { id: 'acc2', name: 'BCA Operasional', bank: 'BCA', account_number: '1234-5678-9012', balance: 185000000, type: 'bank', color: '#0ea5e9', active: true },
    { id: 'acc3', name: 'Mandiri Payroll', bank: 'Mandiri', account_number: '0987-6543-2100', balance: 95000000, type: 'bank', color: '#6366f1', active: true },
    { id: 'acc4', name: 'BRI Tabungan', bank: 'BRI', account_number: '1122-3344-5566', balance: 50000000, type: 'bank', color: '#10b981', active: true },
  ];
  for (const a of accounts) await DB.put('accounts', a);

  // Clients
  const clients = [
    { id: 'cl1', name: 'PT Maju Bersama', contact: 'Hendra Wijaya', phone: '08112345678', email: 'hendra@majubersama.co.id', address: 'Jakarta Selatan', created_at: now },
    { id: 'cl2', name: 'CV Teknologi Nusantara', contact: 'Sari Indah', phone: '08223456789', email: 'sari@teknologi.co.id', address: 'Bandung', created_at: now },
    { id: 'cl3', name: 'Dinas Pendidikan Kota X', contact: 'Pak Bambang', phone: '08334567890', email: 'bambang@dinas.go.id', address: 'Surabaya', created_at: now },
    { id: 'cl4', name: 'PT Retail Indonesia', contact: 'Rina Maulana', phone: '08445678901', email: 'rina@retail.co.id', address: 'Medan', created_at: now },
  ];
  for (const c of clients) await DB.put('clients', c);

  // Projects
  const projects = [
    { id: 'pr1', name: 'SIMPEG — Sistem Informasi Pegawai', client_id: 'cl1', value: 350000000, status: 'ongoing', start_date: '2026-05-01', end_date: '2026-11-30', description: 'Pengembangan sistem informasi manajemen pegawai berbasis web', created_at: now },
    { id: 'pr2', name: 'E-Commerce Platform Retail', client_id: 'cl4', value: 280000000, status: 'ongoing', start_date: '2026-06-15', end_date: '2026-12-31', description: 'Platform e-commerce multi-tenant untuk jaringan retail', created_at: now },
    { id: 'pr3', name: 'Aplikasi Absensi Mobile', client_id: 'cl2', value: 120000000, status: 'completed', start_date: '2026-01-10', end_date: '2026-05-31', description: 'Aplikasi absensi berbasis GPS untuk Android dan iOS', created_at: now },
    { id: 'pr4', name: 'Sistem Pengelolaan Sekolah', client_id: 'cl3', value: 450000000, status: 'ongoing', start_date: '2026-07-01', end_date: '2027-03-31', description: 'Sistem informasi terpadu untuk pengelolaan sekolah', created_at: now },
  ];
  for (const p of projects) await DB.put('projects', p);

  // Milestones
  const milestones = [
    // PR1 — SIMPEG
    { id: 'ms1', project_id: 'pr1', name: 'DP / Kontrak', percentage: 30, amount: 105000000, due_date: '2026-05-15', status: 'invoiced', invoice_id: 'inv1' },
    { id: 'ms2', project_id: 'pr1', name: 'Fase 1 — Analisis & Desain', percentage: 20, amount: 70000000, due_date: '2026-07-31', status: 'invoiced', invoice_id: 'inv2' },
    { id: 'ms3', project_id: 'pr1', name: 'Fase 2 — Development', percentage: 30, amount: 105000000, due_date: '2026-10-15', status: 'pending', invoice_id: null },
    { id: 'ms4', project_id: 'pr1', name: 'Final Delivery', percentage: 20, amount: 70000000, due_date: '2026-11-30', status: 'pending', invoice_id: null },
    // PR2 — E-Commerce
    { id: 'ms5', project_id: 'pr2', name: 'DP', percentage: 30, amount: 84000000, due_date: '2026-06-30', status: 'invoiced', invoice_id: 'inv3' },
    { id: 'ms6', project_id: 'pr2', name: 'Fase 1', percentage: 35, amount: 98000000, due_date: '2026-09-30', status: 'pending', invoice_id: null },
    { id: 'ms7', project_id: 'pr2', name: 'Final', percentage: 35, amount: 98000000, due_date: '2026-12-31', status: 'pending', invoice_id: null },
    // PR3 — Absensi (completed)
    { id: 'ms8', project_id: 'pr3', name: 'DP', percentage: 40, amount: 48000000, due_date: '2026-01-20', status: 'paid', invoice_id: 'inv4' },
    { id: 'ms9', project_id: 'pr3', name: 'Final', percentage: 60, amount: 72000000, due_date: '2026-05-31', status: 'paid', invoice_id: 'inv5' },
    // PR4 — Sekolah
    { id: 'ms10', project_id: 'pr4', name: 'DP', percentage: 25, amount: 112500000, due_date: '2026-07-15', status: 'invoiced', invoice_id: 'inv6' },
    { id: 'ms11', project_id: 'pr4', name: 'Fase 1', percentage: 25, amount: 112500000, due_date: '2026-10-31', status: 'pending', invoice_id: null },
    { id: 'ms12', project_id: 'pr4', name: 'Fase 2', percentage: 25, amount: 112500000, due_date: '2027-01-31', status: 'pending', invoice_id: null },
    { id: 'ms13', project_id: 'pr4', name: 'Final', percentage: 25, amount: 112500000, due_date: '2027-03-31', status: 'pending', invoice_id: null },
  ];
  for (const m of milestones) await DB.put('milestones', m);

  // Invoices
  const invoices = [
    { id: 'inv1', number: 'INV/2026/05/001', project_id: 'pr1', milestone_id: 'ms1', client_id: 'cl1', amount: 105000000, tax: 0, total: 105000000, issue_date: '2026-05-15', due_date: '2026-05-30', status: 'paid', notes: 'DP 30% SIMPEG', created_at: now },
    { id: 'inv2', number: 'INV/2026/07/002', project_id: 'pr1', milestone_id: 'ms2', client_id: 'cl1', amount: 70000000, tax: 0, total: 70000000, issue_date: '2026-07-31', due_date: '2026-08-15', status: 'partial', notes: 'Termin Fase 1 SIMPEG', created_at: now },
    { id: 'inv3', number: 'INV/2026/06/003', project_id: 'pr2', milestone_id: 'ms5', client_id: 'cl4', amount: 84000000, tax: 0, total: 84000000, issue_date: '2026-06-30', due_date: '2026-07-15', status: 'sent', notes: 'DP E-Commerce', created_at: now },
    { id: 'inv4', number: 'INV/2026/01/004', project_id: 'pr3', milestone_id: 'ms8', client_id: 'cl2', amount: 48000000, tax: 0, total: 48000000, issue_date: '2026-01-20', due_date: '2026-02-05', status: 'paid', notes: 'DP Absensi', created_at: now },
    { id: 'inv5', number: 'INV/2026/06/005', project_id: 'pr3', milestone_id: 'ms9', client_id: 'cl2', amount: 72000000, tax: 0, total: 72000000, issue_date: '2026-06-01', due_date: '2026-06-15', status: 'paid', notes: 'Final Absensi', created_at: now },
    { id: 'inv6', number: 'INV/2026/07/006', project_id: 'pr4', milestone_id: 'ms10', client_id: 'cl3', amount: 112500000, tax: 0, total: 112500000, issue_date: '2026-07-15', due_date: '2026-07-31', status: 'sent', notes: 'DP Sistem Sekolah', created_at: now },
  ];
  for (const i of invoices) await DB.put('invoices', i);

  // Invoice Payments
  const invPayments = [
    { id: 'ip1', invoice_id: 'inv1', amount: 105000000, date: '2026-05-28', account_id: 'acc2', notes: 'Transfer BCA', created_at: now },
    { id: 'ip2', invoice_id: 'inv2', amount: 35000000, date: '2026-08-10', account_id: 'acc2', notes: 'Pembayaran sebagian', created_at: now },
    { id: 'ip3', invoice_id: 'inv4', amount: 48000000, date: '2026-02-03', account_id: 'acc2', notes: 'Transfer', created_at: now },
    { id: 'ip4', invoice_id: 'inv5', amount: 72000000, date: '2026-06-12', account_id: 'acc2', notes: 'Transfer', created_at: now },
  ];
  for (const p of invPayments) await DB.put('invoice_payments', p);

  // Expenses
  const expenses = [
    { id: 'ex1', title: 'Gaji Karyawan Juli 2026', category_id: 'cat4', category_type: 'OPEX', amount: 85000000, date: '2026-07-30', account_id: 'acc3', status: 'disbursed', requested_by: 'u4', approved_by: 'u2', description: 'Pembayaran gaji seluruh karyawan', attachment: null, created_at: now },
    { id: 'ex2', title: 'Sewa Kantor Agustus', category_id: 'cat5', category_type: 'OPEX', amount: 15000000, date: '2026-08-01', account_id: 'acc2', status: 'disbursed', requested_by: 'u4', approved_by: 'u3', description: 'Sewa kantor bulan Agustus', attachment: null, created_at: now },
    { id: 'ex3', title: 'Pembelian Laptop Developer', category_id: 'cat9', category_type: 'CAPEX', amount: 32000000, date: '2026-08-05', account_id: 'acc2', status: 'approved', requested_by: 'u4', approved_by: 'u2', description: '2 unit laptop MacBook Air M2', attachment: null, created_at: now },
    { id: 'ex4', title: 'Domain & Hosting Tahunan', category_id: 'cat7', category_type: 'OPEX', amount: 5500000, date: '2026-08-10', account_id: 'acc2', status: 'disbursed', requested_by: 'u4', approved_by: 'u3', description: 'Perpanjangan domain dan hosting server', attachment: null, created_at: now },
    { id: 'ex5', title: 'Gaji Karyawan Agustus 2026', category_id: 'cat4', category_type: 'OPEX', amount: 85000000, date: '2026-08-30', account_id: 'acc3', status: 'disbursed', requested_by: 'u4', approved_by: 'u2', description: 'Pembayaran gaji seluruh karyawan', attachment: null, created_at: now },
    { id: 'ex6', title: 'Iklan Google Ads', category_id: 'cat8', category_type: 'OPEX', amount: 8000000, date: '2026-09-01', account_id: 'acc2', status: 'pending', requested_by: 'u4', approved_by: null, description: 'Budget iklan Google Ads bulan September', attachment: null, created_at: now },
    { id: 'ex7', title: 'ATK & Perlengkapan Kantor', category_id: 'cat5', category_type: 'OPEX', amount: 2500000, date: '2026-09-03', account_id: 'acc1', status: 'disbursed', requested_by: 'u4', approved_by: 'u3', description: 'Pembelian ATK dan perlengkapan kantor', attachment: null, created_at: now },
  ];
  for (const ex of expenses) await DB.put('expenses', ex);

  // Transactions (cash_in / cash_out)
  const transactions = [
    // Inflows from invoice payments
    { id: 'tx1', type: 'cash_in', account_id: 'acc2', category_id: 'cat1', amount: 105000000, date: '2026-05-28', description: 'Pembayaran INV/2026/05/001 — SIMPEG DP', ref_type: 'invoice', ref_id: 'inv1', created_by: 'u3', created_at: now },
    { id: 'tx2', type: 'cash_in', account_id: 'acc2', category_id: 'cat1', amount: 35000000, date: '2026-08-10', description: 'Pembayaran Sebagian INV/2026/07/002 — SIMPEG Fase 1', ref_type: 'invoice', ref_id: 'inv2', created_by: 'u3', created_at: now },
    { id: 'tx3', type: 'cash_in', account_id: 'acc2', category_id: 'cat1', amount: 48000000, date: '2026-02-03', description: 'Pembayaran INV/2026/01/004 — Absensi DP', ref_type: 'invoice', ref_id: 'inv4', created_by: 'u3', created_at: now },
    { id: 'tx4', type: 'cash_in', account_id: 'acc2', category_id: 'cat1', amount: 72000000, date: '2026-06-12', description: 'Pembayaran INV/2026/06/005 — Absensi Final', ref_type: 'invoice', ref_id: 'inv5', created_by: 'u3', created_at: now },
    // Outflows from expenses
    { id: 'tx5', type: 'cash_out', account_id: 'acc3', category_id: 'cat4', amount: 85000000, date: '2026-07-30', description: 'Gaji Karyawan Juli 2026', ref_type: 'expense', ref_id: 'ex1', created_by: 'u3', created_at: now },
    { id: 'tx6', type: 'cash_out', account_id: 'acc2', category_id: 'cat5', amount: 15000000, date: '2026-08-01', description: 'Sewa Kantor Agustus', ref_type: 'expense', ref_id: 'ex2', created_by: 'u3', created_at: now },
    { id: 'tx7', type: 'cash_out', account_id: 'acc2', category_id: 'cat7', amount: 5500000, date: '2026-08-10', description: 'Domain & Hosting Tahunan', ref_type: 'expense', ref_id: 'ex4', created_by: 'u3', created_at: now },
    { id: 'tx8', type: 'cash_out', account_id: 'acc3', category_id: 'cat4', amount: 85000000, date: '2026-08-30', description: 'Gaji Karyawan Agustus 2026', ref_type: 'expense', ref_id: 'ex5', created_by: 'u3', created_at: now },
    { id: 'tx9', type: 'cash_out', account_id: 'acc1', category_id: 'cat5', amount: 2500000, date: '2026-09-03', description: 'ATK & Perlengkapan Kantor', ref_type: 'expense', ref_id: 'ex7', created_by: 'u3', created_at: now },
  ];
  for (const t of transactions) await DB.put('transactions', t);

  await DB.put('settings', { key: 'seeded', value: true, seeded_at: now });
  console.log('[DB] Seed data loaded successfully.');
}

// Export
window.DB = DB;
window.genId = genId;
window.genInvoiceNumber = genInvoiceNumber;
window.seedDatabase = seedDatabase;
window.runMigrations = runMigrations;
window.exportAllData = exportAllData;
window.importAllData = importAllData;
window.previewDemoReset = previewDemoReset;
window.resetDemoData = resetDemoData;
window.SEED_IDS = SEED_IDS;
window.RESET_KEEPS = RESET_KEEPS;
window.STORES = STORES;
