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

  // Credentials are checked by the server against a bcrypt hash. The browser
  // never sees a stored password, and the session lives in an HttpOnly cookie
  // rather than in localStorage where any script could read it.
  async login(email, password) {
    const res = await fetch('api/auth.php?action=login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let payload = null;
    try { payload = await res.json(); } catch { /* handled below */ }

    if (!res.ok) throw new Error(payload?.error || 'Tidak bisa menghubungi server.');

    this.currentUser = payload;
    return payload;
  },

  async logout() {
    try {
      await fetch('api/auth.php?action=logout', { method: 'POST', credentials: 'same-origin' });
    } catch { /* the reload below still drops the client state */ }
    this.currentUser = null;
    window.location.reload();
  },

  async restoreSession() {
    try {
      const res = await fetch('api/auth.php?action=me', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const user = await res.json();
      if (user && user.active) {
        this.currentUser = user;
        return user;
      }
    } catch { /* server unreachable — treat as logged out */ }
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
