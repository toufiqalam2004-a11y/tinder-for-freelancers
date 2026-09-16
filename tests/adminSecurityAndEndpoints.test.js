import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { db } from '../server/database.js';
import { activeSessions } from '../server/sessions.js';
import adminRouter from '../server/routes/admin.js';

// Setup isolated express app with admin router for testing
const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

const server = app.listen(0);
const port = server.address().port;
const BASE_URL = `http://127.0.0.1:${port}/api/admin`;

test.after(() => {
  server.close();
});

test('ADMIN SECURITY & DATA ENDPOINTS TEST SUITE', async (t) => {
  let adminToken = null;
  const normalUserToken = 'tf-sess-test-normal-user-1';

  // Seed a normal user session in activeSessions
  activeSessions.set(normalUserToken, {
    userId: 'user-normal-test',
    phone: '+919999900001',
    role: 'user',
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  await t.test('[Test 1]: Unauthenticated request to /api/admin/stats returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/stats`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Forbidden/);
  });

  await t.test('[Test 2]: Normal user token (role: "user") to /api/admin/users returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      headers: {
        Authorization: `Bearer ${normalUserToken}`,
      },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Insufficient privileges|Administrator access required/);
  });

  await t.test('[Test 3]: Normal user token to /api/admin/ai-agent/status returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/ai-agent/status`, {
      headers: {
        Authorization: `Bearer ${normalUserToken}`,
      },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  await t.test('[Test 4]: Admin login with invalid passkey returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: 'wrong-passkey-123' }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  await t.test('[Test 5]: Admin login with valid passkey returns admin token and role="admin"', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: 'tf-admin-secret-2026' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.token);
    assert.equal(body.admin.role, 'admin');
    adminToken = body.token;
  });

  await t.test('[Test 6]: GET /api/admin/auth/me returns admin identity with valid admin token', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.admin.role, 'admin');
  });

  await t.test('[Test 7]: GET /api/admin/stats returns 8 core metrics from actual DB data', async () => {
    const res = await fetch(`${BASE_URL}/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    const { stats } = body;
    assert.ok('totalUsers' in stats);
    assert.ok('freeUsers' in stats);
    assert.ok('plusUsers' in stats);
    assert.ok('proUsers' in stats);
    assert.ok('totalApplications' in stats);
    assert.ok('applicationsToday' in stats);
    assert.ok('activeSources' in stats);
    assert.ok('activeUsers' in stats);
    assert.equal(typeof stats.totalUsers, 'number');
    assert.equal(typeof stats.totalApplications, 'number');
  });

  await t.test('[Test 8]: GET /api/admin/users lists real users with plan and application counts', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.users));
    if (body.users.length > 0) {
      const u = body.users[0];
      assert.ok('id' in u);
      assert.ok('plan' in u);
      assert.ok('applicationsCount' in u);
      assert.ok('sourcesCount' in u);
    }
  });

  await t.test('[Test 9]: GET /api/admin/applications aggregates platform stats and lists records', async () => {
    const res = await fetch(`${BASE_URL}/applications`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok('stats' in body);
    assert.ok('applied' in body.stats);
    assert.ok('saved' in body.stats);
    assert.ok('draft' in body.stats);
    assert.ok(Array.isArray(body.applications));
  });

  await t.test('[Test 10]: GET /api/admin/opportunities lists stored jobs from database', async () => {
    const res = await fetch(`${BASE_URL}/opportunities`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.opportunities));
  });

  await t.test('[Test 11]: GET /api/admin/sources cleanly separates builtin and custom sources', async () => {
    const res = await fetch(`${BASE_URL}/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.builtinSources));
    assert.ok(Array.isArray(body.customSources));
    assert.ok(body.totalBuiltin > 0);
  });

  await t.test('[Test 12]: GET /api/admin/ai-agent/status returns discovery engine configuration', async () => {
    const res = await fetch(`${BASE_URL}/ai-agent/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok('aiAgent' in body);
    assert.ok('status' in body.aiAgent);
    assert.ok('services' in body.aiAgent);
    assert.ok('metrics' in body.aiAgent);
  });

  await t.test('[Test 13]: GET /api/admin/subscriptions returns tier breakdown and pricing reference', async () => {
    const res = await fetch(`${BASE_URL}/subscriptions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok('stats' in body);
    assert.ok('pricingReference' in body);
    assert.equal(body.pricingReference.monthly.plus, 7);
    assert.equal(body.pricingReference.monthly.pro, 19);
  });

  await t.test('[Test 14]: GET /api/admin/analytics returns real metrics distribution', async () => {
    const res = await fetch(`${BASE_URL}/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok('planDistribution' in body.analytics);
    assert.ok('applicationStatusDistribution' in body.analytics);
  });

  await t.test('[Test 15]: GET /api/admin/settings exposes safe configuration health with zero secret leaks', async () => {
    const res = await fetch(`${BASE_URL}/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    const raw = JSON.stringify(body.settings);
    // Ensure no API keys or secret strings leaked
    assert.ok(!raw.includes('secret'));
    assert.ok(!raw.includes('key_'));
    assert.ok(!raw.includes('token_'));
    assert.ok(body.settings.services);
  });

  await t.test('[Test 16]: Master API key header x-admin-key authorizes admin calls', async () => {
    const res = await fetch(`${BASE_URL}/stats`, {
      headers: { 'x-admin-key': 'tf-admin-secret-2026' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });

  await t.test('[Test 17]: Admin logout invalidates token', async () => {
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(logoutRes.status, 200);

    // Re-attempt access with invalidated token -> 403
    const checkRes = await fetch(`${BASE_URL}/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(checkRes.status, 403);
  });
});
