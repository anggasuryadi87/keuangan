// FinMS — Authentication & RBAC

const ROLES = {
  admin: {
    label: 'Administrator',
    permissions: ['all'],
  },
  ceo: {
    label: 'CEO / Direktur',
    permissions: ['approve_all', 'view_all', 'dashboard'],
  },
  finance_manager: {
    label: 'Finance Manager',
    permissions: ['approve_expense_under_15m', 'manage_invoices', 'manage_accounts', 'view_reports', 'manage_reconciliation'],
  },
  finance_staff: {
    label: 'Finance Staff',
    permissions: ['create_expense', 'create_invoice', 'view_transactions'],
  },
  project_manager: {
    label: 'Project Manager',
    permissions: ['manage_projects', 'manage_milestones', 'view_invoices'],
  },
};

const Auth = {
  currentUser: null,

  async login(email, password) {
    const db = await openDB();
    const users = await DB.getAll('users');
    const user = users.find(u => u.email === email && u.password === password && u.active);
    if (!user) throw new Error('Email atau password salah');
    this.currentUser = user;
    localStorage.setItem('finms_session', JSON.stringify({ id: user.id, email: user.email, role: user.role, name: user.name }));
    return user;
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('finms_session');
    window.location.reload();
  },

  async restoreSession() {
    const session = localStorage.getItem('finms_session');
    if (!session) return null;
    try {
      const s = JSON.parse(session);
      const user = await DB.get('users', s.id);
      if (user && user.active) {
        this.currentUser = user;
        return user;
      }
    } catch (e) {}
    localStorage.removeItem('finms_session');
    return null;
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  hasPermission(permission) {
    if (!this.currentUser) return false;
    const rolePerms = ROLES[this.currentUser.role]?.permissions || [];
    return rolePerms.includes('all') || rolePerms.includes(permission);
  },

  can(action) {
    return this.hasPermission(action);
  },

  getRoleLabel(role) {
    return ROLES[role]?.label || role;
  },

  get user() {
    return this.currentUser;
  },
};

window.Auth = Auth;
window.ROLES = ROLES;
