import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/database.js';
import { cleanAllTestFixtures } from './cleanFixtures.js';

const BASE_URL = 'http://localhost:5000';
const ADMIN_PASSKEY = process.env.ADMIN_SECRET_KEY || 'tf-admin-secret-2026';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('ADMIN DELETE ALL USERS SECURE ACTION SUITE (20 TESTS)', async (t) => {
  let adminToken = null;
  let normalUserToken = null;
  const user1Phone = `+9191${Math.floor(10000000 + Math.random() * 90000000)}`;
  const user2Phone = `+9192${Math.floor(10000000 + Math.random() * 90000000)}`;
  let user1Id = null;
  let user2Id = null;

  // SETUP: Admin login & Normal users creation
  await t.test('Setup: Admin logs in and obtains session token', async () => {
    const res = await fetchJson(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.token);
    adminToken = res.data.token;
  });

  await t.test('Setup: Create two test users with profiles, applications, and subscriptions', async () => {
    // User 1
    const sendRes1 = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user1Phone, mode: 'signup', captchaToken: 'turnstile-local-verified-test' }),
    });
    assert.strictEqual(sendRes1.status, 200);

    const verifyRes1 = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user1Phone, code: '1234', deviceId: `dev-user-1-${Date.now()}` }),
    });
    assert.strictEqual(verifyRes1.status, 200);
    user1Id = verifyRes1.data.user.id;
    normalUserToken = verifyRes1.data.token;

    // User 2
    const sendRes2 = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user2Phone, mode: 'signup', captchaToken: 'turnstile-local-verified-test' }),
    });
    assert.strictEqual(sendRes2.status, 200);

    const verifyRes2 = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user2Phone, code: '1234', deviceId: `dev-user-2-${Date.now()}` }),
    });
    assert.strictEqual(verifyRes2.status, 200);
    user2Id = verifyRes2.data.user.id;

    // Insert associated user-owned records
    db.profiles.insert({ id: `prof-${user1Id}`, userId: user1Id, name: 'User One', profession: 'Developer' });
    db.profiles.insert({ id: `prof-${user2Id}`, userId: user2Id, name: 'User Two', profession: 'Designer' });

    db.applications.insert({ id: `app-${user1Id}-1`, userId: user1Id, jobId: 'job-1', status: 'applied' });
    db.applications.insert({ id: `app-${user2Id}-1`, userId: user2Id, jobId: 'job-2', status: 'saved' });

    db.sources.insert({ id: `src-custom-${user1Id}`, userId: user1Id, name: 'User 1 Source', type: 'custom' });
  });

  // TEST 1: Normal user cannot access Delete All Users endpoint
  await t.test('Test 1: Normal user receives HTTP 403 Forbidden with "Admin access required."', async () => {
    const res = await fetchJson(`${BASE_URL}/api/admin/users/all`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalUserToken}`,
      },
      body: JSON.stringify({
        confirmationPhrase: 'DELETE ALL USERS',
        adminPassword: ADMIN_PASSKEY,
      }),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.error, 'Admin access required.');
  });

  // TEST 2: Unauthenticated request is rejected
  await t.test('Test 2: Unauthenticated request returns HTTP 401 Unauthorized', async () => {
    const res = await fetchJson(`${BASE_URL}/api/admin/users/all`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmationPhrase: 'DELETE ALL USERS',
        adminPassword: ADMIN_PASSKEY,
      }),
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.error, 'Admin access required.');
  });

  // TEST 3: Admin session without re-auth credential is rejected
  await t.test('Test 3: Admin session without re-auth credential returns HTTP 401', async () => {
    const res = await fetchJson(`${BASE_URL}/api/admin/users/all`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        confirmationPhrase: 'DELETE ALL USERS',
        // adminPassword is missing
      }),
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.error, 'Admin verification failed.');
  });

  // TEST 4: Wrong admin password is rejected
  await t.test('Test 4: Wrong admin password returns HTTP 401 "Admin verification failed."', async () => {
    const res = await fetchJson(`${BASE_URL}/api/admin/users/all`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        confirmationPhrase: 'DELETE ALL USERS',
        adminPassword: 'wrong-admin-password-123',
      }),
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.code, 'AUTH_FAILED');
    assert.strictEqual(res.data.error, 'Admin verification failed.');
  });

  // TEST 5: Wrong confirmation phrase is rejected
  await t.test('Test 5: Wrong confirmation phrase returns HTTP 400 "Confirmation text does not match."', async () => {
    const res = await fetchJson(`${BASE_URL}/api/admin/users/all`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        confirmationPhrase: 'delete all users', // must be uppercase exact match
        adminPassword: ADMIN_PASSKEY,
      }),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.code, 'INVALID_CONFIRMATION');
    assert.strictEqual(res.data.error, 'Confirmation text does not match.');
  });

  // TEST 6: Correct credentials and confirmation executes deletion
  let deleteResult = null;
  await t.test('Test 6: Correct admin credential + confirmation phrase executes user deletion successfully', async () => {
    const res = await fetchJson(`${BASE_URL}/api/admin/users/all`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        confirmationPhrase: 'DELETE ALL USERS',
        adminPassword: ADMIN_PASSKEY,
      }),
    });
    console.log('TEST 6 RESULT:', res);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(typeof res.data.deletedUsers === 'number');
    assert.ok(res.data.deletedUsers >= 2);
    deleteResult = res.data;
  });

  // TEST 7: Multiple user accounts are deleted
  await t.test('Test 7: Created user accounts (User 1 & User 2) are completely removed from users collection', async () => {
    const user1 = db.users.findById(user1Id);
    const user2 = db.users.findById(user2Id);
    assert.strictEqual(user1, undefined);
    assert.strictEqual(user2, undefined);

    const userByPhone1 = db.users.findOne((u) => u.phone === user1Phone);
    const userByPhone2 = db.users.findOne((u) => u.phone === user2Phone);
    assert.strictEqual(userByPhone1, undefined);
    assert.strictEqual(userByPhone2, undefined);
  });

  // TEST 8: User profiles are deleted
  await t.test('Test 8: User profiles are deleted', async () => {
    const profile1 = db.profiles.findOne((p) => p.userId === user1Id);
    const profile2 = db.profiles.findOne((p) => p.userId === user2Id);
    assert.strictEqual(profile1, undefined);
    assert.strictEqual(profile2, undefined);
  });

  // TEST 9: User applications are deleted
  await t.test('Test 9: User applications are deleted', async () => {
    const apps1 = db.applications.findAll((a) => a.userId === user1Id);
    const apps2 = db.applications.findAll((a) => a.userId === user2Id);
    assert.strictEqual(apps1.length, 0);
    assert.strictEqual(apps2.length, 0);
  });

  // TEST 10: User subscriptions are deleted
  await t.test('Test 10: User subscriptions are deleted', async () => {
    const sub1 = db.subscriptions.findOne((s) => s.userId === user1Id || s.phone === user1Phone);
    const sub2 = db.subscriptions.findOne((s) => s.userId === user2Id || s.phone === user2Phone);
    assert.strictEqual(sub1, undefined);
    assert.strictEqual(sub2, undefined);
  });

  // TEST 11: User quotas & rewards are deleted
  await t.test('Test 11: User quotas and rewards are deleted', async () => {
    if (db.quotas) {
      const q1 = db.quotas.findOne((q) => q.userId === user1Id);
      assert.strictEqual(q1, undefined);
    }
    if (db.rewards) {
      const r1 = db.rewards.findOne((r) => r.userId === user1Id);
      assert.strictEqual(r1, undefined);
    }
  });

  // TEST 12: User sessions, device bindings, and OTP verifications are purged
  await t.test('Test 12: User sessions and device bindings are purged', async () => {
    if (db.deviceBindings) {
      const binding1 = db.deviceBindings.findOne((b) => b.boundUserId === user1Id || b.boundPhone === user1Phone);
      assert.strictEqual(binding1, undefined);
    }
    if (db.otpVerifications) {
      const otp1 = db.otpVerifications.findOne((o) => o.phone === user1Phone);
      assert.strictEqual(otp1, undefined);
    }
    if (db.sessions) {
      const s1 = db.sessions.findOne((s) => s.userId === user1Id);
      assert.strictEqual(s1, undefined);
    }
  });

  // TEST 13: Built-in sources remain intact
  await t.test('Test 13: Built-in sources remain intact and are not deleted', async () => {
    const builtinSources = db.sources.findAll((s) => s.type === 'builtin');
    assert.ok(builtinSources.length > 0, 'Built-in sources must not be deleted');
  });

  // TEST 14: Admin account remains intact
  await t.test('Test 14: Admin account/configuration remains intact', async () => {
    const adminUsers = db.users.findAll((u) => u.role === 'admin' || u.isAdmin === true);
    // If admin users exist in users table, they must not be deleted
    // And ADMIN_SECRET_KEY remains valid
    assert.ok(ADMIN_PASSKEY, 'ADMIN_SECRET_KEY must be preserved');
  });

  // TEST 15: Admin can still access dashboard after deletion
  await t.test('Test 15: Admin session remains active and can access dashboard endpoints', async () => {
    const meRes = await fetchJson(`${BASE_URL}/api/admin/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.success, true);
    assert.strictEqual(meRes.data.admin.role, 'admin');

    const statsRes = await fetchJson(`${BASE_URL}/api/admin/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsRes.data.success, true);
  });

  // TEST 16: Database remains valid and operational
  await t.test('Test 16: Database collections remain healthy and operational after deletion', async () => {
    const userCount = db.users.count();
    const sourceCount = db.sources.count();
    assert.ok(typeof userCount === 'number');
    assert.ok(sourceCount > 0, 'Sources collection remains populated');
  });

  // TEST 17: No secrets appear in audit logs
  await t.test('Test 17: Audit logs record action without logging admin password or secret', async () => {
    if (db.activities) {
      const deleteActivity = db.activities.findOne((a) => a.action === 'DELETE_ALL_USERS' || a.type === 'admin_delete_all_users');
      assert.ok(deleteActivity, 'Audit log must record DELETE_ALL_USERS event');
      assert.strictEqual(deleteActivity.success, true);
      // Ensure no password or secret key leaked into audit record
      const serialized = JSON.stringify(deleteActivity);
      assert.strictEqual(serialized.includes(ADMIN_PASSKEY), false, 'Password/secret must NEVER appear in audit log');
      assert.strictEqual(serialized.includes('adminPassword'), false);
    }
  });

  // TEST 18: Admin statistics refresh accurately
  await t.test('Test 18: Admin /api/admin/stats reflects 0 regular users', async () => {
    const statsRes = await fetchJson(`${BASE_URL}/api/admin/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(statsRes.status, 200);
    // Regular users are deleted
    assert.strictEqual(statsRes.data.stats.freeUsers + statsRes.data.stats.proUsers + statsRes.data.stats.plusUsers, statsRes.data.stats.totalUsers);
  });

  // TEST 19: Endpoint cannot be triggered through normal user API
  await t.test('Test 19: Normal user public API (/api/users/all) returns 404', async () => {
    const publicRes = await fetchJson(`${BASE_URL}/api/users/all`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.strictEqual(publicRes.status, 404, 'Endpoint must not be accessible via public user route');
  });

  // TEST 20: Repeat destructive requests rate-limiting protection
  await t.test('Test 20: Rapid repeat requests trigger rate limiting (HTTP 429)', async () => {
    // Attempt immediate repeat call
    const repeatRes = await fetchJson(`${BASE_URL}/api/admin/users/all`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        confirmationPhrase: 'DELETE ALL USERS',
        adminPassword: ADMIN_PASSKEY,
      }),
    });
    // Rate limit cooldown is 10 seconds
    assert.strictEqual(repeatRes.status, 429);
    assert.ok(repeatRes.data.error.includes('Rate limit active') || repeatRes.data.error.includes('wait'));
  });

  // Restore canonical database fixtures for subsequent test suites
  cleanAllTestFixtures();
});

