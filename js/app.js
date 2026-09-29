'use strict';

// 저장소 접근을 이곳에 모았습니다. DB 없이 현재 탭의 세션 동안만 저장합니다.
const BANK_KEY = 'sevenq.bank.v1';
const QUIZ_KEY = 'sevenq.quiz.v1';
const CERTIFICATES = { bigdata: '빅데이터분석기사', information: '정보처리기사' };
const $ = (selector) => document.querySelector(selector);

function readSession(key, fallback) {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveSession(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showMessage('브라우저의 임시 저장소를 사용할 수 없습니다. 사이트 데이터 저장을 허용한 뒤 다시 시도해 주세요.');
    return false;
  }
}

function showMessage(text) {
  const target = $('#message');
  if (target) target.textContent = text;
}

// 관리자 입력도 HTML로 해석하지 않고 텍스트로 표시합니다.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function validQuestion(question) {
  return question && typeof question.id === 'string' && Object.hasOwn(CERTIFICATES, question.certificate) &&
    typeof question.question === 'string' && question.question.trim() &&
    Array.isArray(question.options) && question.options.length === 4 && question.options.every(option => typeof option === 'string' && option.trim()) &&
    Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4 && typeof question.explanation === 'string';
}

function getBank() {
  const bank = readSession(BANK_KEY, null);
  if (Array.isArray(bank) && bank.every(validQuestion) && new Set(bank.map(q => q.id)).size === bank.length) return bank;
  return structuredClone(MOCK_QUESTIONS);
}

function getQuiz() {
  const quiz = readSession(QUIZ_KEY, null);
  if (!quiz || !Object.hasOwn(CERTIFICATES, quiz.certificate) || !Array.isArray(quiz.questions) || quiz.questions.length !== 7 ||
    !quiz.questions.every(q => validQuestion(q) && q.certificate === quiz.certificate) || new Set(quiz.questions.map(q => q.id)).size !== 7 ||
    !Array.isArray(quiz.answers) || quiz.answers.length !== 7 || !quiz.answers.every(a => a === null || (Number.isInteger(a) && a >= 0 && a < 4)) ||
    !Number.isInteger(quiz.current) || quiz.current < 0 || quiz.current > 6 || typeof quiz.submitted !== 'boolean' ||
    (quiz.submitted && quiz.answers.includes(null))) return null;
  return quiz;
}

function startQuiz(certificate) {
  const questions = getBank().filter(question => question.certificate === certificate);
  if (questions.length < 7) {
    showMessage(`등록된 문제가 ${questions.length}개입니다. 7문제 이상이 준비되어야 시작할 수 있습니다.`);
    return;
  }
  // Fisher–Yates 셔플: 선택한 자격증에서 중복 없이 7문제를 추출합니다.
  for (let index = questions.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [questions[index], questions[randomIndex]] = [questions[randomIndex], questions[index]];
  }
  const quiz = { certificate, questions: questions.slice(0, 7), answers: Array(7).fill(null), current: 0, submitted: false };
  if (saveSession(QUIZ_KEY, quiz)) window.location.href = 'quiz.html';
}

function showEmptyState(container, title, description) {
  $(container).innerHTML = `<section class="empty-state"><span class="eyebrow">세븐큐(7Q)</span><h1>${title}</h1><p>${description}</p><a class="button primary" href="index.html">자격증 선택하기 →</a></section>`;
}

function initHome() {
  $('#start-form').addEventListener('submit', event => {
    event.preventDefault();
    const certificate = new FormData(event.currentTarget).get('certificate');
    if (Object.hasOwn(CERTIFICATES, certificate)) startQuiz(certificate);
  });
}

