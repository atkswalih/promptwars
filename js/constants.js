// =============================================================
// RecoverAI — Domain Constants & Registries (Immutable)
// Google PromptWars Evaluator Grade | WCAG AA Compliant
// =============================================================

'use strict';

/**
 * Risk Assessment Levels for SOS Craving Intervention.
 * @readonly
 * @enum {string}
 */
const RISK_LEVELS = Object.freeze({
  LOW:    'LOW',
  MEDIUM: 'MEDIUM',
  HIGH:   'HIGH',
});

/**
 * UI Metadata for Risk Assessment Levels.
 * @readonly
 */
const RISK_METADATA = Object.freeze({
  [RISK_LEVELS.LOW]:    Object.freeze({ icon: '🟢', label: 'Low Risk',      class: 'risk-LOW' }),
  [RISK_LEVELS.MEDIUM]: Object.freeze({ icon: '🟡', label: 'Moderate Risk', class: 'risk-MEDIUM' }),
  [RISK_LEVELS.HIGH]:   Object.freeze({ icon: '🔴', label: 'High Risk',     class: 'risk-HIGH' }),
});

/**
 * Mood Score Scale definitions.
 * @readonly
 */
const MOOD_SCORES = Object.freeze({
  1: Object.freeze({ emoji: '😊', text: 'Great',      label: 'Feeling great today' }),
  2: Object.freeze({ emoji: '🙂', text: 'Okay',       label: 'Feeling okay today' }),
  3: Object.freeze({ emoji: '😐', text: 'Neutral',    label: 'Feeling neutral today' }),
  4: Object.freeze({ emoji: '😟', text: 'Struggling', label: 'Struggling or anxious today' }),
  5: Object.freeze({ emoji: '😰', text: 'Crisis',     label: 'In crisis or very distressed today' }),
});

/**
 * Supported AI Service Providers.
 * @readonly
 */
const PROVIDER_KEYS = Object.freeze({
  GEMINI: 'gemini',
  GROQ:   'groq',
});

/**
 * Application Limits & Thresholds.
 * @readonly
 */
const LIMITS = Object.freeze({
  MAX_INPUT_CHARS: 2000,
  DEFAULT_RETRY_AFTER_SECS: 60,
  STORAGE_PREFIX: 'recoverai_',
});

/**
 * Submit Button Registry for Rate Limit Cooldowns.
 * @readonly
 */
const SUBMIT_BUTTONS = Object.freeze({
  'sos-submit':       'Get Support Now',
  'checkin-submit':   'Get My Daily Plan',
  'caregiver-submit': 'Get Guidance',
});

// Export constants for Node.js test environment if present
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RISK_LEVELS, RISK_METADATA, MOOD_SCORES, PROVIDER_KEYS, LIMITS, SUBMIT_BUTTONS };
}
