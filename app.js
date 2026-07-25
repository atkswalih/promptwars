// =============================================================
// RecoverAI — Application Logic
// Handles: tabs, SOS flow, Check-In flow, Caregiver flow,
//          settings modal, streak, loading states, rendering.
// =============================================================

'use strict';

/* ── Tiny DOM helpers ─────────────────────────────────────── */
const $  = (id)  => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

/* ── App State ────────────────────────────────────────────── */
const state = {
  selectedMood:      null,   // 1–5
  selectedMoodLabel: '',
  sosImageBase64:    null,   // base64 string (no data URL prefix)
  sosImageMimeType:  'image/jpeg',
};

/* ── Rate-limit cooldown state ─────────────────────────── */
const cooldown = {
  timer:   null,    // setTimeout reference for the tick
  seconds: 0,       // remaining seconds
  active:  false,   // true while countdown is running
  pending: 0,       // seconds to start after finally{} runs
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
});


/* ═══════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════ */
function initTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  /* Update buttons */
  $$('.tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tabId;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', String(isActive));
  });

  /* Update panels */
  $$('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${tabId}-tab`);
  });
}

/* ═══════════════════════════════════════════════════════════
   STREAK (localStorage)
   ═══════════════════════════════════════════════════════════ */
function initStreak() {
  const streak = getStreak();
  $('streak-count').textContent = streak;
}

function getStreak() {
  return parseInt(localStorage.getItem('recoverai_streak') || '0', 10);
}

function incrementStreak() {
  const lastDate = localStorage.getItem('recoverai_last_checkin');
  const today    = new Date().toDateString();

  if (lastDate === today) return; // already checked in today

  const next = getStreak() + 1;
  localStorage.setItem('recoverai_streak', String(next));
  localStorage.setItem('recoverai_last_checkin', today);

  /* Animate the streak counter */
  const el = $('streak-count');
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
   SOS FEATURE
   ═══════════════════════════════════════════════════════════ */
function initSOS() {
  /* Pulsing button scrolls to textarea */
  $('sos-pulse-btn').addEventListener('click', () => {
    $('sos-textarea').focus();
    $('sos-textarea').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* Submit */
  $('sos-submit').addEventListener('click', handleSOSSubmit);
}



async function handleSOSSubmit() {
  const input = $('sos-textarea').value.trim();
  if (!input) {
    flashError('sos-textarea', 'Please describe what\'s happening first.');
    return;
  }

  const responseEl = $('sos-response');
  setLoading('sos-submit', true);
  responseEl.classList.add('hidden');

  try {
    const prompt = PROMPTS.sos(input);
    const data   = await callGemini(prompt);
    responseEl.innerHTML = renderSOSResponse(data);
    responseEl.classList.remove('hidden');
    scrollIntoView(responseEl);
  } catch (err) {
    responseEl.innerHTML = renderError(err.message);
    responseEl.classList.remove('hidden');
    scrollIntoView(responseEl);
    if (err.message.startsWith('QUOTA_EXCEEDED')) {
      cooldown.pending = parseInt(err.message.split(':')[1] || '60', 10);
    }
  } finally {
    setLoading('sos-submit', false);
    if (cooldown.pending > 0) { startCooldown(cooldown.pending); cooldown.pending = 0; }
  }
}

/* ═══════════════════════════════════════════════════════════
   CHECK-IN FEATURE
   ═══════════════════════════════════════════════════════════ */
function initCheckin() {
  /* Mood button selection */
  $$('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.mood-btn').forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      state.selectedMood      = parseInt(btn.dataset.mood, 10);
      state.selectedMoodLabel = btn.dataset.label;
    });
  });

  $('checkin-submit').addEventListener('click', handleCheckinSubmit);
}

async function handleCheckinSubmit() {
  if (!state.selectedMood) {
    /* Highlight the mood grid */
    const grid = document.querySelector('.mood-grid');
    grid.style.outline = '2px solid var(--sos)';
    grid.style.borderRadius = '8px';
    setTimeout(() => { grid.style.outline = ''; }, 2000);
    return;
  }

  const context    = $('checkin-textarea').value.trim();
  const streak     = getStreak();
  const responseEl = $('checkin-response');

  setLoading('checkin-submit', true);
  responseEl.classList.add('hidden');

  try {
    const prompt = PROMPTS.checkin(state.selectedMood, state.selectedMoodLabel, context, streak);
    const data   = await callGemini(prompt);
    responseEl.innerHTML = renderCheckinResponse(data);
    responseEl.classList.remove('hidden');
    scrollIntoView(responseEl);
    incrementStreak(); // Only increment after a successful check-in
  } catch (err) {
    responseEl.innerHTML = renderError(err.message);
    responseEl.classList.remove('hidden');
    if (err.message.startsWith('QUOTA_EXCEEDED')) {
      cooldown.pending = parseInt(err.message.split(':')[1] || '60', 10);
    }
  } finally {
    setLoading('checkin-submit', false);
    if (cooldown.pending > 0) { startCooldown(cooldown.pending); cooldown.pending = 0; }
  }
}

