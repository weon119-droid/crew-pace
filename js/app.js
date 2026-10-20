import { supabase } from './supabaseClient.js';
import { getSession, getCurrentProfile, signOut } from './auth.js';

export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Universal Navigation Renderer
 */
export async function renderNav() {
  const navContainer = document.getElementById('site-nav');
  if (!navContainer) return;

  const profile = await getCurrentProfile();

  if (!profile) {
    navContainer.innerHTML = `
      <button id="btn-open-login" class="btn btn-primary btn-sm">크루 로그인</button>
    `;
    const btn = document.getElementById('btn-open-login');
    if (btn) btn.addEventListener('click', () => {
      const modal = document.getElementById('login-modal');
      if (modal) modal.style.display = 'flex';
    });
    return;
  }

  const isAdmin = profile.role === 'admin';
  const isMember = profile.role === 'member' || isAdmin;

  navContainer.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.6rem;">
      ${isMember ? `<a href="new-post.html" class="btn btn-primary btn-sm">+ 라이딩/글 작성</a>` : ''}
      ${isAdmin ? `<a href="admin.html" class="btn btn-secondary btn-sm" style="color:var(--accent-orange); border-color:var(--accent-orange);">운영진 관리</a>` : ''}
      <div class="user-pill">
        ${profile.avatar_url ? `
          <img src="${profile.avatar_url}" class="user-avatar" />
        ` : `
          <div class="user-avatar" style="display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">
            ${(profile.name || 'U').charAt(0).toUpperCase()}
          </div>
        `}
        <span style="font-weight:700;">${escapeHtml(profile.name || '라이더')}</span>
        <span class="badge ${profile.role === 'admin' ? 'badge-status-admin' : profile.role === 'member' ? 'badge-status-member' : 'badge-status-pending'}" style="font-size:0.65rem;">
          ${profile.role.toUpperCase()}
        </span>
      </div>
      <button id="btn-logout" class="btn btn-secondary btn-sm" style="padding:0.35rem 0.6rem;">
        로그아웃
      </button>
    </div>
  `;

  document.getElementById('btn-logout').addEventListener('click', signOut);

  // Show pending alert banner if not approved
  if (profile.role === 'pending') {
    const bannerContainer = document.getElementById('pending-banner');
    if (bannerContainer) {
      bannerContainer.innerHTML = `
        <div class="alert-banner">
          <div>
            <strong>🚴 가입 승인 대기 중 (PENDING)</strong>
            <p style="color:var(--text-muted); margin-top:0.25rem;">
              현재 공지사항 열람만 가능합니다. 크루 운영진의 승인 후 라이딩 참석 신청 및 게시글 작성이 가능합니다.
            </p>
          </div>
          <span class="badge badge-status-pending">대기회원</span>
        </div>
      `;
    }
  }
}

/**
 * Main Feed Loader
 */
let currentCategory = 'all';
let posts = [];
let userProfile = null;

export async function initFeed() {
  userProfile = await getCurrentProfile();
  await renderNav();

  setupFilterTabs();
  await loadPosts();
}

function setupFilterTabs() {
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      renderPosts();
    });
  });
}

export async function loadPosts() {
  const feed = document.getElementById('posts-feed');
  if (!feed) return;

  feed.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted);">라이딩 피드 로딩 중...</div>`;

  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles(id, name, avatar_url, role),
        participations(
          user_id,
          user:profiles(id, name, avatar_url)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    posts = data || [];
    renderPosts();
  } catch (err) {
    console.error('Fetch posts error:', err);
    feed.innerHTML = `
      <div style="text-align:center; padding:2rem; background:var(--bg-surface); border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
        <p style="color:var(--accent-red); margin-bottom:0.5rem;">게시글을 불러올 수 없습니다.</p>
        <p style="color:var(--text-muted); font-size:0.85rem;">비회원 상태이거나 승인 대기 중인 경우 공지사항 외 글은 열람이 제한됩니다.</p>
      </div>
    `;
  }
}

