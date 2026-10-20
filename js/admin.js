import { supabase } from './supabaseClient.js';
import { requireAuthGuard, showToast } from './guard.js';

let currentProfile = null;
let allUsers = [];

async function initAdmin() {
  const authData = await requireAuthGuard({ requireAdmin: true });
  if (!authData) return;
  currentProfile = authData.profile;

  await loadUsers();
}

async function loadUsers() {
  const tableBody = document.getElementById('user-table-body');
  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">사용자 명단 로딩 중...</td></tr>`;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('회원 목록 조회 실패: ' + error.message, 'error');
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--accent-red);">오류 발생: ${error.message}</td></tr>`;
    return;
  }

  // Sort so PENDING users appear at the very top
  allUsers = (data || []).sort((a, b) => {
    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
    if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  updateStats();
  renderUsers();
}

function updateStats() {
  const totalElem = document.getElementById('stat-total');
  const pendingElem = document.getElementById('stat-pending');
  const memberElem = document.getElementById('stat-member');
  const adminElem = document.getElementById('stat-admin');

  if (totalElem) totalElem.textContent = allUsers.length;
  if (pendingElem) pendingElem.textContent = allUsers.filter(u => u.status === 'PENDING').length;
  if (memberElem) memberElem.textContent = allUsers.filter(u => u.role === 'MEMBER' && u.status === 'APPROVED').length;
  if (adminElem) adminElem.textContent = allUsers.filter(u => u.role === 'ADMIN').length;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function renderUsers() {
  const tableBody = document.getElementById('user-table-body');

  if (allUsers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">가입된 사용자가 없습니다.</td></tr>`;
    return;
  }

  tableBody.innerHTML = allUsers.map(user => {
    const isSelf = user.id === currentProfile.id;
    const isPending = user.status === 'PENDING';

    let statusBadge = '';
    if (user.status === 'APPROVED') statusBadge = '<span class="badge badge-status-approved">승인됨 (APPROVED)</span>';
    else if (user.status === 'PENDING') statusBadge = '<span class="badge badge-status-pending">승인 대기 (PENDING)</span>';
    else statusBadge = '<span class="badge badge-status-rejected">반려/차단 (REJECTED)</span>';

    let roleBadge = '';
    if (user.role === 'ADMIN') roleBadge = '<span class="badge badge-notice">ADMIN</span>';
    else if (user.role === 'MEMBER') roleBadge = '<span class="badge badge-session">MEMBER</span>';
    else roleBadge = '<span class="badge font-mono" style="background:var(--border-subtle); color:var(--text-muted);">GUEST</span>';

    return `
      <tr style="${isPending ? 'background: rgba(234, 179, 8, 0.05);' : ''}">
        <td>
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <div style="width:28px; height:28px; border-radius:var(--radius-full); background:var(--border-medium); overflow:hidden; display:flex; align-items:center; justify-content:center;">
              ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover;" />` : (user.full_name || 'U').charAt(0)}
            </div>
            <div>
              <div style="font-weight:700;">${escapeHtml(user.full_name || '크루원')} ${isSelf ? '<span style="font-size:0.7rem; color:var(--accent-lime);">(나)</span>' : ''}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${escapeHtml(user.email)}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <input type="text" 
                   value="${escapeHtml(user.crew_bib_number || '')}" 
                   placeholder="배번 미지정" 
                   class="form-input font-mono" 
                   style="padding:0.25rem 0.5rem; font-size:0.8rem; width:100px;" 
                   id="bib-${user.id}" />
            <button class="btn btn-secondary btn-sm btn-save-bib" data-uid="${user.id}" style="padding:0.25rem 0.45rem;">
              저장
            </button>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td class="font-mono" style="font-size:0.78rem; color:var(--text-muted);">${formatDate(user.created_at)}</td>
        <td>
          ${isSelf ? '<span style="font-size:0.78rem; color:var(--text-muted);">본인 계정</span>' : `
            <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
              ${isPending || user.status !== 'APPROVED' ? `
                <button class="btn btn-primary btn-sm btn-action" data-uid="${user.id}" data-role="MEMBER" data-status="APPROVED">
                  ✓ 승인 (MEMBER)
                </button>
              ` : ''}
              ${user.role !== 'ADMIN' ? `
                <button class="btn btn-secondary btn-sm btn-action" data-uid="${user.id}" data-role="ADMIN" data-status="APPROVED">
                  운영진 임명
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm btn-action" data-uid="${user.id}" data-role="MEMBER" data-status="APPROVED">
                  일반 멤버로 강등
                </button>
              `}
              ${user.status !== 'REJECTED' ? `
                <button class="btn btn-danger btn-sm btn-action" data-uid="${user.id}" data-role="GUEST" data-status="REJECTED">
                  반려/차단
                </button>
              ` : ''}
            </div>
          `}
        </td>
      </tr>
    `;
  }).join('');

  // Attach Action Handlers
  document.querySelectorAll('.btn-action').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const uid = btn.dataset.uid;
      const role = btn.dataset.role;
      const status = btn.dataset.status;
      await updateUserStatus(uid, role, status);
    });
  });

  // Attach Bib Save Handlers
  document.querySelectorAll('.btn-save-bib').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const uid = btn.dataset.uid;
      const input = document.getElementById(`bib-${uid}`);
      const newBib = input.value.trim();
      await updateBibNumber(uid, newBib);
    });
  });
}

async function updateUserStatus(userId, role, status) {
  try {
    const { error } = await supabase.rpc('admin_set_user_status', {
      target_user_id: userId,
      new_role: role,
      new_status: status
    });

    if (error) throw error;
    showToast(`권한/상태가 성공적으로 변경되었습니다. (${role} / ${status})`, 'success');
    await loadUsers();
  } catch (err) {
    console.error('Update status error:', err);
    showToast('상태 변경 실패: ' + err.message, 'error');
  }
}

async function updateBibNumber(userId, bib) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ crew_bib_number: bib })
      .eq('id', userId);

    if (error) throw error;
    showToast('배번/닉네임이 저장되었습니다.', 'success');
  } catch (err) {
    showToast('배번 저장 실패: ' + err.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', initAdmin);
