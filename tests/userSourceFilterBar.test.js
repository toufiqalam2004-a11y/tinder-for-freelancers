import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../server/database.js';
import { cleanAllTestFixtures } from './cleanFixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BASE_URL = 'http://localhost:5000';
const ADMIN_PASSKEY = process.env.ADMIN_SECRET_KEY || 'tf-admin-secret-2026';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('USER APP SOURCE FILTER BAR REMOVAL & CUSTOM SOURCE BEHAVIOR', () => {
  let adminToken = null;
  const userAPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  const userBPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  let userAToken = null;
  let userAId = null;
  let userBToken = null;
  let userBId = null;

  let userASource1Id = null;
  let userASource2Id = null;
  let userBSource1Id = null;

  // --------------------------------------------------------------------------
  // TEST 1: STATIC CODE AUDIT — NO HARDCODED DEFAULT SOURCE FILTERS IN USER APP
  // --------------------------------------------------------------------------
  test('1. Static Code Audit: Jobs.jsx contains ZERO hardcoded default source filter arrays (PLATFORM_FILTERS removed)', () => {
    const jobsContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Jobs.jsx'), 'utf8');

    // Ensure PLATFORM_FILTERS is completely gone
    assert.equal(jobsContent.includes('const PLATFORM_FILTERS'), false, 'Jobs.jsx must NOT define PLATFORM_FILTERS');
    assert.equal(jobsContent.includes('PLATFORM_FILTERS.map'), false, 'Jobs.jsx must NOT iterate PLATFORM_FILTERS');

    // Ensure the filter bar is gated by customSources
    assert.ok(
      jobsContent.includes('userCustomSources.length > 0'),
      'Jobs.jsx must gate the source filter bar by userCustomSources.length > 0'
    );

    // Ensure built-in sources are excluded from user filter chips
    assert.ok(
      jobsContent.includes("s.type === 'custom'"),
      'Jobs.jsx must filter for custom sources only'
    );
    assert.ok(
      jobsContent.includes('!s.isBuiltin'),
      'Jobs.jsx must exclude built-in sources from user filter chips'
    );
  });

  // --------------------------------------------------------------------------
  // SETUP: Authenticate Admin & Test Users
  // --------------------------------------------------------------------------
  test('2. Setup: Authenticate Admin, User A, and User B', async () => {
    // Admin login
    const adminRes = await fetchJson(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
    });
    assert.equal(adminRes.status, 200);
    adminToken = adminRes.data.token;

    // User A OTP send & verify
    await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: userAPhone }),
    });
    const verifyA = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: userAPhone, code: '1234' }),
    });
    assert.equal(verifyA.status, 200);
    userAToken = verifyA.data.token;
    userAId = verifyA.data.user.id;

    // User B OTP send & verify
    await fetchJson(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: userBPhone }),
    });
    const verifyB = await fetchJson(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: userBPhone, code: '1234' }),
    });
    assert.equal(verifyB.status, 200);
    userBToken = verifyB.data.token;
    userBId = verifyB.data.user.id;
  });

  // --------------------------------------------------------------------------
  // TEST 3: NEW USER WITH 0 CUSTOM SOURCES HAS EMPTY CUSTOM SOURCES LIST
  // --------------------------------------------------------------------------
  test('3. New user with 0 custom sources receives empty customSources list (filter bar hidden)', async () => {
    const resA = await fetchJson(`${BASE_URL}/api/sources`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
    });

    assert.equal(resA.status, 200);
    assert.equal(resA.data.success, true);
    assert.ok(Array.isArray(resA.data.customSources));
    assert.equal(resA.data.customSources.length, 0, 'New user customSources must be empty');
    assert.equal(resA.data.current, 0);
  });

  // --------------------------------------------------------------------------
  // TEST 4: BUILT-IN SOURCES FEED QUALIFIED JOBS BUT DO NOT APPEAR IN USER FILTER CHIPS
  // --------------------------------------------------------------------------
  test('4. Built-in sources feed qualified jobs to feed, but built-in source filter chips are not in user customSources', async () => {
    const res = await fetchJson(`${BASE_URL}/api/sources`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.builtinSources.length >= 3, 'Built-in sources exist on platform');

    // Built-in sources must NOT be in customSources
    for (const bs of res.data.builtinSources) {
      assert.equal(
        res.data.customSources.some((cs) => cs.id === bs.id),
        false,
        `Built-in source ${bs.id} must not appear in customSources`
      );
    }

    // Verify Jobs feed returns opportunities (built-in jobs still available)
    const jobsRes = await fetchJson(`${BASE_URL}/api/jobs`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(jobsRes.status, 200);
    assert.ok(Array.isArray(jobsRes.data.jobs));
    assert.ok(jobsRes.data.jobs.length > 0, 'Platform jobs must still be returned to feed');
  });

  // --------------------------------------------------------------------------
  // TEST 5: USER ADDS ONE CUSTOM SOURCE -> ONLY THAT CUSTOM SOURCE APPEARS
  // --------------------------------------------------------------------------
  test('5. User A adds 1 custom source -> customSources contains strictly that source', async () => {
    const addRes = await fetchJson(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
      body: JSON.stringify({
        name: 'Video Editing Facebook Group',
        platform: 'facebook_group',
        url: 'https://facebook.com/groups/videoeditors',
        type: 'custom',
      }),
    });

    assert.ok(addRes.status === 200 || addRes.status === 201);
    assert.equal(addRes.data.success, true);
    userASource1Id = addRes.data.source.id;

    // Fetch user A sources
    const listRes = await fetchJson(`${BASE_URL}/api/sources`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
    });

    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.customSources.length, 1);
    assert.equal(listRes.data.customSources[0].name, 'Video Editing Facebook Group');
    assert.equal(listRes.data.customSources[0].id, userASource1Id);
  });

  // --------------------------------------------------------------------------
  // TEST 6: USER ADDS SECOND CUSTOM SOURCE -> BOTH APPEAR, NO HARDCODED NAMES
  // --------------------------------------------------------------------------
  test('6. User A upgrades/adds second custom source -> Only User A custom sources appear', async () => {
    // Give User A Pro plan so they can add a second source
    const sub = db.subscriptions.findOne((s) => s.userId === userAId);
    if (sub) {
      sub.plan = 'pro';
      db.subscriptions.update(sub.id, sub);
    } else {
      db.subscriptions.insert({
        id: `sub-${userAId}`,
        userId: userAId,
        phone: userAPhone,
        plan: 'pro',
        status: 'active',
      });
    }

    const addRes2 = await fetchJson(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
      body: JSON.stringify({
        name: 'Reddit Freelance Jobs',
        platform: 'reddit',
        url: 'https://reddit.com/r/forhire',
        type: 'custom',
      }),
    });

    assert.ok(addRes2.status === 200 || addRes2.status === 201);
    userASource2Id = addRes2.data.source.id;

    const listRes = await fetchJson(`${BASE_URL}/api/sources`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
    });

    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.customSources.length, 2);
    const names = listRes.data.customSources.map((s) => s.name);
    assert.ok(names.includes('Video Editing Facebook Group'));
    assert.ok(names.includes('Reddit Freelance Jobs'));
  });

  // --------------------------------------------------------------------------
  // TEST 7: USER B ADDS A CUSTOM SOURCE & STRICT CROSS-USER ISOLATION
  // --------------------------------------------------------------------------
  test('7. Strict Cross-User Isolation: User A NEVER sees User B sources; User B NEVER sees User A sources', async () => {
    // User B adds custom source "User B YouTube Creators"
    const addB = await fetchJson(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
        'x-user-id': userBId,
      },
      body: JSON.stringify({
        name: 'User B YouTube Creators',
        platform: 'youtube',
        url: 'https://youtube.com/@creators',
        type: 'custom',
      }),
    });
    assert.ok(addB.status === 200 || addB.status === 201);
    userBSource1Id = addB.data.source.id;

    // User A fetches sources: must contain ONLY A1 and A2, never B1
    const listA = await fetchJson(`${BASE_URL}/api/sources`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
    });
    assert.equal(listA.data.customSources.length, 2);
    assert.equal(listA.data.customSources.some((s) => s.id === userBSource1Id), false);
    assert.equal(listA.data.customSources.some((s) => s.name === 'User B YouTube Creators'), false);

    // User B fetches sources: must contain ONLY B1, never A1 or A2
    const listB = await fetchJson(`${BASE_URL}/api/sources`, {
      headers: {
        Authorization: `Bearer ${userBToken}`,
        'x-user-id': userBId,
      },
    });
    assert.equal(listB.data.customSources.length, 1);
    assert.equal(listB.data.customSources[0].name, 'User B YouTube Creators');
    assert.equal(listB.data.customSources.some((s) => s.id === userASource1Id), false);
    assert.equal(listB.data.customSources.some((s) => s.id === userASource2Id), false);
  });

  // --------------------------------------------------------------------------
  // TEST 8: SERVER-SIDE IDOR PROTECTION: USER A CANNOT DELETE OR MUTATE USER B'S SOURCE
  // --------------------------------------------------------------------------
  test("8. IDOR Protection: User A cannot delete or update User B's custom source", async () => {
    // User A tries to delete User B's source
    const deleteRes = await fetchJson(`${BASE_URL}/api/sources/${userBSource1Id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
    });
    assert.equal(deleteRes.status, 403);
    assert.ok(deleteRes.data.message.includes('Access denied') || deleteRes.data.error === 'FORBIDDEN');

    // User A tries to mutate User B's source
    const putRes = await fetchJson(`${BASE_URL}/api/sources/${userBSource1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
      body: JSON.stringify({ name: 'Hacked by User A' }),
    });
    assert.equal(putRes.status, 403);
  });

  // --------------------------------------------------------------------------
  // TEST 9: DISABLE SOURCE -> SOURCE MARKED ENABLED=FALSE
  // --------------------------------------------------------------------------
  test('9. User disables custom source -> enabled is toggled to false', async () => {
    const toggleRes = await fetchJson(`${BASE_URL}/api/sources/${userASource1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
      body: JSON.stringify({ enabled: false }),
    });

    assert.equal(toggleRes.status, 200);
    assert.equal(toggleRes.data.success, true);
    assert.equal(toggleRes.data.source.enabled, false);

    const listRes = await fetchJson(`${BASE_URL}/api/sources`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
    });
    const s1 = listRes.data.customSources.find((s) => s.id === userASource1Id);
    assert.equal(s1.enabled, false);
  });

  // --------------------------------------------------------------------------
  // TEST 10: DELETE SOURCE -> REMOVED FROM CUSTOM SOURCES LIST IMMEDIATELY
  // --------------------------------------------------------------------------
  test('10. User deletes custom source -> Source removed from customSources immediately', async () => {
    const delRes = await fetchJson(`${BASE_URL}/api/sources/${userASource1Id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
    });

    assert.equal(delRes.status, 200);
    assert.equal(delRes.data.success, true);

    const listRes = await fetchJson(`${BASE_URL}/api/sources`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'x-user-id': userAId,
      },
    });
    assert.equal(listRes.data.customSources.length, 1);
    assert.equal(listRes.data.customSources.some((s) => s.id === userASource1Id), false);
  });

  // --------------------------------------------------------------------------
  // TEST 11: ADMIN SOURCES PAGE CONTINUES TO SHOW ALL SOURCES WITH OWNER INFO
  // --------------------------------------------------------------------------
  test('11. Admin Sources page still shows all built-in and user custom sources with owner info', async () => {
    const adminRes = await fetchJson(`${BASE_URL}/api/admin/sources`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.success, true);
    assert.ok(adminRes.data.builtinSources.length >= 3, 'Admin must see built-in sources');
    assert.ok(adminRes.data.customSources.length >= 2, 'Admin must see all user custom sources');

    // User A source 2 must appear in Admin custom sources
    const foundA2 = adminRes.data.customSources.find((s) => s.id === userASource2Id);
    assert.ok(foundA2, 'Admin sees User A custom source');
    assert.equal(foundA2.userId || foundA2.ownerId, userAId);

    // User B source 1 must appear in Admin custom sources
    const foundB1 = adminRes.data.customSources.find((s) => s.id === userBSource1Id);
    assert.ok(foundB1, 'Admin sees User B custom source');
    assert.equal(foundB1.userId || foundB1.ownerId, userBId);
  });

  // --------------------------------------------------------------------------
  // TEST 12: CLEANUP FIXTURES
  // --------------------------------------------------------------------------
  test('12. Cleanup: Database is scrubbed and canonical seed fixtures restored', () => {
    cleanAllTestFixtures();
  });
});