function initQuiz() {
  const quiz = getQuiz();
  if (!quiz) return showEmptyState('#quiz-content', '학습할 자격증을 선택해 주세요.', '자격증을 선택하면 새로운 7문제를 준비해 드려요.');
  if (quiz.submitted) {
    window.location.replace('result.html');
    return;
  }
  $('#certificate-name').textContent = CERTIFICATES[quiz.certificate];
  function renderQuestion(focusTitle = false) {
    const question = quiz.questions[quiz.current];
    const answered = quiz.answers.filter(answer => answer !== null).length;
    $('#question-counter').textContent = `문제 ${quiz.current + 1} / 7`;
    $('#answered-count').textContent = `${answered}문제 답변 완료`;
    $('#quiz-progress').value = answered;
    $('#question-title').textContent = question.question;
    $('#answer-options').innerHTML = question.options.map((option, index) => `<label class="answer-option"><input type="radio" name="answer" value="${index}" ${quiz.answers[quiz.current] === index ? 'checked' : ''}><span class="option-number">${index + 1}</span><span>${escapeHtml(option)}</span><span class="option-check" aria-hidden="true">✓</span></label>`).join('');
    $('#previous').disabled = quiz.current === 0;
    $('#next').disabled = quiz.current === 6;
    if (focusTitle) $('#question-title').focus();
  }
  $('#quiz-form').addEventListener('submit', event => event.preventDefault());
  $('#answer-options').addEventListener('change', event => {
    if (event.target.name !== 'answer') return;
    quiz.answers[quiz.current] = Number(event.target.value);
    if (saveSession(QUIZ_KEY, quiz)) showMessage('');
    const answered = quiz.answers.filter(answer => answer !== null).length;
    $('#answered-count').textContent = `${answered}문제 답변 완료`;
    $('#quiz-progress').value = answered;
  });
  function moveQuestion(offset) {
    quiz.current = Math.max(0, Math.min(6, quiz.current + offset));
    saveSession(QUIZ_KEY, quiz);
    renderQuestion(true);
  }
  $('#previous').addEventListener('click', () => moveQuestion(-1));
  $('#next').addEventListener('click', () => moveQuestion(1));
  $('#grade').addEventListener('click', () => {
    const missing = quiz.answers.indexOf(null);
    if (missing !== -1) {
      quiz.current = missing;
      saveSession(QUIZ_KEY, quiz);
      renderQuestion(true);
      showMessage(`아직 답하지 않은 문제가 있어요. ${missing + 1}번 문제의 보기를 선택해 주세요.`);
      return;
    }
    quiz.submitted = true;
    if (saveSession(QUIZ_KEY, quiz)) window.location.href = 'result.html';
    else quiz.submitted = false;
  });
  renderQuestion();
}

function initResult() {
  const quiz = getQuiz();
  if (!quiz) return showEmptyState('#result-content', '아직 채점 결과가 없어요.', '먼저 자격증을 선택하고 7문제를 풀어 보세요.');
  if (!quiz.submitted) {
    $('#result-content').innerHTML = '<section class="empty-state"><h1>아직 풀고 있는 문제가 있어요.</h1><p>답안을 모두 선택하고 채점하면 결과를 볼 수 있어요.</p><a class="button primary" href="quiz.html">이어서 풀기 →</a></section>';
    return;
  }
  const wrong = quiz.questions.map((question, index) => ({ question, index })).filter(({ question, index }) => quiz.answers[index] !== question.answer);
  const correct = 7 - wrong.length;
  $('#result-certificate').textContent = `${CERTIFICATES[quiz.certificate]} · 학습 결과`;
  $('#score-title').textContent = `7문제 중 ${correct}문제 정답`;
  $('#score-description').textContent = correct === 7 ? '모든 문제를 맞혔어요. 새로운 문제에도 도전해 보세요!' : '틀린 문제를 이해하는 순간, 실력이 한 걸음 자라요.';
  $('#correct-count').textContent = `${correct}개`;
  $('#wrong-count').textContent = `${wrong.length}개`;
  $('#question-results').innerHTML = quiz.questions.map((question, index) => {
    const isCorrect = quiz.answers[index] === question.answer;
    return `<div class="question-result ${isCorrect ? 'is-correct' : 'is-wrong'}"><span>${index + 1}번</span><strong>${isCorrect ? '✓ 정답' : '× 오답'}</strong></div>`;
  }).join('');
  $('#review-count').textContent = `${wrong.length}문제`;
  $('#wrong-answers').innerHTML = wrong.length ? wrong.map(({ question, index }) => `<article class="review-card"><span class="review-label">문제 ${index + 1} <span>오답</span></span><h3>${escapeHtml(question.question)}</h3><div class="answer-comparison"><p class="my-answer"><span>내가 선택한 답</span><strong>${quiz.answers[index] + 1}. ${escapeHtml(question.options[quiz.answers[index]])}</strong></p><p class="correct-answer"><span>정답</span><strong>${question.answer + 1}. ${escapeHtml(question.options[question.answer])}</strong></p></div><button class="explanation-toggle" type="button" aria-expanded="false" aria-controls="explanation-${index}">AI 해설 보기 <span aria-hidden="true">＋</span></button><div id="explanation-${index}" class="explanation" hidden><span class="mock-label">MOCK 해설</span><p>${escapeHtml(question.explanation || `정답은 ${question.answer + 1}번입니다. 아직 상세 해설이 등록되지 않았습니다.`)}</p></div></article>`).join('') : '<div class="perfect-state"><span aria-hidden="true">✦</span><h3>깔끔하게, 모두 정답!</h3><p>복습할 오답이 없어요. 지금의 감각을 다음 일곱 문제로 이어가세요.</p></div>';
  $('#wrong-answers').addEventListener('click', event => {
    const button = event.target.closest('.explanation-toggle');
    if (!button) return;
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    document.getElementById(button.getAttribute('aria-controls')).hidden = !expanded;
    button.innerHTML = `${expanded ? 'AI 해설 접기' : 'AI 해설 보기'} <span aria-hidden="true">${expanded ? '−' : '＋'}</span>`;
  });
  $('#restart').addEventListener('click', () => startQuiz(quiz.certificate));
}

