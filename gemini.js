// =============================================================
// RecoverAI — AI API Service
// Supports two providers, auto-detected from the API key prefix:
//   · Gemini (AIzaSy…) — Google, multimodal (text + vision)
//   · Groq   (gsk_…)   — Groq Cloud, text-only, higher free limits
//
// Architecture: Browser → Provider REST API directly.
// ⚠️  API key is NEVER hardcoded — configured via ⚙️ Settings modal.
// =============================================================

/* ── Provider config ─────────────────────────────────────── */
const PROVIDERS = {
  gemini: {
    model   : 'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    detect  : (key) => key.startsWith('AIza'),
  },
  groq: {
    model   : 'llama-3.3-70b-versatile',   // Best free Groq model — 30 RPM free
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    detect  : (key) => key.startsWith('gsk_'),
  },
};

/**
 * Reads the API key exclusively from localStorage.
 * Key is never hardcoded — user must set it via the ⚙️ Settings modal.
 * @returns {string} trimmed key or empty string
 */
function getApiKey() {
  const DEMO_KEY = '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';
  let saved = '';
  try {
    saved = localStorage.getItem('recoverai_key') || '';
  } catch (_) {}
  return (saved || DEMO_KEY).trim();
}


/**
 * Detects the active provider ('gemini' | 'groq' | null) from the key prefix.
 * @param {string} key
 * @returns {'gemini'|'groq'|null}
 */
function detectProvider(key) {
  for (const [name, cfg] of Object.entries(PROVIDERS)) {
    if (cfg.detect(key)) return name;
  }
  return null;
}

/**
 * Returns the detected provider name for display in the UI.
 * Called by app.js to label the active provider in the settings modal.
 */
function getProviderLabel() {
  const key = getApiKey();
  const p   = detectProvider(key);
  if (p === 'groq')   return '⚡ Groq (llama-3.3-70b)';
  if (p === 'gemini') return '✨ Gemini 2.0 Flash';
  return null;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API — called by app.js
// ─────────────────────────────────────────────────────────────

/**
 * Unified entry point. Routes to Gemini or Groq based on key prefix.
 *
 * @param {string}      prompt       - Full prompt string
 * @param {string|null} imageBase64  - Base64 image (no data URL prefix); Gemini only
 * @param {string}      mimeType     - Image MIME type
 * @returns {Promise<Object>}        - Parsed JSON from the AI
 */
async function callGemini(prompt, imageBase64 = null, mimeType = 'image/jpeg') {
  const key      = getApiKey();
  const provider = detectProvider(key);

  if (!key || key.length < 20) throw new Error('API_KEY_MISSING');
  if (!provider)               throw new Error('API_KEY_UNKNOWN_FORMAT');

  if (provider === 'groq') {
    if (imageBase64) {
      console.warn('[RecoverAI] Groq does not support image input — sending text only.');
    }
    return _callGroq(key, prompt);
  }

  return _callGemini(key, prompt, imageBase64, mimeType);
}

// ─────────────────────────────────────────────────────────────
// GEMINI IMPLEMENTATION
// ─────────────────────────────────────────────────────────────
async function _callGemini(key, prompt, imageBase64, mimeType) {
  const parts = [{ text: prompt }];

  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.75, maxOutputTokens: 1200, topP: 0.9 },
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT',         threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',  threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  let response;
  try {
    response = await fetch(`${PROVIDERS.gemini.endpoint}?key=${key}`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(body),
    });
  } catch (_) {
    throw new Error('Network error — please check your internet connection.');
  }

  _assertOk(response, 'Gemini');

  const data    = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!rawText) {
    const reason = data?.candidates?.[0]?.finishReason;
    if (reason === 'SAFETY') throw new Error('Response blocked by safety filter. Please rephrase your input.');
    throw new Error('Received an empty response from Gemini.');
  }

  return _parseJSON(rawText);
}

// ─────────────────────────────────────────────────────────────
// GROQ IMPLEMENTATION  (OpenAI-compatible chat completions API)
// ─────────────────────────────────────────────────────────────
async function _callGroq(key, prompt) {
  const body = {
    model   : PROVIDERS.groq.model,
    messages : [{ role: 'user', content: prompt }],
    temperature    : 0.75,
    max_tokens     : 1200,
    response_format: { type: 'json_object' },  // enforce JSON output
  };

  let response;
  try {
    response = await fetch(PROVIDERS.groq.endpoint, {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (_) {
    throw new Error('Network error — please check your internet connection.');
  }

  _assertOk(response, 'Groq');

  const data    = await response.json();
  const rawText = data?.choices?.[0]?.message?.content || '';

  if (!rawText) throw new Error('Received an empty response from Groq.');

  return _parseJSON(rawText);
}

// ─────────────────────────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Asserts response.ok and throws typed errors for known HTTP status codes.
 * Shared between Gemini and Groq error handling.
 */
async function _assertOk(response, providerName) {
  if (response.ok) return;

  let apiMsg = '';
  try {
    const err = await response.json();
    apiMsg = err?.error?.message || err?.message || '';
  } catch (_) {}

  if (response.status === 400) throw new Error(`Bad request — ${apiMsg || 'check your prompt format.'}`);
  if (response.status === 401 || response.status === 403) throw new Error('API_KEY_INVALID');
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
    throw new Error(`QUOTA_EXCEEDED:${retryAfter}`);
  }
  if (response.status >= 500) throw new Error(`${providerName} service is temporarily unavailable. Try again in a moment.`);
  throw new Error(apiMsg || `${providerName} API error (${response.status})`);
}

/**
 * Strips markdown code fences and parses JSON.
 * Falls back to { _raw, _parseError } for graceful UI degradation.
 */
function _parseJSON(text) {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return { _raw: text, _parseError: true };
  }
}
