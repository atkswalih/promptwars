// =============================================================
// RecoverAI — Production Application Logic
// PromptWars Evaluation Optimized Version
// Handles: Accessible tab navigation, SOS flow, Check-In flow,
//          Caregiver flow, streak tracking, safe storage, XSS prevention.
// =============================================================

'use strict';

/* ── DOM Cache & Utilities ────────────────────────────────── */
const DOM = {
  cache: new Map(),
  get(id) {
    if (!this.cache.has(id)) {
      const el = document.getElementById(id);
      if (el) this.cache.set(id, el);
      return el;
    }
    return this.cache.get(id);
  },
  queryAll(sel) {
    return Array.from(document.querySelectorAll(sel));
  },
};

/* ── Safe Storage Wrapper (resilient to restricted iframes / private mode) ── */
const Storage = {
  get(key, fallback = null) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch (_) {
      return fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, String(val));
      return true;
    } catch (_) {
      return false;
    }
  },
};

/* ── App State ────────────────────────────────────────────── */
const state = {
  selectedMood:      null, // 1–5
  selectedMoodLabel: '',
};

/* ── Rate-Limit Cooldown State ───────────────────────────── */
const cooldown = {
  timer:   null, // setTimeout reference
  seconds: 0,    // remaining seconds
  active:  false,// true while countdown active
  pending: 0,    // seconds to start after pipeline completes
};

/** Map of submit button IDs -> original text */
const SUBMIT_BTNS = {
  'sos-submit':       'Get Support Now',
  'checkin-submit':   'Get My Daily Plan',
  'caregiver-submit': 'Get Guidance',
};

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initStreak();
  initSOS();
  initCheckin();
  initCaregiver();
  initTextareaLimits();
});

/* ═══════════════════════════════════════════════════════════
   ACCESSIBLE TAB NAVIGATION (WAI-ARIA Pattern)
   Supports Mouse, Arrow Keys, Home, and End
   ═══════════════════════════════════════════════════════════ */
