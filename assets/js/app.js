// FinMS — SPA Controller + All Page Renderers
// ================================================

// ── Nav Structure ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { section: 'Utama' },
  { id: 'dashboard',       icon: 'layout-dashboard',  label: 'Dashboard',        roles: ['all'] },
  { section: 'Keuangan' },
  { id: 'accounts',        icon: 'landmark',           label: 'Rekening Bank',    roles: ['all'] },
  { id: 'transactions',    icon: 'arrow-left-right',   label: 'Transaksi',        roles: ['all'] },
  { id: 'cashflow',        icon: 'trending-up',        label: 'Arus Kas',         roles: ['all'] },
  { id: 'reconciliation',  icon: 'git-merge',          label: 'Rekonsiliasi',     roles: ['admin','finance_manager','ceo'] },
  { section: 'Proyek' },
  { id: 'projects',        icon: 'folder-kanban',      label: 'Proyek',           roles: ['all'] },
  { id: 'invoices',        icon: 'file-text',          label: 'Invoice',          roles: ['all'] },
  { section: 'Pengeluaran' },
  { id: 'expenses',        icon: 'receipt',            label: 'Pengeluaran',      roles: ['all'] },
  { section: 'Master Data' },
  { id: 'clients',         icon: 'users',              label: 'Klien',            roles: ['all'] },
  { id: 'categories',      icon: 'tag',                label: 'Kategori',         roles: ['admin','finance_manager'] },
  { id: 'users',           icon: 'user-cog',           label: 'Pengguna',         roles: ['admin'] },
];

// ── Router ────────────────────────────────────────────────────────
const Router = {
  currentPage: null,

  go(page) {
    window.location.hash = page;
  },

  init() {
    window.addEventListener('hashchange', () => this.render());
    this.render();
  },

  render() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.currentPage = hash;
    this.updateNav(hash);
    document.getElementById('topbar-title').textContent = this.getPageTitle(hash);
    renderPage(hash);
  },

  updateNav(active) {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === active);
    });
  },

  getPageTitle(page) {
    const titles = {
      dashboard: 'Executive Dashboard',
      accounts: 'Rekening Bank',
      transactions: 'Transaksi Kas',
      cashflow: 'Laporan Arus Kas',
      reconciliation: 'Rekonsiliasi Bank',
      projects: 'Manajemen Proyek',
      invoices: 'Invoice',
      expenses: 'Pengeluaran & Approval',
      clients: 'Data Klien',
      categories: 'Kategori Arus Kas',
      users: 'Manajemen Pengguna',
    };
    return titles[page] || 'FinMS';
  },
};

// ── Sidebar Render ────────────────────────────────────────────────
function renderSidebar() {
  const user = Auth.user;
  const nav = document.getElementById('sidebar-nav');
  let html = '';

  for (const item of NAV_ITEMS) {
    if (item.section) {
      html += `<div class="nav-section-title">${item.section}</div>`;
      continue;
    }
    const allowed = item.roles.includes('all') || item.roles.includes(user.role);
    if (!allowed) continue;
    html += `
      <div class="nav-item" data-page="${item.id}" onclick="Router.go('${item.id}')">
        <i data-lucide="${item.icon}"></i>
        <span>${item.label}</span>
      </div>`;
  }

  nav.innerHTML = html;

  // User info
  document.getElementById('user-display-name').textContent = user.name;
  document.getElementById('user-display-role').textContent = Auth.getRoleLabel(user.role);
  document.getElementById('user-avatar-initials').textContent = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  if (window.lucide) lucide.createIcons();
}

// ── Page Dispatcher ───────────────────────────────────────────────
async function renderPage(page) {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="flex-center" style="height:60vh;"><div class="loader"></div></div>`;

  try {
    switch (page) {
      case 'dashboard':      await renderDashboard(el);       break;
      case 'accounts':       await renderAccounts(el);        break;
      case 'transactions':   await renderTransactions(el);    break;
      case 'cashflow':       await renderCashflow(el);        break;
      case 'reconciliation': await renderReconciliation(el);  break;
      case 'projects':       await renderProjects(el);        break;
      case 'invoices':       await renderInvoices(el);        break;
      case 'expenses':       await renderExpenses(el);        break;
      case 'clients':        await renderClients(el);         break;
      case 'categories':     await renderCategories(el);      break;
      case 'users':          await renderUsers(el);           break;
      default:               el.innerHTML = '<p style="padding:40px;color:var(--text-muted)">Halaman tidak ditemukan.</p>';
    }
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    el.innerHTML = `<div style="padding:40px;color:var(--red);">Error: ${err.message}</div>`;
    console.error(err);
  }
}

// ════════════════════════════════════════════════════
// ── DASHBOARD ────────────────────────────────────────
// ════════════════════════════════════════════════════
async function renderDashboard(el) {
  const [accounts, transactions, invoices, projects, expenses] = await Promise.all([
    DB.getAll('accounts'), DB.getAll('transactions'), DB.getAll('invoices'),
    DB.getAll('projects'), DB.getAll('expenses'),
  ]);

  const totalBalance = accounts.filter(a => a.active).reduce((s, a) => s + a.balance, 0);
  const today = new Date();
  const m = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const monthRange = Utils.monthRange(m);
  const monthTx = transactions.filter(t => Utils.isInRange(t.date, monthRange.start, monthRange.end));
  const cashIn  = monthTx.filter(t => t.type === 'cash_in').reduce((s,t)=> s+t.amount, 0);
  const cashOut = monthTx.filter(t => t.type === 'cash_out').reduce((s,t)=> s+t.amount, 0);
  const netFlow = cashIn - cashOut;

  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'partial');
  const arTotal = pendingInvoices.reduce((s, i) => s + i.total, 0);

  const pendingExpenses = expenses.filter(e => e.status === 'pending');
  const overdueInvoices = invoices.filter(i => {
    const days = Utils.daysUntil(i.due_date);
    return (i.status === 'sent' || i.status === 'partial') && days !== null && days < 0;
  });
  const dueSoonInvoices = invoices.filter(i => {
    const days = Utils.daysUntil(i.due_date);
    return (i.status === 'sent' || i.status === 'partial') && days !== null && days >= 0 && days <= 7;
  });

  // Burn rate (avg monthly outflow last 3m)
  const months3 = Utils.getLast12Months().slice(-3);
  let totalOut3 = 0;
  for (const mn of months3) {
    const r = Utils.monthRange(mn.key);
    totalOut3 += transactions.filter(t => t.type === 'cash_out' && Utils.isInRange(t.date, r.start, r.end)).reduce((s,t)=>s+t.amount,0);
  }
  const burnRate = Math.round(totalOut3 / 3);
  const runwayMonths = burnRate > 0 ? Math.round(totalBalance / burnRate) : 99;

  // Last 6 months chart data
  const months6 = Utils.getLast12Months().slice(-6);
  const chartIn  = months6.map(mn => { const r = Utils.monthRange(mn.key); return transactions.filter(t=>t.type==='cash_in'&&Utils.isInRange(t.date,r.start,r.end)).reduce((s,t)=>s+t.amount,0)/1e6; });
  const chartOut = months6.map(mn => { const r = Utils.monthRange(mn.key); return transactions.filter(t=>t.type==='cash_out'&&Utils.isInRange(t.date,r.start,r.end)).reduce((s,t)=>s+t.amount,0)/1e6; });

  // Project profitability (ongoing)
  const clients = await DB.getAll('clients');
  const projProfit = await Promise.all(projects.filter(p => p.status !== 'cancelled').map(async p => {
    const pInvoices = invoices.filter(i => i.project_id === p.id && i.status === 'paid');
    const collected = pInvoices.reduce((s,i)=>s+i.total,0);
    const cl = clients.find(c => c.id === p.client_id);
    return { name: p.name.slice(0,25), value: p.value/1e6, collected: collected/1e6, pct: Utils.pct(collected, p.value) };
  }));

  // Recent transactions
  const recentTx = [...transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  const categories = await DB.getAll('categories');
  const catMap = Object.fromEntries(categories.map(c=>[c.id,c]));
  const accMap = Object.fromEntries(accounts.map(a=>[a.id,a]));

  el.innerHTML = `
    <!-- Stats -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon cyan"><i data-lucide="wallet"></i></div>
        <div class="stat-label">Total Saldo</div>
        <div class="stat-value">${Utils.formatRupiah(totalBalance, true)}</div>
        <div class="stat-sub">${accounts.filter(a=>a.active).length} rekening aktif</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><i data-lucide="trending-up"></i></div>
        <div class="stat-label">Cash In Bulan Ini</div>
        <div class="stat-value text-green">${Utils.formatRupiah(cashIn, true)}</div>
        <div class="stat-sub">${Utils.formatDate(monthRange.start)} – ${Utils.formatDate(monthRange.end)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red"><i data-lucide="trending-down"></i></div>
        <div class="stat-label">Cash Out Bulan Ini</div>
        <div class="stat-value text-red">${Utils.formatRupiah(cashOut, true)}</div>
        <div class="stat-sub">Pengeluaran bulan berjalan</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${netFlow >= 0 ? 'green' : 'red'}"><i data-lucide="activity"></i></div>
        <div class="stat-label">Net Cash Flow</div>
        <div class="stat-value ${netFlow >= 0 ? 'text-green' : 'text-red'}">${Utils.formatRupiah(netFlow, true)}</div>
        <div class="stat-sub">${netFlow >= 0 ? '✅ Positif' : '⚠️ Negatif'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><i data-lucide="file-text"></i></div>
        <div class="stat-label">A/R Outstanding</div>
        <div class="stat-value">${Utils.formatRupiah(arTotal, true)}</div>
        <div class="stat-sub">${pendingInvoices.length} invoice belum lunas</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><i data-lucide="clock"></i></div>
        <div class="stat-label">Approval Pending</div>
        <div class="stat-value">${pendingExpenses.length}</div>
        <div class="stat-sub">Pengeluaran menunggu approval</div>
      </div>
    </div>

    <!-- Row 2: Chart + Burn Rate -->
    <div class="grid-2 mb-6">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Arus Kas 6 Bulan Terakhir</span>
          <span style="font-size:12px;color:var(--text-muted)">dalam juta Rupiah</span>
        </div>
        <div class="card-body">
          <div class="chart-container" style="height:220px;">
            <canvas id="chart-cashflow"></canvas>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Burn Rate & Runway</span></div>
        <div class="card-body">
          <div style="margin-bottom:20px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Burn Rate (Rata-rata bulanan)</div>
            <div style="font-size:26px;font-weight:800;color:var(--red);">${Utils.formatRupiah(burnRate, true)}<span style="font-size:13px;color:var(--text-muted);font-weight:400;">/bulan</span></div>
          </div>
          <div style="margin-bottom:20px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Runway (Estimasi bertahan)</div>
            <div style="font-size:26px;font-weight:800;color:${runwayMonths >= 6 ? 'var(--green)' : runwayMonths >= 3 ? 'var(--orange)' : 'var(--red)'};">${runwayMonths} <span style="font-size:13px;color:var(--text-muted);font-weight:400;">bulan</span></div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Status Runway</div>
            <div class="progress-bar" style="height:10px;">
              <div class="progress-fill ${runwayMonths >= 12 ? 'green' : runwayMonths >= 6 ? '' : runwayMonths >= 3 ? 'orange' : 'red'}" style="width:${Math.min(100, runwayMonths/24*100)}%;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--text-muted);">
              <span>0</span><span>3 bln</span><span>6 bln</span><span>12 bln</span><span>24 bln</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 3: Project Profitability + Alerts -->
    <div class="grid-2 mb-6">
      <div class="card">
        <div class="card-header"><span class="card-title">Profitabilitas Proyek</span></div>
        <div class="card-body">
          ${projProfit.map(p => `
            <div style="margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:13px;color:var(--text-secondary);">${p.name}</span>
                <span style="font-size:12px;font-weight:600;color:${p.pct>=75?'var(--green)':p.pct>=40?'var(--blue)':'var(--orange)'};">${p.pct}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${p.pct>=75?'green':p.pct>=40?'':'orange'}" style="width:${p.pct}%;"></div>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Terkumpul: ${Utils.formatRupiah(p.collected*1e6,true)} / ${Utils.formatRupiah(p.value*1e6,true)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">⚠️ Alert Invoice</span></div>
        <div class="card-body" style="max-height:300px;overflow-y:auto;">
          ${overdueInvoices.length === 0 && dueSoonInvoices.length === 0 ? '<div class="empty-state"><div class="empty-title">Semua invoice on track ✅</div></div>' : ''}
          ${overdueInvoices.map(i => `
            <div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13px;font-weight:600;color:var(--red);">${i.number}</span>
                <span class="badge badge-red">Jatuh Tempo</span>
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${Utils.formatRupiah(i.total)} — ${Utils.formatDate(i.due_date)}</div>
            </div>
          `).join('')}
          ${dueSoonInvoices.map(i => {
            const days = Utils.daysUntil(i.due_date);
            return `
              <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:13px;font-weight:600;color:var(--orange);">${i.number}</span>
                  <span class="badge badge-orange">${days}h lagi</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${Utils.formatRupiah(i.total)} — ${Utils.formatDate(i.due_date)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Recent Transactions -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Transaksi Terkini</span>
        <button class="btn btn-ghost btn-sm" onclick="Router.go('transactions')"><i data-lucide="arrow-right"></i> Lihat Semua</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Tanggal</th><th>Keterangan</th><th>Rekening</th><th>Tipe</th><th style="text-align:right">Jumlah</th>
          </tr></thead>
          <tbody>
            ${recentTx.map(t => `
              <tr>
                <td>${Utils.formatDate(t.date)}</td>
                <td class="text-primary">${t.description}</td>
                <td>${accMap[t.account_id]?.name || '-'}</td>
                <td>${t.type === 'cash_in' ? '<span class="badge badge-green">Masuk</span>' : '<span class="badge badge-red">Keluar</span>'}</td>
                <td class="${t.type === 'cash_in' ? 'amount-in' : 'amount-out'}" style="text-align:right;font-weight:700;">${t.type==='cash_in'?'+':'-'}${Utils.formatRupiah(t.amount,true)}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" class="text-center text-muted" style="padding:40px;">Belum ada transaksi</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Render cashflow chart
  setTimeout(() => {
    const ctx = document.getElementById('chart-cashflow');
    if (ctx && window.Chart) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: months6.map(m => m.label),
          datasets: [
            { label: 'Cash In', data: chartIn, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 6, borderSkipped: false },
            { label: 'Cash Out', data: chartOut, backgroundColor: 'rgba(244,63,94,0.7)', borderRadius: 6, borderSkipped: false },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#8ca5c8', font: { family: 'Inter', size: 12 } } },
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: Rp ${ctx.parsed.y.toFixed(1)}jt` } }
          },
          scales: {
            x: { ticks: { color: '#4a6080', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(79,142,247,0.05)' } },
            y: { ticks: { color: '#4a6080', font: { family: 'Inter', size: 11 }, callback: v => `${v}jt` }, grid: { color: 'rgba(79,142,247,0.07)' } }
          }
        }
      });
    }
  }, 100);
}

