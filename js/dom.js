// =============================================================
// RecoverAI — DOM & Accessibility Utility Module
// Declarative Utilities | Event Delegation | Screen Reader Announcer
// =============================================================

'use strict';

/**
 * High-performance DOM Selector and Cache Engine.
 */
const DOM = {
  cache: new Map(),

  /**
   * Retrieves element by ID with Map-backed caching.
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  get(id) {
    if (!this.cache.has(id)) {
      const el = document.getElementById(id);
      if (el) this.cache.set(id, el);
      return el;
    }
    return this.cache.get(id);
  },

  /**
   * Returns Array of elements matching selector.
   * @param {string} selector
   * @returns {HTMLElement[]}
   */
  queryAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  },

  /**
   * Binds event delegation listener to a container element.
   *
   * @param {HTMLElement|string} container - Container element or ID.
   * @param {string} eventName - Event type (e.g. 'click').
   * @param {string} targetSelector - Selector for delegated targets.
   * @param {function(Event, HTMLElement): void} handler - Callback.
   */
  delegate(container, eventName, targetSelector, handler) {
    let el;
    if (typeof container === 'string') {
      // Support both raw IDs and CSS selectors (e.g. '.mood-grid', '#my-id')
      el = container.startsWith('.') || container.startsWith('#')
        ? document.querySelector(container)
        : this.get(container);
    } else {
      el = container;
    }
    if (!el) return;

    el.addEventListener(eventName, (e) => {
      const target = e.target.closest(targetSelector);
      if (target && el.contains(target)) {
        handler(e, target);
      }
    });
  },

  /**
   * Announces a text message to screen readers via an invisible live region.
   *
   * @param {string} message - Announcement text.
   * @param {'polite'|'assertive'} [politeness='polite'] - ARIA politeness level.
   */
  announce(message, politeness = 'polite') {
    let announcer = this.get('a11y-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'a11y-announcer';
      announcer.className = 'sr-only';
      announcer.setAttribute('aria-live', politeness);
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
      this.cache.set('a11y-announcer', announcer);
    }

    // Force DOM update trigger for assistive technology
    announcer.textContent = '';
    setTimeout(() => {
      announcer.textContent = message;
    }, 50);
  },

  /**
   * Escapes HTML entities in dynamic strings to prevent XSS attacks.
   *
   * @param {*} str - Input value.
   * @returns {string} Escaped string.
   */
  escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  },
};

// Export for Node.js test environment if present
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DOM };
}
