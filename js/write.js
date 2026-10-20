import { supabase } from './supabaseClient.js';
import { requireAuthGuard, showToast } from './guard.js';

let currentProfile = null;

async function initWrite() {
  const authData = await requireAuthGuard({ requireMember: true });
  if (!authData) return;
  currentProfile = authData.profile;

  setupCategoryChange();
  setupFormSubmit();

  // If user is not admin, hide or disable NOTICE option
  if (currentProfile.role !== 'ADMIN') {
    const noticeOption = document.querySelector('option[value="NOTICE"]');
    if (noticeOption) noticeOption.remove();
  }
}

function setupCategoryChange() {
  const categorySelect = document.getElementById('post-category');
  const sessionFields = document.getElementById('session-fields');

  function updateVisibility() {
    if (categorySelect.value === 'RUN_SESSION') {
      sessionFields.style.display = 'block';
    } else {
      sessionFields.style.display = 'none';
    }
  }

  categorySelect.addEventListener('change', updateVisibility);
  updateVisibility();
}

function setupFormSubmit() {
  const form = document.getElementById('write-form');
  const btnSubmit = document.getElementById('btn-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('post-category').value;
    const content = document.getElementById('content').value.trim();

    if (!title || !content) {
      alert('제목과 본문을 입력해주세요.');
      return;
    }

    const payload = {
      author_id: currentProfile.id,
      category,
      title,
      content
    };

    if (category === 'RUN_SESSION') {
      const runDate = document.getElementById('run-date').value;
      const location = document.getElementById('location').value.trim();
      const targetPace = document.getElementById('target-pace').value.trim();
      const distanceKm = document.getElementById('distance-km').value;
      const maxParticipants = document.getElementById('max-participants').value;

      if (!runDate || !location) {
        alert('러닝 모임의 일시와 집결 장소는 필수 항목입니다.');
        return;
      }

      payload.run_date = new Date(runDate).toISOString();
      payload.location = location;
      payload.target_pace = targetPace || '5:30/km';
      payload.distance_km = distanceKm ? parseFloat(distanceKm) : null;
      payload.max_participants = maxParticipants ? parseInt(maxParticipants, 10) : 15;
    }

    try {
      btnSubmit.disabled = true;
      btnSubmit.textContent = '등록 중...';

      const { data, error } = await supabase
        .from('posts')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Automatically register author to session participants if RUN_SESSION
      if (category === 'RUN_SESSION' && data?.id) {
        await supabase.from('session_participants').insert({
          post_id: data.id,
          user_id: currentProfile.id
        });
      }

      showToast('성공적으로 등록되었습니다! 🏃', 'success');
      setTimeout(() => {
        window.location.href = `post.html?id=${data.id}`;
      }, 500);
    } catch (err) {
      console.error('Post creation error:', err);
      alert('등록 실패: ' + err.message);
      btnSubmit.disabled = false;
      btnSubmit.textContent = '게시글 등록';
    }
  });
}

document.addEventListener('DOMContentLoaded', initWrite);