/* ═══════════════════════════════════════════════════════════
   CAREGIVER FEATURE
   ═══════════════════════════════════════════════════════════ */
function initCaregiver() {
  $('caregiver-submit').addEventListener('click', handleCaregiverSubmit);
}

async function handleCaregiverSubmit() {
  const situation  = $('caregiver-textarea').value.trim();
  const responseEl = $('caregiver-response');

  if (!situation) {
    flashError('caregiver-textarea', 'Please describe the situation first.');
    return;
  }

  setLoading('caregiver-submit', true);
  responseEl.classList.add('hidden');

  try {
    const prompt = PROMPTS.caregiver(situation);
    const data   = await callGemini(prompt);
    responseEl.innerHTML = renderCaregiverResponse(data);
    responseEl.classList.remove('hidden');
    scrollIntoView(responseEl);
  } catch (err) {
    responseEl.innerHTML = renderError(err.message);
    responseEl.classList.remove('hidden');
    if (err.message.startsWith('QUOTA_EXCEEDED')) {
      cooldown.pending = parseInt(err.message.split(':')[1] || '60', 10);
    }
  } finally {
    setLoading('caregiver-submit', false);
    if (cooldown.pending > 0) { startCooldown(cooldown.pending); cooldown.pending = 0; }
  }
}


/* ═══════════════════════════════════════════════════════════
   RATE-LIMIT COOLDOWN ENGINE
   Disables all submit buttons for N seconds when Gemini returns 429.
   Countdown is displayed live in each button’s text.
   ═══════════════════════════════════════════════════════════ */

/** Map of submit button IDs → their original label text */
const SUBMIT_BTNS = {
  'sos-submit':       'Get Support Now',
  'checkin-submit':   'Get My Daily Plan',
  'caregiver-submit': 'Get Guidance',
};

/**
 * Starts the global cooldown across all submit buttons.
 * Called from a handler’s finally{} so setLoading(false) has already run.
 * @param {number} totalSeconds
 */
function startCooldown(totalSeconds) {
  if (cooldown.active) return;          // don’t stack cooldowns
  cooldown.active  = true;
  cooldown.seconds = totalSeconds;
  clearTimeout(cooldown.timer);
  _tickCooldown();
}

function _tickCooldown() {
  if (cooldown.seconds <= 0) { _endCooldown(); return; }

  /* Update every submit button: disable + show live countdown */
  Object.keys(SUBMIT_BTNS).forEach(id => {
    const btn    = $(id);
    const text   = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    btn.disabled = true;
    btn.dataset.cooldown = 'true';
    if (loader) loader.classList.add('hidden');
    if (text)  { text.classList.remove('hidden'); text.textContent = `⏳ Retry in ${cooldown.seconds}s`; }
  });

  cooldown.seconds--;
  cooldown.timer = setTimeout(_tickCooldown, 1000);
}

function _endCooldown() {
  clearTimeout(cooldown.timer);
  cooldown.active  = false;
  cooldown.seconds = 0;

  /* Restore all submit buttons to original state */
  Object.entries(SUBMIT_BTNS).forEach(([id, label]) => {
    const btn  = $(id);
    const text = btn.querySelector('.btn-text');
    btn.disabled = false;
    delete btn.dataset.cooldown;
    if (text) text.textContent = label;
  });
}

/* ═══════════════════════════════════════════════════════════
   UI UTILITIES
   ═══════════════════════════════════════════════════════════ */

/** Toggle loading state on a submit button */
function setLoading(btnId, isLoading) {
  const btn    = $(btnId);
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = isLoading;
  text.classList.toggle('hidden',  isLoading);
  loader.classList.toggle('hidden', !isLoading);
}

/** Flash textarea border red for 2s */
function flashError(inputId, _message) {
  const el = $(inputId);
  el.style.borderColor = 'var(--sos)';
  el.style.boxShadow   = '0 0 0 3px rgba(244,63,94,0.15)';
  el.focus();
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow   = '';
  }, 2000);
}

