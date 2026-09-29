'use strict';

// 인증 UI만 담당합니다. 문제 출제·채점·문제은행은 기존 app.js에서 관리합니다.
(() => {
  const client = window.supabaseClient;
  const form = document.querySelector('#auth-form');
  const submitButton = document.querySelector('#auth-submit');
  const isAuthPage = Boolean(form);
  const isSignup = form?.dataset.mode === 'signup';
  const submitLabel = isSignup ? '회원가입' : '로그인';
  let session = null;
  let ready = false;
  let submitting = false;
  let signingOut = false;
  let stateVersion = 0;

  // 모든 화면에서 같은 메뉴를 사용합니다. 기존 헤더의 링크도 유지합니다.
  const nav = document.createElement('nav');
  nav.className = 'auth-nav';
  nav.setAttribute('aria-label', '계정 메뉴');
  nav.innerHTML = '<span id="auth-loading" class="muted">로그인 상태 확인 중…</span><div id="auth-guest-menu" class="auth-menu" hidden><a class="text-link" href="login.html">로그인</a><a class="small-button" href="signup.html">회원가입</a></div><div id="auth-member-menu" class="auth-menu" hidden><span id="auth-user-email" class="auth-user-email"></span><button type="button" id="auth-logout" class="small-button">로그아웃</button></div><p id="auth-header-message" class="auth-message" role="status" aria-live="polite"></p>';
  document.querySelector('.site-header').append(nav);
  const loading = document.querySelector('#auth-loading');
  const guestMenu = document.querySelector('#auth-guest-menu');
  const memberMenu = document.querySelector('#auth-member-menu');
  const emailLabel = document.querySelector('#auth-user-email');
  const logoutButton = document.querySelector('#auth-logout');
  const message = document.querySelector(isAuthPage ? '#auth-message' : '#auth-header-message');

  function showMessage(text, success = false) {
    message.textContent = text;
    message.classList.toggle('is-success', success);
  }

  function errorMessage(error) {
    const messages = {
      invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.',
      email_not_confirmed: '이메일 인증이 필요합니다. 받은 편지함의 가입 확인 링크를 눌러 주세요.',
      user_already_exists: '이미 가입된 이메일입니다. 로그인 화면에서 로그인해 주세요.',
      email_exists: '이미 가입된 이메일입니다. 로그인 화면에서 로그인해 주세요.',
      signup_disabled: '현재 회원가입을 받을 수 없습니다. 잠시 후 다시 시도해 주세요.',
      email_provider_disabled: '현재 이메일 가입을 사용할 수 없습니다. 관리자에게 문의해 주세요.',
      email_address_invalid: '올바른 이메일 주소를 입력해 주세요.',
      email_address_not_authorized: '이 이메일로 확인 메일을 보낼 수 없습니다. 관리자에게 문의해 주세요.',
      weak_password: '비밀번호가 보안 기준에 맞지 않습니다. 길이를 늘리고 대소문자·숫자·기호를 함께 사용해 주세요.',
      over_email_send_rate_limit: '확인 메일 요청이 너무 많습니다. 잠시 기다린 뒤 다시 시도해 주세요.',
      over_request_rate_limit: '요청이 너무 많습니다. 잠시 기다린 뒤 다시 시도해 주세요.',
      request_timeout: '서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.',
      otp_expired: '이메일 확인 링크가 만료되었거나 이미 사용되었습니다. 인증을 마쳤다면 로그인해 주세요.',
      session_not_found: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
      refresh_token_not_found: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
      refresh_token_already_used: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
      user_banned: '현재 이 계정으로 로그인할 수 없습니다. 관리자에게 문의해 주세요.'
    };
    if (messages[error?.code]) return messages[error.code];
    if (error?.status === 429) return messages.over_request_rate_limit;
    if (error?.name === 'AuthRetryableFetchError' || error instanceof TypeError || /fetch|network/i.test(error?.message || '')) {
      return '서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    }
    return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  function render() {
    loading.hidden = ready;
    guestMenu.hidden = !ready || Boolean(session);
    memberMenu.hidden = !ready || !session;
    emailLabel.textContent = session?.user?.email || '로그인됨';
    emailLabel.title = emailLabel.textContent;
    logoutButton.disabled = signingOut;
    logoutButton.textContent = signingOut ? '로그아웃 중…' : '로그아웃';
    if (form) {
      form.setAttribute('aria-busy', String(!ready || submitting));
      submitButton.disabled = !ready || submitting || !client;
      submitButton.textContent = !ready ? '로그인 상태 확인 중…' : submitting ? '처리 중…' : submitLabel;
    }
  }

  function applySession(nextSession) {
    session = nextSession;
    ready = true;
    render();
    // 이미 로그인했거나 이메일 인증으로 로그인되면 기존 메인으로 이동합니다.
    if (session && isAuthPage) window.location.replace('index.html');
  }

  async function refreshSession() {
    const version = stateVersion;
    try {
      const { data, error } = await client.auth.getSession();
      // 조회 중 다른 탭 등에서 로그인 상태가 바뀌면 최신 이벤트를 우선합니다.
      if (version !== stateVersion) return;
      if (error) throw error;
      applySession(data.session);
    } catch (error) {
      if (version !== stateVersion) return;
      ready = true;
      render();
      showMessage(errorMessage(error));
    }
  }

  if (!client) {
    ready = true;
    render();
    showMessage('인증 서버 연결을 준비하지 못했습니다. 인터넷 연결을 확인하고 페이지를 새로고침해 주세요.');
    return;
  }

  // SDK 콜백 안에서는 비동기 인증 요청을 실행하지 않습니다.
  client.auth.onAuthStateChange((event, nextSession) => {
    stateVersion += 1;
    applySession(nextSession);
    if (event === 'SIGNED_OUT') window.location.replace('login.html');
  });
  refreshSession();
  window.addEventListener('pageshow', event => { if (event.persisted) refreshSession(); });

  // 만료되거나 잘못된 이메일 확인 링크도 이해하기 쉬운 안내로 표시합니다.
  const currentUrl = new URL(window.location.href);
  const hashParams = new URLSearchParams(currentUrl.hash.slice(1));
  const authError = hashParams.get('error') || currentUrl.searchParams.get('error');
  if (authError) {
    const code = hashParams.get('error_code') || currentUrl.searchParams.get('error_code');
    showMessage(errorMessage({ code }));
    ['error', 'error_code', 'error_description'].forEach(key => {
      hashParams.delete(key);
      currentUrl.searchParams.delete(key);
    });
    currentUrl.hash = hashParams.toString();
    window.history.replaceState(null, '', currentUrl.href);
  }

  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || submitting || !form.reportValidity()) return;
    const emailInput = document.querySelector('#auth-email');
    const passwordInput = document.querySelector('#auth-password');
    const credentials = { email: emailInput.value.trim(), password: passwordInput.value };
    submitting = true;
    showMessage('');
    render();
    try {
      // 이메일 확인이 켜진 프로젝트에서는 이 주소로 돌아온 뒤 세션을 처리합니다.
      if (isSignup && /^https?:$/.test(window.location.protocol)) {
        credentials.options = { emailRedirectTo: new URL('login.html', window.location.href).href };
      }
      const { data, error } = isSignup
        ? await client.auth.signUp(credentials)
        : await client.auth.signInWithPassword(credentials);
      if (error) throw error;
      passwordInput.value = '';
      if (data.session) {
        applySession(data.session);
      } else if (isSignup) {
        // Supabase는 기존 이메일 여부를 숨길 수 있으므로 가입 완료로 단정하지 않습니다.
        showMessage('가입 요청을 접수했습니다. 확인 메일이 도착하면 링크를 눌러 이메일 인증을 완료한 뒤 로그인해 주세요. 메일이 보이지 않으면 스팸함을 확인하고, 이미 가입한 이메일이라면 로그인해 주세요.', true);
      } else {
        showMessage('로그인 세션을 확인하지 못했습니다. 다시 로그인해 주세요.');
      }
    } catch (error) {
      showMessage(errorMessage(error));
    } finally {
      submitting = false;
      render();
    }
  });

  logoutButton.addEventListener('click', async () => {
    if (signingOut) return;
    signingOut = true;
    showMessage('');
    render();
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      applySession(null);
      window.location.replace('login.html');
    } catch (error) {
      showMessage(errorMessage(error));
    } finally {
      signingOut = false;
      render();
    }
  });
})();
