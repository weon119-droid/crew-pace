import { getSession, getCurrentProfile, signOut } from './auth.js';

/**
 * Toast Notification Helper
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease-in';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

/**
 * Renders universal header navigation
 */
export function renderHeader(profile) {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const isAdmin = profile?.role === 'ADMIN';
  const isApproved = profile?.status === 'APPROVED';

  header.innerHTML = `
    <div class="container header-inner">
      <a href="board.html" class="brand-logo">
        <span>CREW PACE</span>
        <span class="brand-badge">RUN CLUB</span>
      </a>

      <div class="header-nav">
        ${profile ? `
          <a href="board.html" class="btn btn-ghost btn-sm">러닝 보드</a>
          ${isApproved ? `<a href="write.html" class="btn btn-primary btn-sm">+ 모임/글 등록</a>` : ''}
          ${isAdmin ? `<a href="admin.html" class="btn btn-secondary btn-sm" style="border-color: var(--accent-lime); color: var(--accent-lime);">운영진 콘솔</a>` : ''}

          <div class="user-menu">
            ${profile.avatar_url ? `
              <img src="${profile.avatar_url}" alt="${profile.full_name || 'Runner'}" class="user-avatar" onerror="this.src='https://api.dicebear.com/7.x/identicon/svg?seed=${profile.id}'" />
            ` : `
              <div class="user-avatar font-mono" style="display:flex;align-items:center;justify-content:center;background:var(--border-bold);font-size:0.75rem;">
                ${(profile.full_name || 'U').charAt(0).toUpperCase()}
              </div>
            `}
            <div class="user-info">
              <span class="user-name">${profile.full_name || '크루원'}</span>
              <span class="user-role-badge">[${profile.role}]</span>
            </div>
            <button id="btn-logout" class="btn btn-ghost btn-sm" title="로그아웃" style="padding: 0.3rem 0.5rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        ` : `
          <a href="index.html" class="btn btn-primary btn-sm">로그인</a>
        `}
      </div>
    </div>
  `;

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut();
    });
  }
}

/**
 * Renders warning banner if user account is PENDING approval
 */
export function checkPendingBanner(profile) {
  if (!profile) return;
  if (profile.status === 'PENDING') {
    const main = document.querySelector('main');
    if (main) {
      const banner = document.createElement('div');
      banner.className = 'container';
      banner.innerHTML = `
        <div class="alert-banner" style="margin-top: 1rem;">
          <div>
            <strong>🔒 크루 운영진의 승인 대기 중입니다.</strong>
            <p>신규 가입자는 비인가 어뷰징 방지를 위해 운영진 승인 후 러닝 모임 참가 및 글/댓글 작성이 가능합니다. 공지사항은 즉시 열람하실 수 있습니다.</p>
          </div>
          <span class="badge badge-status-pending">GUEST / PENDING</span>
        </div>
      `;
      main.insertBefore(banner, main.firstChild);
    }
  } else if (profile.status === 'REJECTED') {
    const main = document.querySelector('main');
    if (main) {
      const banner = document.createElement('div');
      banner.className = 'container';
      banner.innerHTML = `
        <div class="alert-banner" style="margin-top: 1rem; border-left-color: var(--accent-red); background: rgba(239,68,68,0.1);">
          <div>
            <strong style="color: #f87171;">⚠️ 가입이 반려되거나 활동이 제한된 계정입니다.</strong>
            <p>크루 운영진에 문의해 주세요.</p>
          </div>
          <span class="badge badge-status-rejected">REJECTED</span>
        </div>
      `;
      main.insertBefore(banner, main.firstChild);
    }
  }
}

/**
 * Route protection guard
 */
export async function requireAuthGuard(options = {}) {
  const { requireAdmin = false, requireMember = false } = options;
  const session = await getSession();

  if (!session) {
    window.location.href = '/index.html';
    return null;
  }

  const profile = await getCurrentProfile();

  if (requireAdmin && profile?.role !== 'ADMIN') {
    alert('운영진(ADMIN) 권한이 필요한 페이지입니다.');
    window.location.href = '/board.html';
    return null;
  }

  if (requireMember && (profile?.role === 'GUEST' || profile?.status !== 'APPROVED')) {
    alert('크루 운영진의 가입 승인 후 이용할 수 있는 기능입니다.');
    window.location.href = '/board.html';
    return null;
  }

  renderHeader(profile);
  checkPendingBanner(profile);

  return { session, profile };
}
