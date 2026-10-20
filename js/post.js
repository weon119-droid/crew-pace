import { supabase } from './supabaseClient.js';
import { requireAuthGuard, showToast } from './guard.js';

let currentProfile = null;
let currentPost = null;
let participants = [];
let comments = [];

async function initPostDetail() {
  const authData = await requireAuthGuard();
  if (!authData) return;
  currentProfile = authData.profile;

  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id');

  if (!postId) {
    alert('올바르지 않은 게시글 ID입니다.');
    window.location.href = 'board.html';
    return;
  }

  await loadPostDetail(postId);
  await loadParticipants(postId);
  await loadComments(postId);
  setupCommentForm(postId);
}

async function loadPostDetail(postId) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, full_name, avatar_url, crew_bib_number, role)
    `)
    .eq('id', postId)
    .single();

  if (error || !data) {
    alert('게시글을 찾을 수 없거나 삭제되었습니다.');
    window.location.href = 'board.html';
    return;
  }

  currentPost = data;
  renderPostHeaderAndBody();
}

function formatDateFull(dateStr) {
  if (!dateStr) return '미정';
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[d.getDay()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}.${month}.${day} (${dayName}) ${hours}:${minutes}`;
}

function renderPostHeaderAndBody() {
  const headerElem = document.getElementById('post-header');
  const bodyElem = document.getElementById('post-body');
  const sessionBox = document.getElementById('post-session-box');
  const actionArea = document.getElementById('post-owner-actions');

  const isAuthor = currentPost.author_id === currentProfile.id;
  const isAdmin = currentProfile.role === 'ADMIN';

  // Badges & Title
  let catBadge = '';
  if (currentPost.category === 'NOTICE') catBadge = '<span class="badge badge-notice">공지사항</span>';
  else if (currentPost.category === 'RUN_SESSION') catBadge = '<span class="badge badge-session">🏃 러닝 세션</span>';
  else catBadge = '<span class="badge badge-free">💬 크루 톡</span>';

  headerElem.innerHTML = `
    <div style="display:flex; align-items:center; gap: 0.5rem; margin-bottom: 0.6rem;">
      ${catBadge}
      <span class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">${formatDateFull(currentPost.created_at)}</span>
    </div>
    <h1 style="font-size: 1.6rem; font-weight: 800; line-height: 1.3; margin-bottom: 0.85rem;">${escapeHtml(currentPost.title)}</h1>
    <div style="display:flex; align-items:center; gap:0.6rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-subtle);">
      <div style="width: 28px; height: 28px; border-radius: var(--radius-full); background: var(--border-medium); display:flex; align-items:center; justify-content:center; overflow:hidden;">
        ${currentPost.author?.avatar_url ? `<img src="${currentPost.author.avatar_url}" style="width:100%;height:100%;object-fit:cover;" />` : (currentPost.author?.full_name || 'U').charAt(0)}
      </div>
      <span style="font-size: 0.88rem; font-weight: 600;">${escapeHtml(currentPost.author?.full_name || '크루원')}</span>
      ${currentPost.author?.crew_bib_number ? `<span class="badge font-mono" style="background:var(--bg-canvas); color:var(--accent-lime); border:1px solid var(--accent-lime-border);">#${currentPost.author.crew_bib_number}</span>` : ''}
    </div>
  `;

  // Owner/Admin Actions (Delete)
  if (isAuthor || isAdmin) {
    actionArea.innerHTML = `
      <button id="btn-delete-post" class="btn btn-danger btn-sm">
        게시글 삭제
      </button>
    `;
    document.getElementById('btn-delete-post').addEventListener('click', deletePost);
  }

  // Session details if category is RUN_SESSION
  if (currentPost.category === 'RUN_SESSION') {
    sessionBox.style.display = 'block';
    renderSessionBox();
  } else {
    sessionBox.style.display = 'none';
  }

  // Content
  bodyElem.innerHTML = `<div style="white-space: pre-wrap; line-height: 1.7; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(currentPost.content)}</div>`;
}

