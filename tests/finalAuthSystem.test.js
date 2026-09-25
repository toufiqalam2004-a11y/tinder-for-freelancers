import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/database.js';

const BASE_URL = 'http://localhost:5000';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('FINAL AUTHENTICATION SYSTEM SPECIFICATION TESTS (1-17)', async (t) => {
  const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
  const rawNumberA = `98${randomSuffix}`;
  const phoneA = `+91${rawNumberA}`;
  const deviceA = `device-test-alpha-${Date.now()}`;
  const deviceB = `device-test-beta-${Date.now()}`;

  const randomSuffixB = Math.floor(10000000 + Math.random() * 90000000);
  const rawNumberB = `97${randomSuffixB}`;
  const phoneB = `+91${rawNumberB}`;

  let userAId = null;
  let userBId = null;

  // TEST 1: Phone Normalization & Validation
  await t.test('Test 1: Server strictly normalizes phone numbers into E.164 format', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/check-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', localNumber: rawNumberA }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.phone, phoneA);
    assert.strictEqual(res.data.exists, false);
  });

  // TEST 2: CAPTCHA Requirement before OTP
  await t.test('Test 2: Requesting OTP without CAPTCHA token returns 400 CAPTCHA_REQUIRED', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode: '+91',
        localNumber: rawNumberA,
        mode: 'signup',
        // No captchaToken provided
      }),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.code, 'CAPTCHA_REQUIRED');
    assert.strictEqual(res.data.error, 'Please complete the CAPTCHA.');
  });

  // TEST 3: CAPTCHA Failure handling
  await t.test('Test 3: Requesting OTP with invalid CAPTCHA token returns 400 CAPTCHA_FAILED', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode: '+91',
        localNumber: rawNumberA,
        mode: 'signup',
        captchaToken: 'invalid',
      }),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.code, 'CAPTCHA_FAILED');
  });

  // TEST 4: Login Mode Existence Check (Account Not Found)
  await t.test('Test 4: Login with non-existent phone returns 404 ACCOUNT_NOT_FOUND without sending OTP', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode: '+91',
        localNumber: rawNumberA,
        mode: 'login',
        captchaToken: 'turnstile-local-verified-test',
      }),
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.code, 'ACCOUNT_NOT_FOUND');
    assert.strictEqual(res.data.error, 'No account found with this number.');
    assert.strictEqual(res.data.phone, phoneA);
  });

  // TEST 5: Sign Up Mode with New Number Sends OTP
  await t.test('Test 5: Sign Up with non-existent phone succeeds and sends OTP', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode: '+91',
        localNumber: rawNumberA,
        mode: 'signup',
        captchaToken: 'turnstile-local-verified-test',
        deviceId: deviceA,
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.isDemo, true);
  });

  // TEST 6: Verify Demo OTP & Create User A with Device Binding
  await t.test('Test 6: Verify OTP creates User A and binds device A', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneA,
        code: '1234',
        deviceId: deviceA,
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.user);
    assert.strictEqual(res.data.user.phone, phoneA);
    assert.strictEqual(res.data.user.isNewUser, true);
    userAId = res.data.user.id;

    // Check device binding in DB
    const binding = db.deviceBindings.findOne((b) => b.deviceId === deviceA || b.id === deviceA);
    assert.ok(binding);
    assert.strictEqual(binding.boundPhone, phoneA);
    assert.strictEqual(binding.boundAccountId, userAId);
  });

  // TEST 7: OTP Replay Prevention (OTP invalidated after use)
  await t.test('Test 7: OTP cannot be reused after verification', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneA,
        code: '1234',
        deviceId: deviceA,
      }),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  // TEST 8: Sign Up with Existing User Denied (ACCOUNT_ALREADY_EXISTS)
  await t.test('Test 8: Sign Up with existing phone returns 409 ACCOUNT_ALREADY_EXISTS', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode: '+91',
        localNumber: rawNumberA,
        mode: 'signup',
        captchaToken: 'turnstile-local-verified-test',
      }),
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.code, 'ACCOUNT_ALREADY_EXISTS');
    assert.strictEqual(res.data.error, 'An account already exists with this number.');
    assert.strictEqual(res.data.phone, phoneA);
  });

  // TEST 9: Login Mode with Existing User Sends OTP
  await t.test('Test 9: Login mode with existing user succeeds and sends OTP', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-clock-skew': '61000', // advance past 60s cooldown
      },
      body: JSON.stringify({
        countryCode: '+91',
        localNumber: rawNumberA,
        mode: 'login',
        captchaToken: 'turnstile-local-verified-test',
        deviceId: deviceA,
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  // TEST 10: Single Account Identity: Login Reconnects to Exact Same User A (No Duplication)
  await t.test('Test 10: User A logs in again -> exact same user ID is resolved, no duplicates created', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneA,
        code: '1234',
        deviceId: deviceA,
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.id, userAId);
    assert.strictEqual(res.data.user.isNewUser, false);

    // Verify exactly one user record exists in db for this phone
    const usersWithPhone = db.users.findAll((u) => u.phone === phoneA);
    assert.strictEqual(usersWithPhone.length, 1);
  });

  // TEST 11: Same Device, Same Account: Bypasses 72h Cooldown Always
  await t.test('Test 11: Same account on same device is always permitted immediately', async () => {
    // Re-verify immediately on deviceA
    const sendRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-clock-skew': '125000',
      },
      body: JSON.stringify({
        phone: phoneA,
        mode: 'login',
        captchaToken: 'turnstile-local-verified-test',
      }),
    });
    assert.strictEqual(sendRes.status, 200);

    const verifyRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-clock-skew': '125000',
      },
      body: JSON.stringify({
        phone: phoneA,
        code: '1234',
        deviceId: deviceA,
      }),
    });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.data.user.id, userAId);
  });

  // TEST 12: Create User B on separate Device B
  await t.test('Test 12: Create User B on Device B', async () => {
    const sendRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneB,
        mode: 'signup',
        captchaToken: 'turnstile-local-verified-test',
        deviceId: deviceB,
      }),
    });
    assert.strictEqual(sendRes.status, 200);

    const verifyRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneB,
        code: '1234',
        deviceId: deviceB,
      }),
    });
    assert.strictEqual(verifyRes.status, 200);
    assert.ok(verifyRes.data.user);
    userBId = verifyRes.data.user.id;
    assert.notStrictEqual(userBId, userAId);
  });

  // TEST 13: Device Binding Cooldown: Different Account on Device A is Denied within 72 Hours
  await t.test('Test 13: User B attempts login on Device A within 72h -> 403 DEVICE_COOLDOWN_ACTIVE', async () => {
    // Send OTP for User B
    const sendRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-clock-skew': '190000',
      },
      body: JSON.stringify({
        phone: phoneB,
        mode: 'login',
        captchaToken: 'turnstile-local-verified-test',
      }),
    });
    assert.strictEqual(sendRes.status, 200);

    // Verify OTP on Device A (which is bound to User A!)
    const verifyRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-clock-skew': '190000', // only a few minutes elapsed
      },
      body: JSON.stringify({
        phone: phoneB,
        code: '1234',
        deviceId: deviceA,
      }),
    });
    assert.strictEqual(verifyRes.status, 403);
    assert.strictEqual(verifyRes.data.code, 'DEVICE_COOLDOWN_ACTIVE');
    assert.ok(verifyRes.data.remainingCooldownHours > 0);
  });

  // TEST 14: Device Binding Cooldown: After 72 Hours, Switching Device Account is Permitted
  await t.test('Test 14: After 72 hours, User B can bind and log into Device A', async () => {
    const elapsed73HoursMs = 73 * 60 * 60 * 1000;
    // Send OTP for User B with clock skew past 72h
    const sendRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-clock-skew': String(elapsed73HoursMs),
      },
      body: JSON.stringify({
        phone: phoneB,
        mode: 'login',
        captchaToken: 'turnstile-local-verified-test',
      }),
    });
    assert.strictEqual(sendRes.status, 200);

    const verifyRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-clock-skew': String(elapsed73HoursMs),
      },
      body: JSON.stringify({
        phone: phoneB,
        code: '1234',
        deviceId: deviceA,
      }),
    });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.data.user.id, userBId);

    // Verify Device A is now rebound to User B
    const binding = db.deviceBindings.findOne((b) => b.deviceId === deviceA || b.id === deviceA);
    assert.strictEqual(binding.boundAccountId, userBId);
  });

  // TEST 15: Brute Force Protection (5 Failed Attempts Invalidates OTP)
  await t.test('Test 15: Max 5 failed OTP attempts invalidates OTP record', async () => {
    const randomSuffixC = Math.floor(10000000 + Math.random() * 90000000);
    const phoneC = `+9196${randomSuffixC}`;

    const sendRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneC,
        mode: 'signup',
        captchaToken: 'turnstile-local-verified-test',
      }),
    });
    assert.strictEqual(sendRes.status, 200);

    // Attempt 1-4 with wrong code
    for (let i = 1; i <= 4; i++) {
      const failRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneC, code: '9999' }),
      });
      assert.strictEqual(failRes.status, 400);
      assert.strictEqual(failRes.data.remainingAttempts, 5 - i);
    }

    // Attempt 5 with wrong code -> Invalidates OTP
    const fifthRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneC, code: '9999' }),
    });
    assert.strictEqual(fifthRes.status, 429);
    assert.ok(fifthRes.data.error.includes('Too many failed attempts'));

    // Even with the correct code now, it is invalidated
    const lockedRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneC, code: '1234' }),
    });
    assert.strictEqual(lockedRes.status, 400);
  });

  // TEST 16: Rate Limiting: 60-Second Cooldown on OTP Requests
  await t.test('Test 16: OTP requests enforce 60s cooldown for the same phone number', async () => {
    const randomSuffixD = Math.floor(10000000 + Math.random() * 90000000);
    const phoneD = `+9195${randomSuffixD}`;

    const firstRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneD,
        mode: 'signup',
        captchaToken: 'turnstile-local-verified-test',
      }),
    });
    assert.strictEqual(firstRes.status, 200);

    // Immediate second request without clock advancement
    const secondRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneD,
        mode: 'signup',
        captchaToken: 'turnstile-local-verified-test',
      }),
    });
    assert.strictEqual(secondRes.status, 429);
    assert.strictEqual(secondRes.data.cooldownActive, true);
    assert.ok(secondRes.data.remainingSeconds > 0);
  });

  // TEST 17: OTP Expiration after 10 Minutes
  await t.test('Test 17: OTP code expires after 10 minutes', async () => {
    const randomSuffixE = Math.floor(10000000 + Math.random() * 90000000);
    const phoneE = `+9194${randomSuffixE}`;

    const sendRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneE,
        mode: 'signup',
        captchaToken: 'turnstile-local-verified-test',
      }),
    });
    assert.strictEqual(sendRes.status, 200);

    // Verify after 11 minutes (660,000 ms)
    const verifyRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-clock-skew': '660000',
      },
      body: JSON.stringify({
        phone: phoneE,
        code: '1234',
      }),
    });
    assert.strictEqual(verifyRes.status, 400);
    assert.ok(verifyRes.data.error.includes('expired'));
  });
});
