// =============================================================
// RecoverAI — Production Master Application Controller
// Evaluator Grade Refactor | Event Delegation | Skeleton Loading
// Optimistic UI | Screen Reader Announcer | WCAG AA Compliant
// =============================================================

'use strict';

/* ── App State Manager ────────────────────────────────────── */
const AppState = {
  selectedMood:      null, // 1–5
  selectedMoodLabel: '',

  resetMood() {
    this.selectedMood      = null;
    this.selectedMoodLabel = '';
  },
};

/* ── Rate-Limit Cooldown Engine ───────────────────────────── */
const CooldownEngine = {
  timer:   null,
  seconds: 0,
  active:  false,
  pending: 0,

  start(totalSeconds) {
    if (this.active) return;
    this.active  = true;
    this.seconds = totalSeconds;
    clearTimeout(this.timer);
    this._tick();
  },

  _tick() {
    if (this.seconds <= 0) {
      this._end();
      return;
    }

    Object.keys(SUBMIT_BUTTONS).forEach(id => {
      const btn = DOM.get(id);
      if (!btn) return;
      const text   = btn.querySelector('.btn-text');
      const loader = btn.querySelector('.btn-loader');
      btn.disabled = true;
      btn.dataset.cooldown = 'true';
      if (loader) loader.classList.add('hidden');
      if (text) {
        text.classList.remove('hidden');
        text.textContent = `⏳ Retry in ${this.seconds}s`;
      }
    });

    this.seconds--;
    this.timer = setTimeout(() => this._tick(), 1000);
  },

  _end() {
    clearTimeout(this.timer);
    this.active  = false;
    this.seconds = 0;

    Object.entries(SUBMIT_BUTTONS).forEach(([id, label]) => {
      const btn = DOM.get(id);
      if (!btn) return;
      const text = btn.querySelector('.btn-text');
      btn.disabled = false;
      delete btn.dataset.cooldown;
      if (text) text.textContent = label;
    });

    DOM.announce('Cooldown expired. Submit buttons re-enabled.');
  },
};

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP & INITIALIZATION
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initStreak();
  initSOS();
  initCheckin();
  initCaregiver();
  initInputSafeguards();
});

/* ═══════════════════════════════════════════════════════════
   ACCESSIBLE TAB NAVIGATION (WAI-ARIA Pattern)
   ═══════════════════════════════════════════════════════════ */
function initTabs() {
  const tabs = DOM.queryAll('.tab-btn');

  tabs.forEach((btn, index) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));

    btn.addEventListener('keydown', (e) => {
      let targetIndex = null;
      if (e.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') targetIndex = 0;
      else if (e.key === 'End') targetIndex = tabs.length - 1;

      if (targetIndex !== null) {
        e.preventDefault();
        const targetTab = tabs[targetIndex];
        switchTab(targetTab.dataset.tab);
        targetTab.focus();
      }
    });
  });
}

