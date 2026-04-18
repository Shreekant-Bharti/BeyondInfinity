'use strict';

const ADMIN = {

  _pendingReject: null,

  _showMsg(text, type) {
    const el = document.getElementById('adminStatusMsg');
    if (!el) return;
    el.className   = type;
    el.textContent = text;
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => {
      el.className     = '';
      el.textContent   = '';
      el.style.display = 'none';
    }, 4000);
  },

  _formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  _renderTable(users) {
    const tbody      = document.getElementById('adminUserTableBody');
    const emptyState = document.getElementById('adminEmptyState');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!users || users.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    users.forEach((user, idx) => {
      const statusClass = 'admin-status-' + user.status.toLowerCase();
      const roleClass   = 'admin-role-'   + user.role.toLowerCase();
      const isPending   = user.status === 'PENDING';
      const reasonCell  = user.rejectionReason
        ? `<br><small style="color:#c0392b;font-size:11px">Reason: ${user.rejectionReason}</small>`
        : '';

      const tr = document.createElement('tr');
      tr.id    = 'admin-row-' + user._id;
      
      const idCardContent = user.idCardUrl ? `<img src="/uploads/${user.idCardUrl}" width="120" style="border-radius:4px; border: 1px solid #ccc;" alt="ID Card"/>` : '<span style="color:#aaa;">No ID</span>';
      
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${user.name}</strong></td>
        <td style="color:#1a3a6b">${user.email}</td>
        <td>${user.regNumber || '—'}</td>
        <td>${user.branch || '—'}</td>
        <td>${user.batch || '—'}</td>
        <td>${idCardContent}</td>
        <td><span class="admin-role-badge ${roleClass}">${user.role}</span></td>
        <td><span class="admin-status-badge ${statusClass}">${user.status}</span>${reasonCell}</td>
        <td>${this._formatDate(user.createdAt)}</td>
        <td>
          <button class="admin-btn-approve" onclick="ADMIN.action('${user._id}','APPROVE')" ${!isPending ? 'disabled' : ''}>
            <i class="fa-solid fa-check"></i> Approve
          </button>
          <button class="admin-btn-reject" onclick="ADMIN.openRejectModal('${user._id}')" ${!isPending ? 'disabled' : ''}>
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  _updatePendingBadge(users) {
    const tab = document.getElementById('tabUserMgmt');
    if (!tab) return;
    const existing = tab.querySelector('.admin-pending-badge');
    if (existing) existing.remove();

    const pending = (users || []).filter(u => u.status === 'PENDING').length;
    if (pending > 0) {
      const badge       = document.createElement('span');
      badge.className   = 'admin-pending-badge';
      badge.textContent = pending;
      tab.appendChild(badge);
    }
  },

  openRejectModal(userId) {
    this._pendingReject = userId;
    const modal  = document.getElementById('rejectReasonModal');
    const input  = document.getElementById('rejectReasonInput');
    const errEl  = document.getElementById('rejectReasonError');
    if (modal)  modal.style.display = 'flex';
    if (input)  input.value         = '';
    if (errEl)  errEl.textContent   = '';
    if (input)  setTimeout(() => input.focus(), 100);
  },

  closeRejectModal() {
    this._pendingReject = null;
    const modal = document.getElementById('rejectReasonModal');
    if (modal) modal.style.display = 'none';
  },

  async confirmReject() {
    const input  = document.getElementById('rejectReasonInput');
    const errEl  = document.getElementById('rejectReasonError');
    const btn    = document.getElementById('rejectConfirmBtn');
    const reason = input ? input.value.trim() : '';

    if (!reason) {
      if (errEl) errEl.textContent = 'Please enter a reason for rejection.';
      if (input) input.focus();
      return;
    }

    if (!this._pendingReject) return;

    btn.disabled    = true;
    btn.textContent = 'Rejecting…';

    await this.action(this._pendingReject, 'REJECT', reason);

    btn.disabled    = false;
    btn.textContent = 'Confirm Rejection';
    this.closeRejectModal();
  },

  async load() {
    const role = localStorage.getItem('wt_role');
    if (role !== 'ADMIN') return;

    const filterEl = document.getElementById('adminFilterStatus');
    const status   = filterEl ? filterEl.value : 'PENDING';
    const url      = '/api/admin/users' + (status ? `?status=${status}` : '');

    try {
      const res  = await fetch(url, { headers: window.getAuthHeaders() });
      const data = await res.json();

      if (!data.success) {
        this._showMsg('Failed to load users: ' + (data.error || 'Unknown error'), 'error');
        return;
      }

      this._renderTable(data.data);

      const allRes  = await fetch('/api/admin/users', { headers: window.getAuthHeaders() });
      const allData = await allRes.json();
      if (allData.success) this._updatePendingBadge(allData.data);

    } catch {
      this._showMsg('Network error. Could not load user list.', 'error');
    }
  },

  async action(userId, action, reason) {
    const approveBtns = document.querySelectorAll(`#admin-row-${userId} .admin-btn-approve`);
    const rejectBtns  = document.querySelectorAll(`#admin-row-${userId} .admin-btn-reject`);
    approveBtns.forEach(b => { b.disabled = true; });
    rejectBtns.forEach(b  => { b.disabled = true; });

    try {
      const body = { userId, action };
      if (reason) body.reason = reason;

      const res  = await fetch('/api/admin/approve', {
        method:  'POST',
        headers: window.getAuthHeaders(),
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        const verb = action === 'APPROVE' ? 'approved' : 'rejected';
        this._showMsg(`✅ User ${data.data.email} has been ${verb} successfully.`, 'success');
        this.load();
      } else {
        this._showMsg('Action failed: ' + (data.error || 'Unknown error'), 'error');
        approveBtns.forEach(b => { b.disabled = false; });
        rejectBtns.forEach(b  => { b.disabled = false; });
      }
    } catch {
      this._showMsg('Network error. Please try again.', 'error');
      approveBtns.forEach(b => { b.disabled = false; });
      rejectBtns.forEach(b  => { b.disabled = false; });
    }
  },

  init() {
    const role   = localStorage.getItem('wt_role');
    const tabBtn = document.getElementById('tabUserMgmt');
    if (!tabBtn) return;

    if (role === 'ADMIN') {
      tabBtn.style.display = 'block';
      tabBtn.addEventListener('click', () => {
        if (document.getElementById('tab-admin').classList.contains('active')) return;
        this.load();
      });
      this.load();
    }
  },
};

window.ADMIN = ADMIN;

document.addEventListener('DOMContentLoaded', () => {
  const role = localStorage.getItem('wt_role');
  if (role === 'ADMIN') {
    ADMIN.init();
  } else {
    const observer = new MutationObserver(() => {
      const r = localStorage.getItem('wt_role');
      if (r === 'ADMIN') {
        observer.disconnect();
        ADMIN.init();
      }
    });
    const userInfo = document.getElementById('authUserInfo');
    if (userInfo) observer.observe(userInfo, { attributes: true, attributeFilter: ['style'] });
  }
});