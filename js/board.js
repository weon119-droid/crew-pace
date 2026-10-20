import { supabase } from './supabaseClient.js';
import { requireAuthGuard, showToast } from './guard.js';

let currentCategory = 'ALL';
let allPosts = [];
let currentProfile = null;

async function initBoard() {
  const authData = await requireAuthGuard();
  if (!authData) return;
  currentProfile = authData.profile;

  setupTabs();
  await loadPosts();
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      renderPosts();
    });
  });
}

async function loadPosts() {
  const listContainer = document.getElementById('post-list');
  listContainer.innerHTML = `
    <div style="text-align:center; padding: 2.5rem; color: var(--text-muted); font-size: 0.9rem;">
      러닝 세션 및 피드 불러오는 중...
    </div>
  `;

  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles!posts_author_id_fkey(id, full_name, avatar_url, crew_bib_number, role),
        participants:session_participants(user_id)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    allPosts = data || [];
    renderPosts();
  } catch (err) {
    console.error('Failed to load posts:', err);
    listContainer.innerHTML = `
      <div style="text-align:center; padding: 2rem; color: var(--accent-red);">
        게시글을 불러오지 못했습니다: ${err.message}
      </div>
    `;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[d.getDay()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day}(${dayName}) ${hours}:${minutes}`;
}

function formatRelativeTime(dateStr) {
  const d = new Date(dateStr);
  const diffSec = Math.floor((new Date() - d) / 1000);
  if (diffSec < 60) return '방금 전';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  return `${Math.floor(diffSec / 86400)}일 전`;
}

function renderPosts() {
  const listContainer = document.getElementById('post-list');
  
  const filtered = allPosts.filter(p => {
    if (currentCategory === 'ALL') return true;
    return p.category === currentCategory;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center; padding: 3rem; background: var(--bg-surface); border: 1px dashed var(--border-medium); border-radius: var(--radius-sm); color: var(--text-muted);">
        <p style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;">등록된 게시글이 없습니다.</p>
        <p style="font-size: 0.85rem;">새로운 정기 러닝이나 번개 세션을 열어보세요!</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filtered.map(post => {
    const isSession = post.category === 'RUN_SESSION';
    const isNotice = post.category === 'NOTICE';
    const participantCount = post.participants ? post.participants.length : 0;
    const isFull = isSession && post.max_participants > 0 && participantCount >= post.max_participants;
    const isJoined = isSession && post.participants?.some(p => p.user_id === currentProfile?.id);

    return `
      <article class="post-item" onclick="location.href='post.html?id=${post.id}'">
        <div class="post-item-header">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${isNotice ? '<span class="badge badge-notice">공지</span>' : ''}
            ${isSession ? '<span class="badge badge-session">🏃 정기/번개 러닝</span>' : ''}
            ${post.category === 'FREE_TALK' ? '<span class="badge badge-free">💬 크루 톡</span>' : ''}
            <h2 class="post-item-title">${escapeHtml(post.title)}</h2>
          </div>
          ${isSession ? `
            <span class="badge ${isFull ? 'badge-status-rejected' : 'badge-status-approved'} font-mono">
              ${isFull ? '모집 마감' : `모집 중 (${participantCount}/${post.max_participants || 15}명)`}
            </span>
          ` : ''}
        </div>

        ${isSession ? `
          <div class="session-metrics">
            <div class="metric-unit">
              <span class="metric-label">일시</span>
              <span class="metric-val font-mono">${formatDate(post.run_date)}</span>
            </div>
            <div class="metric-unit">
              <span class="metric-label">집결 장소</span>
              <span class="metric-val" title="${escapeHtml(post.location || '')}">${escapeHtml(post.location || '미정')}</span>
            </div>
            <div class="metric-unit">
              <span class="metric-label">목표 페이스</span>
              <span class="metric-val highlight font-mono">${escapeHtml(post.target_pace || '자율')}</span>
            </div>
            <div class="metric-unit">
              <span class="metric-label">예상 거리</span>
              <span class="metric-val font-mono">${post.distance_km ? `${post.distance_km} km` : '자율'}</span>
            </div>
            <div class="metric-unit">
              <span class="metric-label">참가 상태</span>
              <span class="metric-val ${isJoined ? 'highlight' : ''}">
                ${isJoined ? '✓ 참가 완료' : '미신청'}
              </span>
            </div>
          </div>
        ` : `
          <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.45; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${escapeHtml(post.content)}
          </p>
        `}

        <div class="post-item-meta" style="margin-top: 0.25rem;">
          <span style="font-weight: 600; color: var(--text-secondary);">
            ${escapeHtml(post.author?.full_name || '크루원')}
            ${post.author?.crew_bib_number ? `<span class="font-mono" style="color: var(--accent-lime); font-size:0.75rem;">(#${post.author.crew_bib_number})</span>` : ''}
          </span>
          <span>·</span>
          <span>${formatRelativeTime(post.created_at)}</span>
        </div>
      </article>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', initBoard);
