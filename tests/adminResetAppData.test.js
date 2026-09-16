import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:5000/api/admin';
const AUTH_URL = 'http://localhost:5000/api/auth';
const ADMIN_PASSKEY = process.env.ADMIN_SECRET_KEY || 'tf-admin-secret-2026';

test('ADMIN PANEL — SAFE RESET APP DATA TEST SUITE', async (t) => {
  let adminToken = null;
  let normalUserToken = null;

  // =========================================================================
  // 1. ADMIN AUTHENTICATION
  // =========================================================================
  await t.test('1. Admin logs in to obtain admin token', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
    adminToken = data.token;
  });

  // =========================================================================
  // 2. NORMAL USER ACCESS SECURITY (MUST BE 403 FORBIDDEN)
  // =========================================================================
  await t.test('2. Normal user receives 403 Forbidden when calling POST /api/admin/reset-app-data', async () => {
    // Obtain a real normal user token through OTP verification with a unique phone number
    const testUserPhone = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;
    const sendOtpRes = await fetch(`${AUTH_URL}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testUserPhone }),
    });
    assert.strictEqual(sendOtpRes.status, 200);

    const verifyRes = await fetch(`${AUTH_URL}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testUserPhone, code: '1234' }),
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200);
    assert.ok(verifyData.token);
    normalUserToken = verifyData.token;

    // Normal user token calling admin reset-app-data
    const res = await fetch(`${BASE_URL}/reset-app-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalUserToken}`,
      },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /Forbidden|Insufficient privileges/i);
  });

  // =========================================================================
  // 3. UNAUTHENTICATED REQUEST SECURITY (MUST BE 401 UNAUTHORIZED)
  // =========================================================================
  await t.test('3. Unauthenticated request receives 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/reset-app-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /Unauthorized|Administrator credentials required/i);
  });

  // =========================================================================
  // 4 & 5. CONFIRMATION MODAL & CANCEL IN UI COMPONENT
  // =========================================================================
  await t.test('4 & 5. UI verifies confirmation modal structure, scope listing, and Cancel button', () => {
    const settingsFile = fs.readFileSync(path.join(__dirname, '../src/pages/admin/AdminSettings.jsx'), 'utf-8');
    assert.ok(settingsFile.includes('Reset App Data?'), 'Must have modal title "Reset App Data?"');
    assert.ok(settingsFile.includes('Danger Zone'), 'Must have Danger Zone section');
    assert.ok(settingsFile.includes('Protected'), 'Modal must list Protected category');
    assert.ok(settingsFile.includes('Will Reset'), 'Modal must list Will Reset category');
    assert.ok(settingsFile.includes('Cancel'), 'Modal must have Cancel button');
    assert.ok(settingsFile.includes('setShowResetModal(false)'), 'Cancel must dismiss modal without action');
  });

  // =========================================================================
  // 6, 7, 8, 9, 10, 11, 12, 13: SELECTIVE RESET OF TEST DATA WHILE PRESERVING REAL & UNMARKED DATA
  // =========================================================================
  await t.test('6-13. Safe selective reset: Removes test fixtures, strictly protects real users, admin, real apps, real subs, built-in sources & unmarked records', async () => {
    // Seed an explicitly marked test user
    db.users.insert({
      id: 'test-user-fixture-1',
      name: 'Automated Test User',
      phone: '+919999912345',
      isTest: true,
      plan: 'free',
    });

    // Seed an unmarked unknown production user (must NOT be deleted!)
    db.users.insert({
      id: 'user-unmarked-prod-999',
      name: 'Unmarked Real User',
      phone: '+919811122233',
      plan: 'free',
    });

    // Seed test profile
    db.profiles.insert({
      id: 'prof-test-1',
      userId: 'test-user-fixture-1',
      name: 'Automated Test User',
      isTest: true,
    });

    // Seed unmarked profile
    db.profiles.insert({
      id: 'prof-unmarked-999',
      userId: 'user-unmarked-prod-999',
      name: 'Unmarked Real User',
    });

    // Seed test application
    db.applications.insert({
      id: 'test-app-fixture-1',
      userId: 'test-user-fixture-1',
      jobId: 'job-builtin-1',
      status: 'applied',
      isTest: true,
    });

    // Seed test custom job
    db.jobs.insert({
      id: 'job-test-fixture-1',
      title: 'Fake Scraped Job',
      isTest: true,
      sourceId: 'custom-src-1',
    });

    // Seed test custom source
    db.sources.insert({
      id: 'custom-src-test-1',
      name: 'Test Subreddit',
      type: 'custom',
      isTest: true,
      userId: 'test-user-fixture-1',
    });

    // Seed test subscription & transaction
    db.subscriptions.insert({
      id: 'sub-test-1',
      userId: 'test-user-fixture-1',
      plan: 'free',
      isTest: true,
    });

    if (db.transactions) {
      db.transactions.insert({
        id: 'tx-test-1',
        userId: 'test-user-fixture-1',
        amount: 299,
        isTest: true,
      });
    }

    // 2. Perform Reset as Admin
    const res = await fetch(`${BASE_URL}/reset-app-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.reset);

    // 6. Test/demo data is removed
    assert.ok(data.reset.users >= 1, 'At least 1 test user was reset');
    assert.ok(data.reset.applications >= 1, 'At least 1 test application was reset');
    assert.ok(data.reset.jobs >= 1, 'At least 1 test job was reset');
    assert.ok(data.reset.sources >= 1, 'At least 1 test source was reset');

    // Verify test records are no longer in DB
    assert.strictEqual(db.users.findById('test-user-fixture-1'), undefined);
    assert.strictEqual(db.profiles.findById('prof-test-1'), undefined);
    assert.strictEqual(db.applications.findById('test-app-fixture-1'), undefined);
    assert.strictEqual(db.jobs.findById('job-test-fixture-1'), undefined);
    assert.strictEqual(db.sources.findById('custom-src-test-1'), undefined);
    assert.strictEqual(db.subscriptions.findById('sub-test-1'), undefined);

    // 7. Real user remains untouched
    const toufiq = db.users.findOne((u) => u.phone === '+917758757575');
    assert.ok(toufiq, 'Real user Toufiq must exist');
    assert.strictEqual(toufiq.name, 'Toufiq');

    const messi = db.users.findOne((u) => u.phone === '+919874950646');
    assert.ok(messi, 'Real user messi must exist');

    // 8. Real admin remains untouched (valid token check via /auth/me)
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.success, true);
    assert.strictEqual(meData.admin.role, 'admin');

    // 9. Real applications remain untouched
    const realApp = db.applications.findOne((a) => a.userId === 'user-1789503692368' || a.userId === 'user-1789502668516');
    assert.ok(realApp, 'Real user application must be preserved');

    // 10. Real subscriptions remain untouched
    const toufiqSub = db.subscriptions.findOne((s) => s.userId === 'user-1789502668516');
    assert.ok(toufiqSub, 'Toufiq subscription must be preserved');
    const messiSub = db.subscriptions.findOne((s) => s.userId === 'user-1789503692368');
    assert.ok(messiSub, 'messi subscription must be preserved');

    // 12. Built-in sources remain protected
    const builtinSources = db.sources.findAll((s) => s.type === 'builtin' || s.id.startsWith('demo-src-'));
    assert.ok(builtinSources.length >= 3, 'Built-in sources must remain protected');

    // 13. Unmarked/unknown records are NOT deleted
    const unmarkedUser = db.users.findById('user-unmarked-prod-999');
    assert.ok(unmarkedUser, 'Unmarked user must NOT be deleted');
    const unmarkedProfile = db.profiles.findById('prof-unmarked-999');
    assert.ok(unmarkedProfile, 'Unmarked profile must NOT be deleted');

    // Clean up temporary unmarked test record
    db.users.delete('user-unmarked-prod-999');
    db.profiles.delete('prof-unmarked-999');
  });

  // =========================================================================
  // 14. DASHBOARD METRICS REFRESH AFTER RESET
  // =========================================================================
  await t.test('14. Dashboard metrics recalculate accurately from actual remaining DB state', async () => {
    const res = await fetch(`${BASE_URL}/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.stats.totalUsers, db.users.count());
    assert.strictEqual(data.stats.totalApplications, db.applications.count());

    const oppRes = await fetch(`${BASE_URL}/opportunities`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const oppData = await oppRes.json();
    assert.strictEqual(oppRes.status, 200);
    assert.strictEqual(oppData.total, db.jobs.count());
  });

  // =========================================================================
  // 15 & 16. RESPONSE REPORTS ACTUAL COUNTS & IDEMPOTENT RUN
  // =========================================================================
  await t.test('15 & 16. Reset response reports actual counts and running reset twice is idempotent', async () => {
    // Run second time on already cleaned DB
    const res2 = await fetch(`${BASE_URL}/reset-app-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(res2.status, 200);
    const data2 = await res2.json();
    assert.strictEqual(data2.success, true);

    // On second immediate run, 0 items should need resetting
    assert.strictEqual(data2.reset.users, 0);
    assert.strictEqual(data2.reset.applications, 0);
    assert.strictEqual(data2.reset.jobs, 0);
    assert.strictEqual(data2.reset.sources, 0);

    // Preserved counts remain intact
    assert.strictEqual(data2.preserved.users, db.users.count());
    assert.strictEqual(data2.preserved.applications, db.applications.count());
    assert.strictEqual(data2.preserved.jobs, db.jobs.count());
  });
});
