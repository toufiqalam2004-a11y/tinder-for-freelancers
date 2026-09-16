import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/database.js';

const BASE_URL = 'http://localhost:5000';
const ADMIN_PASSKEY = process.env.ADMIN_SECRET_KEY || 'tf-admin-secret-2026';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('ADMIN DASHBOARD <-> USER APP SOURCE LIVE SYNC END-TO-END SUITE', async (t) => {
  const testPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  let adminToken = null;
  let userToken = null;
  let userId = null;
  let firstSourceId = null;
  let secondSourceId = null;
  let initialCustomCount = 0;

  // 1. Admin login to obtain admin credentials
  await t.test('Step 1: Admin logs in to obtain admin token', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
    });
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.ok(data.token);
    adminToken = data.token;

    const initialRes = await fetchJson(`${BASE_URL}/api/admin/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (initialRes.data && typeof initialRes.data.totalCustom === 'number') {
      initialCustomCount = initialRes.data.totalCustom;
    }
  });

  // 2. User logs in via standard OTP flow and sets profile name
  await t.test('Step 2: Real test user completes OTP flow & creates profile', async () => {
    // Send OTP
    const sendRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });
    assert.equal(sendRes.status, 200);

    // Verify OTP
    const verifyRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, code: '1234' }),
    });
    assert.equal(verifyRes.status, 200);
    assert.ok(verifyRes.data.token);
    assert.ok(verifyRes.data.user.id);
    userToken = verifyRes.data.token;
    userId = verifyRes.data.user.id;

    // Set user profile name
    const profileRes = await fetchJson(`${BASE_URL}/api/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        userId,
        name: 'Sarah Designer',
        email: 'sarah@example.com',
        profession: 'UI/UX Specialist',
      }),
    });
    assert.equal(profileRes.status, 200);
  });

  // 3 & 4. User App adds one custom source
  await t.test('Step 3 & 4: User App adds Reddit custom source via POST /api/sources', async () => {
    const sourcePayload = {
      id: `custom-src-sync-${Date.now()}`,
      name: 'Reddit — Video Editing Jobs',
      platform: 'reddit',
      url: 'https://reddit.com/r/forhire',
      enabled: true,
      query: 'video editing',
    };

    const addRes = await fetchJson(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(sourcePayload),
    });

    assert.equal(addRes.status, 201);
    assert.equal(addRes.data.success, true);
    assert.ok(addRes.data.source);
    assert.equal(addRes.data.source.name, 'Reddit — Video Editing Jobs');
    firstSourceId = addRes.data.source.id;
  });

  // 5. Verify it appears directly in db.sources
  await t.test('Step 5: Verify source exists in db.sources (single source of truth)', async () => {
    const foundInDb = db.sources.findById(firstSourceId);
    assert.ok(foundInDb, 'Source record must exist in db.sources');
    assert.equal(foundInDb.id, firstSourceId);
    assert.equal(foundInDb.userId, userId);
    assert.equal(foundInDb.name, 'Reddit — Video Editing Jobs');
    assert.equal(foundInDb.enabled, true);
  });

  // 6, 7 & 8. Open Admin -> Sources, verify same source appears with correct owner & details
  await t.test('Step 6, 7 & 8: Admin -> Sources shows exact source with Sarah Designer as owner', async () => {
    const adminRes = await fetchJson(`${BASE_URL}/api/admin/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.success, true);
    assert.equal(adminRes.data.totalCustom, initialCustomCount + 1);
    assert.equal(adminRes.data.totalBuiltin, 3);

    const customSource = adminRes.data.customSources.find((s) => s.id === firstSourceId);
    assert.ok(customSource, 'Custom source must appear in Admin Sources');
    assert.equal(customSource.name, 'Reddit — Video Editing Jobs');
    assert.equal(customSource.platform, 'reddit');
    assert.equal(customSource.url, 'https://reddit.com/r/forhire');
    assert.equal(customSource.ownerId, userId);
    assert.equal(customSource.ownerName, 'Sarah Designer');
    assert.equal(customSource.ownerPhone, testPhone);
    assert.equal(customSource.enabled, true);
    assert.equal(customSource.status, 'Active');
    assert.ok(customSource.createdAt);
  });

  // 9, 10 & 11. Disable source from User App -> Verify Admin reflects Disabled
  await t.test('Step 9, 10 & 11: Disable source from User App -> Admin shows Disabled', async () => {
    const toggleRes = await fetchJson(`${BASE_URL}/api/sources/${firstSourceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(toggleRes.status, 200);
    assert.equal(toggleRes.data.source.enabled, false);

    // Refresh Admin Sources
    const adminRes = await fetchJson(`${BASE_URL}/api/admin/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.totalCustom, initialCustomCount + 1);

    const customSource = adminRes.data.customSources.find((s) => s.id === firstSourceId);
    assert.ok(customSource);
    assert.equal(customSource.enabled, false);
    assert.equal(customSource.status, 'Disabled');
  });

  // 12 & 13. Enable source again from User App -> Verify Admin reflects Active
  await t.test('Step 12 & 13: Enable source again from User App -> Admin shows Active', async () => {
    const toggleRes = await fetchJson(`${BASE_URL}/api/sources/${firstSourceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(toggleRes.status, 200);
    assert.equal(toggleRes.data.source.enabled, true);

    // Refresh Admin Sources
    const adminRes = await fetchJson(`${BASE_URL}/api/admin/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.totalCustom, initialCustomCount + 1);

    const customSource = adminRes.data.customSources.find((s) => s.id === firstSourceId);
    assert.ok(customSource);
    assert.equal(customSource.enabled, true);
    assert.equal(customSource.status, 'Active');
  });

  // 14, 15 & 16. Delete source from User App -> Verify source is gone in Admin
  await t.test('Step 14, 15 & 16: Delete source from User App -> Disappears from Admin', async () => {
    const deleteRes = await fetchJson(`${BASE_URL}/api/sources/${firstSourceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(deleteRes.status, 200);

    // Verify deleted in db.sources
    assert.equal(db.sources.findById(firstSourceId), undefined);

    // Refresh Admin Sources
    const adminRes = await fetchJson(`${BASE_URL}/api/admin/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.totalCustom, initialCustomCount);
    const customSource = adminRes.data.customSources.find((s) => s.id === firstSourceId);
    assert.equal(customSource, undefined);
  });

  // 17 & 18. Add a second source -> Verify Admin count increases to the real count
  await t.test('Step 17 & 18: Add a second source -> Admin count dynamically reflects 1', async () => {
    const secondPayload = {
      id: `custom-src-sync2-${Date.now()}`,
      name: 'X — Video Editor Hiring',
      platform: 'x',
      url: 'https://x.com/jobs',
      enabled: true,
      query: 'hiring video editor',
    };

    const addRes = await fetchJson(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(secondPayload),
    });

    assert.equal(addRes.status, 201);
    secondSourceId = addRes.data.source.id;

    // Refresh Admin Sources
    const adminRes = await fetchJson(`${BASE_URL}/api/admin/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.totalCustom, initialCustomCount + 1);

    const foundSecond = adminRes.data.customSources.find((s) => s.id === secondSourceId);
    assert.ok(foundSecond);
    assert.equal(foundSecond.name, 'X — Video Editor Hiring');
    assert.equal(foundSecond.platform, 'x');
    assert.equal(foundSecond.ownerName, 'Sarah Designer');
  });

  // Guaranteed Teardown: Clean up test user & sources even if subtests fail
  t.after(async () => {
    if (userId) {
      db.users.delete(userId);
      db.profiles.delete(userId);
      db.profiles.delete(`prof-${userId}`);
      db.subscriptions.delete(`sub-${userId}`);
      db.quotas.delete(`quota-${userId}`);
      db.rewards.delete(`reward-${userId}`);
    }
    if (firstSourceId) db.sources.delete(firstSourceId);
    if (secondSourceId) db.sources.delete(secondSourceId);
  });
});
