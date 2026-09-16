import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/database.js';
import { isValidEmail, isValidUsername, normalizeUsername } from '../src/utils/validators.js';
import { getAvailableUsernameSuggestions } from '../src/utils/nameUtils.js';

const BASE_URL = 'http://localhost:5000';

test('Unique Username & Mandatory Email Test Suite', async (t) => {
  const testUserAId = 'test-uname-a-' + Date.now();
  const testUserBId = 'test-uname-b-' + Date.now();

  t.after(async () => {
    db.users.data = db.users.data.filter((u) => !u.id?.startsWith('test-uname-'));
    db.users.save();
    db.profiles.data = db.profiles.data.filter((p) => !p.userId?.startsWith('test-uname-') && !p.id?.startsWith('test-uname-'));
    db.profiles.save();
    db.subscriptions.data = db.subscriptions.data.filter((s) => !s.userId?.startsWith('test-uname-'));
    db.subscriptions.save();
  });

  await t.test('1. Unit: isValidEmail validates email addresses RFC-compliant', () => {
    assert.strictEqual(isValidEmail(''), false);
    assert.strictEqual(isValidEmail(null), false);
    assert.strictEqual(isValidEmail(undefined), false);
    assert.strictEqual(isValidEmail('   '), false);
    assert.strictEqual(isValidEmail('plainaddress'), false);
    assert.strictEqual(isValidEmail('user@'), false);
    assert.strictEqual(isValidEmail('@domain.com'), false);
    assert.strictEqual(isValidEmail('user space@domain.com'), false);
    assert.strictEqual(isValidEmail('user@domain'), false);
    assert.strictEqual(isValidEmail('valid.user+tag@domain.co'), true);
    assert.strictEqual(isValidEmail('toufiq@example.com'), true);
  });

  await t.test('2. Unit: isValidUsername and normalizeUsername', () => {
    assert.strictEqual(isValidUsername(''), false);
    assert.strictEqual(isValidUsername('a'), false);
    assert.strictEqual(isValidUsername('ab'), false);
    assert.strictEqual(isValidUsername('user name'), false);
    assert.strictEqual(isValidUsername('user@name'), false);
    assert.strictEqual(isValidUsername('a'.repeat(31)), false);
    assert.strictEqual(isValidUsername('toufiq_10'), true);
    assert.strictEqual(isValidUsername('jane.doe'), true);
    assert.strictEqual(isValidUsername('super-editor'), true);

    assert.strictEqual(normalizeUsername('  Toufiq_10  '), 'toufiq_10');
    assert.strictEqual(normalizeUsername(''), '');
  });

  await t.test('3. Unit: getAvailableUsernameSuggestions returns verified candidates and excludes taken ones', () => {
    const existing = [
      { username: 'toufiq' },
      { username: 'toufiq1' },
      { username: 'toufiq2' },
    ];
    const suggestions = getAvailableUsernameSuggestions('toufiq', existing);
    assert.ok(Array.isArray(suggestions));
    assert.ok(suggestions.length > 0 && suggestions.length <= 4);
    assert.ok(!suggestions.includes('toufiq'));
    assert.ok(!suggestions.includes('toufiq1'));
    assert.ok(!suggestions.includes('toufiq2'));
    assert.ok(suggestions.includes('toufiq_edit') || suggestions.includes('toufiqofficial'));
  });

  await t.test('4. GET /api/profile/check-username returns 400 for empty or invalid usernames', async () => {
    const resEmpty = await fetch(BASE_URL + '/api/profile/check-username?username=');
    assert.strictEqual(resEmpty.status, 400);
    const dataEmpty = await resEmpty.json();
    assert.strictEqual(dataEmpty.available, false);

    const resInvalid = await fetch(BASE_URL + '/api/profile/check-username?username=ab');
    assert.strictEqual(resInvalid.status, 400);
    const dataInvalid = await resInvalid.json();
    assert.strictEqual(dataInvalid.available, false);
  });

  await t.test('5. GET /api/profile/check-username returns available: true for unused username', async () => {
    const freshUname = 'unique_user_' + Date.now();
    const res = await fetch(BASE_URL + '/api/profile/check-username?username=' + freshUname);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.available, true);
    assert.strictEqual(data.username, freshUname);
    assert.strictEqual(data.message, '✓ Username available');
  });

  await t.test('6. Setup: Create User A with valid username and email via POST /api/profile', async () => {
    const res = await fetch(BASE_URL + '/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUserAId,
      },
      body: JSON.stringify({
        userId: testUserAId,
        name: 'User A',
        username: 'creator_pro',
        email: 'userA@example.com',
        profession: 'Video Editor',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.profile.username, 'creator_pro');
    assert.strictEqual(data.profile.email, 'usera@example.com');
  });

  await t.test('7. GET /api/profile/check-username detects taken username (case-insensitive) and offers suggestions', async () => {
    const res = await fetch(BASE_URL + '/api/profile/check-username?username=CREATOR_PRO');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.available, false);
    assert.ok(data.message.includes('Username already taken'));
    assert.ok(Array.isArray(data.suggestions));
    assert.ok(data.suggestions.length > 0);
    assert.ok(!data.suggestions.includes('creator_pro'));
  });

  await t.test('8. User A checking their own username receives available: true', async () => {
    const res = await fetch(BASE_URL + '/api/profile/check-username?username=creator_pro', {
      headers: { 'x-user-id': testUserAId },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.available, true);
  });

  await t.test('9. POST /api/profile rejects missing email with HTTP 400 "Email is required."', async () => {
    const res = await fetch(BASE_URL + '/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUserBId,
      },
      body: JSON.stringify({
        userId: testUserBId,
        name: 'User B',
        profession: 'Designer',
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'Email is required.');
  });

  await t.test('10. POST /api/profile rejects empty or whitespace email with HTTP 400 "Email is required."', async () => {
    const res = await fetch(BASE_URL + '/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUserBId,
      },
      body: JSON.stringify({
        userId: testUserBId,
        name: 'User B',
        email: '   ',
        profession: 'Designer',
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'Email is required.');
  });

  await t.test('11. POST /api/profile rejects invalid email format with HTTP 400 "Enter a valid email address."', async () => {
    const invalidEmails = ['invalid', 'user@', '@domain.com', 'user space@mail.com', 'test@domain'];
    for (const inv of invalidEmails) {
      const res = await fetch(BASE_URL + '/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUserBId,
        },
        body: JSON.stringify({
          userId: testUserBId,
          name: 'User B',
          email: inv,
          profession: 'Designer',
        }),
      });
      assert.strictEqual(res.status, 400, 'Expected 400 for ' + inv);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'Enter a valid email address.');
    }
  });

  await t.test('12. POST /api/profile rejects taken username with HTTP 409 Conflict and code USERNAME_TAKEN', async () => {
    const res = await fetch(BASE_URL + '/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUserBId,
      },
      body: JSON.stringify({
        userId: testUserBId,
        name: 'User B',
        username: 'Creator_Pro',
        email: 'userb@example.com',
        profession: 'Designer',
      }),
    });

    assert.strictEqual(res.status, 409, 'Must return HTTP 409 Conflict');
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'USERNAME_TAKEN');
    assert.strictEqual(data.error, 'Username already taken. Please try a different username.');
    assert.ok(Array.isArray(data.suggestions));
    assert.ok(data.suggestions.length > 0);

    const profileB = db.profiles.findOne((p) => p.userId === testUserBId);
    assert.ok(!profileB, 'Duplicate username must NOT be silently auto-saved with numbering');
  });

  await t.test('13. User A can edit their own profile while keeping their username without 409 conflict', async () => {
    const res = await fetch(BASE_URL + '/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUserAId,
      },
      body: JSON.stringify({
        userId: testUserAId,
        name: 'User A Updated',
        username: 'creator_pro',
        email: 'usera@example.com',
        bio: 'Updated bio by User A',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.profile.username, 'creator_pro');
    assert.strictEqual(data.profile.bio, 'Updated bio by User A');
  });

  await t.test('14. User B manually chooses an available username and saves successfully', async () => {
    const res = await fetch(BASE_URL + '/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUserBId,
      },
      body: JSON.stringify({
        userId: testUserBId,
        name: 'User B',
        username: 'creator_b_official',
        email: 'userb@example.com',
        profession: 'Motion Designer',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.profile.username, 'creator_b_official');
    assert.strictEqual(data.profile.email, 'userb@example.com');
  });

  await t.test('15. Strict user data isolation: User A and User B cannot read each other profile emails', async () => {
    const resA = await fetch(BASE_URL + '/api/profile', {
      headers: { 'x-user-id': testUserAId },
    });
    const dataA = await resA.json();
    assert.strictEqual(dataA.profile.email, 'usera@example.com');

    const resB = await fetch(BASE_URL + '/api/profile', {
      headers: { 'x-user-id': testUserBId },
    });
    const dataB = await resB.json();
    assert.strictEqual(dataB.profile.email, 'userb@example.com');

    assert.notStrictEqual(dataA.profile.email, dataB.profile.email);
  });

  await t.test('16. AI Outreach endpoint preserves applicant profile email as sender address', async () => {
    db.subscriptions.insert({
      id: 'sub-' + testUserAId,
      userId: testUserAId,
      plan: 'pro',
      status: 'active',
    });

    const res = await fetch(BASE_URL + '/api/outreach/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUserAId,
      },
      body: JSON.stringify({
        userId: testUserAId,
        to: 'client@company.com',
        subject: 'Application for Video Editor Role',
        body: 'Here is my proposal...',
      }),
    });

    const data = await res.json();
    assert.strictEqual(data.from, 'usera@example.com');
    assert.strictEqual(data.recipient, 'client@company.com');
  });
});