/** Smooth-scroll element into view */
function scrollIntoView(el) {
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

/** Escape HTML to prevent XSS */
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

/* ── SOS Response ─────────────────────────────────────────── */
function renderSOSResponse(data) {
  /* Graceful degradation: Gemini returned raw text, not JSON */
  if (data._raw || data._parseError) {
    return `
      <div class="resp-card">
        <div class="resp-card-header">
          <span class="resp-card-icon">💚</span>
          <span class="resp-card-title">Support Response</span>
        </div>
        <p class="insight-text">${esc(data._raw || 'No response received.')}</p>
      </div>`;
  }

  const risk = (['LOW', 'MEDIUM', 'HIGH'].includes(data.riskLevel))
    ? data.riskLevel
    : 'MEDIUM';

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
    <!-- Validation + Risk Level -->
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💚</span>
        <span class="resp-card-title">We hear you</span>
        <span class="risk-badge risk-${risk}" aria-label="Risk level: ${riskLabel[risk]}">
          ${riskIcon[risk]} ${riskLabel[risk]}
        </span>
      </div>
      <p class="validation-text">${esc(data.validation || '')}</p>
    </div>

    <!-- Coping Strategies -->
    ${strategies ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">🛡️</span>
        <span class="resp-card-title">Coping Strategies</span>
      </div>
      <ul class="strategy-list" aria-label="Coping strategies">${strategies}</ul>
    </div>` : ''}

    <!-- Grounding Exercise -->
    ${data.groundingExercise ? `
    <div class="grounding-card">
      <div class="grounding-title">⚡ 60-Second Grounding Exercise</div>
      <p class="grounding-text">${esc(data.groundingExercise)}</p>
    </div>` : ''}

    <!-- When to Seek Help -->
    ${data.helpGuidance ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">📞</span>
        <span class="resp-card-title">When to Seek Help</span>
      </div>
      <p class="insight-text">${esc(data.helpGuidance)}</p>
    </div>` : ''}`;
}

/* ── Check-In Response ────────────────────────────────────── */
function renderCheckinResponse(data) {
  if (data._raw || data._parseError) {
    return `
      <div class="resp-card">
        <div class="resp-card-header">
          <span class="resp-card-icon">💬</span>
          <span class="resp-card-title">Your Coach</span>
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
    <!-- Reflection -->
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💬</span>
        <span class="resp-card-title">Your AI Coach</span>
      </div>
      <p class="insight-text">${esc(data.reflection || '')}</p>
    </div>

    <!-- Insight -->
    ${data.insight ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💡</span>
        <span class="resp-card-title">Today's Insight</span>
      </div>
      <p class="insight-text">${esc(data.insight)}</p>
    </div>` : ''}

    <!-- Daily Plan -->
    ${plan ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">📅</span>
        <span class="resp-card-title">Your Plan for Today</span>
      </div>
      <ul class="plan-list" aria-label="Daily recovery plan">${plan}</ul>
    </div>` : ''}

    <!-- Trigger Warning -->
    ${data.triggerWarning ? `
    <div class="trigger-card" role="note" aria-label="Today's trigger warnings">
      <div class="trigger-title">⚠️ Watch Out Today</div>
      <p class="trigger-text">${esc(data.triggerWarning)}</p>
    </div>` : ''}

    <!-- Affirmation -->
    ${data.affirmation ? `
    <div class="affirmation-card">
      <p class="affirmation-quote">${esc(data.affirmation)}</p>
    </div>` : ''}`;
}

/* ── Caregiver Response ───────────────────────────────────── */
function renderCaregiverResponse(data) {
  if (data._raw || data._parseError) {
    return `
      <div class="resp-card">
        <div class="resp-card-header">
          <span class="resp-card-icon">🤝</span>
          <span class="resp-card-title">Guidance</span>
        </div>
        <p class="insight-text">${esc(data._raw || '')}</p>
      </div>`;
  }

  const whatToSay    = Array.isArray(data.whatToSay)
    ? data.whatToSay.map(s => `<li>${esc(s)}</li>`).join('')
    : '';
  const whatNotToSay = Array.isArray(data.whatNotToSay)
    ? data.whatNotToSay.map(s => `<li>${esc(s)}</li>`).join('')
    : '';
  const actions      = Array.isArray(data.actionSteps)
    ? data.actionSteps.map((s, i) => `
        <li class="action-item">
          <span class="action-num" aria-hidden="true">${i + 1}</span>
          <span>${esc(s)}</span>
        </li>`).join('')
    : '';

  return `
    <!-- Situation Assessment -->
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">🤝</span>
        <span class="resp-card-title">Situation Assessment</span>
      </div>
      <p class="assessment-text">${esc(data.assessment || '')}</p>
    </div>

    <!-- What to Say / Not Say -->
    ${(whatToSay || whatNotToSay) ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">💬</span>
        <span class="resp-card-title">Words That Help vs. Hurt</span>
      </div>
      <div class="two-col">
        <div class="say-card">
          <div class="col-title">✓ Say This</div>
          <ul class="col-list" aria-label="Phrases to say">${whatToSay}</ul>
        </div>
        <div class="dont-say-card">
          <div class="col-title">✗ Avoid This</div>
          <ul class="col-list" aria-label="Phrases to avoid">${whatNotToSay}</ul>
        </div>
      </div>
    </div>` : ''}

    <!-- Action Steps -->
    ${actions ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">📋</span>
        <span class="resp-card-title">Action Steps</span>
      </div>
      <ul class="action-list" aria-label="Recommended action steps">${actions}</ul>
    </div>` : ''}

    <!-- Escalation Signals -->
    ${data.escalationSignals ? `
    <div class="escalation-card" role="alert">
      <div class="escalation-title">🚨 When to Escalate</div>
      <p class="escalation-text">${esc(data.escalationSignals)}</p>
    </div>` : ''}

    <!-- Caregiver Self-Care -->
    ${data.selfCare ? `
    <div class="resp-card">
      <div class="resp-card-header">
        <span class="resp-card-icon" aria-hidden="true">🌿</span>
        <span class="resp-card-title">Your Self-Care Reminder</span>
      </div>
      <p class="selfcare-text">${esc(data.selfCare)}</p>
    </div>` : ''}`;
}

/* ── Error Response ───────────────────────────────────────── */
function renderError(message) {
  /**
   * Named error codes mapped to user-friendly cards.
   * Each entry has: icon, title, html body.
   * Covers all failure modes from gemini.js:
   *   API_KEY_MISSING  → not configured
   *   API_KEY_INVALID  → 401 / 403 from Gemini
   *   QUOTA_EXCEEDED   → 429 rate limit
   */
  const KNOWN = {
    API_KEY_MISSING: {
      icon:  '🔑',
      title: 'API Key Required',
      body:  `Add your Gemini API key via the
              <button onclick="openSettingsModal()"
                style="color:var(--checkin);text-decoration:underline;font-size:inherit;cursor:pointer;">
                ⚙️&nbsp;Settings
              </button> button (top-right).
              Get a free key at
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener"
                 style="color:var(--checkin);text-decoration:underline;">Google AI Studio</a>.`,
    },
    API_KEY_INVALID: {
      icon:  '🔐',
      title: 'Invalid API Key (401 / 403)',
      body:  `Gemini or Groq rejected your key. Open <button onclick="openSettingsModal()"
              style="color:var(--checkin);text-decoration:underline;font-size:inherit;cursor:pointer;">
              ⚙️&nbsp;Settings</button> and paste a valid key.
              <br>• Gemini keys start with <code>AIzaSy…</code> — get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color:var(--checkin);text-decoration:underline;">Google AI Studio</a>.
              <br>• Groq keys start with <code>gsk_…</code> — get one at <a href="https://console.groq.com" target="_blank" rel="noopener" style="color:var(--checkin);text-decoration:underline;">console.groq.com</a>.`,
    },
    API_KEY_UNKNOWN_FORMAT: {
      icon:  '❓',
      title: 'Unrecognised Key Format',
      body:  `The key you entered isn\'t recognised as Gemini or Groq.
              <br>• Gemini keys start with <code>AIzaSy…</code>
              <br>• Groq keys start with <code>gsk_…</code>
              <br>Open <button onclick="openSettingsModal()"
              style="color:var(--checkin);text-decoration:underline;font-size:inherit;cursor:pointer;">⚙️&nbsp;Settings</button> and re-paste your key.`,
    },
    QUOTA_EXCEEDED: {
      icon:  '⏳',
      title: 'Rate Limit Reached (429)',
      body:  `Gemini\'s free tier allows ~15 requests/minute.
              All submit buttons are disabled — the countdown above each button
              will re-enable them automatically.
              Check your quota at
              <a href="https://aistudio.google.com" target="_blank" rel="noopener"
                 style="color:var(--checkin);text-decoration:underline;">Google AI Studio</a>.`,
    },
  };

  // QUOTA_EXCEEDED error format is "QUOTA_EXCEEDED:60" — parse seconds for the card
  let errorCode = message;
  let quotaSecs = 60;
  if (message.startsWith('QUOTA_EXCEEDED:')) {
    errorCode = 'QUOTA_EXCEEDED';
    quotaSecs = parseInt(message.split(':')[1] || '60', 10);
  }

  const known = KNOWN[errorCode];
  if (known) {
    const body = errorCode === 'QUOTA_EXCEEDED'
      ? known.body.replace('countdown above each button', `<strong>${quotaSecs}-second</strong> countdown above each button`)
      : known.body;
    return `
      <div class="error-card quota-card" role="alert">
        <p class="error-title">${known.icon} ${known.title}</p>
        <p class="error-message">${body}</p>
      </div>`;
  }

  // Generic fallback for any unclassified error (network timeouts, etc.)
  return `
    <div class="error-card" role="alert">
      <p class="error-title">⚠️ Something went wrong</p>
      <p class="error-message">${esc(message)}</p>
    </div>`;
}
