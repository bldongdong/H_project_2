'use strict';

// CDN은 window.supabase, 이 프로젝트의 클라이언트는 window.supabaseClient입니다.
// 다른 파일에서는 window.supabaseClient.from('테이블명') 형태로 사용합니다.
// 현재 문제은행과 답안 저장은 기존 Mock Data / sessionStorage 방식을 유지합니다.
window.supabaseClient = null;

(() => {
  const projectUrl = 'https://cchvulpiondywynwjboh.supabase.co';
  // 브라우저에서 사용하는 공개 키입니다. Secret Key로 교체하지 마세요.
  const publishableKey = 'sb_publishable_8uP2twsC5x8uOLTO5N5TCA_B5mrKKhw';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.warn('Supabase CDN을 불러오지 못했습니다. 기존 학습 기능은 계속 사용할 수 있습니다.');
    return;
  }

  try {
    window.supabaseClient = window.supabase.createClient(projectUrl, publishableKey, {
      // 새로고침 후에도 로그인 유지, 만료 토큰 갱신, 이메일 확인 링크 처리.
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (error) {
    console.warn('Supabase 클라이언트를 초기화하지 못했습니다. 기존 학습 기능은 계속 사용할 수 있습니다.', error);
  }
})();
