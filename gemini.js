// =============================================================
// RecoverAI — Gemini API Service
// Handles text + vision calls to Gemini 2.0 Flash (free tier)
// Architecture: Browser → Gemini REST API directly — no backend required.
// ⚠️  API key is NEVER hardcoded. User configures it via the ⚙️ Settings modal.
// =============================================================

// Supported free-tier model. Fallback: 'gemini-1.5-flash'
const GEMINI_MODEL = 'gemini-2.0-flash';
const API_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Reads the Gemini API key exclusively from localStorage.
 * Key is never hardcoded — user must set it via the ⚙️ Settings modal.
 * @returns {string} trimmed API key, or empty string if not configured
 */
function getApiKey() {
  return (localStorage.getItem('recoverai_key') || '').trim();
}

/**
 * Calls the Gemini API with optional image input.
 *
 * @param {string} prompt - The full prompt string
 * @param {string|null} imageBase64 - Base64-encoded image (no data URL prefix)
 * @param {string} mimeType - MIME type of the image (e.g. 'image/jpeg')
 * @returns {Promise<Object>} - Parsed JSON response from Gemini
 */
async function callGemini(prompt, imageBase64 = null, mimeType = 'image/jpeg') {
  const key = getApiKey();

  // Validate key is present and plausibly formatted (Google API keys are 39 chars)
  if (!key || key.length < 20) {
    throw new Error('API_KEY_MISSING');
  }

  // Build the parts array — text first, then optional image
  const parts = [{ text: prompt }];

  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: imageBase64,
      },
    });
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 1200,
      topP: 0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  let response;
  try {
    response = await fetch(`${API_BASE}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr) {
    throw new Error('Network error — please check your internet connection.');
  }

  if (!response.ok) {
    // Extract Gemini's developer error message if available
    let apiMsg = '';
    try { apiMsg = (await response.json())?.error?.message || ''; } catch (_) {}

    // Map HTTP status codes to user-friendly, actionable errors
    if (response.status === 400) throw new Error(`Bad request — ${apiMsg || 'check your prompt or API key format.'}`);
    if (response.status === 401 || response.status === 403) throw new Error('API_KEY_INVALID');
    if (response.status === 429) {
      // Read Retry-After if the server sends it; fall back to 60s
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      throw new Error(`QUOTA_EXCEEDED:${retryAfter}`);
    }
    if (response.status >= 500)  throw new Error('Gemini service is temporarily unavailable. Try again in a moment.');
    throw new Error(apiMsg || `Gemini API error (${response.status})`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!rawText) {
    const reason = data?.candidates?.[0]?.finishReason;
    if (reason === 'SAFETY') throw new Error('Response blocked by safety filter. Please rephrase your input.');
    throw new Error('Received an empty response from Gemini.');
  }

  return parseGeminiJSON(rawText);
}

/**
 * Strips markdown fences and parses JSON from Gemini's response.
 * Falls back to a raw-text wrapper if parsing fails.
 *
 * @param {string} text - Raw text from the Gemini API
 * @returns {Object}
 */
function parseGeminiJSON(text) {
  // Remove ```json ... ``` or ``` ... ``` code fences
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Return raw text in a fallback wrapper for graceful degradation
    return { _raw: text, _parseError: true };
  }
}
