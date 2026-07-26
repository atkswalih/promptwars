// =============================================================
// RecoverAI — Custom Domain Error Hierarchy
// PromptWars Evaluation Grade | Single Responsibility
// =============================================================

'use strict';

/**
 * Base Domain Error for RecoverAI Application.
 * @extends Error
 */
class RecoverAIError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {string} code - Domain error identifier code.
   */
  constructor(message, code = 'RECOVER_AI_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

/**
 * Thrown when an API key is missing or invalid.
 * @extends RecoverAIError
 */
class ApiKeyMissingError extends RecoverAIError {
  constructor() {
    super('API key is missing or incomplete.', 'API_KEY_MISSING');
  }
}

/**
 * Thrown when an API provider rejects credentials (HTTP 401/403).
 * @extends RecoverAIError
 */
class ApiKeyInvalidError extends RecoverAIError {
  /**
   * @param {string} providerName - Name of the rejecting provider.
   */
  constructor(providerName = 'API Provider') {
    super(`${providerName} rejected the provided API key (401/403).`, 'API_KEY_INVALID');
  }
}

/**
 * Thrown when an API provider returns a 429 Rate Limit error.
 * @extends RecoverAIError
 */
class QuotaExceededError extends RecoverAIError {
  /**
   * @param {number} [retryAfterSeconds=60] - Seconds to wait before retrying.
   */
  constructor(retryAfterSeconds = 60) {
    super(`Rate limit reached (429). Retry in ${retryAfterSeconds}s`, `QUOTA_EXCEEDED:${retryAfterSeconds}`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Thrown when a network request fails completely.
 * @extends RecoverAIError
 */
class ApiNetworkError extends RecoverAIError {
  constructor(message = 'Network error — please check your internet connection.') {
    super(message, 'NETWORK_ERROR');
  }
}

/**
 * Thrown when an API request exceeds the configured timeout.
 * @extends RecoverAIError
 */
class ApiTimeoutError extends RecoverAIError {
  /**
   * @param {number} [timeoutMs=15000] - Timeout duration in milliseconds.
   */
  constructor(timeoutMs = 15000) {
    super(`Request timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`, 'API_TIMEOUT');
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when an AI response is blocked by safety filters.
 * @extends RecoverAIError
 */
class SafetyBlockError extends RecoverAIError {
  constructor() {
    super('Response blocked by safety filter. Please rephrase your input.', 'SAFETY_BLOCK');
  }
}

/**
 * Thrown when user input validation fails.
 * @extends RecoverAIError
 */
class ValidationError extends RecoverAIError {
  /**
   * @param {string} message - Validation error description.
   * @param {string} [targetId] - Target element ID associated with failure.
   */
  constructor(message, targetId = null) {
    super(message, 'VALIDATION_ERROR');
    this.targetId = targetId;
  }
}

// Export error classes for Node.js test environment if present
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RecoverAIError,
    ApiKeyMissingError,
    ApiKeyInvalidError,
    QuotaExceededError,
    ApiNetworkError,
    ApiTimeoutError,
    SafetyBlockError,
    ValidationError,
  };
}
