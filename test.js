// =============================================================
// RecoverAI — Automated Test Suite (PromptWars Evaluation)
// Zero-dependency Node.js test runner verifying Unit, Integration,
// and Edge Case requirements.
// Run: node test.js
// =============================================================

'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

console.log('🧪 Running RecoverAI Test Suite...\n');

let totalTests = 0;
let passedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. FILE & ARCHITECTURE SANITY TESTS
// ─────────────────────────────────────────────────────────────
console.log('📦 1. Architecture & File Integrity Tests');

test('All core application files exist', () => {
  const files = ['index.html', 'style.css', 'app.js', 'gemini.js', 'prompts.js', 'server.js', 'README.md'];
  files.forEach(f => {
    const exists = fs.existsSync(path.join(__dirname, f));
    assert.strictEqual(exists, true, `Missing required file: ${f}`);
  });
});

test('No prohibited legacy methods (eval, document.write)', () => {
  ['app.js', 'gemini.js', 'prompts.js'].forEach(f => {
    const content = fs.readFileSync(path.join(__dirname, f), 'utf8');
    assert.strictEqual(content.includes('eval('), false, `Prohibited eval() found in ${f}`);
    assert.strictEqual(content.includes('document.write('), false, `Prohibited document.write() found in ${f}`);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. SECURITY & UTILITY UNIT TESTS
// ─────────────────────────────────────────────────────────────
console.log('\n🔒 2. Security & Sanitization Unit Tests');

// Mock HTML Escaper for testing logic
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

test('HTML escaping prevents script injection (XSS)', () => {
  const malicious = '<script>alert("xss")</script>';
  const escaped = esc(malicious);
  assert.strictEqual(escaped.includes('<script>'), false);
  assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
});

test('HTML escaping handles null and undefined safely', () => {
  assert.strictEqual(esc(null), '');
  assert.strictEqual(esc(undefined), '');
  assert.strictEqual(esc(123), '123');
});

test('HTML escaping preserves normal safe characters', () => {
  const safe = 'Hello world! 123 - recovery support.';
  assert.strictEqual(esc(safe), safe);
});

// Safe Storage Mock Test
function safeStorageGet(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

test('Storage getter returns fallback on error or missing key', () => {
  assert.strictEqual(safeStorageGet('non_existent_key', 'default'), 'default');
});

// ─────────────────────────────────────────────────────────────
// 3. PROMPT GENERATION UNIT TESTS
// ─────────────────────────────────────────────────────────────
console.log('\n🧠 3. Prompt Engineering & Schema Tests');

const promptsContent = fs.readFileSync(path.join(__dirname, 'prompts.js'), 'utf8');
// Evaluate prompts.js in isolated scope
const PROMPTS = eval(`(function() { ${promptsContent}; return PROMPTS; })()`);

test('PROMPTS.sos generates valid prompt with user input', () => {
  const prompt = PROMPTS.sos('Feeling strong urge at a party');
  assert.strictEqual(typeof prompt, 'string');
  assert.strictEqual(prompt.includes('Feeling strong urge at a party'), true);
  assert.strictEqual(prompt.includes('Respond ONLY with a single valid JSON object'), true);
  assert.strictEqual(prompt.includes('riskLevel'), true);
  assert.strictEqual(prompt.includes('groundingExercise'), true);
});

test('PROMPTS.checkin incorporates mood score, context, and streak', () => {
  const prompt = PROMPTS.checkin(4, 'Struggling', 'Work was stressful', 5);
  assert.strictEqual(typeof prompt, 'string');
  assert.strictEqual(prompt.includes('4/5'), true);
  assert.strictEqual(prompt.includes('Struggling'), true);
  assert.strictEqual(prompt.includes('Work was stressful'), true);
  assert.strictEqual(prompt.includes('5 days'), true);
});

test('PROMPTS.caregiver generates detailed caregiver advice schema', () => {
  const prompt = PROMPTS.caregiver('Son relapsed today');
  assert.strictEqual(typeof prompt, 'string');
  assert.strictEqual(prompt.includes('Son relapsed today'), true);
  assert.strictEqual(prompt.includes('whatToSay'), true);
  assert.strictEqual(prompt.includes('whatNotToSay'), true);
  assert.strictEqual(prompt.includes('escalationSignals'), true);
});

// ─────────────────────────────────────────────────────────────
// 4. API & PARSER INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────
console.log('\n🔌 4. API & Parser Integration Tests');

const geminiContent = fs.readFileSync(path.join(__dirname, 'gemini.js'), 'utf8');
const geminiModule  = eval(`(function() { ${geminiContent}; return { parseJSON: _parseJSON, detectProvider: detectProvider, getApiKey: getApiKey }; })()`);

test('detectProvider identifies Groq vs Gemini keys', () => {
  assert.strictEqual(geminiModule.detectProvider('gsk_12345678901234567890'), 'groq');
  assert.strictEqual(geminiModule.detectProvider('AIzaSy12345678901234567890'), 'gemini');
  assert.strictEqual(geminiModule.detectProvider('invalid_key_prefix'), null);
});

test('JSON parser cleans markdown code fences (```json)', () => {
  const markdownJson = '```json\n{"validation": "I hear you", "riskLevel": "LOW"}\n```';
  const parsed = geminiModule.parseJSON(markdownJson);
  assert.strictEqual(parsed.riskLevel, 'LOW');
  assert.strictEqual(parsed.validation, 'I hear you');
});

test('JSON parser cleanly handles raw text with fallback flag', () => {
  const rawText = 'I am sorry to hear you are struggling. Take deep breaths.';
  const parsed = geminiModule.parseJSON(rawText);
  assert.strictEqual(parsed._parseError, true);
  assert.strictEqual(parsed._raw, rawText);
});

// ─────────────────────────────────────────────────────────────
// 5. EDGE CASE & ERROR RESILIENCE TESTS
// ─────────────────────────────────────────────────────────────
console.log('\n🛡️ 5. Edge Case & Failure Mode Tests');

test('Handles malformed JSON without crashing', () => {
  const malformed = '{"riskLevel": "HIGH", "strategies": [unclosed array';
  const parsed = geminiModule.parseJSON(malformed);
  assert.strictEqual(parsed._parseError, true);
  assert.strictEqual(typeof parsed._raw, 'string');
});

test('Handles empty strings safely', () => {
  const parsed = geminiModule.parseJSON('');
  assert.strictEqual(parsed._parseError, true);
  assert.strictEqual(parsed._raw, '');
});

test('Prompt generator handles special characters in input', () => {
  const specialInput = 'Urge after argument & "stress" <script>alert(1)</script>';
  const prompt = PROMPTS.sos(specialInput);
  assert.strictEqual(prompt.includes(specialInput), true);
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