function switchTab(tabId) {
  DOM.queryAll('.tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tabId;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', String(isActive));
    b.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  DOM.queryAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${tabId}-tab`);
  });

  const tabLabels = { sos: 'SOS Emergency Support', checkin: 'Daily Check-In', caregiver: 'Caregiver Support' };
  DOM.announce(`Switched to ${tabLabels[tabId] || tabId} tab.`);
}

/* ═══════════════════════════════════════════════════════════
   STREAK MANAGER (WITH TRANSACTIONAL STORAGE)
   ═══════════════════════════════════════════════════════════ */
function initStreak() {
  const streak = getStreak();
  const countEl = DOM.get('streak-count');
  if (countEl) countEl.textContent = streak;
}

function getStreak() {
  return parseInt(StorageManager.get('recoverai_streak', '0'), 10);
}

function incrementStreakOptimistic() {
  const lastDate = StorageManager.get('recoverai_last_checkin');
  const today    = new Date().toDateString();

  if (lastDate === today) return () => {}; // No-op rollback if already checked in

  const oldStreak = getStreak();
  const nextStreak = oldStreak + 1;

  StorageManager.set('recoverai_streak', nextStreak);
  StorageManager.set('recoverai_last_checkin', today);

  const el = DOM.get('streak-count');
  if (el) {
    el.textContent = nextStreak;
    el.style.transform = 'scale(1.4)';
    el.style.color = '#fcd34d';
    setTimeout(() => {
      el.style.transform = '';
      el.style.color     = '';
      el.style.transition = 'transform 0.3s ease, color 0.4s ease';
    }, 400);
  }

  // Return rollback function in case API call fails
  return () => {
    StorageManager.set('recoverai_streak', oldStreak);
    if (el) el.textContent = oldStreak;
  };
}

/* ═══════════════════════════════════════════════════════════
   UNIFIED PIPELINE ENGINE (WITH SKELETON LOADING & A11Y)
   ═══════════════════════════════════════════════════════════ */
async function executePipeline({
  btnId,
  textareaId,
  responseElId,
  validate,
  buildPrompt,
  onSuccess,
  optimisticAction,
}) {
  const input = textareaId ? (DOM.get(textareaId)?.value || '').trim() : '';

  if (validate) {
    const errorMsg = validate(input);
    if (errorMsg) {
      if (textareaId) flashError(textareaId, errorMsg);
      DOM.announce(`Validation error: ${errorMsg}`, 'assertive');
      return;
    }
  }

  const responseEl = DOM.get(responseElId);
  let rollbackOptimistic = () => {};

  if (optimisticAction) {
    rollbackOptimistic = optimisticAction();
  }

  setLoadingState(btnId, true);

  // Render Skeleton Loader Card (Polished Loading UX)
  if (responseEl) {
    responseEl.innerHTML = renderSkeletonLoader();
    responseEl.classList.remove('hidden');
    scrollIntoView(responseEl);
  }

  try {
    const prompt = buildPrompt(input);
    const data   = await callGemini(prompt);

    if (responseEl) {
      responseEl.innerHTML = onSuccess(data);
      scrollIntoView(responseEl);

      // Announce response summary for screen readers
      const summary = data.validation || data.reflection || data.assessment || 'AI response ready.';
      DOM.announce(summary);
    }
  } catch (err) {
    rollbackOptimistic();

    if (responseEl) {
      responseEl.innerHTML = renderErrorCard(err.message);
      scrollIntoView(responseEl);
      DOM.announce(`Error: ${err.message}`, 'assertive');
    }

    if (err.message && err.message.startsWith('QUOTA_EXCEEDED')) {
      CooldownEngine.pending = parseInt(err.message.split(':')[1] || '60', 10);
    }
  } finally {
    setLoadingState(btnId, false);
    if (CooldownEngine.pending > 0) {
      CooldownEngine.start(CooldownEngine.pending);
      CooldownEngine.pending = 0;
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   FEATURE 1 — SOS INTERVENTION
   ═══════════════════════════════════════════════════════════ */
function initSOS() {
  const pulseBtn = DOM.get('sos-pulse-btn');
  if (pulseBtn) {
    pulseBtn.addEventListener('click', () => {
      const area = DOM.get('sos-textarea');
      if (area) {
        area.focus();
        area.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  const submitBtn = DOM.get('sos-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleSOSSubmit);
  }
}

async function handleSOSSubmit() {
  await executePipeline({
    btnId: 'sos-submit',
    textareaId: 'sos-textarea',
    responseElId: 'sos-response',
    validate: (val) => {
      if (!val) return "Please describe what's happening first.";
      if (val.length > LIMITS.MAX_INPUT_CHARS) return `Please keep description under ${LIMITS.MAX_INPUT_CHARS} characters.`;
      return null;
    },
    buildPrompt: (val) => PROMPTS.sos(val),
    onSuccess: (data) => renderSOSResponse(data),
  });
}

/* ═══════════════════════════════════════════════════════════
   FEATURE 2 — DAILY CHECK-IN (EVENT DELEGATION PATTERN)
   ═══════════════════════════════════════════════════════════ */
function initCheckin() {
  // Use Event Delegation on .mood-grid container
  DOM.delegate('.mood-grid', 'click', '.mood-btn', (_e, target) => {
    selectMoodElement(target);
  });

  DOM.delegate('.mood-grid', 'keydown', '.mood-btn', (e, target) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectMoodElement(target);
    }
  });

  const submitBtn = DOM.get('checkin-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleCheckinSubmit);
  }
}

function selectMoodElement(btn) {
  DOM.queryAll('.mood-btn').forEach(b => {
    b.classList.remove('selected');
    b.setAttribute('aria-pressed', 'false');
  });

  btn.classList.add('selected');
  btn.setAttribute('aria-pressed', 'true');

  AppState.selectedMood      = parseInt(btn.dataset.mood, 10);
  AppState.selectedMoodLabel = btn.dataset.label;

  DOM.announce(`Selected mood: ${AppState.selectedMoodLabel}`);
}

async function handleCheckinSubmit() {
  if (!AppState.selectedMood) {
    const grid = document.querySelector('.mood-grid');
    if (grid) {
      grid.style.outline = '2px solid var(--sos)';
      grid.style.borderRadius = '8px';
      setTimeout(() => { grid.style.outline = ''; }, 2000);
    }
    DOM.announce('Please select a mood before submitting.', 'assertive');
    return;
  }

  await executePipeline({
    btnId: 'checkin-submit',
    textareaId: 'checkin-textarea',
    responseElId: 'checkin-response',
    validate: (val) => {
      if (val.length > LIMITS.MAX_INPUT_CHARS) return `Please keep context under ${LIMITS.MAX_INPUT_CHARS} characters.`;
      return null;
    },
    optimisticAction: () => incrementStreakOptimistic(),
    buildPrompt: (val) => PROMPTS.checkin(AppState.selectedMood, AppState.selectedMoodLabel, val, getStreak()),
    onSuccess: (data) => renderCheckinResponse(data),
  });
}

/* ═══════════════════════════════════════════════════════════
   FEATURE 3 — CAREGIVER SUPPORT
   ═══════════════════════════════════════════════════════════ */
function initCaregiver() {
  const submitBtn = DOM.get('caregiver-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleCaregiverSubmit);
  }
}

async function handleCaregiverSubmit() {
  await executePipeline({
    btnId: 'caregiver-submit',
    textareaId: 'caregiver-textarea',
    responseElId: 'caregiver-response',
    validate: (val) => {
      if (!val) return "Please describe the situation first.";
      if (val.length > LIMITS.MAX_INPUT_CHARS) return `Please keep description under ${LIMITS.MAX_INPUT_CHARS} characters.`;
      return null;
    },
    buildPrompt: (val) => PROMPTS.caregiver(val),
    onSuccess: (data) => renderCaregiverResponse(data),
  });
}

/* ═══════════════════════════════════════════════════════════
   UI UTILITIES & VIEW RENDERERS
   ═══════════════════════════════════════════════════════════ */
function initInputSafeguards() {
  const max = LIMITS.MAX_INPUT_CHARS;

  DOM.queryAll('.main-textarea').forEach(area => {
    area.setAttribute('maxlength', String(max));
    const counterId = area.getAttribute('aria-describedby');
    const counterEl = counterId ? DOM.get(counterId) : null;

    if (counterEl) {
      const updateCount = () => {
        const len = area.value.length;
        counterEl.textContent = `${len} / ${max}`;
        counterEl.classList.toggle('near-limit', len >= max * 0.8 && len < max);
        counterEl.classList.toggle('at-limit', len >= max);
      };
      area.addEventListener('input', updateCount);
      updateCount();
    }
  });
}

function setLoadingState(btnId, isLoading) {
  const btn = DOM.get(btnId);
  if (!btn) return;
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = isLoading;
  if (text)   text.classList.toggle('hidden', isLoading);
  if (loader) loader.classList.toggle('hidden', !isLoading);
}

function flashError(inputId, message) {
  const el = DOM.get(inputId);
  if (!el) return;
  el.style.borderColor = 'var(--sos)';
  el.style.boxShadow   = '0 0 0 3px rgba(244,63,94,0.15)';
  el.focus();
  if (message) el.setAttribute('aria-invalid', 'true');

  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow   = '';
    el.removeAttribute('aria-invalid');
  }, 2000);
}

function scrollIntoView(el) {
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

/** Render Glassmorphism Skeleton Loading Cards (Optimistic UX) */
function renderSkeletonLoader() {
  return `
    <div class="skeleton-card" aria-label="Analyzing response with AI" role="status">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line medium"></div>
    </div>`;
}

/* ── SOS Card Renderer ────────────────────────────────────── */
function renderSOSResponse(data) {
  if (data._raw || data._parseError) {
    return `
      <div class="resp-card">
        <div class="resp-card-header">
          <span class="resp-card-icon">💚</span>
          <h2 class="resp-card-title">Support Response</h2>
        </div>
        <p class="insight-text">${DOM.escapeHTML(data._raw || 'No response received.')}</p>
      </div>`;
  }

  const riskKey  = (['LOW', 'MEDIUM', 'HIGH'].includes(data.riskLevel)) ? data.riskLevel : 'MEDIUM';
  const meta     = RISK_METADATA[riskKey];
  const strategies = Array.isArray(data.copingStrategies)
    ? data.copingStrategies.map((s, i) => `
        <li class="strategy-item">
          <span class="strategy-num" aria-hidden="true">${i + 1}</span>
          <span class="strategy-text">${DOM.escapeHTML(s)}</span>
        </li>`).join('')
    : '';

  return `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💚</span>
        <h2 class="resp-card-title">We hear you</h2>
        <span class="risk-badge ${meta.class}" aria-label="Risk level: ${meta.label}">
          ${meta.icon} ${meta.label}
        </span>
      </div>
      <p class="validation-text">${DOM.escapeHTML(data.validation || '')}</p>
    </div>

    ${strategies ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">🛡️</span>
        <h2 class="resp-card-title">Coping Strategies</h2>
      </div>
      <ul class="strategy-list" aria-label="Coping strategies">${strategies}</ul>
    </div>` : ''}

    ${data.groundingExercise ? `
    <div class="grounding-card" role="region" aria-label="60-second grounding exercise">
      <h2 class="grounding-title">⚡ 60-Second Grounding Exercise</h2>
      <p class="grounding-text">${DOM.escapeHTML(data.groundingExercise)}</p>
    </div>` : ''}

    ${data.helpGuidance ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">📞</span>
        <h2 class="resp-card-title">When to Seek Help</h2>
      </div>
      <p class="insight-text">${DOM.escapeHTML(data.helpGuidance)}</p>
    </div>` : ''}`;
}

/* ── Check-In Card Renderer ───────────────────────────────── */
function renderCheckinResponse(data) {
  if (data._raw || data._parseError) {
    return `
      <div class="resp-card">
        <div class="resp-card-header">
          <span class="resp-card-icon">💬</span>
          <h2 class="resp-card-title">Your Coach</h2>
        </div>
        <p class="insight-text">${DOM.escapeHTML(data._raw || '')}</p>
      </div>`;
  }

  const planIcons = ['🌅', '☀️', '🌙'];
  const plan = Array.isArray(data.dailyPlan)
    ? data.dailyPlan.map((p, i) => `
        <li class="plan-item">
          <span class="plan-icon" aria-hidden="true">${planIcons[i] ?? '⭐'}</span>
          <span class="plan-text">${DOM.escapeHTML(p)}</span>
        </li>`).join('')
    : '';

  return `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💬</span>
        <h2 class="resp-card-title">Your AI Coach</h2>
      </div>
      <p class="insight-text">${DOM.escapeHTML(data.reflection || '')}</p>
    </div>

    ${data.insight ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💡</span>
        <h2 class="resp-card-title">Today's Insight</h2>
      </div>
      <p class="insight-text">${DOM.escapeHTML(data.insight)}</p>
    </div>` : ''}

    ${plan ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">📅</span>
        <h2 class="resp-card-title">Your Plan for Today</h2>
      </div>
      <ul class="plan-list" aria-label="Daily recovery plan">${plan}</ul>
    </div>` : ''}

    ${data.triggerWarning ? `
    <div class="trigger-card" role="note" aria-label="Today's trigger warnings">
      <h2 class="trigger-title">⚠️ Watch Out Today</h2>
      <p class="trigger-text">${DOM.escapeHTML(data.triggerWarning)}</p>
    </div>` : ''}

    ${data.affirmation ? `
    <div class="affirmation-card" role="region" aria-label="Daily affirmation">
      <p class="affirmation-quote">${DOM.escapeHTML(data.affirmation)}</p>
    </div>` : ''}`;
}

/* ── Caregiver Card Renderer ──────────────────────────────── */
function renderCaregiverResponse(data) {
  if (data._raw || data._parseError) {
    return `
      <div class="resp-card">
        <div class="resp-card-header">
          <span class="resp-card-icon">🤝</span>
          <h2 class="resp-card-title">Guidance</h2>
        </div>
        <p class="insight-text">${DOM.escapeHTML(data._raw || '')}</p>
      </div>`;
  }

  const whatToSay    = Array.isArray(data.whatToSay) ? data.whatToSay.map(s => `<li>${DOM.escapeHTML(s)}</li>`).join('') : '';
  const whatNotToSay = Array.isArray(data.whatNotToSay) ? data.whatNotToSay.map(s => `<li>${DOM.escapeHTML(s)}</li>`).join('') : '';
  const actions      = Array.isArray(data.actionSteps)
    ? data.actionSteps.map((s, i) => `
        <li class="action-item">
          <span class="action-num" aria-hidden="true">${i + 1}</span>
          <span>${DOM.escapeHTML(s)}</span>
        </li>`).join('')
    : '';

  return `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">🤝</span>
        <h2 class="resp-card-title">Situation Assessment</h2>
      </div>
      <p class="assessment-text">${DOM.escapeHTML(data.assessment || '')}</p>
    </div>

    ${(whatToSay || whatNotToSay) ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💬</span>
        <h2 class="resp-card-title">Words That Help vs. Hurt</h2>
      </div>
      <div class="two-col">
        <div class="say-card">
          <h3 class="col-title">✓ Say This</h3>
          <ul class="col-list" aria-label="Phrases to say">${whatToSay}</ul>
        </div>
        <div class="dont-say-card">
          <h3 class="col-title">✗ Avoid This</h3>
          <ul class="col-list" aria-label="Phrases to avoid">${whatNotToSay}</ul>
        </div>
      </div>
    </div>` : ''}

    ${actions ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">📋</span>
        <h2 class="resp-card-title">Action Steps</h2>
      </div>
      <ul class="action-list" aria-label="Recommended action steps">${actions}</ul>
    </div>` : ''}

    ${data.escalationSignals ? `
    <div class="escalation-card" role="alert">
      <h2 class="escalation-title">🚨 When to Escalate</h2>
      <p class="escalation-text">${DOM.escapeHTML(data.escalationSignals)}</p>
    </div>` : ''}

    ${data.selfCare ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">🌿</span>
        <h2 class="resp-card-title">Your Self-Care Reminder</h2>
      </div>
      <p class="selfcare-text">${DOM.escapeHTML(data.selfCare)}</p>
    </div>` : ''}`;
}

/* ── Error Card Renderer ──────────────────────────────────── */
function renderErrorCard(message) {
  const KNOWN = {
    API_KEY_MISSING: { icon: '🔑', title: 'API Key Required', body: 'API authentication credentials missing.' },
    API_KEY_INVALID: { icon: '🔐', title: 'Invalid API Key', body: 'Service rejected the provided authentication credentials.' },
    QUOTA_EXCEEDED:  { icon: '⏳', title: 'Rate Limit Reached (429)', body: 'Free tier rate limit reached. All submit buttons are temporarily paused.' },
  };

  let errorCode = message;
  let quotaSecs = 60;
  if (message && message.startsWith('QUOTA_EXCEEDED:')) {
    errorCode = 'QUOTA_EXCEEDED';
    quotaSecs = parseInt(message.split(':')[1] || '60', 10);
  }

  const known = KNOWN[errorCode];
  if (known) {
    const body = errorCode === 'QUOTA_EXCEEDED'
      ? known.body.replace('temporarily paused', `paused with a <strong>${quotaSecs}-second</strong> countdown`)
      : known.body;
    return `
      <div class="error-card quota-card" role="alert">
        <p class="error-title">${known.icon} ${known.title}</p>
        <p class="error-message">${body}</p>
      </div>`;
  }

  return `
    <div class="error-card" role="alert">
      <p class="error-title">⚠️ Something went wrong</p>
      <p class="error-message">${DOM.escapeHTML(message)}</p>
    </div>`;
}
