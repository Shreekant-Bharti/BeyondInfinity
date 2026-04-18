'use strict';

const AUTH = {
  token: null,
  role:  null,
  user:  null,

  async init() {
    this.token = localStorage.getItem('wt_token');
    this.role  = localStorage.getItem('wt_role');
    const u    = localStorage.getItem('wt_user');
    this.user  = u ? JSON.parse(u) : null;

    if (this.token && this.user) {
      this._onLoggedIn();
      this._validateToken();
    } else {
      this._onLoggedOut();
    }
  },

  async _validateToken() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` },
      });
      if (!res.ok) {
        this._forceLogout('Session expired. Please login again.');
      }
    } catch {
      // Network offline — don't force logout, just keep cached session
    }
  },

  _forceLogout(message) {
    localStorage.removeItem('wt_token');
    localStorage.removeItem('wt_role');
    localStorage.removeItem('wt_user');
    this.token = null;
    this.role  = null;
    this.user  = null;
    this._onLoggedOut();
    if (message) {
      setTimeout(() => {
        const errEl = document.getElementById('authLoginError');
        if (errEl) errEl.textContent = message;
      }, 150);
    }
  },

  getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  },

  _showOverlay() {
    const el = document.getElementById('authOverlay');
    if (el) el.style.display = 'flex';
  },

  _hideOverlay() {
    const el = document.getElementById('authOverlay');
    if (el) el.style.display = 'none';
  },

  _onLoggedIn() {
    this._hideOverlay();

    const loginBtn = document.getElementById('authLoginBtn');
    const info     = document.getElementById('authUserInfo');
    if (loginBtn) loginBtn.style.display = 'none';
    if (info)     info.style.display     = 'flex';

    const nameEl = document.getElementById('authUserName');
    const roleEl = document.getElementById('authUserRole');
    if (nameEl) nameEl.textContent = this.user.name;
    if (roleEl) {
      roleEl.textContent = this.role;
      roleEl.className   = 'auth-role-badge auth-role-' + this.role.toLowerCase();
    }

    this._applyRoleRestrictions(this.role);
  },

  _onLoggedOut() {
    this._showOverlay();

    const loginBtn = document.getElementById('authLoginBtn');
    const info     = document.getElementById('authUserInfo');
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (info)     info.style.display     = 'none';

    this._disableControls();

    setTimeout(() => this.openLoginModal(), 300);
  },

  _applyRoleRestrictions(role) {
    const modeToggle = document.getElementById('modeToggle');
    const motorBtns  = document.querySelectorAll('.btn-force-on, .btn-force-off');

    if (role === 'STUDENT') {
      if (modeToggle) { modeToggle.disabled = true; }
      motorBtns.forEach(btn => {
        btn.disabled = true;
        btn.title    = 'WARDEN or ADMIN access required';
      });

      // Hide restricted tabs
      const tabAlerts = document.querySelector('[data-target="tab-alerts"]');
      const tabReports = document.querySelector('[data-target="tab-reports"]');
      const tabAdmin = document.querySelector('[data-target="tab-admin"]');
      const tabAllTanks = document.querySelector('[data-target="tab-all-tanks"]');
      
      if (tabAlerts) tabAlerts.remove();
      if (tabReports) tabReports.remove();
      if (tabAdmin) tabAdmin.remove();
      if (tabAllTanks) tabAllTanks.remove();

      // Remove "Action" column elements in All Tanks (if they somehow access it)
      document.querySelectorAll(".action-column").forEach(el => el.remove());
      document.querySelectorAll(".action-btn").forEach(el => el.remove());

      // Route protection
      const path = window.location.pathname;
      if (
          path.includes("alerts") ||
          path.includes("reports") ||
          path.includes("users") ||
          path.includes("all-tanks")
      ) {
          window.location.href = "/";
      }
    }
    if (role === 'WARDEN') {
      if (modeToggle) {
        modeToggle.disabled = true;
        modeToggle.title    = 'ADMIN access required';
      }
      
      // Hide restricted tabs for Warden
      const tabReportsWarden = document.querySelector('[data-target="tab-reports"]');
      if (tabReportsWarden) tabReportsWarden.remove();

      // Route protection
      const path = window.location.pathname;
      if (path.includes("reports")) {
          window.location.href = "/";
      }
    }
  },

  _disableControls() {
    const modeToggle = document.getElementById('modeToggle');
    const motorBtns  = document.querySelectorAll('.btn-force-on, .btn-force-off');
    if (modeToggle) modeToggle.disabled = true;
    motorBtns.forEach(btn => { btn.disabled = true; });
  },

  openLoginModal() {
    const loginModal  = document.getElementById('authLoginModal');
    const signupModal = document.getElementById('authSignupModal');
    if (loginModal)  loginModal.style.display  = 'flex';
    if (signupModal) signupModal.style.display = 'none';
    const errEl = document.getElementById('authLoginError');
    if (errEl) errEl.textContent = '';
  },

  openSignupModal() {
    const loginModal  = document.getElementById('authLoginModal');
    const signupModal = document.getElementById('authSignupModal');
    if (signupModal) signupModal.style.display = 'flex';
    if (loginModal)  loginModal.style.display  = 'none';
    const msgEl = document.getElementById('authSignupMsg');
    if (msgEl) msgEl.textContent = '';
  },

  closeAuthModals() {
    const loginModal  = document.getElementById('authLoginModal');
    const signupModal = document.getElementById('authSignupModal');
    if (loginModal)  loginModal.style.display  = 'none';
    if (signupModal) signupModal.style.display = 'none';
  },

  async login() {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl    = document.getElementById('authLoginError');
    const btn      = document.getElementById('loginSubmitBtn');

    errEl.textContent = '';
    if (!email || !password) {
      errEl.textContent = 'Please enter email and password.';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Logging in…';

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        this.token = data.data.token;
        this.role  = data.data.user.role;
        this.user  = data.data.user;
        localStorage.setItem('wt_token', this.token);
        localStorage.setItem('wt_role',  this.role);
        localStorage.setItem('wt_user',  JSON.stringify(this.user));
        this.closeAuthModals();
        this._onLoggedIn();
      } else {
        errEl.textContent = data.error || 'Login failed.';
      }
    } catch {
      errEl.textContent = 'Server error. Check your connection.';
    }

    btn.disabled    = false;
    btn.textContent = 'Login';
  },

  async register() {
    const name     = document.getElementById('signupName').value.trim();
    const email    = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const role     = document.getElementById('signupRole').value;
    const msgEl    = document.getElementById('authSignupMsg');
    const btn      = document.getElementById('signupSubmitBtn');

    msgEl.textContent = '';

    // Common validation
    if (!name || !email || !password) {
      msgEl.style.color = '#c0392b';
      msgEl.textContent = 'Name, Email, and Password are required.';
      return;
    }

    // Role-specific validation
    if (role === 'STUDENT') {
      if (!document.getElementById('regNumber').value || !document.getElementById('branch').value || !document.getElementById('batch').value || !document.getElementById('idCard').files[0]) {
        msgEl.style.color = '#c0392b';
        msgEl.textContent = 'All student fields including ID Card upload are required.';
        return;
      }
    }
    if (role === 'WARDEN') {
      if (!document.getElementById('hostelNumber').value || !document.getElementById('tankCount').value || !document.getElementById('wardenPhoto').files[0]) {
        msgEl.style.color = '#c0392b';
        msgEl.textContent = 'Hostel number, tank count, and photo are required.';
        return;
      }
    }

    btn.disabled    = true;
    btn.textContent = 'Registering\u2026';

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("role", role);

    if (role === 'STUDENT') {
      formData.append("regNumber", document.getElementById("regNumber").value.trim());
      formData.append("branch", document.getElementById("branch").value.trim());
      formData.append("batch", document.getElementById("batch").value.trim());
      formData.append("idCard", document.getElementById("idCard").files[0]);
    }
    if (role === 'WARDEN') {
      formData.append("hostelNumber", document.getElementById("hostelNumber").value.trim());
      formData.append("tankCount", document.getElementById("tankCount").value.trim());
      formData.append("idCard", document.getElementById("wardenPhoto").files[0]);
    }

    try {
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        // Note: Do not set Content-Type header when sending FormData!
        body:    formData,
      });
      const data = await res.json();

      if (data.success) {
        msgEl.style.color = '#27ae60';
        msgEl.textContent = '\u2705 Registered! Awaiting admin approval before you can login.';
        document.getElementById('signupName').value     = '';
        document.getElementById('signupEmail').value    = '';
        document.getElementById('signupPassword').value = '';
        // Reset student fields
        document.getElementById('regNumber').value = '';
        document.getElementById('branch').value = '';
        document.getElementById('batch').value = '';
        document.getElementById('idCard').value = '';
        // Reset warden fields
        document.getElementById('hostelNumber').value = '';
        document.getElementById('tankCount').value = '';
        document.getElementById('wardenPhoto').value = '';
      } else {
        msgEl.style.color = '#c0392b';
        msgEl.textContent = data.error || 'Registration failed.';
      }
    } catch {
      msgEl.style.color = '#c0392b';
      msgEl.textContent = 'Server error. Check your connection.';
    }

    btn.disabled    = false;
    btn.textContent = 'Register';
  },

  logout() {
    localStorage.removeItem('wt_token');
    localStorage.removeItem('wt_role');
    localStorage.removeItem('wt_user');
    location.reload();
  },
};

window.AUTH           = AUTH;
window.getAuthHeaders = () => AUTH.getHeaders();

document.addEventListener('DOMContentLoaded', () => AUTH.init());

// ─── Role-based signup field toggle ───────────────────────────────────────────
function handleRoleChange() {
    const role = document.getElementById('signupRole').value;
    const studentFields = document.getElementById('studentFields');
    const wardenFields  = document.getElementById('wardenFields');

    if (role === 'WARDEN') {
        studentFields.style.display = 'none';
        wardenFields.style.display  = 'block';
    } else {
        studentFields.style.display = 'block';
        wardenFields.style.display  = 'none';
    }
}