function renderSessionBox() {
  const sessionBox = document.getElementById('post-session-box');
  const isJoined = participants.some(p => p.user_id === currentProfile.id);
  const max = currentPost.max_participants || 15;
  const count = participants.length;
  const isFull = count >= max;
  const canJoin = currentProfile.status === 'APPROVED' && (currentProfile.role === 'MEMBER' || currentProfile.role === 'ADMIN');

  sessionBox.innerHTML = `
    <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-bold); border-radius: var(--radius-sm); padding: 1.25rem; margin: 1.5rem 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
        <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--accent-lime); display:flex; align-items:center; gap: 0.4rem;">
          ⚡ 러닝 모임 브리핑
        </h3>
        <span class="badge ${isFull ? 'badge-status-rejected' : 'badge-status-approved'} font-mono" style="font-size:0.8rem;">
          정원 ${count} / ${max}명 ${isFull ? '(마감)' : ''}
        </span>
      </div>

      <div class="session-metrics" style="background: var(--bg-surface); margin-bottom: 1.25rem;">
        <div class="metric-unit">
          <span class="metric-label">집결 일시</span>
          <span class="metric-val font-mono">${formatDateFull(currentPost.run_date)}</span>
        </div>
        <div class="metric-unit">
          <span class="metric-label">집결 장소</span>
          <span class="metric-val">${escapeHtml(currentPost.location || '상세 공지 참조')}</span>
        </div>
        <div class="metric-unit">
          <span class="metric-label">목표 페이스</span>
          <span class="metric-val highlight font-mono">${escapeHtml(currentPost.target_pace || '자율')}</span>
        </div>
        <div class="metric-unit">
          <span class="metric-label">예상 거리</span>
          <span class="metric-val font-mono">${currentPost.distance_km ? `${currentPost.distance_km} km` : '자율'}</span>
        </div>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <h4 style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform:uppercase; margin-bottom: 0.5rem;">
          참석 크루원 명단 (${count}명)
        </h4>
        <div style="display:flex; flex-wrap:wrap; gap: 0.45rem;">
          ${participants.length === 0 ? '<span style="font-size:0.82rem; color:var(--text-muted);">첫 번째 러너가 되어 참석해 보세요!</span>' : ''}
          ${participants.map(p => `
            <div style="display:inline-flex; align-items:center; gap:0.4rem; background:var(--bg-canvas); border:1px solid var(--border-medium); padding: 0.25rem 0.6rem; border-radius: var(--radius-xs); font-size:0.8rem;">
              <span style="font-weight:600;">${escapeHtml(p.profile?.full_name || '크루원')}</span>
              ${p.profile?.crew_bib_number ? `<span class="font-mono" style="color:var(--accent-lime); font-size:0.75rem;">#${p.profile.crew_bib_number}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <div style="display:flex; align-items:center; gap: 0.75rem;">
        ${!canJoin ? `
          <div style="font-size:0.82rem; color: #fde047; background:rgba(234,179,8,0.1); border:1px solid rgba(234,179,8,0.3); padding:0.5rem 0.8rem; border-radius:var(--radius-xs); flex:1;">
            🔒 가입 승인(MEMBER 이상) 완료 후 참가 신청을 할 수 있습니다.
          </div>
        ` : isJoined ? `
          <button id="btn-toggle-join" class="btn btn-secondary" style="border-color:var(--accent-red); color:#fca5a5; flex: 1;">
            ✕ 참석 취소하기
          </button>
        ` : `
          <button id="btn-toggle-join" class="btn btn-primary" ${isFull ? 'disabled' : ''} style="flex: 1;">
            ${isFull ? '정원 마감되었습니다' : '⚡ 지금 참석 신청하기'}
          </button>
        `}
      </div>
    </div>
  `;

  const toggleBtn = document.getElementById('btn-toggle-join');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', handleToggleParticipation);
  }
}

async function loadParticipants(postId) {
  const { data, error } = await supabase
    .from('session_participants')
    .select(`
      user_id,
      created_at,
      profile:profiles!session_participants_user_id_fkey(id, full_name, avatar_url, crew_bib_number)
    `)
    .eq('post_id', postId);

  if (!error && data) {
    participants = data;
    if (currentPost?.category === 'RUN_SESSION') {
      renderSessionBox();
    }
  }
}

