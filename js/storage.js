// =============================================================
// RecoverAI — Transactional Storage Manager (Isomorphic)
// Safe LocalStorage Wrapper | Memory Fallback | Optimistic Rollback
// =============================================================

'use strict';

/**
 * Memory Storage Fallback for non-browser/restricted sandboxes.
 * @type {Map<string, string>}
 */
const memoryStorage = new Map();

/**
 * Storage Manager offering safe getters/setters and transactional rollback.
 * Resilient to third-party restricted iframe sandboxes, private browsing, and Node environments.
 */
const StorageManager = {
  /**
   * Safely reads a value from localStorage or in-memory fallback.
   *
   * @param {string} key - Storage key name.
   * @param {string|null} [fallback=null] - Default value if key is missing or unreadable.
   * @returns {string|null}
   */
  get(key, fallback = null) {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        return val !== null ? val : fallback;
      }
    } catch (_) {
      // Access denied / restricted sandbox
    }
    return memoryStorage.has(key) ? memoryStorage.get(key) : fallback;
  },

  /**
   * Safely writes a key-value pair to localStorage or in-memory fallback.
   *
   * @param {string} key - Storage key name.
   * @param {*} value - Value to serialize and store.
   * @returns {boolean} True if write succeeded.
   */
  set(key, value) {
    const stringVal = String(value);
    memoryStorage.set(key, stringVal);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, stringVal);
      }
      return true;
    } catch (_) {
      return true; // Succeeded in memory fallback
    }
  },

  /**
   * Removes a key from localStorage and memory storage.
   *
   * @param {string} key
   * @returns {boolean}
   */
  remove(key) {
    memoryStorage.delete(key);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return true;
    } catch (_) {
      return true;
    }
  },

  /**
   * Executes an optimistic state modification with automatic rollback on failure.
   *
   * @template T
   * @param {string} key - Storage key to mutate.
   * @param {function(string|null): *} mutator - Transform function receiving old value.
   * @param {function(): Promise<T>} asyncOperation - Async task to perform with optimistic state.
   * @returns {Promise<T>} Result of the async operation.
   */
  async executeOptimistic(key, mutator, asyncOperation) {
    const oldValue = this.get(key);
    const newValue = mutator(oldValue);

    this.set(key, newValue);

    try {
      const result = await asyncOperation();
      return result;
    } catch (error) {
      // Rollback to original value on failure
      if (oldValue !== null) {
        this.set(key, oldValue);
      } else {
        this.remove(key);
      }
      throw error;
    }
  },
};

// Export for Node.js test environment if present
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager };
}
