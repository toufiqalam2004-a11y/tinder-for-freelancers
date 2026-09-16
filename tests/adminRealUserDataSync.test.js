import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/database.js';

const BASE_URL = 'http://localhost:5000';
const ADMIN_PASSKEY = process.env.ADMIN_SECRET_KEY || 'tf-admin-secret-2026';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('LIVE SYNC VERIFICATION: Real User Application -> Admin Dashboard Data', async (t) => {
  const testPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  let userToken = null;
  let userId = null;
  let adminToken = null;
  let createdAppId = null;
  let createdSourceId = null;
  let createdJobId = null;

  // 0. Admin Login
  await t.test('Step 0: Admin logs in to obtain admin credentials', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
    adminToken = data.token;
  });

  // 1 & 2. Create/login test user using existing OTP flow
  await t.test('Step 1 & 2: User completes normal OTP send & verify flow', async () => {
    // Send OTP
    const sendRes = await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });
    assert.strictEqual(sendRes.status, 200);
    assert.strictEqual(sendRes.data.success, true);

    // Verify OTP with 1234
    const verifyRes = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, code: '1234' }),
    });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.data.success, true);
    assert.ok(verifyRes.data.token);
    assert.ok(verifyRes.data.user.id);
    userToken = verifyRes.data.token;
    userId = verifyRes.data.user.id;
  });

  // 4 & 5. Verify the new user appears automatically in Admin Dashboard -> Users
  await t.test('Step 4 & 5: New user immediately appears in Admin Dashboard -> Users', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/users?search=${encodeURIComponent(testPhone)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    const found = data.users.find((u) => u.id === userId || u.phone === testPhone);
    assert.ok(found, 'New user must appear in Admin Users list');
    assert.strictEqual(found.phone, testPhone);
    assert.strictEqual(found.plan, 'free');
  });

  // 3, 6 & 7. Complete onboarding/profile in user app -> verify Admin shows profile
  await t.test('Step 3, 6 & 7: User completes profile -> Admin Dashboard displays real craft profile', async () => {
    const profilePayload = {
      userId,
      name: 'Test Candidate Alice',
      email: 'alice@example.com',
      profession: 'Senior UI/UX Designer',
      primaryRole: 'Senior UI/UX Designer',
      category: 'Design & Creative',
      skills: ['Figma', 'Prototyping', 'Design Systems'],
      experience: '5+ years',
      portfolioUrl: 'https://example.com/alice-portfolio',
      availability: 'Immediate',
      targetRates: '$75/hr',
      remotePreference: 'Remote Only',
    };

    const saveRes = await fetchJson(`${BASE_URL}/api/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(profilePayload),
    });
    assert.strictEqual(saveRes.status, 200);
    assert.strictEqual(saveRes.data.success, true);

    // Fetch user details from Admin API
    const adminDetailRes = await fetchJson(`${BASE_URL}/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminDetailRes.status, 200);
    assert.strictEqual(adminDetailRes.data.success, true);
    const adminUser = adminDetailRes.data.user;

    assert.strictEqual(adminUser.name, 'Test Candidate Alice');
    assert.strictEqual(adminUser.profile?.profession, 'Senior UI/UX Designer');
    assert.strictEqual(adminUser.profile?.category, 'Design & Creative');
    assert.deepStrictEqual(adminUser.profile?.skills, ['Figma', 'Prototyping', 'Design Systems']);
    assert.strictEqual(adminUser.profile?.portfolioUrl, 'https://example.com/alice-portfolio');
    assert.strictEqual(adminUser.profile?.targetRates, '$75/hr');
  });

  // 8, 9 & 10. Update profile in user app -> Refresh Admin -> Verify updated value
  await t.test('Step 8, 9 & 10: Update profile in user app -> Admin reflects update immediately', async () => {
    const updatedPayload = {
      userId,
      name: 'Alice Cooper',
      email: 'alice@example.com',
      profession: 'Lead Product Designer',
      primaryRole: 'Lead Product Designer',
      targetRates: '$95/hr',
      category: 'Design & Creative',
      skills: ['Figma', 'Framer', 'AI Workflows'],
    };

    const updateRes = await fetchJson(`${BASE_URL}/api/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(updatedPayload),
    });
    assert.strictEqual(updateRes.status, 200);

    // Admin detail check
    const adminDetailRes = await fetchJson(`${BASE_URL}/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminDetailRes.status, 200);
    assert.strictEqual(adminDetailRes.data.user.name, 'Alice Cooper');
    assert.strictEqual(adminDetailRes.data.user.profile?.profession, 'Lead Product Designer');
    assert.strictEqual(adminDetailRes.data.user.profile?.targetRates, '$95/hr');
  });

  // 11, 12 & 13. Create/save/apply to a job -> Verify Admin reflects applications
  await t.test('Step 11, 12 & 13: User applies to a job -> Admin Applications pipeline reflects real record', async () => {
    const testAppId = `app-sync-${Date.now()}`;
    const testJobId = `job-sync-${Date.now()}`;
    createdAppId = testAppId;
    createdJobId = testJobId;

    // Seed a job in DB
    db.jobs.insert({
      id: testJobId,
      title: 'Senior Mobile App Design Contract',
      company: 'Fintech Studio',
      sourceId: 'direct',
      platform: 'reddit',
      matchScore: 92,
    });

    const appPayload = {
      id: testAppId,
      jobId: testJobId,
      userId,
      title: 'Senior Mobile App Design Contract',
      company: 'Fintech Studio',
      platform: 'reddit',
      status: 'applied',
      matchScore: 92,
      message: 'Hi, I would love to design your mobile application.',
    };

    const submitRes = await fetchJson(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(appPayload),
    });
    assert.strictEqual(submitRes.status, 200);
    assert.strictEqual(submitRes.data.success, true);

    // Admin Applications check
    const adminAppsRes = await fetchJson(`${BASE_URL}/api/admin/applications?userId=${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminAppsRes.status, 200);
    assert.strictEqual(adminAppsRes.data.success, true);
    const foundApp = adminAppsRes.data.applications.find((a) => a.id === testAppId);
    assert.ok(foundApp, 'Submitted application must appear in Admin Applications');
    assert.strictEqual(foundApp.status, 'applied');
    assert.strictEqual(foundApp.title, 'Senior Mobile App Design Contract');

    // Admin User inspect check: application count & applied list
    const adminUserRes = await fetchJson(`${BASE_URL}/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminUserRes.data.user.applicationUsage.applied, 1);
    assert.strictEqual(adminUserRes.data.user.applicationUsage.applicationsUsed, 1);
  });

  // 14 & 15. Custom source add/delete/toggle & subscription upgrade
  await t.test('Step 14 & 15: Custom source add & subscription upgrade -> Admin reflects database state', async () => {
    // 14a. Add a custom source
    const sourcePayload = {
      id: `custom-src-${Date.now()}`,
      name: 'Designers Subreddit Feed',
      platform: 'reddit',
      url: 'https://reddit.com/r/designjobs',
      enabled: true,
      query: 'designer',
    };

    const addSrcRes = await fetchJson(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(sourcePayload),
    });
    assert.strictEqual(addSrcRes.status, 201);
    createdSourceId = addSrcRes.data.source.id;

    // Verify custom source in Admin -> Sources
    const adminSourcesRes = await fetchJson(`${BASE_URL}/api/admin/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminSourcesRes.status, 200);
    const foundSource = adminSourcesRes.data.customSources.find((s) => s.id === createdSourceId);
    assert.ok(foundSource, 'Created source must appear in Admin Sources');
    assert.strictEqual(foundSource.ownerId, userId);
    assert.strictEqual(foundSource.enabled, true);

    // 14b. Toggle source to disabled
    const toggleRes = await fetchJson(`${BASE_URL}/api/sources/${createdSourceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ enabled: false }),
    });
    assert.strictEqual(toggleRes.status, 200);

    // Verify disabled state in Admin -> Sources
    const adminSourcesDisabledRes = await fetchJson(`${BASE_URL}/api/admin/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const foundDisabledSource = adminSourcesDisabledRes.data.customSources.find((s) => s.id === createdSourceId);
    assert.strictEqual(foundDisabledSource.enabled, false);

    // 15. Upgrade subscription from Free to Pro
    const subRes = await fetchJson(`${BASE_URL}/api/subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        userId,
        plan: 'pro',
        currency: 'USD',
        status: 'active',
      }),
    });
    assert.strictEqual(subRes.status, 200);

    // Verify Pro tier in Admin -> Users and Admin -> Subscriptions
    const adminSubRes = await fetchJson(`${BASE_URL}/api/admin/subscriptions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminSubRes.status, 200);
    const userSub = adminSubRes.data.subscriptions.find((s) => s.userId === userId);
    assert.ok(userSub);
    assert.strictEqual(userSub.plan, 'pro');

    const adminUserUpdatedRes = await fetchJson(`${BASE_URL}/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminUserUpdatedRes.data.user.subscription.plan, 'pro');
    assert.strictEqual(adminUserUpdatedRes.data.user.sourcesUsage.maxLimit, 5); // Pro allows 5 sources
  });

  // Guaranteed Teardown: Clean up test user & generated test records
  t.after(async () => {
    if (userId) {
      db.users.delete(userId);
      db.profiles.delete(userId);
      db.profiles.delete(`prof-${userId}`);
      db.subscriptions.delete(`sub-${userId}`);
      db.quotas.delete(`quota-${userId}`);
      db.rewards.delete(`reward-${userId}`);
    }
    if (createdSourceId) db.sources.delete(createdSourceId);
    if (createdAppId) db.applications.delete(createdAppId);
    if (createdJobId) db.jobs.delete(createdJobId);
  });
});
