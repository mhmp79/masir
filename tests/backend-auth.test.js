'use strict';
/* Focused unit tests for the SQL backend auth helpers.
   Run: node tests/backend-auth.test.js
   No database, network or browser is needed: only exported pure helpers are used. */

const assert = require('assert');
const auth = require('../server/src/auth');

const results = [];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('PHONE: Iranian spellings normalize to E.164 and invalid input returns null', () => {
  assert.strictEqual(auth.normalizePhone('09123456789'), '+989123456789');
  assert.strictEqual(auth.normalizePhone('9 1234 5678 9'), '+989123456789');
  assert.strictEqual(auth.normalizePhone('989123456789'), '+989123456789');
  assert.strictEqual(auth.normalizePhone('+98 912 345 6789'), '+989123456789');
  assert.strictEqual(auth.normalizePhone('00989123456789'), '+989123456789');
  assert.strictEqual(auth.normalizePhone('0912-345-6789'), '+989123456789');
  assert.strictEqual(auth.normalizePhone(''), null);
  assert.strictEqual(auth.normalizePhone('12345'), null);
  assert.strictEqual(auth.normalizePhone(null), null);
});

test('PURPOSE: OTP purpose defaults to signup and rejects unknown values', () => {
  assert.strictEqual(auth.normalizePurpose(undefined, 'signup'), 'signup');
  assert.strictEqual(auth.normalizePurpose('', 'signup'), 'signup');
  assert.strictEqual(auth.normalizePurpose('reset', 'signup'), 'reset');
  assert.strictEqual(auth.normalizePurpose('SIGNUP', 'signup'), 'signup');
  assert.strictEqual(auth.normalizePurpose('delete', 'signup'), null);
  assert.deepStrictEqual(Array.from(auth.OTP_PURPOSES), ['signup', 'reset']);
});

test('OTP HASH: purpose is bound into the stored code hash', () => {
  const phone = '+989123456789';
  const signup = auth.hashCode(phone, '123456', 'signup');
  const reset = auth.hashCode(phone, '123456', 'reset');
  assert.notStrictEqual(signup, reset);
  assert.strictEqual(auth.hashCode(phone, '123456'), signup, 'omitted purpose means signup');
  assert.strictEqual(auth.hashCode(phone, '123456', 'signup'), signup);
  assert.notStrictEqual(auth.legacyHashCode(phone, '123456'), signup);
  assert.match(signup, /^[0-9a-f]{64}$/);
});

test('PASSWORD POLICY: minimum eight characters, bounded and string only', () => {
  assert.strictEqual(auth.isValidPassword('12345678'), true);
  assert.strictEqual(auth.isValidPassword('long enough'), true);
  assert.strictEqual(auth.isValidPassword('1234567'), false);
  assert.strictEqual(auth.isValidPassword(''), false);
  assert.strictEqual(auth.isValidPassword(null), false);
  assert.strictEqual(auth.isValidPassword(12345678), false);
  assert.strictEqual(auth.isValidPassword('1234567\0'), false);
  assert.strictEqual(auth.isValidPassword('x'.repeat(1025)), false);
  assert.throws(() => auth.validatePassword('short'), (error) => {
    assert.strictEqual(error.status, 400);
    assert.match(error.message, /8/);
    return true;
  });
  assert.strictEqual(auth.validatePassword('12345678'), '12345678');
});

test('PASSWORD HASH: scrypt storage is salted and verification is exact', async () => {
  const first = await auth.hashPassword('correct horse');
  const second = await auth.hashPassword('correct horse');
  assert.match(first, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notStrictEqual(first, second, 'each hash needs a fresh salt');
  assert.strictEqual(await auth.verifyPassword('correct horse', first), true);
  assert.strictEqual(await auth.verifyPassword('correct horse!', first), false);
  assert.strictEqual(await auth.verifyPassword('', first), false);
  assert.strictEqual(await auth.verifyPassword('correct horse', null), false);
  assert.strictEqual(await auth.verifyPassword('correct horse', 'bcrypt$bad$value'), false);
  assert.strictEqual(await auth.verifyPassword('correct horse', `${first}x`), false);
  await assert.rejects(() => auth.hashPassword('short'), /8/);
});

test('JWT: login tokens stay valid; purpose tokens are bound to their scope', () => {
  const user = { id: '11111111-1111-4111-8111-111111111111', role: 'admin' };
  const login = auth.signToken(user);
  const loginPayload = auth.verifyToken(login);
  assert.strictEqual(loginPayload.sub, user.id);
  assert.strictEqual(loginPayload.role, 'admin');
  assert.strictEqual(auth.verifyPurposeToken(login, 'signup'), null, 'login token is not a purpose token');

  const phone = '+989123456789';
  const signup = auth.signPurposeToken(phone, 'signup');
  const payload = auth.verifyPurposeToken(signup, 'signup');
  assert.ok(payload, 'signup token must verify');
  assert.strictEqual(payload.phone, phone);
  assert.strictEqual(payload.sub, phone);
  assert.strictEqual(payload.purpose, 'signup');
  assert.strictEqual(payload.typ, 'purpose');
  assert.ok(payload.jti && payload.exp > payload.iat);
  assert.strictEqual(payload.exp - payload.iat, auth.PURPOSE_TOKEN_TTL_SECONDS);
  assert.strictEqual(auth.verifyPurposeToken(signup, 'reset'), null, 'signup cannot reset');
  assert.strictEqual(auth.verifyToken(`${signup}x`), null, 'tampered signature is rejected');
  assert.strictEqual(auth.verifyPurposeToken('not-a-token', 'signup'), null);

  const reset = auth.signPurposeToken(phone, 'reset', 60);
  assert.strictEqual(auth.verifyPurposeToken(reset, 'reset').purpose, 'reset');
  assert.strictEqual(auth.verifyPurposeToken(reset, 'signup'), null, 'reset cannot sign up');
  assert.strictEqual(auth.verifyPurposeToken(auth.signPurposeToken(phone, 'reset', -1), 'reset'), null);
  assert.throws(() => auth.signPurposeToken(phone, 'unknown'), /purpose/);
});

(async () => {
  for (const entry of tests) {
    try {
      await entry.fn();
      results.push(`  ✓ ${entry.name}`);
    } catch (error) {
      results.push(`  ✗ ${entry.name}\n      ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  }
  console.log('Backend auth — helper checks');
  console.log(results.join('\n'));
  console.log(process.exitCode ? 'FAILED' : 'ALL PASSED');
})();