async function handleToggleParticipation() {
  const isJoined = participants.some(p => p.user_id === currentProfile.id);

  try {
    if (isJoined) {
      const { error } = await supabase
        .from('session_participants')
        .delete()
        .eq('post_id', currentPost.id)
        .eq('user_id', currentProfile.id);

      if (error) throw error;
      showToast('참석이 취소되었습니다.', 'info');
    } else {
      const max = currentPost.max_participants || 15;
      if (participants.length >= max) {
        showToast('정원이 초과되었습니다.', 'error');
        return;
      }

      const { error } = await supabase
        .from('session_participants')
        .insert({
          post_id: currentPost.id,
          user_id: currentProfile.id
        });

      if (error) throw error;
      showToast('참석 신청이 완료되었습니다! 🏃', 'success');
    }

    await loadParticipants(currentPost.id);
  } catch (err) {
    console.error('Participation error:', err);
    showToast(err.message || '참가 처리 중 오류가 발생했습니다.', 'error');
  }
}

async function deletePost() {
  if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;
  try {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', currentPost.id);

    if (error) throw error;
    showToast('게시글이 삭제되었습니다.', 'info');
    setTimeout(() => {
      window.location.href = 'board.html';
    }, 500);
  } catch (err) {
    alert('삭제 실패: ' + err.message);
  }
}

// ===== Comments Management =====
async function loadComments(postId) {
  const list = document.getElementById('comments-list');
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles!comments_author_id_fkey(id, full_name, avatar_url, crew_bib_number, role)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Load comments error:', error);
    return;
  }

  comments = data || [];
  renderComments();
}

function renderComments() {
  const list = document.getElementById('comments-list');
  const countLabel = document.getElementById('comments-count');
  if (countLabel) countLabel.textContent = comments.length;

  if (comments.length === 0) {
    list.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); padding: 1rem 0;">첫 번째 댓글을 남겨보세요.</p>`;
    return;
  }

  list.innerHTML = comments.map(c => {
    const canDelete = c.author_id === currentProfile.id || currentProfile.role === 'ADMIN';
    return `
      <div style="padding: 0.85rem 0; border-bottom: 1px solid var(--border-subtle); display:flex; gap:0.75rem;">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 0.35rem;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span style="font-size:0.85rem; font-weight:700;">${escapeHtml(c.author?.full_name || '크루원')}</span>
              ${c.author?.crew_bib_number ? `<span class="badge font-mono" style="font-size:0.68rem; background:var(--bg-canvas); color:var(--accent-lime); border:1px solid var(--border-subtle);">#${c.author.crew_bib_number}</span>` : ''}
              <span style="font-size:0.75rem; color:var(--text-muted);">${formatDateFull(c.created_at)}</span>
            </div>
            ${canDelete ? `
              <button class="btn btn-ghost btn-sm btn-delete-comment" data-cid="${c.id}" style="color:var(--accent-red); font-size:0.75rem; padding:0.1rem 0.4rem;">
                삭제
              </button>
            ` : ''}
          </div>
          <div style="font-size:0.88rem; line-height:1.5; color:var(--text-primary); white-space:pre-wrap;">${escapeHtml(c.content)}</div>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.btn-delete-comment').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const cid = e.target.dataset.cid;
      if (!confirm('댓글을 삭제하시겠습니까?')) return;
      const { error } = await supabase.from('comments').delete().eq('id', cid);
      if (!error) {
        showToast('댓글이 삭제되었습니다.', 'info');
        await loadComments(currentPost.id);
      }
    });
  });
}

function setupCommentForm(postId) {
  const form = document.getElementById('comment-form');
  const input = document.getElementById('comment-input');
  const canComment = currentProfile.status === 'APPROVED' && (currentProfile.role === 'MEMBER' || currentProfile.role === 'ADMIN');

  if (!canComment) {
    if (form) {
      form.innerHTML = `
        <div style="font-size:0.85rem; color:var(--text-muted); background:var(--bg-surface); padding:0.8rem; border:1px solid var(--border-subtle); border-radius:var(--radius-sm);">
          🔒 크루 가입 승인(MEMBER 이상) 완료 후 댓글 작성이 가능합니다.
        </div>
      `;
    }
    return;
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = input.value.trim();
      if (!content) return;

      try {
        const { error } = await supabase.from('comments').insert({
          post_id: postId,
          author_id: currentProfile.id,
          content
        });

        if (error) throw error;
        input.value = '';
        showToast('댓글이 등록되었습니다.', 'success');
        await loadComments(postId);
      } catch (err) {
        showToast('댓글 작성 실패: ' + err.message, 'error');
      }
    });
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

document.addEventListener('DOMContentLoaded', initPostDetail);