function formatDatetime(dateStr) {
  if (!dateStr) return '미정';
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const date = d.getDate();
  const dayName = ['일','월','화','수','목','금','토'][d.getDay()];
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${date}(${dayName}) ${h}:${min}`;
}

function renderPosts() {
  const feed = document.getElementById('posts-feed');
  if (!feed) return;

  const filtered = posts.filter(p => {
    if (currentCategory === 'all') return true;
    return p.category === currentCategory;
  });

  if (filtered.length === 0) {
    feed.innerHTML = `
      <div style="text-align:center; padding:3.5rem; background:var(--bg-surface); border:1px dashed var(--border-medium); border-radius:var(--radius-sm); color:var(--text-muted);">
        <p style="font-size:1.1rem; font-weight:700; margin-bottom:0.4rem;">등록된 글이 없습니다.</p>
        <p style="font-size:0.85rem;">새로운 라이딩 번개나 공지를 작성해 보세요!</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = filtered.map(post => {
    const isRiding = post.category === 'riding';
    const isNotice = post.category === 'notice';
    const participants = post.participations || [];
    const count = participants.length;
    const max = post.max_participants || 10;
    const isFull = isRiding && count >= max;
    const isJoined = participants.some(p => p.user_id === userProfile?.id);
    const canJoin = userProfile && (userProfile.role === 'member' || userProfile.role === 'admin');
    const canDelete = userProfile && (userProfile.id === post.author_id || userProfile.role === 'admin');

    return `
      <article class="post-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${isNotice ? '<span class="badge badge-notice">📢 공지사항</span>' : ''}
            ${isRiding ? '<span class="badge badge-riding">🚴 라이딩 세션</span>' : ''}
            ${post.category === 'general' ? '<span class="badge badge-general">💬 자유 게시판</span>' : ''}
            <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-main);">${escapeHtml(post.title)}</h3>
          </div>
          ${canDelete ? `
            <button class="btn btn-secondary btn-sm btn-delete-post" data-id="${post.id}" style="color:var(--accent-red); font-size:0.75rem; padding:0.2rem 0.5rem;">
              삭제
            </button>
          ` : ''}
        </div>

        ${isRiding ? `
          <div class="riding-telemetry font-mono">
            <div class="telemetry-item">
              <span class="telemetry-label">출발 일시</span>
              <span class="telemetry-value">${formatDatetime(post.riding_date)}</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">집결 장소</span>
              <span class="telemetry-value" style="font-family:var(--font-sans);">${escapeHtml(post.location || '미정')}</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">목표 평속</span>
              <span class="telemetry-value highlight">${escapeHtml(post.target_pace || '자율')}</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">코스 거리</span>
              <span class="telemetry-value">${post.distance_km ? `${post.distance_km} km` : '자율'}</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">모집 현황</span>
              <span class="telemetry-value ${isFull ? '' : 'highlight'}">${count} / ${max}명 ${isFull ? '(마감)' : ''}</span>
            </div>
          </div>
        ` : ''}

        <div style="white-space:pre-wrap; line-height:1.6; font-size:0.92rem; color:var(--text-main);">
          ${escapeHtml(post.content)}
        </div>

        ${isRiding ? `
          <div style="border-top:1px solid var(--border-subtle); padding-top:0.75rem; margin-top:0.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <span style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
                참석 라이더 (${count}명)
              </span>
              ${canJoin ? `
                <button class="btn ${isJoined ? 'btn-secondary' : 'btn-primary'} btn-sm btn-join-toggle" data-id="${post.id}" data-joined="${isJoined}">
                  ${isJoined ? '✕ 참석 취소' : isFull ? '정원 마감' : '🚴 지금 참석 신청'}
                </button>
              ` : ''}
            </div>
            <div class="participant-pills">
              ${participants.length === 0 ? '<span style="font-size:0.78rem; color:var(--text-dim);">가장 먼저 첫 번째 라이더로 참가해 보세요!</span>' : ''}
              ${participants.map(p => `
                <span class="participant-chip">
                  <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--accent-orange);"></span>
                  ${escapeHtml(p.user?.name || '라이더')}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.78rem; color:var(--text-dim); margin-top:0.25rem;">
          <span style="font-weight:700; color:var(--text-muted);">${escapeHtml(post.author?.name || '크루원')}</span>
          <span>·</span>
          <span>${new Date(post.created_at).toLocaleDateString()}</span>
        </div>
      </article>
    `;
  }).join('');

  // Attach join/cancel handlers
  document.querySelectorAll('.btn-join-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.id;
      const joined = btn.dataset.joined === 'true';
      await toggleParticipation(postId, joined);
    });
  });

  // Attach delete handlers
  document.querySelectorAll('.btn-delete-post').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.id;
      if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (!error) {
        showToast('게시글이 삭제되었습니다.', 'info');
        await loadPosts();
      }
    });
  });
}

async function toggleParticipation(postId, isCurrentlyJoined) {
  try {
    if (isCurrentlyJoined) {
      const { error } = await supabase
        .from('participations')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userProfile.id);
      if (error) throw error;
      showToast('참석이 취소되었습니다.', 'info');
    } else {
      const { error } = await supabase
        .from('participations')
        .insert({
          post_id: postId,
          user_id: userProfile.id
        });
      if (error) throw error;
      showToast('참석 신청이 완료되었습니다! 🚴', 'success');
    }
    await loadPosts();
  } catch (err) {
    showToast('오류: ' + err.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
