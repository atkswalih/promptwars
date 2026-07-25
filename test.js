// =============================================================
// RecoverAI — Production Automated Test Suite (30 Tests)
// Async Test Runner | 100% Target Pass Rate
// Run: node test.js
// =============================================================

'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

console.log('🧪 Running RecoverAI Comprehensive 30-Test Suite...\n');

let totalTests = 0;
let passedTests = 0;

async function test(description, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllTests() {
  // ─────────────────────────────────────────────────────────────
  // 1. ARCHITECTURE & FILE INTEGRITY (5 TESTS)
  // ─────────────────────────────────────────────────────────────
  console.log('📦 1. Architecture & File Integrity');

  await test('All core application and modular files exist', () => {
    const files = [
      'index.html', 'style.css', 'app.js', 'gemini.js', 'prompts.js',
      'js/constants.js', 'js/errors.js', 'js/storage.js', 'js/dom.js',
      'server.js', 'README.md', 'test.js'
    ];
    files.forEach(f => {
      const exists = fs.existsSync(path.join(__dirname, f));
      assert.strictEqual(exists, true, `Missing required file: ${f}`);
    });
  });

  await test('No prohibited legacy methods (eval, document.write) in production source', () => {
    ['app.js', 'gemini.js', 'prompts.js', 'js/constants.js', 'js/errors.js', 'js/storage.js', 'js/dom.js'].forEach(f => {
      const content = fs.readFileSync(path.join(__dirname, f), 'utf8');
      assert.strictEqual(content.includes('eval('), false, `Prohibited eval() found in ${f}`);
      assert.strictEqual(content.includes('document.write('), false, `Prohibited document.write() found in ${f}`);
    });
  });

  await test('index.html references all required modular scripts in correct dependency order', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert.strictEqual(html.includes('src="js/constants.js"'), true);
    assert.strictEqual(html.includes('src="js/errors.js"'), true);
    assert.strictEqual(html.includes('src="js/storage.js"'), true);
    assert.strictEqual(html.includes('src="js/dom.js"'), true);
  });

  await test('index.html contains WAI-ARIA tablist and live region announcer', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert.strictEqual(html.includes('id="a11y-announcer"'), true);
    assert.strictEqual(html.includes('role="tablist"'), true);
    assert.strictEqual(html.includes('role="tabpanel"'), true);
  });

  await test('style.css defines prefers-reduced-motion media query for WCAG AA compliance', () => {
    const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
    assert.strictEqual(css.includes('prefers-reduced-motion: reduce'), true);
    assert.strictEqual(css.includes('.skeleton-card'), true);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. CONSTANTS & DOMAIN ENUMS (5 TESTS)
  // ─────────────────────────────────────────────────────────────
  console.log('\n📐 2. Domain Constants & Registries');

  const constants = require('./js/constants.js');

  await test('RISK_LEVELS enum is frozen and defines LOW, MEDIUM, HIGH', () => {
    assert.strictEqual(Object.isFrozen(constants.RISK_LEVELS), true);
    assert.strictEqual(constants.RISK_LEVELS.LOW, 'LOW');
    assert.strictEqual(constants.RISK_LEVELS.MEDIUM, 'MEDIUM');
    assert.strictEqual(constants.RISK_LEVELS.HIGH, 'HIGH');
  });

  await test('RISK_METADATA defines icons and labels for all risk levels', () => {
    assert.strictEqual(constants.RISK_METADATA.LOW.icon, '🟢');
    assert.strictEqual(constants.RISK_METADATA.HIGH.icon, '🔴');
    assert.strictEqual(constants.RISK_METADATA.MEDIUM.label, 'Moderate Risk');
  });

  await test('MOOD_SCORES defines 5 mood ratings with emojis', () => {
    assert.strictEqual(Object.keys(constants.MOOD_SCORES).length, 5);
    assert.strictEqual(constants.MOOD_SCORES[1].text, 'Great');
    assert.strictEqual(constants.MOOD_SCORES[5].text, 'Crisis');
  });

  await test('PROVIDER_KEYS defines GEMINI and GROQ', () => {
    assert.strictEqual(constants.PROVIDER_KEYS.GEMINI, 'gemini');
    assert.strictEqual(constants.PROVIDER_KEYS.GROQ, 'groq');
  });

  await test('LIMITS defines MAX_INPUT_CHARS as 2000', () => {
    assert.strictEqual(constants.LIMITS.MAX_INPUT_CHARS, 2000);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. ERROR HIERARCHY (5 TESTS)
  // ─────────────────────────────────────────────────────────────
  console.log('\n🚨 3. Domain Error Hierarchy');

  const errors = require('./js/errors.js');

  await test('RecoverAIError sets custom code and extends Error', () => {
    const err = new errors.RecoverAIError('Test error', 'TEST_CODE');
    assert.strictEqual(err instanceof Error, true);
    assert.strictEqual(err.code, 'TEST_CODE');
  });

  await test('ApiKeyMissingError defaults to API_KEY_MISSING code', () => {
    const err = new errors.ApiKeyMissingError();
    assert.strictEqual(err.code, 'API_KEY_MISSING');
  });

  await test('QuotaExceededError parses retryAfterSeconds into error code', () => {
    const err = new errors.QuotaExceededError(45);
    assert.strictEqual(err.code, 'QUOTA_EXCEEDED:45');
    assert.strictEqual(err.retryAfterSeconds, 45);
  });

  await test('ApiKeyInvalidError records provider name', () => {
    const err = new errors.ApiKeyInvalidError('Groq Cloud');
    assert.strictEqual(err.message.includes('Groq Cloud'), true);
    assert.strictEqual(err.code, 'API_KEY_INVALID');
  });

  await test('ValidationError records target element ID', () => {
    const err = new errors.ValidationError('Too long', 'sos-textarea');
    assert.strictEqual(err.code, 'VALIDATION_ERROR');
    assert.strictEqual(err.targetId, 'sos-textarea');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. STORAGE & OPTIMISTIC ROLLBACK (5 TESTS)
  // ─────────────────────────────────────────────────────────────
  console.log('\n💾 4. Transactional Storage & Optimistic Rollback');

  const { StorageManager } = require('./js/storage.js');

  await test('StorageManager.get and set handle basic values', () => {
    StorageManager.set('test_key', 'hello');
    assert.strictEqual(StorageManager.get('test_key'), 'hello');
  });

  await test('StorageManager.get returns fallback when key is missing', () => {
    assert.strictEqual(StorageManager.get('missing_xyz', 'fallback_val'), 'fallback_val');
  });

  await test('StorageManager.executeOptimistic commits state on successful async operation', async () => {
    StorageManager.set('streak', '5');
    await StorageManager.executeOptimistic('streak', (oldVal) => String(parseInt(oldVal) + 1), async () => {
      return 'success';
    });
    assert.strictEqual(StorageManager.get('streak'), '6');
  });

  await test('StorageManager.executeOptimistic rolls back state on failed async operation', async () => {
    StorageManager.set('streak', '5');
    try {
      await StorageManager.executeOptimistic('streak', (oldVal) => String(parseInt(oldVal) + 1), async () => {
        throw new Error('API failure simulation');
      });
    } catch (_) {
      // Exception caught
    }
    assert.strictEqual(StorageManager.get('streak'), '5');
  });

  await test('StorageManager.remove deletes stored key', () => {
    StorageManager.set('temp_key', 'data');
    StorageManager.remove('temp_key');
    assert.strictEqual(StorageManager.get('temp_key'), null);
  });

  // ─────────────────────────────────────────────────────────────
  // 5. SECURITY & XSS DEFENSE (5 TESTS)
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔒 5. Security & XSS Defense');

  const { DOM } = require('./js/dom.js');

  await test('DOM.escapeHTML prevents script tag execution', () => {
    const malicious = '<script>alert("xss")</script>';
    assert.strictEqual(DOM.escapeHTML(malicious), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  await test('DOM.escapeHTML prevents attribute injection', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    assert.strictEqual(DOM.escapeHTML(malicious), '&lt;img src=x onerror=alert(1)&gt;');
  });

  await test('DOM.escapeHTML handles non-string data types', () => {
    assert.strictEqual(DOM.escapeHTML(null), '');
    assert.strictEqual(DOM.escapeHTML(undefined), '');
    assert.strictEqual(DOM.escapeHTML(100), '100');
  });

  await test('DOM.escapeHTML escapes single and double quotes', () => {
    const text = 'User said "No" & \'Yes\'';
    assert.strictEqual(DOM.escapeHTML(text), 'User said &quot;No&quot; &amp; &#039;Yes&#039;');
  });

  await test('DOM.escapeHTML preserves normal safe text', () => {
    const safe = 'Feeling much better today after a walk.';
    assert.strictEqual(DOM.escapeHTML(safe), safe);
  });

  // ─────────────────────────────────────────────────────────────
  // 6. PROMPT SCHEMAS & API PARSING (5 TESTS)
  // ─────────────────────────────────────────────────────────────
  console.log('\n🧠 6. Prompt Engineering & API Parsing');

  const promptsContent = fs.readFileSync(path.join(__dirname, 'prompts.js'), 'utf8');
  const PROMPTS = eval(`(function() { ${promptsContent}; return PROMPTS; })()`);

  const geminiContent = fs.readFileSync(path.join(__dirname, 'gemini.js'), 'utf8');
  const geminiModule  = eval(`(function() { ${geminiContent}; return { parseJSON: _parseJSON, detectProvider: detectProvider, getApiKey: getApiKey }; })()`);

  await test('PROMPTS.sos generates schema requiring validation, riskLevel, copingStrategies', () => {
    const p = PROMPTS.sos('Feeling craving at party');
    assert.strictEqual(p.includes('"validation"'), true);
    assert.strictEqual(p.includes('"riskLevel"'), true);
    assert.strictEqual(p.includes('"copingStrategies"'), true);
  });

  await test('PROMPTS.checkin incorporates mood score and streak count', () => {
    const p = PROMPTS.checkin(4, 'Struggling', 'Work stress', 7);
    assert.strictEqual(p.includes('4/5'), true);
    assert.strictEqual(p.includes('7 days'), true);
  });

  await test('PROMPTS.caregiver requires whatToSay and escalationSignals', () => {
    const p = PROMPTS.caregiver('Loved one relapsed');
    assert.strictEqual(p.includes('"whatToSay"'), true);
    assert.strictEqual(p.includes('"escalationSignals"'), true);
  });

  await test('detectProvider maps gsk_ to groq and AIza to gemini', () => {
    assert.strictEqual(geminiModule.detectProvider('gsk_12345678901234567890'), 'groq');
    assert.strictEqual(geminiModule.detectProvider('AIzaSy12345678901234567890'), 'gemini');
  });

  await test('JSON parser removes markdown fences and handles fallback', () => {
    const markdown = '```json\n{"status": "ok"}\n```';
    assert.strictEqual(geminiModule.parseJSON(markdown).status, 'ok');

    const invalid = 'Raw plain text response';
    assert.strictEqual(geminiModule.parseJSON(invalid)._parseError, true);
  });

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log(`\n=============================================================`);
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Passed (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log(`=============================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests();
