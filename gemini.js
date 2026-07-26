// =============================================================
// RecoverAI — AI API Service Layer (Top-Tier Competitor Grade)
// AbortController Timeout (15s) | Sanitized JSON Parser | Dual-Provider
// =============================================================

'use strict';

if (typeof require !== 'undefined' && typeof global !== 'undefined') {
  try {
    const errors = require('./js/errors.js');
    Object.assign(global, errors);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────
// PROVIDER CONFIGURATION REGISTRY (IMMUTABLE)
// ─────────────────────────────────────────────────────────────

const PROVIDERS = Object.freeze({
  GEMINI: Object.freeze({
    id:       'gemini',
    name:     'Google Gemini',
    label:    '✨ Gemini 2.0 Flash',
    model:    'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    detect:   (key) => typeof key === 'string' && key.trim().startsWith('AIza'),
  }),
  GROQ: Object.freeze({
    id:       'groq',
    name:     'Groq Cloud',
    label:    '⚡ Groq (llama-3.3-70b)',
    model:    'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    detect:   (key) => typeof key === 'string' && key.trim().startsWith('gsk_'),
  }),
});

const API_TIMEOUT_MS = 15000; // 15-second strict request timeout

/**
 * Reads the active API key safely from localStorage with a fallback demo key.
 * @returns {string} Trimmed API key.
 */
function getApiKey() {
  const DEMO_KEY = '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';
  let savedKey = '';
  try {
    savedKey = localStorage.getItem('recoverai_key') || '';
  } catch (_) {
    // Sandbox fallback
  }
  return (savedKey || DEMO_KEY).trim();
}

/**
 * Detects the active provider ('gemini' | 'groq' | null) from the API key prefix.
 * @param {string} key
 * @returns {'gemini'|'groq'|null}
 */
function detectProvider(key) {
  const sanitized = String(key ?? '').trim();
  if (!sanitized) return null;
  if (PROVIDERS.GROQ.detect(sanitized))   return PROVIDERS.GROQ.id;
  if (PROVIDERS.GEMINI.detect(sanitized)) return PROVIDERS.GEMINI.id;
  return null;
}

/**
 * Returns the human-readable label of the currently active provider.
 * @returns {string|null}
 */
function getProviderLabel() {
  const key = getApiKey();
  const providerId = detectProvider(key);
  if (providerId === PROVIDERS.GROQ.id)   return PROVIDERS.GROQ.label;
  if (providerId === PROVIDERS.GEMINI.id) return PROVIDERS.GEMINI.label;
  return null;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API FACADE
// ─────────────────────────────────────────────────────────────

/**
 * Unified entry point for AI text generation.
 * Routes dynamically to Gemini or Groq based on key prefix with strict 15s timeout.
 *
 * @param {string} prompt - Fully formed prompt string.
 * @returns {Promise<Object>} Parsed JSON response object.
 */
async function callGemini(prompt) {
  const key        = getApiKey();
  const providerId = detectProvider(key);

  if (!key || key.length < 20) throw new ApiKeyMissingError();
  if (!providerId)             throw new RecoverAIError('Unrecognized API key format.', 'API_KEY_UNKNOWN_FORMAT');

  if (providerId === PROVIDERS.GROQ.id) {
    return _callGroq(key, prompt);
  }

  return _callGemini(key, prompt);
}

// ─────────────────────────────────────────────────────────────
// PROVIDER IMPLEMENTATIONS WITH ABORT CONTROLLER TIMEOUT
// ─────────────────────────────────────────────────────────────

async function _callGemini(key, prompt) {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
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
    response = await fetch(`${PROVIDERS.GEMINI.endpoint}?key=${key}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(requestBody),
      signal:  controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiTimeoutError(API_TIMEOUT_MS);
    throw new ApiNetworkError();
  } finally {
    clearTimeout(timeoutId);
  }

  await _assertResponseOk(response, PROVIDERS.GEMINI.name);

  const data    = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!rawText) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') throw new SafetyBlockError();
    throw new RecoverAIError('Received an empty response from Gemini.', 'EMPTY_RESPONSE');
  }

  return _parseJSON(rawText);
}

async function _callGroq(key, prompt) {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const requestBody = {
    model:           PROVIDERS.GROQ.model,
    messages:        [{ role: 'user', content: prompt }],
    temperature:     0.75,
    max_tokens:      1200,
    response_format: { type: 'json_object' },
  };

  let response;
  try {
    response = await fetch(PROVIDERS.GROQ.endpoint, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body:   JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiTimeoutError(API_TIMEOUT_MS);
    throw new ApiNetworkError();
  } finally {
    clearTimeout(timeoutId);
  }

  await _assertResponseOk(response, PROVIDERS.GROQ.name);

  const data    = await response.json();
  const rawText = data?.choices?.[0]?.message?.content || '';

  if (!rawText) throw new RecoverAIError('Received an empty response from Groq.', 'EMPTY_RESPONSE');

  return _parseJSON(rawText);
}

// ─────────────────────────────────────────────────────────────
// PRIVATE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

async function _assertResponseOk(response, providerName) {
  if (response.ok) return;

  let apiErrorMessage = '';
  try {
    const errorJson = await response.json();
    apiErrorMessage = errorJson?.error?.message || errorJson?.message || '';
  } catch (_) {
    // Unparseable body
  }

  if (response.status === 400) throw new RecoverAIError(`Bad request — ${apiErrorMessage || 'check input format.'}`, 'BAD_REQUEST');
  if (response.status === 401 || response.status === 403) throw new ApiKeyInvalidError(providerName);
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    throw new QuotaExceededError(retryAfter);
  }
  if (response.status >= 500) throw new RecoverAIError(`${providerName} service is temporarily unavailable. Try again in a moment.`, 'SERVER_ERROR');

  throw new RecoverAIError(apiErrorMessage || `${providerName} API error (${response.status})`, 'API_ERROR');
}

/**
 * Strips markdown code fences and control characters, returning parsed JSON object.
 *
 * @param {string} rawText
 * @returns {Object}
 */
function _parseJSON(rawText) {
  if (typeof rawText !== 'string') return { _raw: rawText, _parseError: true };

  const clean = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch (err) {
    return { _raw: rawText, _parseError: true, _errorMsg: err.message, _cleanText: clean };
  }
}

// Export for Node.js test environment if present
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { _parseJSON, detectProvider, getApiKey, callGemini, getProviderLabel };
}

// Explicitly expose to browser global scope (defensive — ensures availability
// even if strict-mode, CSP, or bundler quirks shadow top-level declarations)
if (typeof window !== 'undefined') {
  window.callGemini      = callGemini;
  window.getApiKey        = getApiKey;
  window.detectProvider   = detectProvider;
  window.getProviderLabel = getProviderLabel;
}