function initAdmin() {
  let bank = getBank();
  let editingId = null;
  const form = $('#admin-form');
  function renderList() {
    const list = bank.filter(question => question.certificate === $('#list-certificate').value);
    $('#bank-count').textContent = `${list.length}문제`;
    $('#question-list').innerHTML = list.map((question, index) => `<article class="admin-question"><span class="card-category">QUESTION ${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(question.question)}</h3><p class="muted">정답 ${question.answer + 1} · ${escapeHtml(question.options[question.answer])}</p><div><button type="button" class="small-button" data-action="edit" data-id="${escapeHtml(question.id)}">수정</button><button type="button" class="small-button delete-button" data-action="delete" data-id="${escapeHtml(question.id)}">삭제</button></div></article>`).join('') || '<p class="empty-list">등록된 문제가 없습니다. 첫 문제를 등록해 주세요.</p>';
  }
  function resetForm() {
    editingId = null;
    form.reset();
    $('#admin-certificate').value = $('#list-certificate').value;
    $('#form-title').textContent = '새 문제 등록';
    $('#save-question').textContent = '문제 등록';
    $('#cancel-edit').hidden = true;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(form);
    const question = {
      id: editingId || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      certificate: values.get('certificate'),
      question: values.get('question').trim(),
      options: [0, 1, 2, 3].map(index => values.get(`option${index}`).trim()),
      answer: Number(values.get('answer')),
      explanation: values.get('explanation').trim()
    };
    if (!validQuestion(question)) {
      showMessage('문제와 보기 4개를 공백이 아닌 내용으로 입력해 주세요.');
      return;
    }
    const updated = editingId ? bank.map(item => item.id === editingId ? question : item) : [...bank, question];
    if (!saveSession(BANK_KEY, updated)) return;
    const wasEditing = Boolean(editingId);
    bank = updated;
    $('#list-certificate').value = question.certificate;
    resetForm();
    renderList();
    showMessage(wasEditing ? '문제를 수정했습니다. 다음 풀이부터 반영됩니다.' : '새 문제를 등록했습니다. 다음 풀이부터 출제됩니다.');
  });
  $('#cancel-edit').addEventListener('click', () => { resetForm(); showMessage('수정을 취소했습니다.'); });
  $('#list-certificate').addEventListener('change', renderList);
  $('#admin-certificate').addEventListener('change', () => { $('#list-certificate').value = $('#admin-certificate').value; renderList(); });
  $('#question-list').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const question = bank.find(item => item.id === button.dataset.id);
    if (!question) return;
    if (button.dataset.action === 'delete') {
      if (!window.confirm('이 문제를 삭제할까요? 현재 탭의 문제은행에서 삭제됩니다.')) return;
      const updated = bank.filter(item => item.id !== question.id);
      if (!saveSession(BANK_KEY, updated)) return;
      bank = updated;
      if (editingId === question.id) resetForm();
      renderList();
      showMessage('문제를 삭제했습니다. 이미 시작한 풀이에는 영향을 주지 않습니다.');
      return;
    }
    editingId = question.id;
    $('#admin-certificate').value = question.certificate;
    $('#question-text').value = question.question;
    question.options.forEach((option, index) => { $(`#option-${index}`).value = option; });
    $('#correct-answer').value = question.answer;
    $('#explanation').value = question.explanation;
    $('#form-title').textContent = '문제 수정';
    $('#save-question').textContent = '수정 저장';
    $('#cancel-edit').hidden = false;
    showMessage('내용을 수정한 뒤 수정 저장을 눌러 주세요.');
    $('#question-text').focus();
    $('#form-title').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  renderList();
}

// 뒤로 가기로 돌아왔을 때도 제출 상태와 임시 데이터를 다시 확인합니다.
window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
const page = document.body.dataset.page;
if (page === 'home') initHome();
if (page === 'quiz') initQuiz();
if (page === 'result') initResult();
if (page === 'admin') initAdmin();