// ════════════════════════════════════════════════════
// ── ACCOUNTS ─────────────────────────────────────────
// ════════════════════════════════════════════════════
async function renderAccounts(el) {
  const accounts = await DB.getAll('accounts');
  const totalBalance = accounts.filter(a=>a.active).reduce((s,a)=>s+a.balance,0);

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Rekening Bank</h1>
        <p>Kelola rekening kas dan bank perusahaan</p>
      </div>
      <button class="btn btn-primary" onclick="openAccountModal()"><i data-lucide="plus"></i> Tambah Rekening</button>
    </div>

    <!-- Summary -->
    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-icon cyan"><i data-lucide="piggy-bank"></i></div>
        <div class="stat-label">Total Saldo Tersedia</div>
        <div class="stat-value">${Utils.formatRupiah(totalBalance,true)}</div>
      </div>
      ${accounts.filter(a=>a.active).map(a=>`
        <div class="stat-card" style="cursor:pointer;" onclick="Router.go('transactions')">
          <div class="stat-icon" style="background:${a.color}22;color:${a.color};"><i data-lucide="landmark"></i></div>
          <div class="stat-label">${a.name}</div>
          <div class="stat-value sm">${Utils.formatRupiah(a.balance,true)}</div>
          <div class="stat-sub">${a.bank}</div>
        </div>
      `).join('')}
    </div>

    <!-- Table -->
    <div class="card">
      <div class="card-header"><span class="card-title">Daftar Rekening</span></div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Nama Rekening</th><th>Bank</th><th>No. Rekening</th><th>Tipe</th><th style="text-align:right">Saldo</th><th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            ${accounts.map(a=>`
              <tr>
                <td><strong style="color:${a.color}">${a.name}</strong></td>
                <td>${a.bank}</td>
                <td style="font-family:monospace;font-size:12px;">${a.account_number}</td>
                <td><span class="badge badge-gray">${a.type==='cash'?'Kas':'Bank'}</span></td>
                <td style="text-align:right;font-weight:700;color:var(--text-primary);">${Utils.formatRupiah(a.balance)}</td>
                <td>${a.active ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-gray">Nonaktif</span>'}</td>
                <td>
                  <div style="display:flex;gap:6px;">
                    <button class="btn-icon" onclick="openAccountModal('${a.id}')" title="Edit"><i data-lucide="pencil"></i></button>
                    <button class="btn-icon danger" onclick="deleteAccount('${a.id}')" title="Hapus"><i data-lucide="trash-2"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Account Modal -->
    <div class="modal-overlay" id="account-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="account-modal-title">Tambah Rekening</span>
          <button class="modal-close" onclick="Utils.closeModal('account-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="account-form">
            <input type="hidden" name="id" />
            <div class="form-group"><label class="form-label">Nama Rekening</label><input name="name" class="form-control" placeholder="BCA Operasional" required /></div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Bank</label><input name="bank" class="form-control" placeholder="BCA" required /></div>
              <div class="form-group"><label class="form-label">Tipe</label>
                <select name="type" class="form-select">
                  <option value="bank">Bank</option>
                  <option value="cash">Kas</option>
                </select>
              </div>
            </div>
            <div class="form-group"><label class="form-label">No. Rekening</label><input name="account_number" class="form-control" placeholder="1234-5678-9012" /></div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Saldo Awal (Rp)</label><input name="balance" type="number" class="form-control" placeholder="0" required /></div>
              <div class="form-group"><label class="form-label">Warna</label><input name="color" type="color" class="form-control" value="#4f8ef7" style="height:42px;padding:4px 8px;" /></div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('account-modal')">Batal</button>
          <button class="btn btn-primary" onclick="saveAccount()"><i data-lucide="save"></i> Simpan</button>
        </div>
      </div>
    </div>
  `;

  window.openAccountModal = async (id = null) => {
    document.getElementById('account-modal-title').textContent = id ? 'Edit Rekening' : 'Tambah Rekening';
    const form = document.getElementById('account-form');
    form.reset();
    if (id) {
      const acc = await DB.get('accounts', id);
      Utils.fillForm(form, { ...acc, balance: acc.balance });
    }
    Utils.showModal('account-modal');
  };

  window.saveAccount = async () => {
    const form = document.getElementById('account-form');
    const data = Utils.getFormData(form);
    data.balance = Number(data.balance);
    data.active = true;
    if (!data.id) { data.id = genId(); await DB.put('accounts', data); Utils.toast('Rekening ditambahkan', 'success'); }
    else { const old = await DB.get('accounts', data.id); await DB.put('accounts', { ...old, ...data }); Utils.toast('Rekening diperbarui', 'success'); }
    Utils.closeModal('account-modal');
    renderPage('accounts');
  };

  window.deleteAccount = async (id) => {
    if (await Utils.confirm('Hapus rekening ini? Semua data transaksi terkait akan tetap ada.')) {
      await DB.delete('accounts', id);
      Utils.toast('Rekening dihapus', 'success');
      renderPage('accounts');
    }
  };
}

// ════════════════════════════════════════════════════
// ── TRANSACTIONS ──────────────────────────────────────
// ════════════════════════════════════════════════════
async function renderTransactions(el) {
  const [transactions, accounts, categories] = await Promise.all([
    DB.getAll('transactions'), DB.getAll('accounts'), DB.getAll('categories'),
  ]);

  const accMap = Object.fromEntries(accounts.map(a=>[a.id,a]));
  const catMap = Object.fromEntries(categories.map(c=>[c.id,c]));
  const sorted = [...transactions].sort((a,b) => b.date.localeCompare(a.date));

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Transaksi Kas</h1><p>Semua arus kas masuk dan keluar</p></div>
      <button class="btn btn-primary" onclick="openTxModal()"><i data-lucide="plus"></i> Tambah Transaksi</button>
    </div>

    <div class="filters-bar">
      <div class="search-box"><span class="search-icon"><i data-lucide="search"></i></span><input type="text" placeholder="Cari transaksi..." id="tx-search" oninput="filterTx()" /></div>
      <select class="filter-select" id="tx-type" onchange="filterTx()">
        <option value="">Semua Tipe</option>
        <option value="cash_in">Cash In</option>
        <option value="cash_out">Cash Out</option>
      </select>
      <select class="filter-select" id="tx-account" onchange="filterTx()">
        <option value="">Semua Rekening</option>
        ${accounts.map(a=>`<option value="${a.id}">${a.name}</option>`).join('')}
      </select>
      <input type="month" class="filter-select" id="tx-month" value="" onchange="filterTx()" title="Filter bulan — kosongkan untuk menampilkan semua" />
      <button class="btn btn-ghost btn-sm" onclick="resetTxFilter()"><i data-lucide="rotate-ccw"></i> Reset Filter</button>
      <button class="btn btn-ghost btn-sm" onclick="exportTx()"><i data-lucide="download"></i> Export CSV</button>
    </div>

    <div class="card">
      <div style="padding:12px 16px;font-size:12px;color:var(--text-muted);" id="tx-count"></div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Tanggal</th><th>Keterangan</th><th>Rekening</th><th>Kategori</th><th>Tipe</th><th style="text-align:right">Jumlah</th><th>Aksi</th>
          </tr></thead>
          <tbody id="tx-tbody">
            ${renderTxRows(sorted, accMap, catMap)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add / Edit Tx Modal -->
    <div class="modal-overlay" id="tx-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="tx-modal-title">Tambah Transaksi</span>
          <button class="modal-close" onclick="Utils.closeModal('tx-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="tx-form">
            <input type="hidden" name="id" id="tx-id" />
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Tipe</label>
                <select name="type" class="form-select">
                  <option value="cash_in">Cash In (Masuk)</option>
                  <option value="cash_out">Cash Out (Keluar)</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">Tanggal</label><input name="date" type="date" class="form-control" required /></div>
            </div>
            <div class="form-group"><label class="form-label">Rekening</label>
              <select name="account_id" class="form-select" required>
                <option value="">-- Pilih Rekening --</option>
                ${accounts.map(a=>`<option value="${a.id}">${a.name} (${a.bank})</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">Kategori</label>
              <select name="category_id" class="form-select">
                <option value="">-- Pilih Kategori --</option>
                ${categories.map(c=>`<option value="${c.id}">${c.name} (${c.flow_type === 'inflow' ? '↑' : '↓'})</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">Jumlah (Rp)</label><input name="amount" type="number" class="form-control" placeholder="0" required /></div>
            <div class="form-group"><label class="form-label">Keterangan</label><input name="description" class="form-control" placeholder="Deskripsi transaksi..." required /></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('tx-modal')">Batal</button>
          <button class="btn btn-primary" onclick="saveTx()"><i data-lucide="save"></i> Simpan</button>
        </div>
      </div>
    </div>
  `;

  let _allTx = sorted;

  window.renderTxRows = renderTxRows;
  function renderTxRows(rows, aMap, cMap) {
    if (!rows.length) return `<tr><td colspan="7"><div class="table-empty"><i data-lucide="inbox"></i><p>Tidak ada transaksi</p></div></td></tr>`;
    return rows.map(t => `
      <tr>
        <td>${Utils.formatDate(t.date)}</td>
        <td class="text-primary">${t.description}</td>
        <td>${aMap[t.account_id]?.name || '-'}</td>
        <td><span style="font-size:12px;color:var(--text-muted);">${cMap[t.category_id]?.name || '-'}</span></td>
        <td>${t.type === 'cash_in' ? '<span class="badge badge-green">Masuk</span>' : '<span class="badge badge-red">Keluar</span>'}</td>
        <td class="${t.type==='cash_in'?'amount-in':'amount-out'}" style="text-align:right;">${t.type==='cash_in'?'+':'-'}${Utils.formatRupiah(t.amount)}</td>
        <td style="white-space:nowrap;">
          <button class="btn-icon" onclick="editTx('${t.id}')" title="Edit Transaksi" style="margin-right:4px;"><i data-lucide="pencil"></i></button>
          <button class="btn-icon danger" onclick="deleteTx('${t.id}')" title="Hapus Transaksi"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>
    `).join('');
  }

  window.filterTx = () => {
    const q = document.getElementById('tx-search').value.toLowerCase();
    const type = document.getElementById('tx-type').value;
    const acc = document.getElementById('tx-account').value;
    const month = document.getElementById('tx-month').value;
    let filtered = _allTx;
    if (q) filtered = filtered.filter(t => t.description.toLowerCase().includes(q));
    if (type) filtered = filtered.filter(t => t.type === type);
    if (acc) filtered = filtered.filter(t => t.account_id === acc);
    if (month) { const r = Utils.monthRange(month); filtered = filtered.filter(t => Utils.isInRange(t.date, r.start, r.end)); }
    document.getElementById('tx-tbody').innerHTML = renderTxRows(filtered, accMap, catMap);
    const info = document.getElementById('tx-count');
    if (info) info.textContent = `Menampilkan ${filtered.length} dari ${_allTx.length} transaksi`;
    if (window.lucide) lucide.createIcons();
  };

  window.resetTxFilter = () => {
    document.getElementById('tx-search').value = '';
    document.getElementById('tx-type').value = '';
    document.getElementById('tx-account').value = '';
    document.getElementById('tx-month').value = '';
    window.filterTx();
  };

  window.openTxModal = () => {
    const form = document.getElementById('tx-form');
    form.reset();
    document.getElementById('tx-id').value = '';
    document.getElementById('tx-modal-title').textContent = 'Tambah Transaksi';
    document.querySelector('#tx-form [name="date"]').value = Utils.formatDateInput(new Date().toISOString());
    Utils.showModal('tx-modal');
    if (window.lucide) lucide.createIcons();
  };

  window.editTx = async (id) => {
    const tx = await DB.get('transactions', id);
    if (!tx) {
      Utils.toast('Transaksi tidak ditemukan', 'error');
      return;
    }
    const form = document.getElementById('tx-form');
    form.reset();
    document.getElementById('tx-id').value = tx.id;
    document.getElementById('tx-modal-title').textContent = 'Edit Transaksi';
    form.elements['type'].value = tx.type;
    form.elements['date'].value = Utils.formatDateInput(tx.date);
    form.elements['account_id'].value = tx.account_id;
    form.elements['category_id'].value = tx.category_id || '';
    form.elements['amount'].value = tx.amount;
    form.elements['description'].value = tx.description;
    Utils.showModal('tx-modal');
    if (window.lucide) lucide.createIcons();
  };

  window.saveTx = async () => {
    const form = document.getElementById('tx-form');
    const data = Utils.getFormData(form);
    if (!data.date || !data.amount || !data.description || !data.account_id) {
      Utils.toast('Lengkapi semua field', 'error');
      return;
    }
    const isEdit = Boolean(data.id);
    data.amount = Number(data.amount);

    if (isEdit) {
      const oldTx = await DB.get('transactions', data.id);
      if (!oldTx) {
        Utils.toast('Transaksi tidak ditemukan', 'error');
        return;
      }
      // Revert old transaction balance impact
      const oldAcc = await DB.get('accounts', oldTx.account_id);
      if (oldAcc) {
        oldAcc.balance = oldTx.type === 'cash_in' ? oldAcc.balance - oldTx.amount : oldAcc.balance + oldTx.amount;
        await DB.put('accounts', oldAcc);
      }
      // Apply new transaction balance impact
      const newAcc = await DB.get('accounts', data.account_id);
      if (newAcc) {
        newAcc.balance = data.type === 'cash_in' ? newAcc.balance + data.amount : newAcc.balance - data.amount;
        await DB.put('accounts', newAcc);
      }
      // Preserve original metadata & add updated timestamp
      const updatedTx = {
        ...oldTx,
        ...data,
        updated_at: new Date().toISOString()
      };
      await DB.put('transactions', updatedTx);
      Utils.closeModal('tx-modal');
      Utils.toast('Transaksi berhasil diperbarui', 'success');
      renderPage('transactions');
    } else {
      data.id = genId();
      data.created_by = Auth.user.id;
      data.created_at = new Date().toISOString();
      data.ref_type = 'manual';
      data.ref_id = null;
      await DB.put('transactions', data);
      // Update account balance
      const acc = await DB.get('accounts', data.account_id);
      if (acc) {
        acc.balance = data.type === 'cash_in' ? acc.balance + data.amount : acc.balance - data.amount;
        await DB.put('accounts', acc);
      }
      Utils.closeModal('tx-modal');
      Utils.toast('Transaksi ditambahkan', 'success');
      renderPage('transactions');
    }
  };

  window.deleteTx = async (id) => {
    if (await Utils.confirm('Hapus transaksi ini?')) {
      const tx = await DB.get('transactions', id);
      if (tx) {
        const acc = await DB.get('accounts', tx.account_id);
        if (acc) {
          acc.balance = tx.type === 'cash_in' ? acc.balance - tx.amount : acc.balance + tx.amount;
          await DB.put('accounts', acc);
        }
        await DB.delete('transactions', id);
      }
      Utils.toast('Transaksi dihapus', 'success');
      renderPage('transactions');
    }
  };

  window.exportTx = () => {
    Utils.exportCSV('transaksi.csv', sorted, [
      { label: 'Tanggal', key: 'date' },
      { label: 'Keterangan', key: 'description' },
      { label: 'Tipe', fn: t => t.type === 'cash_in' ? 'Masuk' : 'Keluar' },
      { label: 'Rekening', fn: t => accMap[t.account_id]?.name || '-' },
      { label: 'Kategori', fn: t => catMap[t.category_id]?.name || '-' },
      { label: 'Jumlah', key: 'amount' },
    ]);
  };

  // Initial filter by current month
  window.filterTx();
}

// ════════════════════════════════════════════════════
// ── CASH FLOW REPORT ──────────────────────────────────
// ════════════════════════════════════════════════════
async function renderCashflow(el) {
  const [transactions, categories, accounts] = await Promise.all([
    DB.getAll('transactions'), DB.getAll('categories'), DB.getAll('accounts'),
  ]);

  const currentM = Utils.currentMonth();

  function buildReport(month) {
    const range = Utils.monthRange(month);
    const txs = transactions.filter(t => Utils.isInRange(t.date, range.start, range.end));
    const catMap = Object.fromEntries(categories.map(c=>[c.id,c]));

    const sections = {
      operating: { label: 'Aktivitas Operasional', in: [], out: [] },
      investing:  { label: 'Aktivitas Investasi',   in: [], out: [] },
      financing:  { label: 'Aktivitas Pendanaan',    in: [], out: [] },
    };

    for (const t of txs) {
      const cat = catMap[t.category_id];
      const sec = cat?.section || 'operating';
      const grp = sections[sec];
      if (!grp) continue;
      const arr = cat?.flow_type === 'inflow' ? grp.in : grp.out;
      const existing = arr.find(x => x.cat_id === t.category_id);
      if (existing) existing.amount += t.amount;
      else arr.push({ cat_id: t.category_id, name: cat?.name || 'Lainnya', amount: t.amount });
    }

    let totalNetFlow = 0;
    Object.values(sections).forEach(s => {
      s.totalIn  = s.in.reduce((a,i)=>a+i.amount,0);
      s.totalOut = s.out.reduce((a,i)=>a+i.amount,0);
      s.net = s.totalIn - s.totalOut;
      totalNetFlow += s.net;
    });

    return { sections, totalNetFlow, range };
  }

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Laporan Arus Kas</h1><p>Direct Method — Operasional, Investasi, Pendanaan</p></div>
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="month" class="filter-select" id="cf-month" value="${currentM}" onchange="renderCfReport()" />
        <button class="btn btn-ghost btn-sm" onclick="exportCf()"><i data-lucide="download"></i> Export CSV</button>
      </div>
    </div>
    <div id="cf-report"></div>
  `;

  window.renderCfReport = () => {
    const month = document.getElementById('cf-month').value || currentM;
    const { sections, totalNetFlow, range } = buildReport(month);
    const openBal = accounts.filter(a=>a.active).reduce((s,a)=>s+a.balance,0) - totalNetFlow;

    let html = `
      <div class="stat-grid" style="margin-bottom:24px;">
        <div class="stat-card">
          <div class="stat-icon ${totalNetFlow>=0?'green':'red'}"><i data-lucide="activity"></i></div>
          <div class="stat-label">Net Cash Flow</div>
          <div class="stat-value ${totalNetFlow>=0?'text-green':'text-red'}">${Utils.formatRupiah(totalNetFlow,true)}</div>
          <div class="stat-sub">${Utils.formatDate(range.start)} – ${Utils.formatDate(range.end)}</div>
        </div>
        ${Object.values(sections).map(s=>`
          <div class="stat-card">
            <div class="stat-icon ${s.net>=0?'blue':'orange'}"><i data-lucide="layers"></i></div>
            <div class="stat-label">${s.label}</div>
            <div class="stat-value sm ${s.net>=0?'text-green':'text-red'}">${Utils.formatRupiah(s.net,true)}</div>
          </div>
        `).join('')}
      </div>
    `;

    for (const [key, sec] of Object.entries(sections)) {
      html += `
        <div class="card mb-4">
          <div class="card-header">
            <span class="card-title">${sec.label}</span>
            <span class="badge ${sec.net>=0?'badge-green':'badge-red'}">${Utils.formatRupiah(sec.net,true)}</span>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Uraian</th><th style="text-align:right">Cash In</th><th style="text-align:right">Cash Out</th><th style="text-align:right">Net</th></tr></thead>
              <tbody>
                ${sec.in.map(i=>`<tr><td>${i.name}</td><td class="amount-in" style="text-align:right">+${Utils.formatRupiah(i.amount)}</td><td>-</td><td class="amount-in" style="text-align:right">+${Utils.formatRupiah(i.amount)}</td></tr>`).join('')}
                ${sec.out.map(i=>`<tr><td>${i.name}</td><td>-</td><td class="amount-out" style="text-align:right">-${Utils.formatRupiah(i.amount)}</td><td class="amount-out" style="text-align:right">-${Utils.formatRupiah(i.amount)}</td></tr>`).join('')}
                ${sec.in.length===0&&sec.out.length===0?`<tr><td colspan="4" class="text-center text-muted" style="padding:24px;">Tidak ada transaksi</td></tr>`:''}
              </tbody>
              <tfoot>
                <tr style="border-top:2px solid var(--border);">
                  <td style="font-weight:700;color:var(--text-primary);">Subtotal</td>
                  <td class="amount-in" style="text-align:right;font-weight:700;">+${Utils.formatRupiah(sec.totalIn)}</td>
                  <td class="amount-out" style="text-align:right;font-weight:700;">-${Utils.formatRupiah(sec.totalOut)}</td>
                  <td style="text-align:right;font-weight:700;color:${sec.net>=0?'var(--green)':'var(--red)'};">${sec.net>=0?'+':''}${Utils.formatRupiah(sec.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }

    html += `
      <div class="card">
        <div class="card-body" style="background:rgba(79,142,247,0.05);border-radius:var(--radius-md);">
          <table style="width:100%;">
            <tbody>
              <tr><td style="font-weight:600;">Saldo Awal Periode</td><td style="text-align:right;">${Utils.formatRupiah(openBal)}</td></tr>
              <tr><td style="font-weight:600;">Net Cash Flow</td><td style="text-align:right;color:${totalNetFlow>=0?'var(--green)':'var(--red)'};">${totalNetFlow>=0?'+':''}${Utils.formatRupiah(totalNetFlow)}</td></tr>
              <tr style="border-top:2px solid var(--border);"><td style="font-weight:800;color:var(--text-primary);">Saldo Akhir Periode</td><td style="text-align:right;font-weight:800;font-size:16px;color:var(--blue);">${Utils.formatRupiah(openBal+totalNetFlow)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const rpt = document.getElementById('cf-report');
    rpt.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  };

  window.exportCf = () => {
    const month = document.getElementById('cf-month').value || currentM;
    const { sections } = buildReport(month);
    const rows = [];
    for (const [key, sec] of Object.entries(sections)) {
      rows.push({ section: sec.label, name: '', amount_in: '', amount_out: '', net: '' });
      sec.in.forEach(i => rows.push({ section: '', name: i.name, amount_in: i.amount, amount_out: 0, net: i.amount }));
      sec.out.forEach(i => rows.push({ section: '', name: i.name, amount_in: 0, amount_out: i.amount, net: -i.amount }));
      rows.push({ section: 'Subtotal', name: '', amount_in: sec.totalIn, amount_out: sec.totalOut, net: sec.net });
    }
    Utils.exportCSV(`arus-kas-${month}.csv`, rows, [
      { label: 'Seksi', key: 'section' },
      { label: 'Uraian', key: 'name' },
      { label: 'Cash In', key: 'amount_in' },
      { label: 'Cash Out', key: 'amount_out' },
      { label: 'Net', key: 'net' },
    ]);
  };

  window.renderCfReport();
}

// ════════════════════════════════════════════════════
// ── PROJECTS ─────────────────────────────────────────
// ════════════════════════════════════════════════════
async function renderProjects(el) {
  const [projects, clients, milestones, invoices] = await Promise.all([
    DB.getAll('projects'), DB.getAll('clients'), DB.getAll('milestones'), DB.getAll('invoices'),
  ]);

  const clientMap = Object.fromEntries(clients.map(c=>[c.id,c]));

  function projectCard(p) {
    const cl = clientMap[p.client_id];
    const ms = milestones.filter(m => m.project_id === p.id);
    const inv = invoices.filter(i => i.project_id === p.id && i.status === 'paid');
    const collected = inv.reduce((s,i)=>s+i.total,0);
    const pct = Utils.pct(collected, p.value);

    return `
      <div class="card" style="cursor:pointer;" onclick="openProjectDetail('${p.id}')">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">${p.name}</div>
              <div style="font-size:12px;color:var(--text-muted);">${cl?.name || '-'}</div>
            </div>
            ${Utils.statusBadge(p.status)}
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">${p.description}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:12px;color:var(--text-secondary);">Nilai Proyek</span>
            <span style="font-size:13px;font-weight:700;">${Utils.formatRupiah(p.value,true)}</span>
          </div>
          <div class="progress-bar" style="margin-bottom:6px;">
            <div class="progress-fill ${pct>=75?'green':pct>=40?'':'orange'}" style="width:${pct}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:11px;color:var(--text-muted);">Terkumpul ${pct}%</span>
            <span style="font-size:11px;color:var(--text-muted);">${ms.length} milestone</span>
          </div>
          <hr class="divider" style="margin:12px 0;" />
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);">
            <span><i data-lucide="calendar" style="width:12px;height:12px;display:inline;"></i> ${Utils.formatDate(p.start_date)}</span>
            <span>→ ${Utils.formatDate(p.end_date)}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" onclick="openProjectModal('${p.id}')"><i data-lucide="pencil"></i> Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="openMilestoneModal('${p.id}')"><i data-lucide="plus"></i> Milestone</button>
          </div>
        </div>
      </div>
    `;
  }

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Manajemen Proyek</h1><p>Kelola proyek, milestone, dan pendapatan</p></div>
      <button class="btn btn-primary" onclick="openProjectModal()"><i data-lucide="plus"></i> Tambah Proyek</button>
    </div>

    <div class="stat-grid" style="margin-bottom:24px;">
      <div class="stat-card"><div class="stat-icon blue"><i data-lucide="folder-kanban"></i></div><div class="stat-label">Total Proyek</div><div class="stat-value">${projects.length}</div></div>
      <div class="stat-card"><div class="stat-icon green"><i data-lucide="activity"></i></div><div class="stat-label">Berjalan</div><div class="stat-value">${projects.filter(p=>p.status==='ongoing').length}</div></div>
      <div class="stat-card"><div class="stat-icon cyan"><i data-lucide="check-circle"></i></div><div class="stat-label">Selesai</div><div class="stat-value">${projects.filter(p=>p.status==='completed').length}</div></div>
      <div class="stat-card"><div class="stat-icon purple"><i data-lucide="dollar-sign"></i></div><div class="stat-label">Total Nilai</div><div class="stat-value">${Utils.formatRupiah(projects.reduce((s,p)=>s+p.value,0),true)}</div></div>
    </div>

    <div class="filters-bar">
      <div class="search-box"><span class="search-icon"><i data-lucide="search"></i></span><input type="text" placeholder="Cari proyek..." id="proj-search" oninput="filterProjects()" /></div>
      <select class="filter-select" id="proj-status" onchange="filterProjects()">
        <option value="">Semua Status</option>
        <option value="ongoing">Berjalan</option>
        <option value="completed">Selesai</option>
        <option value="cancelled">Batal</option>
      </select>
    </div>

    <div class="grid-auto" id="projects-grid">
      ${projects.map(p => projectCard(p)).join('') || '<div class="empty-state"><div class="empty-title">Belum ada proyek</div></div>'}
    </div>

    <!-- Project Modal -->
    <div class="modal-overlay" id="project-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="project-modal-title">Tambah Proyek</span>
          <button class="modal-close" onclick="Utils.closeModal('project-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="project-form">
            <input type="hidden" name="id" />
            <div class="form-group"><label class="form-label">Nama Proyek</label><input name="name" class="form-control" placeholder="Nama proyek..." required /></div>
            <div class="form-group"><label class="form-label">Klien</label>
              <select name="client_id" class="form-select" required>
                <option value="">-- Pilih Klien --</option>
                ${clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Nilai Kontrak (Rp)</label><input name="value" type="number" class="form-control" placeholder="0" required /></div>
              <div class="form-group"><label class="form-label">Status</label>
                <select name="status" class="form-select">
                  <option value="ongoing">Berjalan</option>
                  <option value="completed">Selesai</option>
                  <option value="cancelled">Batal</option>
                </select>
              </div>
            </div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Tanggal Mulai</label><input name="start_date" type="date" class="form-control" required /></div>
              <div class="form-group"><label class="form-label">Tanggal Selesai</label><input name="end_date" type="date" class="form-control" required /></div>
            </div>
            <div class="form-group"><label class="form-label">Deskripsi</label><textarea name="description" class="form-textarea" placeholder="Deskripsi singkat proyek..."></textarea></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('project-modal')">Batal</button>
          <button class="btn btn-primary" onclick="saveProject()"><i data-lucide="save"></i> Simpan</button>
        </div>
      </div>
    </div>

    <!-- Milestone Modal -->
    <div class="modal-overlay" id="milestone-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Tambah Milestone</span>
          <button class="modal-close" onclick="Utils.closeModal('milestone-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="milestone-form">
            <input type="hidden" name="project_id" id="ms-project-id" />
            <div class="form-group"><label class="form-label">Nama Milestone</label><input name="name" class="form-control" placeholder="DP 30%, Fase 1, dll..." required /></div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Persentase (%)</label><input name="percentage" type="number" min="1" max="100" class="form-control" placeholder="30" required /></div>
              <div class="form-group"><label class="form-label">Jumlah (Rp)</label><input name="amount" type="number" class="form-control" placeholder="0" required /></div>
            </div>
            <div class="form-group"><label class="form-label">Tanggal Jatuh Tempo</label><input name="due_date" type="date" class="form-control" required /></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('milestone-modal')">Batal</button>
          <button class="btn btn-primary" onclick="saveMilestone()"><i data-lucide="save"></i> Simpan</button>
        </div>
      </div>
    </div>

    <!-- Project Detail Modal -->
    <div class="modal-overlay" id="project-detail-modal">
      <div class="modal modal-lg">
        <div class="modal-header">
          <span class="modal-title" id="project-detail-title">Detail Proyek</span>
          <button class="modal-close" onclick="Utils.closeModal('project-detail-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body" id="project-detail-body"></div>
      </div>
    </div>
  `;

  let _allProjects = projects;

  window.filterProjects = () => {
    const q = document.getElementById('proj-search').value.toLowerCase();
    const status = document.getElementById('proj-status').value;
    let filtered = _allProjects;
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || clientMap[p.client_id]?.name.toLowerCase().includes(q));
    if (status) filtered = filtered.filter(p => p.status === status);
    const grid = document.getElementById('projects-grid');
    grid.innerHTML = filtered.map(p => projectCard(p)).join('') || '<div class="empty-state"><div class="empty-title">Tidak ada proyek</div></div>';
    if (window.lucide) lucide.createIcons();
  };

  window.openProjectModal = async (id = null) => {
    document.getElementById('project-modal-title').textContent = id ? 'Edit Proyek' : 'Tambah Proyek';
    const form = document.getElementById('project-form');
    form.reset();
    if (id) { const p = await DB.get('projects', id); Utils.fillForm(form, p); }
    Utils.showModal('project-modal');
  };

  window.saveProject = async () => {
    const form = document.getElementById('project-form');
    const data = Utils.getFormData(form);
    data.value = Number(data.value);
    data.created_at = new Date().toISOString();
    if (!data.id) { data.id = genId(); await DB.put('projects', data); Utils.toast('Proyek ditambahkan', 'success'); }
    else { const old = await DB.get('projects', data.id); await DB.put('projects', { ...old, ...data }); Utils.toast('Proyek diperbarui', 'success'); }
    Utils.closeModal('project-modal');
    renderPage('projects');
  };

  window.openMilestoneModal = (projectId) => {
    document.getElementById('milestone-form').reset();
    document.getElementById('ms-project-id').value = projectId;
    Utils.showModal('milestone-modal');
  };

  window.saveMilestone = async () => {
    const form = document.getElementById('milestone-form');
    const data = Utils.getFormData(form);
    data.id = genId();
    data.amount = Number(data.amount);
    data.percentage = Number(data.percentage);
    data.status = 'pending';
    data.invoice_id = null;
    await DB.put('milestones', data);
    Utils.closeModal('milestone-modal');
    Utils.toast('Milestone ditambahkan', 'success');
    renderPage('projects');
  };

  window.openProjectDetail = async (projectId) => {
    const p = await DB.get('projects', projectId);
    const cl = clientMap[p.client_id];
    const ms = milestones.filter(m => m.project_id === p.id);
    const inv = invoices.filter(i => i.project_id === p.id);
    const collected = inv.filter(i=>i.status==='paid').reduce((s,i)=>s+i.total,0);
    document.getElementById('project-detail-title').textContent = p.name;
    document.getElementById('project-detail-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div><span style="color:var(--text-muted);font-size:12px;">Klien</span><div style="font-weight:600;margin-top:2px;">${cl?.name || '-'}</div></div>
        <div><span style="color:var(--text-muted);font-size:12px;">Status</span><div style="margin-top:2px;">${Utils.statusBadge(p.status)}</div></div>
        <div><span style="color:var(--text-muted);font-size:12px;">Nilai Kontrak</span><div style="font-weight:700;color:var(--blue);margin-top:2px;">${Utils.formatRupiah(p.value)}</div></div>
        <div><span style="color:var(--text-muted);font-size:12px;">Terkumpul</span><div style="font-weight:700;color:var(--green);margin-top:2px;">${Utils.formatRupiah(collected)}</div></div>
        <div><span style="color:var(--text-muted);font-size:12px;">Mulai</span><div style="margin-top:2px;">${Utils.formatDate(p.start_date)}</div></div>
        <div><span style="color:var(--text-muted);font-size:12px;">Selesai</span><div style="margin-top:2px;">${Utils.formatDate(p.end_date)}</div></div>
      </div>
      <h3 style="font-size:14px;font-weight:700;margin-bottom:12px;">Milestone & Termin</h3>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Milestone</th><th>%</th><th style="text-align:right">Nilai</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${ms.map(m => `
              <tr>
                <td class="text-primary">${m.name}</td>
                <td>${m.percentage}%</td>
                <td style="text-align:right;">${Utils.formatRupiah(m.amount)}</td>
                <td>${Utils.formatDate(m.due_date)}</td>
                <td>${Utils.statusBadge(m.status)}</td>
                <td>
                  ${m.status === 'pending' ? `<button class="btn btn-ghost btn-sm" onclick="createInvoiceFromMs('${m.id}','${p.id}')"><i data-lucide="file-plus"></i> Buat Invoice</button>` : `<span style="font-size:11px;color:var(--text-muted);">${m.invoice_id || '-'}</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    Utils.showModal('project-detail-modal');
    if (window.lucide) lucide.createIcons();
  };

  window.createInvoiceFromMs = async (msId, projectId) => {
    const ms = await DB.get('milestones', msId);
    const p  = await DB.get('projects', projectId);
    const allInv = await DB.getAll('invoices');
    const seq = allInv.length + 1;
    const now = new Date();
    const invId = genId();
    const inv = {
      id: invId,
      number: genInvoiceNumber(now.getFullYear(), now.getMonth()+1, seq),
      project_id: projectId,
      milestone_id: msId,
      client_id: p.client_id,
      amount: ms.amount, tax: 0, total: ms.amount,
      issue_date: now.toISOString().split('T')[0],
      due_date: ms.due_date,
      status: 'draft',
      notes: ms.name,
      created_at: now.toISOString(),
    };
    await DB.put('invoices', inv);
    ms.status = 'invoiced';
    ms.invoice_id = invId;
    await DB.put('milestones', ms);
    Utils.closeModal('project-detail-modal');
    Utils.toast(`Invoice ${inv.number} dibuat`, 'success');
    Router.go('invoices');
  };
}

// ════════════════════════════════════════════════════
// ── INVOICES ──────────────────────════════════════════
// ════════════════════════════════════════════════════
async function renderInvoices(el) {
  const [invoices, projects, clients, payments, accounts] = await Promise.all([
    DB.getAll('invoices'), DB.getAll('projects'), DB.getAll('clients'),
    DB.getAll('invoice_payments'), DB.getAll('accounts'),
  ]);

  const projMap   = Object.fromEntries(projects.map(p=>[p.id,p]));
  const clientMap = Object.fromEntries(clients.map(c=>[c.id,c]));
  const sorted    = [...invoices].sort((a,b) => b.issue_date.localeCompare(a.issue_date));

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Invoice</h1><p>Tagihan ke klien dan pembayaran termin</p></div>
      <button class="btn btn-primary" onclick="openInvoiceModal()"><i data-lucide="plus"></i> Buat Invoice</button>
    </div>

    <div class="stat-grid" style="margin-bottom:24px;">
      <div class="stat-card"><div class="stat-icon blue"><i data-lucide="file-text"></i></div><div class="stat-label">Total Invoice</div><div class="stat-value">${invoices.length}</div></div>
      <div class="stat-card"><div class="stat-icon green"><i data-lucide="check-circle"></i></div><div class="stat-label">Lunas</div><div class="stat-value">${invoices.filter(i=>i.status==='paid').length}</div></div>
      <div class="stat-card"><div class="stat-icon orange"><i data-lucide="clock"></i></div><div class="stat-label">Outstanding</div><div class="stat-value">${invoices.filter(i=>['sent','partial'].includes(i.status)).length}</div></div>
      <div class="stat-card"><div class="stat-icon cyan"><i data-lucide="dollar-sign"></i></div><div class="stat-label">Total Nilai</div><div class="stat-value">${Utils.formatRupiah(invoices.reduce((s,i)=>s+i.total,0),true)}</div></div>
    </div>

    <div class="filters-bar">
      <div class="search-box"><span class="search-icon"><i data-lucide="search"></i></span><input type="text" placeholder="Cari invoice..." id="inv-search" oninput="filterInvoices()" /></div>
      <select class="filter-select" id="inv-status" onchange="filterInvoices()">
        <option value="">Semua Status</option>
        <option value="draft">Draft</option>
        <option value="sent">Terkirim</option>
        <option value="partial">Sebagian</option>
        <option value="paid">Lunas</option>
      </select>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>No. Invoice</th><th>Proyek</th><th>Klien</th><th style="text-align:right">Total</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody id="inv-tbody">
            ${renderInvRows(sorted)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Invoice Modal -->
    <div class="modal-overlay" id="invoice-modal">
      <div class="modal modal-lg">
        <div class="modal-header">
          <span class="modal-title" id="invoice-modal-title">Buat Invoice</span>
          <button class="modal-close" onclick="Utils.closeModal('invoice-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="invoice-form">
            <input type="hidden" name="id" />
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Proyek</label>
                <select name="project_id" class="form-select" required onchange="onProjChange(this.value)">
                  <option value="">-- Pilih Proyek --</option>
                  ${projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label class="form-label">Klien</label>
                <select name="client_id" class="form-select" required>
                  <option value="">-- Pilih Klien --</option>
                  ${clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Tanggal Invoice</label><input name="issue_date" type="date" class="form-control" required /></div>
              <div class="form-group"><label class="form-label">Jatuh Tempo</label><input name="due_date" type="date" class="form-control" required /></div>
            </div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Jumlah (Rp)</label><input name="amount" type="number" class="form-control" placeholder="0" required /></div>
              <div class="form-group"><label class="form-label">Status</label>
                <select name="status" class="form-select">
                  <option value="draft">Draft</option>
                  <option value="sent">Terkirim</option>
                </select>
              </div>
            </div>
            <div class="form-group"><label class="form-label">Keterangan</label><input name="notes" class="form-control" placeholder="DP, Fase 1, dll..." /></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('invoice-modal')">Batal</button>
          <button class="btn btn-primary" onclick="saveInvoice()"><i data-lucide="save"></i> Simpan</button>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <div class="modal-overlay" id="payment-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Catat Pembayaran</span>
          <button class="modal-close" onclick="Utils.closeModal('payment-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <div id="payment-invoice-info" style="background:rgba(79,142,247,0.06);border-radius:var(--radius-md);padding:12px;margin-bottom:16px;font-size:13px;color:var(--text-secondary);"></div>
          <form id="payment-form">
            <input type="hidden" name="invoice_id" id="pay-invoice-id" />
            <div class="form-group"><label class="form-label">Tanggal Pembayaran</label><input name="date" type="date" class="form-control" required /></div>
            <div class="form-group"><label class="form-label">Jumlah Diterima (Rp)</label><input name="amount" type="number" class="form-control" required /></div>
            <div class="form-group"><label class="form-label">Rekening Tujuan</label>
              <select name="account_id" class="form-select" required>
                <option value="">-- Pilih Rekening --</option>
                ${accounts.map(a=>`<option value="${a.id}">${a.name} (${a.bank})</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">Keterangan</label><input name="notes" class="form-control" placeholder="Transfer, Tunai, dll..." /></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('payment-modal')">Batal</button>
          <button class="btn btn-success" onclick="savePayment()"><i data-lucide="check-circle"></i> Simpan Pembayaran</button>
        </div>
      </div>
    </div>
  `;

  let _allInv = sorted;

  function renderInvRows(rows) {
    if (!rows.length) return `<tr><td colspan="7"><div class="table-empty"><i data-lucide="file-x"></i><p>Tidak ada invoice</p></div></td></tr>`;
    return rows.map(i => {
      const days = Utils.daysUntil(i.due_date);
      const overdue = (i.status === 'sent' || i.status === 'partial') && days !== null && days < 0;
      return `
        <tr ${overdue ? 'style="background:rgba(244,63,94,0.04);"' : ''}>
          <td><strong>${i.number}</strong></td>
          <td>${projMap[i.project_id]?.name?.slice(0,30) || '-'}</td>
          <td>${clientMap[i.client_id]?.name || '-'}</td>
          <td style="text-align:right;font-weight:700;">${Utils.formatRupiah(i.total)}</td>
          <td style="${overdue?'color:var(--red);font-weight:600;':''}">${Utils.formatDate(i.due_date)}${overdue?' ⚠️':''}</td>
          <td>${Utils.statusBadge(i.status)}</td>
          <td>
            <div style="display:flex;gap:6px;">
              ${['sent','partial'].includes(i.status) ? `<button class="btn btn-ghost btn-sm" onclick="openPaymentModal('${i.id}')"><i data-lucide="credit-card"></i> Bayar</button>` : ''}
              <button class="btn-icon" onclick="printInvoice('${i.id}')"><i data-lucide="printer"></i></button>
              <button class="btn-icon danger" onclick="deleteInvoice('${i.id}')"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.filterInvoices = () => {
    const q = document.getElementById('inv-search').value.toLowerCase();
    const status = document.getElementById('inv-status').value;
    let filtered = _allInv;
    if (q) filtered = filtered.filter(i => i.number.toLowerCase().includes(q) || clientMap[i.client_id]?.name.toLowerCase().includes(q));
    if (status) filtered = filtered.filter(i => i.status === status);
    document.getElementById('inv-tbody').innerHTML = renderInvRows(filtered);
    if (window.lucide) lucide.createIcons();
  };

  window.onProjChange = (projectId) => {
    const p = projects.find(x => x.id === projectId);
    if (p) {
      const form = document.getElementById('invoice-form');
      form.querySelector('[name="client_id"]').value = p.client_id;
    }
  };

  window.openInvoiceModal = async (id = null) => {
    document.getElementById('invoice-modal-title').textContent = id ? 'Edit Invoice' : 'Buat Invoice';
    const form = document.getElementById('invoice-form');
    form.reset();
    const today = Utils.formatDateInput(new Date().toISOString());
    form.querySelector('[name="issue_date"]').value = today;
    if (id) { const inv = await DB.get('invoices', id); Utils.fillForm(form, inv); }
    Utils.showModal('invoice-modal');
  };

  window.saveInvoice = async () => {
    const form = document.getElementById('invoice-form');
    const data = Utils.getFormData(form);
    data.amount = Number(data.amount);
    data.tax = 0;
    data.total = data.amount;
    data.created_at = new Date().toISOString();
    if (!data.id) {
      data.id = genId();
      const now = new Date();
      const seq = invoices.length + 1;
      data.number = genInvoiceNumber(now.getFullYear(), now.getMonth()+1, seq);
      await DB.put('invoices', data);
      Utils.toast(`Invoice ${data.number} dibuat`, 'success');
    } else {
      const old = await DB.get('invoices', data.id);
      await DB.put('invoices', { ...old, ...data });
      Utils.toast('Invoice diperbarui', 'success');
    }
    Utils.closeModal('invoice-modal');
    renderPage('invoices');
  };

  window.openPaymentModal = async (invoiceId) => {
    const inv = await DB.get('invoices', invoiceId);
    const paid = payments.filter(p => p.invoice_id === invoiceId).reduce((s,p)=>s+p.amount,0);
    const remaining = inv.total - paid;
    document.getElementById('pay-invoice-id').value = invoiceId;
    document.getElementById('payment-invoice-info').innerHTML = `
      <strong>${inv.number}</strong> — ${Utils.formatRupiah(inv.total)}<br/>
      Sudah dibayar: ${Utils.formatRupiah(paid)} &nbsp;|&nbsp; Sisa: <strong style="color:var(--orange);">${Utils.formatRupiah(remaining)}</strong>
    `;
    const form = document.getElementById('payment-form');
    form.reset();
    form.querySelector('[name="invoice_id"]').value = invoiceId;
    form.querySelector('[name="date"]').value = Utils.formatDateInput(new Date().toISOString());
    form.querySelector('[name="amount"]').value = remaining;
    Utils.showModal('payment-modal');
  };

  window.savePayment = async () => {
    const form = document.getElementById('payment-form');
    const data = Utils.getFormData(form);
    data.id = genId();
    data.amount = Number(data.amount);
    data.created_at = new Date().toISOString();
    await DB.put('invoice_payments', data);

    // Update invoice status
    const inv = await DB.get('invoices', data.invoice_id);
    const allPays = await DB.getAll('invoice_payments');
    const totalPaid = allPays.filter(p => p.invoice_id === data.invoice_id).reduce((s,p)=>s+p.amount,0) + data.amount;
    inv.status = totalPaid >= inv.total ? 'paid' : 'partial';
    await DB.put('invoices', inv);

    // Create cash transaction
    const tx = {
      id: genId(), type: 'cash_in',
      account_id: data.account_id,
      category_id: 'cat1',
      amount: data.amount,
      date: data.date,
      description: `Pembayaran ${inv.number}`,
      ref_type: 'invoice', ref_id: inv.id,
      created_by: Auth.user.id,
      created_at: new Date().toISOString(),
    };
    await DB.put('transactions', tx);

    // Update account balance
    const acc = await DB.get('accounts', data.account_id);
    if (acc) { acc.balance += data.amount; await DB.put('accounts', acc); }

    Utils.closeModal('payment-modal');
    Utils.toast('Pembayaran dicatat', 'success');
    renderPage('invoices');
  };

  window.deleteInvoice = async (id) => {
    if (await Utils.confirm('Hapus invoice ini?')) {
      await DB.delete('invoices', id);
      Utils.toast('Invoice dihapus', 'success');
      renderPage('invoices');
    }
  };

  window.printInvoice = async (id) => {
    const inv = await DB.get('invoices', id);
    const p   = projMap[inv.project_id];
    const cl  = clientMap[inv.client_id];
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>${inv.number}</title><style>
        body{font-family:Arial,sans-serif;padding:40px;color:#222;}
        h1{color:#1a3a6b;} table{width:100%;border-collapse:collapse;margin:20px 0;}
        th,td{border:1px solid #ddd;padding:10px;} th{background:#f0f4ff;}
        .total{font-size:18px;font-weight:bold;color:#1a3a6b;}
      </style></head><body>
        <h1>INVOICE</h1><p><strong>${inv.number}</strong></p>
        <p>Tanggal: ${inv.issue_date} | Jatuh Tempo: ${inv.due_date}</p>
        <hr/>
        <p><strong>Kepada:</strong><br/>${cl?.name || '-'}<br/>${cl?.contact || ''}</p>
        <p><strong>Proyek:</strong> ${p?.name || '-'}</p>
        <table><tr><th>Uraian</th><th>Jumlah</th></tr>
          <tr><td>${inv.notes || 'Termin'}</td><td>${Utils.formatRupiah(inv.total)}</td></tr>
        </table>
        <p class="total">TOTAL: ${Utils.formatRupiah(inv.total)}</p>
        <p style="margin-top:60px;font-size:12px;color:#888;">Dokumen ini digenerate oleh FinMS</p>
      </body></html>`);
    win.document.close();
    win.print();
  };
}

// ════════════════════════════════════════════════════
// ── EXPENSES ──────────────────────────────────────────
// ════════════════════════════════════════════════════
async function renderExpenses(el) {
  const [expenses, categories, accounts, users] = await Promise.all([
    DB.getAll('expenses'), DB.getAll('categories'), DB.getAll('accounts'), DB.getAll('users'),
  ]);

  const catMap  = Object.fromEntries(categories.map(c=>[c.id,c]));
  const accMap  = Object.fromEntries(accounts.map(a=>[a.id,a]));
  const userMap = Object.fromEntries(users.map(u=>[u.id,u]));
  const outCats = categories.filter(c => c.flow_type === 'outflow');
  const sorted  = [...expenses].sort((a,b) => b.date?.localeCompare(a.date));

  const pending    = expenses.filter(e=>e.status==='pending');
  const approved   = expenses.filter(e=>e.status==='approved');
  const disbursed  = expenses.filter(e=>e.status==='disbursed');

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Pengeluaran & Approval</h1><p>Payment Request, Approval Workflow, dan Disbursement</p></div>
      <button class="btn btn-primary" onclick="openExpenseModal()"><i data-lucide="plus"></i> Buat PR</button>
    </div>

    <div class="stat-grid" style="margin-bottom:24px;">
      <div class="stat-card"><div class="stat-icon orange"><i data-lucide="clock"></i></div><div class="stat-label">Menunggu Approval</div><div class="stat-value">${pending.length}</div><div class="stat-sub">${Utils.formatRupiah(pending.reduce((s,e)=>s+e.amount,0),true)}</div></div>
      <div class="stat-card"><div class="stat-icon blue"><i data-lucide="check"></i></div><div class="stat-label">Disetujui</div><div class="stat-value">${approved.length}</div><div class="stat-sub">${Utils.formatRupiah(approved.reduce((s,e)=>s+e.amount,0),true)}</div></div>
      <div class="stat-card"><div class="stat-icon green"><i data-lucide="banknote"></i></div><div class="stat-label">Dibayar Bulan Ini</div><div class="stat-value">${Utils.formatRupiah(disbursed.filter(e=>{const r=Utils.monthRange(Utils.currentMonth());return Utils.isInRange(e.date,r.start,r.end);}).reduce((s,e)=>s+e.amount,0),true)}</div></div>
      <div class="stat-card"><div class="stat-icon red"><i data-lucide="receipt"></i></div><div class="stat-label">Total Pengeluaran</div><div class="stat-value">${Utils.formatRupiah(expenses.reduce((s,e)=>s+e.amount,0),true)}</div></div>
    </div>

    <div class="filters-bar">
      <div class="search-box"><span class="search-icon"><i data-lucide="search"></i></span><input type="text" placeholder="Cari pengeluaran..." id="exp-search" oninput="filterExp()" /></div>
      <select class="filter-select" id="exp-status" onchange="filterExp()">
        <option value="">Semua Status</option>
        <option value="pending">Menunggu</option>
        <option value="approved">Disetujui</option>
        <option value="disbursed">Dibayar</option>
        <option value="rejected">Ditolak</option>
      </select>
      <select class="filter-select" id="exp-type" onchange="filterExp()">
        <option value="">Semua Tipe</option>
        <option value="OPEX">OPEX</option>
        <option value="CAPEX">CAPEX</option>
        <option value="COGS">COGS</option>
      </select>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Judul</th><th>Tipe</th><th>Kategori</th><th style="text-align:right">Jumlah</th><th>Tanggal</th><th>Rekening</th><th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody id="exp-tbody">
            ${renderExpRows(sorted, catMap, accMap)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Expense Modal -->
    <div class="modal-overlay" id="expense-modal">
      <div class="modal modal-lg">
        <div class="modal-header">
          <span class="modal-title" id="expense-modal-title">Buat Payment Request</span>
          <button class="modal-close" onclick="Utils.closeModal('expense-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="expense-form">
            <input type="hidden" name="id" />
            <div class="form-group"><label class="form-label">Judul Pengeluaran</label><input name="title" class="form-control" placeholder="Gaji, Sewa, Pembelian..." required /></div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Kategori</label>
                <select name="category_id" class="form-select" required>
                  <option value="">-- Pilih Kategori --</option>
                  ${outCats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label class="form-label">Tipe</label>
                <select name="category_type" class="form-select">
                  <option value="OPEX">OPEX — Operasional</option>
                  <option value="CAPEX">CAPEX — Aset</option>
                  <option value="COGS">COGS — Biaya Langsung</option>
                </select>
              </div>
            </div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Jumlah (Rp)</label><input name="amount" type="number" class="form-control" placeholder="0" required /></div>
              <div class="form-group"><label class="form-label">Tanggal</label><input name="date" type="date" class="form-control" required /></div>
            </div>
            <div class="form-group"><label class="form-label">Rekening Pembayaran</label>
              <select name="account_id" class="form-select" required>
                <option value="">-- Pilih Rekening --</option>
                ${accounts.map(a=>`<option value="${a.id}">${a.name} (${a.bank})</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">Deskripsi</label><textarea name="description" class="form-textarea" placeholder="Deskripsi detail pengeluaran..."></textarea></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('expense-modal')">Batal</button>
          <button class="btn btn-primary" onclick="saveExpense()"><i data-lucide="send"></i> Submit PR</button>
        </div>
      </div>
    </div>
  `;

  let _allExp = sorted;

  function renderExpRows(rows, cMap, aMap) {
    if (!rows.length) return `<tr><td colspan="8"><div class="table-empty"><i data-lucide="receipt"></i><p>Tidak ada data</p></div></td></tr>`;
    return rows.map(e => `
      <tr>
        <td class="text-primary">${e.title}</td>
        <td><span class="badge badge-${e.category_type==='OPEX'?'blue':e.category_type==='CAPEX'?'purple':'cyan'}">${e.category_type}</span></td>
        <td style="font-size:12px;color:var(--text-muted);">${cMap[e.category_id]?.name || '-'}</td>
        <td style="text-align:right;font-weight:700;color:var(--red);">${Utils.formatRupiah(e.amount)}</td>
        <td>${Utils.formatDate(e.date)}</td>
        <td style="font-size:12px;">${aMap[e.account_id]?.name || '-'}</td>
        <td>${Utils.statusBadge(e.status)}</td>
        <td>
          <div style="display:flex;gap:6px;">
            ${e.status === 'pending' ? `
              <button class="btn btn-ghost btn-sm" onclick="approveExpense('${e.id}')" title="Setujui"><i data-lucide="check-circle"></i></button>
              <button class="btn-icon danger" onclick="rejectExpense('${e.id}')" title="Tolak"><i data-lucide="x-circle"></i></button>
            ` : ''}
            ${e.status === 'approved' ? `
              <button class="btn btn-success btn-sm" onclick="disburseExpense('${e.id}')"><i data-lucide="banknote"></i> Bayar</button>
            ` : ''}
            <button class="btn-icon danger" onclick="deleteExpense('${e.id}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.filterExp = () => {
    const q = document.getElementById('exp-search').value.toLowerCase();
    const status = document.getElementById('exp-status').value;
    const type = document.getElementById('exp-type').value;
    let filtered = _allExp;
    if (q) filtered = filtered.filter(e => e.title.toLowerCase().includes(q));
    if (status) filtered = filtered.filter(e => e.status === status);
    if (type) filtered = filtered.filter(e => e.category_type === type);
    document.getElementById('exp-tbody').innerHTML = renderExpRows(filtered, catMap, accMap);
    if (window.lucide) lucide.createIcons();
  };

  window.openExpenseModal = () => {
    document.getElementById('expense-form').reset();
    document.querySelector('#expense-form [name="date"]').value = Utils.formatDateInput(new Date().toISOString());
    Utils.showModal('expense-modal');
  };

  window.saveExpense = async () => {
    const form = document.getElementById('expense-form');
    const data = Utils.getFormData(form);
    data.amount = Number(data.amount);
    data.id = data.id || genId();
    data.status = 'pending';
    data.requested_by = Auth.user.id;
    data.approved_by = null;
    data.attachment = null;
    data.created_at = new Date().toISOString();

    // Determine approver based on amount
    const approverNote = data.amount > 15000000
      ? 'Membutuhkan persetujuan CEO (> Rp 15jt)'
      : 'Membutuhkan persetujuan Finance Manager';

    await DB.put('expenses', data);
    Utils.closeModal('expense-modal');
    Utils.toast(`PR submitted. ${approverNote}`, 'info', 5000);
    renderPage('expenses');
  };

  window.approveExpense = async (id) => {
    if (!Auth.can('approve_expense_under_15m') && !Auth.can('approve_all')) {
      Utils.toast('Anda tidak memiliki izin untuk menyetujui', 'error'); return;
    }
    const exp = await DB.get('expenses', id);
    if (exp.amount > 15000000 && !Auth.can('approve_all')) {
      Utils.toast('Pengeluaran > Rp 15jt membutuhkan persetujuan CEO', 'error'); return;
    }
    exp.status = 'approved';
    exp.approved_by = Auth.user.id;
    await DB.put('expenses', exp);
    Utils.toast('Pengeluaran disetujui', 'success');
    renderPage('expenses');
  };

  window.rejectExpense = async (id) => {
    const exp = await DB.get('expenses', id);
    exp.status = 'rejected';
    await DB.put('expenses', exp);
    Utils.toast('Pengeluaran ditolak', 'warning');
    renderPage('expenses');
  };

  window.disburseExpense = async (id) => {
    if (!await Utils.confirm('Konfirmasi pembayaran pengeluaran ini?')) return;
    const exp = await DB.get('expenses', id);
    exp.status = 'disbursed';
    await DB.put('expenses', exp);

    // Create cash transaction
    const tx = {
      id: genId(), type: 'cash_out',
      account_id: exp.account_id, category_id: exp.category_id,
      amount: exp.amount, date: exp.date,
      description: exp.title,
      ref_type: 'expense', ref_id: exp.id,
      created_by: Auth.user.id, created_at: new Date().toISOString(),
    };
    await DB.put('transactions', tx);

    // Update account balance
    const acc = await DB.get('accounts', exp.account_id);
    if (acc) { acc.balance -= exp.amount; await DB.put('accounts', acc); }

    Utils.toast('Pembayaran berhasil dicatat', 'success');
    renderPage('expenses');
  };

  window.deleteExpense = async (id) => {
    if (await Utils.confirm('Hapus pengeluaran ini?')) {
      await DB.delete('expenses', id);
      Utils.toast('Data dihapus', 'success');
      renderPage('expenses');
    }
  };
}

// ════════════════════════════════════════════════════
// ── RECONCILIATION ────────────────────────────────────
// ════════════════════════════════════════════════════
async function renderReconciliation(el) {
  const [accounts, transactions, categories] = await Promise.all([
    DB.getAll('accounts'), DB.getAll('transactions'), DB.getAll('categories'),
  ]);

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Rekonsiliasi Bank</h1><p>Cocokkan mutasi bank dengan transaksi sistem</p></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><span class="card-title">Import Mutasi Bank (CSV)</span></div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Format CSV: <code style="background:rgba(79,142,247,0.1);padding:2px 8px;border-radius:4px;">tanggal,keterangan,debit,kredit</code></p>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="form-label">Rekening</label>
            <select class="form-select" id="recon-account">
              ${accounts.map(a=>`<option value="${a.id}">${a.name} (${a.bank})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">File CSV Mutasi Bank</label>
            <input type="file" accept=".csv" id="recon-file" class="form-control" onchange="loadCsvFile(this)" />
          </div>
        </div>
        <button class="btn btn-primary" onclick="runReconciliation()"><i data-lucide="git-merge"></i> Jalankan Rekonsiliasi</button>
      </div>
    </div>

    <div id="recon-results"></div>
  `;

  let _importedRows = [];

  window.loadCsvFile = (input) => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      _importedRows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g,''));
        return { date: cols[0], description: cols[1], debit: Number(cols[2]||0), credit: Number(cols[3]||0) };
      }).filter(r => r.date);
      Utils.toast(`${_importedRows.length} baris diimpor`, 'success');
    };
    reader.readAsText(file);
  };

  window.runReconciliation = () => {
    if (!_importedRows.length) {
      // Demo with mock data
      _importedRows = [
        { date: '2026-08-10', description: 'CR TRANSFER SIMPEG', debit: 0,         credit: 35000000 },
        { date: '2026-08-01', description: 'DR SEWA KANTOR',     debit: 15000000,  credit: 0        },
        { date: '2026-08-10', description: 'DR HOSTING DOMAIN',  debit: 5500000,   credit: 0        },
        { date: '2026-08-30', description: 'DR PAYROLL',         debit: 85000000,  credit: 0        },
        { date: '2026-09-01', description: 'DR ADMIN BANK',      debit: 25000,     credit: 0        },
      ];
    }

    const accId = document.getElementById('recon-account').value;
    const accTx = transactions.filter(t => t.account_id === accId);

    const results = _importedRows.map(row => {
      const amount = row.credit > 0 ? row.credit : row.debit;
      const type   = row.credit > 0 ? 'cash_in' : 'cash_out';
      const match  = accTx.find(t => t.type === type && Math.abs(t.amount - amount) < 1000 && Math.abs(new Date(t.date) - new Date(row.date)) < 7 * 86400000);
      return { ...row, amount, type, match, status: match ? 'matched' : 'unmatched' };
    });

    const matched   = results.filter(r=>r.status==='matched').length;
    const unmatched = results.filter(r=>r.status==='unmatched').length;

    const html = `
      <div class="stat-grid" style="margin-bottom:16px;">
        <div class="stat-card"><div class="stat-icon blue"><i data-lucide="list"></i></div><div class="stat-label">Total Mutasi</div><div class="stat-value">${results.length}</div></div>
        <div class="stat-card"><div class="stat-icon green"><i data-lucide="check-circle"></i></div><div class="stat-label">Cocok</div><div class="stat-value">${matched}</div></div>
        <div class="stat-card"><div class="stat-icon red"><i data-lucide="x-circle"></i></div><div class="stat-label">Tidak Cocok</div><div class="stat-value">${unmatched}</div></div>
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Tanggal Bank</th><th>Keterangan Mutasi</th><th style="text-align:right">Debit</th><th style="text-align:right">Kredit</th><th>Status</th><th>Transaksi Sistem</th></tr></thead>
            <tbody>
              ${results.map(r=>`
                <tr>
                  <td>${Utils.formatDate(r.date)}</td>
                  <td>${r.description}</td>
                  <td class="${r.debit?'amount-out':''}" style="text-align:right;">${r.debit ? '-'+Utils.formatRupiah(r.debit) : '-'}</td>
                  <td class="${r.credit?'amount-in':''}" style="text-align:right;">${r.credit ? '+'+Utils.formatRupiah(r.credit) : '-'}</td>
                  <td>${Utils.statusBadge(r.status)}</td>
                  <td style="font-size:12px;color:var(--text-muted);">${r.match ? r.match.description : '<span style="color:var(--red);">Tidak ditemukan</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('recon-results').innerHTML = html;
    if (window.lucide) lucide.createIcons();
    Utils.toast(`Rekonsiliasi selesai: ${matched} cocok, ${unmatched} tidak cocok`, 'info');
  };
}

// ════════════════════════════════════════════════════
// ── CLIENTS ──────────────────────────────────────────
// ════════════════════════════════════════════════════
async function renderClients(el) {
  const [clients, projects] = await Promise.all([DB.getAll('clients'), DB.getAll('projects')]);
  const projByClient = {};
  projects.forEach(p => { if (!projByClient[p.client_id]) projByClient[p.client_id] = 0; projByClient[p.client_id]++; });

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Data Klien</h1><p>Kelola data klien dan proyek terkait</p></div>
      <button class="btn btn-primary" onclick="openClientModal()"><i data-lucide="plus"></i> Tambah Klien</button>
    </div>

    <div class="filters-bar">
      <div class="search-box"><span class="search-icon"><i data-lucide="search"></i></span><input type="text" placeholder="Cari klien..." id="cl-search" oninput="filterClients()" /></div>
    </div>

    <div class="grid-auto" id="clients-grid">
      ${clients.map(c=>`
        <div class="card">
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <div style="width:42px;height:42px;border-radius:var(--radius-md);background:var(--grad-primary);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;flex-shrink:0;">${c.name[0]}</div>
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--text-primary);">${c.name}</div>
                <div style="font-size:12px;color:var(--text-muted);">${c.contact}</div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${c.email}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${c.phone}</div>
            <div style="font-size:12px;color:var(--text-muted);">${c.address}</div>
            <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--text-secondary);">${projByClient[c.id]||0} proyek</span>
              <div style="display:flex;gap:6px;">
                <button class="btn-icon" onclick="openClientModal('${c.id}')"><i data-lucide="pencil"></i></button>
                <button class="btn-icon danger" onclick="deleteClient('${c.id}')"><i data-lucide="trash-2"></i></button>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Client Modal -->
    <div class="modal-overlay" id="client-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="client-modal-title">Tambah Klien</span>
          <button class="modal-close" onclick="Utils.closeModal('client-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="client-form">
            <input type="hidden" name="id" />
            <div class="form-group"><label class="form-label">Nama Perusahaan</label><input name="name" class="form-control" placeholder="PT / CV / Dinas..." required /></div>
            <div class="form-group"><label class="form-label">Nama Kontak PIC</label><input name="contact" class="form-control" placeholder="Nama PIC..." required /></div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Email</label><input name="email" type="email" class="form-control" placeholder="pic@company.id" /></div>
              <div class="form-group"><label class="form-label">No. Telepon</label><input name="phone" class="form-control" placeholder="08xxx" /></div>
            </div>
            <div class="form-group"><label class="form-label">Alamat</label><textarea name="address" class="form-textarea" style="min-height:70px;" placeholder="Kota, Provinsi..."></textarea></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('client-modal')">Batal</button>
          <button class="btn btn-primary" onclick="saveClient()"><i data-lucide="save"></i> Simpan</button>
        </div>
      </div>
    </div>
  `;

  let _allClients = clients;

  window.filterClients = () => {
    const q = document.getElementById('cl-search').value.toLowerCase();
    let filtered = q ? _allClients.filter(c => c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q)) : _allClients;
    const grid = document.getElementById('clients-grid');
    grid.innerHTML = filtered.map(c=>`
      <div class="card">
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="width:42px;height:42px;border-radius:var(--radius-md);background:var(--grad-primary);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;flex-shrink:0;">${c.name[0]}</div>
            <div><div style="font-size:14px;font-weight:700;color:var(--text-primary);">${c.name}</div><div style="font-size:12px;color:var(--text-muted);">${c.contact}</div></div>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">${c.email}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${c.phone}</div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12px;color:var(--text-secondary);">${projByClient[c.id]||0} proyek</span>
            <div style="display:flex;gap:6px;">
              <button class="btn-icon" onclick="openClientModal('${c.id}')"><i data-lucide="pencil"></i></button>
              <button class="btn-icon danger" onclick="deleteClient('${c.id}')"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
  };

  window.openClientModal = async (id = null) => {
    document.getElementById('client-modal-title').textContent = id ? 'Edit Klien' : 'Tambah Klien';
    const form = document.getElementById('client-form');
    form.reset();
    if (id) { const c = await DB.get('clients', id); Utils.fillForm(form, c); }
    Utils.showModal('client-modal');
  };

  window.saveClient = async () => {
    const form = document.getElementById('client-form');
    const data = Utils.getFormData(form);
    data.created_at = new Date().toISOString();
    if (!data.id) { data.id = genId(); await DB.put('clients', data); Utils.toast('Klien ditambahkan', 'success'); }
    else { const old = await DB.get('clients', data.id); await DB.put('clients', { ...old, ...data }); Utils.toast('Klien diperbarui', 'success'); }
    Utils.closeModal('client-modal');
    renderPage('clients');
  };

  window.deleteClient = async (id) => {
    if (await Utils.confirm('Hapus klien ini?')) {
      await DB.delete('clients', id);
      Utils.toast('Klien dihapus', 'success');
      renderPage('clients');
    }
  };
}

// ════════════════════════════════════════════════════
// ── CATEGORIES ───────────────────────────────────────
// ════════════════════════════════════════════════════
async function renderCategories(el) {
  const categories = await DB.getAll('categories');

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Kategori Arus Kas</h1><p>Chart of Accounts — klasifikasi pendapatan dan pengeluaran</p></div>
      <button class="btn btn-primary" onclick="openCatModal()"><i data-lucide="plus"></i> Tambah Kategori</button>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Cash In (Inflow)</span></div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nama</th><th>Seksi</th><th>Warna</th><th>Aksi</th></tr></thead>
            <tbody>
              ${categories.filter(c=>c.flow_type==='inflow').map(c=>`
                <tr>
                  <td class="text-primary">${c.name}</td>
                  <td><span class="badge badge-blue">${c.section}</span></td>
                  <td><div style="width:24px;height:24px;border-radius:6px;background:${c.color};"></div></td>
                  <td><div style="display:flex;gap:6px;"><button class="btn-icon" onclick="openCatModal('${c.id}')"><i data-lucide="pencil"></i></button><button class="btn-icon danger" onclick="deleteCat('${c.id}')"><i data-lucide="trash-2"></i></button></div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Cash Out (Outflow)</span></div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nama</th><th>Seksi</th><th>Warna</th><th>Aksi</th></tr></thead>
            <tbody>
              ${categories.filter(c=>c.flow_type==='outflow').map(c=>`
                <tr>
                  <td class="text-primary">${c.name}</td>
                  <td><span class="badge badge-red">${c.section}</span></td>
                  <td><div style="width:24px;height:24px;border-radius:6px;background:${c.color};"></div></td>
                  <td><div style="display:flex;gap:6px;"><button class="btn-icon" onclick="openCatModal('${c.id}')"><i data-lucide="pencil"></i></button><button class="btn-icon danger" onclick="deleteCat('${c.id}')"><i data-lucide="trash-2"></i></button></div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <div class="modal-overlay" id="cat-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="cat-modal-title">Tambah Kategori</span>
          <button class="modal-close" onclick="Utils.closeModal('cat-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="cat-form">
            <input type="hidden" name="id" />
            <div class="form-group"><label class="form-label">Nama Kategori</label><input name="name" class="form-control" placeholder="Nama kategori..." required /></div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Tipe</label>
                <select name="flow_type" class="form-select">
                  <option value="inflow">Cash In (Inflow)</option>
                  <option value="outflow">Cash Out (Outflow)</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">Seksi</label>
                <select name="section" class="form-select">
                  <option value="operating">Operasional</option>
                  <option value="investing">Investasi</option>
                  <option value="financing">Pendanaan</option>
                </select>
              </div>
            </div>
            <div class="form-group"><label class="form-label">Warna</label><input name="color" type="color" class="form-control" value="#4f8ef7" style="height:42px;padding:4px 8px;" /></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('cat-modal')">Batal</button>
          <button class="btn btn-primary" onclick="saveCat()"><i data-lucide="save"></i> Simpan</button>
        </div>
      </div>
    </div>
  `;

  window.openCatModal = async (id = null) => {
    document.getElementById('cat-modal-title').textContent = id ? 'Edit Kategori' : 'Tambah Kategori';
    const form = document.getElementById('cat-form');
    form.reset();
    if (id) { const c = await DB.get('categories', id); Utils.fillForm(form, c); }
    Utils.showModal('cat-modal');
  };

  window.saveCat = async () => {
    const form = document.getElementById('cat-form');
    const data = Utils.getFormData(form);
    if (!data.id) { data.id = genId(); await DB.put('categories', data); Utils.toast('Kategori ditambahkan', 'success'); }
    else { const old = await DB.get('categories', data.id); await DB.put('categories', { ...old, ...data }); Utils.toast('Kategori diperbarui', 'success'); }
    Utils.closeModal('cat-modal');
    renderPage('categories');
  };

  window.deleteCat = async (id) => {
    if (await Utils.confirm('Hapus kategori ini?')) {
      await DB.delete('categories', id);
      Utils.toast('Kategori dihapus', 'success');
      renderPage('categories');
    }
  };
}

// ════════════════════════════════════════════════════
// ── USERS ────────────────────────────────────────────
// ════════════════════════════════════════════════════
async function renderUsers(el) {
  if (!Auth.can('all')) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="lock"></i></div><div class="empty-title">Akses Ditolak</div><div class="empty-desc">Hanya Administrator yang dapat mengakses halaman ini.</div></div>`;
    return;
  }

  const users = await DB.getAll('users');

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Manajemen Pengguna</h1><p>Kelola akun dan hak akses pengguna sistem</p></div>
      <button class="btn btn-primary" onclick="openUserModal()"><i data-lucide="plus"></i> Tambah Pengguna</button>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${users.map(u=>`
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;">${u.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
                    <span class="text-primary">${u.name}</span>
                  </div>
                </td>
                <td style="font-size:12px;">${u.email}</td>
                <td><span class="badge badge-blue">${Auth.getRoleLabel(u.role)}</span></td>
                <td>${u.active ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-gray">Nonaktif</span>'}</td>
                <td>
                  <div style="display:flex;gap:6px;">
                    <button class="btn-icon" onclick="openUserModal('${u.id}')"><i data-lucide="pencil"></i></button>
                    ${u.id !== Auth.user.id ? `<button class="btn-icon danger" onclick="deleteUser('${u.id}')"><i data-lucide="trash-2"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- User Modal -->
    <div class="modal-overlay" id="user-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="user-modal-title">Tambah Pengguna</span>
          <button class="modal-close" onclick="Utils.closeModal('user-modal')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="user-form">
            <input type="hidden" name="id" />
            <div class="form-group"><label class="form-label">Nama Lengkap</label><input name="name" class="form-control" placeholder="Nama lengkap..." required /></div>
            <div class="form-group"><label class="form-label">Email</label><input name="email" type="email" class="form-control" placeholder="email@company.id" required /></div>
            <div class="form-group"><label class="form-label">Password</label><input name="password" type="password" class="form-control" placeholder="••••••••" /></div>
            <div class="form-row form-row-2">
              <div class="form-group"><label class="form-label">Role</label>
                <select name="role" class="form-select">
                  ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label class="form-label">Status</label>
                <select name="active" class="form-select">
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="Utils.closeModal('user-modal')">Batal</button>
          <button class="btn btn-primary" onclick="saveUser()"><i data-lucide="save"></i> Simpan</button>
        </div>
      </div>
    </div>
  `;

  window.openUserModal = async (id = null) => {
    document.getElementById('user-modal-title').textContent = id ? 'Edit Pengguna' : 'Tambah Pengguna';
    const form = document.getElementById('user-form');
    form.reset();
    if (id) { const u = await DB.get('users', id); Utils.fillForm(form, { ...u, active: String(u.active) }); }
    Utils.showModal('user-modal');
  };

  window.saveUser = async () => {
    const form = document.getElementById('user-form');
    const data = Utils.getFormData(form);
    data.active = data.active === 'true';
    data.created_at = new Date().toISOString();
    if (!data.id) { data.id = genId(); await DB.put('users', data); Utils.toast('Pengguna ditambahkan', 'success'); }
    else {
      const old = await DB.get('users', data.id);
      if (!data.password) data.password = old.password;
      await DB.put('users', { ...old, ...data });
      Utils.toast('Pengguna diperbarui', 'success');
    }
    Utils.closeModal('user-modal');
    renderPage('users');
  };

  window.deleteUser = async (id) => {
    if (await Utils.confirm('Hapus pengguna ini?')) {
      await DB.delete('users', id);
      Utils.toast('Pengguna dihapus', 'success');
      renderPage('users');
    }
  };
}

// ── Clock ─────────────────────────────────────────────────────────
function startClock() {
  const tick = () => {
    const el = document.getElementById('clock-display');
    if (el) el.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

// ── Sidebar Toggle (mobile) ───────────────────────────────────────
window.toggleSidebar = () => {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('mobile-open');
};

function checkMobile() {
  const btn = document.getElementById('sidebar-toggle');
  if (window.innerWidth <= 768) {
    if (btn) btn.style.display = 'flex';
  } else {
    if (btn) btn.style.display = 'none';
    document.getElementById('sidebar')?.classList.remove('mobile-open');
  }
}

// ── PWA Install ───────────────────────────────────────────────────
let _deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstall = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'flex';
});

window.installPWA = async () => {
  if (_deferredInstall) {
    _deferredInstall.prompt();
    const result = await _deferredInstall.userChoice;
    if (result.outcome === 'accepted') Utils.toast('App berhasil diinstall!', 'success');
    _deferredInstall = null;
    document.getElementById('pwa-install-btn').style.display = 'none';
  }
};

window.addEventListener('appinstalled', () => Utils.toast('FinMS berhasil diinstall', 'success'));

// ── Fill Login ────────────────────────────────────────────────────
window.fillLogin = (email, password) => {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = password;
  document.getElementById('login-form').dispatchEvent(new Event('submit'));
};

// ── App Bootstrap ─────────────────────────────────────────────────
async function bootstrap() {
  // Init DB + seed
  await openDB();
  await seedDatabase();

  // Try restore session
  const user = await Auth.restoreSession();

  if (user) {
    showApp();
  } else {
    showLogin();
  }

  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass  = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn   = document.getElementById('login-btn');

    btn.disabled = true;
    btn.innerHTML = '<div style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;"></div> Masuk...';

    try {
      await Auth.login(email, pass);
      showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg> Masuk`;
    }
  });

  // SW Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('[SW]', err));
  }

  // Mobile check
  checkMobile();
  window.addEventListener('resize', checkMobile);
}

function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  renderSidebar();
  startClock();
  Router.init();
}

// Kick off
bootstrap();