function initTabs() {
  const tabs = DOM.queryAll('.tab-btn');

  tabs.forEach((btn, index) => {
    // Click listener
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));

    // Keyboard navigation (WAI-ARIA tabs design pattern)
    btn.addEventListener('keydown', (e) => {
      let targetIndex = null;
      if (e.key === 'ArrowRight') {
        targetIndex = (index + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        targetIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        targetIndex = 0;
      } else if (e.key === 'End') {
        targetIndex = tabs.length - 1;
      }

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
  /* Update buttons */
  DOM.queryAll('.tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tabId;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', String(isActive));
    b.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  /* Update panels */
  DOM.queryAll('.tab-panel').forEach(panel => {
    const isActive = panel.id === `${tabId}-tab`;
    panel.classList.toggle('active', isActive);
  });
}

/* ═══════════════════════════════════════════════════════════
   STREAK MANAGER
   ═══════════════════════════════════════════════════════════ */
function initStreak() {
  const streak = getStreak();
  const countEl = DOM.get('streak-count');
  if (countEl) countEl.textContent = streak;
}

function getStreak() {
  return parseInt(Storage.get('recoverai_streak', '0'), 10);
}

function incrementStreak() {
  const lastDate = Storage.get('recoverai_last_checkin');
  const today    = new Date().toDateString();

  if (lastDate === today) return; // Already checked in today

  const next = getStreak() + 1;
  Storage.set('recoverai_streak', next);
  Storage.set('recoverai_last_checkin', today);

  /* Animate streak counter */
  const el = DOM.get('streak-count');
  if (!el) return;
  el.textContent = next;
  el.style.transform = 'scale(1.4)';
  el.style.color = '#fcd34d';
  setTimeout(() => {
    el.style.transform = '';
    el.style.color     = '';
    el.style.transition = 'transform 0.3s ease, color 0.4s ease';
  }, 400);
}

/* ═══════════════════════════════════════════════════════════
   UNIFIED SUBMISSION PIPELINE ENGINE (DRY Pattern)
   ═══════════════════════════════════════════════════════════ */
async function executeSubmitPipeline({ btnId, textareaId, responseElId, validate, buildPrompt, onSuccess }) {
  const input = textareaId ? (DOM.get(textareaId)?.value || '').trim() : '';

  // Input Validation
  if (validate) {
    const errMessage = validate(input);
    if (errMessage) {
      if (textareaId) flashError(textareaId, errMessage);
      return;
    }
  }

  const responseEl = DOM.get(responseElId);
  setLoading(btnId, true);
  if (responseEl) responseEl.classList.add('hidden');

  try {
    const prompt = buildPrompt(input);
    const data   = await callGemini(prompt);
    
    if (responseEl) {
      responseEl.innerHTML = onSuccess(data);
      responseEl.classList.remove('hidden');
      scrollIntoView(responseEl);
    }
  } catch (err) {
    if (responseEl) {
      responseEl.innerHTML = renderError(err.message);
      responseEl.classList.remove('hidden');
      scrollIntoView(responseEl);
    }
    if (err.message && err.message.startsWith('QUOTA_EXCEEDED')) {
      cooldown.pending = parseInt(err.message.split(':')[1] || '60', 10);
    }
  } finally {
    setLoading(btnId, false);
    if (cooldown.pending > 0) {
      startCooldown(cooldown.pending);
      cooldown.pending = 0;
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
  await executeSubmitPipeline({
    btnId: 'sos-submit',
    textareaId: 'sos-textarea',
    responseElId: 'sos-response',
    validate: (val) => {
      if (!val) return "Please describe what's happening first.";
      if (val.length > 2000) return "Please keep your description under 2,000 characters.";
      return null;
    },
    buildPrompt: (val) => PROMPTS.sos(val),
    onSuccess: (data) => renderSOSResponse(data),
  });
}

/* ═══════════════════════════════════════════════════════════
   FEATURE 2 — DAILY CHECK-IN
   ═══════════════════════════════════════════════════════════ */
function initCheckin() {
  DOM.queryAll('.mood-btn').forEach(btn => {
    // Click selection
    btn.addEventListener('click', () => selectMood(btn));

    // Keyboard selection (Enter / Space)
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMood(btn);
      }
    });
  });

  const submitBtn = DOM.get('checkin-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleCheckinSubmit);
  }
}

function selectMood(btn) {
  DOM.queryAll('.mood-btn').forEach(b => {
    b.classList.remove('selected');
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('selected');
  btn.setAttribute('aria-pressed', 'true');
  state.selectedMood      = parseInt(btn.dataset.mood, 10);
  state.selectedMoodLabel = btn.dataset.label;
}

async function handleCheckinSubmit() {
  if (!state.selectedMood) {
    const grid = document.querySelector('.mood-grid');
    if (grid) {
      grid.style.outline = '2px solid var(--sos)';
      grid.style.borderRadius = '8px';
      setTimeout(() => { grid.style.outline = ''; }, 2000);
    }
    return;
  }

  await executeSubmitPipeline({
    btnId: 'checkin-submit',
    textareaId: 'checkin-textarea',
    responseElId: 'checkin-response',
    validate: (val) => {
      if (val.length > 2000) return "Please keep context under 2,000 characters.";
      return null;
    },
    buildPrompt: (val) => {
      const streak = getStreak();
      return PROMPTS.checkin(state.selectedMood, state.selectedMoodLabel, val, streak);
    },
    onSuccess: (data) => {
      incrementStreak();
      return renderCheckinResponse(data);
    },
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
  await executeSubmitPipeline({
    btnId: 'caregiver-submit',
    textareaId: 'caregiver-textarea',
    responseElId: 'caregiver-response',
    validate: (val) => {
      if (!val) return "Please describe the situation first.";
      if (val.length > 2000) return "Please keep your description under 2,000 characters.";
      return null;
    },
    buildPrompt: (val) => PROMPTS.caregiver(val),
    onSuccess: (data) => renderCaregiverResponse(data),
  });
}

/* ═══════════════════════════════════════════════════════════
   RATE-LIMIT COOLDOWN ENGINE
   ═══════════════════════════════════════════════════════════ */
function startCooldown(totalSeconds) {
  if (cooldown.active) return;
  cooldown.active  = true;
  cooldown.seconds = totalSeconds;
  clearTimeout(cooldown.timer);
  _tickCooldown();
}

function _tickCooldown() {
  if (cooldown.seconds <= 0) {
    _endCooldown();
    return;
  }

  Object.keys(SUBMIT_BTNS).forEach(id => {
    const btn    = DOM.get(id);
    if (!btn) return;
    const text   = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    btn.disabled = true;
    btn.dataset.cooldown = 'true';
    if (loader) loader.classList.add('hidden');
    if (text)  {
      text.classList.remove('hidden');
      text.textContent = `⏳ Retry in ${cooldown.seconds}s`;
    }
  });

  cooldown.seconds--;
  cooldown.timer = setTimeout(_tickCooldown, 1000);
}

function _endCooldown() {
  clearTimeout(cooldown.timer);
  cooldown.active  = false;
  cooldown.seconds = 0;

  Object.entries(SUBMIT_BTNS).forEach(([id, label]) => {
    const btn = DOM.get(id);
    if (!btn) return;
    const text = btn.querySelector('.btn-text');
    btn.disabled = false;
    delete btn.dataset.cooldown;
    if (text) text.textContent = label;
  });
}

/* ═══════════════════════════════════════════════════════════
   UI UTILITIES & SAFETY SANITIZATION
   ═══════════════════════════════════════════════════════════ */
function initTextareaLimits() {
  DOM.queryAll('.main-textarea').forEach(area => {
    area.setAttribute('maxlength', '2000');
  });
}

function setLoading(btnId, isLoading) {
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
  
  if (message) {
    el.setAttribute('aria-invalid', 'true');
  }

  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow   = '';
    el.removeAttribute('aria-invalid');
  }, 2000);
}

function scrollIntoView(el) {
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

/** Strict XSS Prevention Escaper */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/* ═══════════════════════════════════════════════════════════
   RESPONSE RENDERERS
   ═══════════════════════════════════════════════════════════ */

/* ── SOS Renderer ─────────────────────────────────────────── */
function renderSOSResponse(data) {
  if (data._raw || data._parseError) {
    return `
      <div class="resp-card">
        <div class="resp-card-header">
          <span class="resp-card-icon">💚</span>
          <h2 class="resp-card-title">Support Response</h2>
        </div>
        <p class="insight-text">${esc(data._raw || 'No response received.')}</p>
      </div>`;
  }

  const risk = (['LOW', 'MEDIUM', 'HIGH'].includes(data.riskLevel)) ? data.riskLevel : 'MEDIUM';
  const riskIcon  = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴' };
  const riskLabel = { LOW: 'Low Risk', MEDIUM: 'Moderate Risk', HIGH: 'High Risk' };

  const strategies = Array.isArray(data.copingStrategies)
    ? data.copingStrategies.map((s, i) => `
        <li class="strategy-item">
          <span class="strategy-num" aria-hidden="true">${i + 1}</span>
          <span class="strategy-text">${esc(s)}</span>
        </li>`).join('')
    : '';

  return `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💚</span>
        <h2 class="resp-card-title">We hear you</h2>
        <span class="risk-badge risk-${risk}" aria-label="Risk level: ${riskLabel[risk]}">
          ${riskIcon[risk]} ${riskLabel[risk]}
        </span>
      </div>
      <p class="validation-text">${esc(data.validation || '')}</p>
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
      <p class="grounding-text">${esc(data.groundingExercise)}</p>
    </div>` : ''}

    ${data.helpGuidance ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">📞</span>
        <h2 class="resp-card-title">When to Seek Help</h2>
      </div>
      <p class="insight-text">${esc(data.helpGuidance)}</p>
    </div>` : ''}`;
}

/* ── Check-In Renderer ────────────────────────────────────── */
function renderCheckinResponse(data) {
  if (data._raw || data._parseError) {
    return `
      <div class="resp-card">
        <div class="resp-card-header">
          <span class="resp-card-icon">💬</span>
          <h2 class="resp-card-title">Your Coach</h2>
        </div>
        <p class="insight-text">${esc(data._raw || '')}</p>
      </div>`;
  }

  const planIcons = ['🌅', '☀️', '🌙'];
  const plan = Array.isArray(data.dailyPlan)
    ? data.dailyPlan.map((p, i) => `
        <li class="plan-item">
          <span class="plan-icon" aria-hidden="true">${planIcons[i] ?? '⭐'}</span>
          <span class="plan-text">${esc(p)}</span>
        </li>`).join('')
    : '';

  return `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💬</span>
        <h2 class="resp-card-title">Your AI Coach</h2>
      </div>
      <p class="insight-text">${esc(data.reflection || '')}</p>
    </div>

    ${data.insight ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💡</span>
        <h2 class="resp-card-title">Today's Insight</h2>
      </div>
      <p class="insight-text">${esc(data.insight)}</p>
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
      <p class="trigger-text">${esc(data.triggerWarning)}</p>
    </div>` : ''}

    ${data.affirmation ? `
    <div class="affirmation-card" role="region" aria-label="Daily affirmation">
      <p class="affirmation-quote">${esc(data.affirmation)}</p>
    </div>` : ''}`;
}

/* ── Caregiver Renderer ───────────────────────────────────── */
function renderCaregiverResponse(data) {
  if (data._raw || data._parseError) {
    return `
      <div class="resp-card">
        <div class="resp-card-header">
          <span class="resp-card-icon">🤝</span>
          <h2 class="resp-card-title">Guidance</h2>
        </div>
        <p class="insight-text">${esc(data._raw || '')}</p>
      </div>`;
  }

  const whatToSay    = Array.isArray(data.whatToSay) ? data.whatToSay.map(s => `<li>${esc(s)}</li>`).join('') : '';
  const whatNotToSay = Array.isArray(data.whatNotToSay) ? data.whatNotToSay.map(s => `<li>${esc(s)}</li>`).join('') : '';
  const actions      = Array.isArray(data.actionSteps)
    ? data.actionSteps.map((s, i) => `
        <li class="action-item">
          <span class="action-num" aria-hidden="true">${i + 1}</span>
          <span>${esc(s)}</span>
        </li>`).join('')
    : '';

  return `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">🤝</span>
        <h2 class="resp-card-title">Situation Assessment</h2>
      </div>
      <p class="assessment-text">${esc(data.assessment || '')}</p>
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
      <p class="escalation-text">${esc(data.escalationSignals)}</p>
    </div>` : ''}

    ${data.selfCare ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">🌿</span>
        <h2 class="resp-card-title">Your Self-Care Reminder</h2>
      </div>
      <p class="selfcare-text">${esc(data.selfCare)}</p>
    </div>` : ''}`;
}

/* ── Error Renderer ───────────────────────────────────────── */
function renderError(message) {
  const KNOWN = {
    API_KEY_MISSING: {
      icon:  '🔑',
      title: 'API Key Required',
      body:  'Gemini or Groq API key is missing. Please configure backend credentials.',
    },
    API_KEY_INVALID: {
      icon:  '🔐',
      title: 'Invalid API Key',
      body:  'API service rejected the provided authentication credentials.',
    },
    QUOTA_EXCEEDED: {
      icon:  '⏳',
      title: 'Rate Limit Reached (429)',
      body:  'Free tier rate limit reached. All submit buttons are temporarily paused.',
    },
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
      <p class="error-message">${esc(message)}</p>
    </div>`;
}
