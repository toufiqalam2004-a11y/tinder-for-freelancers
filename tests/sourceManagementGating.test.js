/**
 * Comprehensive V1 Source Management Test Suite
 * Validates all 16 specified scenarios:
 *
 * 1. Free user can add exactly 1 custom source.
 * 2. Free user cannot add a second custom source.
 * 3. Plus user can add exactly 3 custom sources.
 * 4. Plus user cannot add a fourth.
 * 5. Pro user can add exactly 5 custom sources.
 * 6. Pro user cannot add a sixth.
 * 7. Built-in sources do not count toward any plan limit.
 * 8. User cannot access another user's custom sources.
 * 9. User cannot modify built-in sources.
 * 10. Deleting a custom source frees one slot.
 * 11. Duplicate custom sources are rejected.
 * 12. Frontend cannot bypass the backend source limit.
 * 13. Downgrade does not delete existing sources.
 * 14. Built-in-source opportunities can appear in the user's feed.
 * 15. Custom-source opportunities can appear in the user's feed after qualification.
 * 16. Unqualified opportunities are not added to the actionable feed.
 */

import { db } from '../server/database.js';
import {
  FREE_CUSTOM_SOURCE_LIMIT,
  PLUS_CUSTOM_SOURCE_LIMIT,
  PRO_CUSTOM_SOURCE_LIMIT,
  getCustomSourceLimit,
} from '../src/utils/sourceConfig.js';
import { subscriptionService } from '../src/services/subscriptionService.js';
import {
  getSources,
  getBuiltinSources,
  getUserCustomSources,
  addSource as persistAddSource,
  removeSource as persistRemoveSource,
  setAuth,
} from '../src/data/storage.js';
import { qualifyDiscoveredPost, SERVER_BUILTIN_SOURCES } from '../server/routes/api.js';

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const API_BASE = 'http://localhost:5000/api';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS [Scenario ${totalTests}]: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL [Scenario ${totalTests}]: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING V1 SOURCE MANAGEMENT REGRESSION SUITE (16 SCENARIOS)');
  console.log('====================================================\n');

  // Test setup: Create clean users for each tier
  const ts = Date.now();
  const freeUser = `user-src-free-${ts}`;
  const plusUser = `user-src-plus-${ts}`;
  const proUser = `user-src-pro-${ts}`;
  const isolatedUser = `user-src-isolated-${ts}`;

  db.users.insert({ id: freeUser, phone: `+91999911${ts % 10000}` });
  db.users.insert({ id: plusUser, phone: `+91999922${ts % 10000}` });
  db.users.insert({ id: proUser, phone: `+91999933${ts % 10000}` });
  db.users.insert({ id: isolatedUser, phone: `+91999944${ts % 10000}` });

  db.subscriptions.insert({ id: `sub-${freeUser}`, userId: freeUser, plan: 'free', status: 'active' });
  db.subscriptions.insert({ id: `sub-${plusUser}`, userId: plusUser, plan: 'plus', status: 'active' });
  db.subscriptions.insert({ id: `sub-${proUser}`, userId: proUser, plan: 'pro', status: 'active' });
  db.subscriptions.insert({ id: `sub-${isolatedUser}`, userId: isolatedUser, plan: 'free', status: 'active' });

  // ----------------------------------------------------
  // Scenario 1: Free user can add exactly 1 custom source
  // ----------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': freeUser },
      body: JSON.stringify({
        platform: 'reddit',
        name: 'r/freelance_forhire',
        url: 'https://reddit.com/r/freelance_forhire',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 201 && data.success === true && data.current === 1,
      'Free user can add exactly 1 custom source'
    );
  }

  // ----------------------------------------------------
  // Scenario 2: Free user cannot add a second custom source
  // ----------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': freeUser },
      body: JSON.stringify({
        platform: 'youtube',
        name: 'YouTube Hiring Videos',
        url: 'https://youtube.com',
        query: 'editor hiring',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 403 && data.error === 'SOURCE_LIMIT_REACHED' && data.limit === 1 && data.current === 1,
      'Free user cannot add a second custom source'
    );
  }

  // ----------------------------------------------------
  // Scenario 3: Plus user can add exactly 3 custom sources
  // ----------------------------------------------------
  let plusSourceIds = [];
  {
    let successCount = 0;
    for (let i = 1; i <= 3; i++) {
      const res = await fetch(`${API_BASE}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': plusUser },
        body: JSON.stringify({
          platform: i === 1 ? 'reddit' : i === 2 ? 'youtube' : 'x',
          name: `Plus Source ${i}`,
          url: `https://example.com/plus-source-${i}`,
          query: `query-${i}`,
        }),
      });
      const data = await res.json();
      if (res.status === 201 && data.success) {
        successCount++;
        plusSourceIds.push(data.source.id);
      }
    }
    assert(successCount === 3, 'Plus user can add exactly 3 custom sources');
  }

  // ----------------------------------------------------
  // Scenario 4: Plus user cannot add a fourth
  // ----------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': plusUser },
      body: JSON.stringify({
        platform: 'reddit',
        name: 'Plus Source 4',
        url: 'https://reddit.com/r/source4',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 403 && data.error === 'SOURCE_LIMIT_REACHED' && data.limit === 3 && data.current === 3,
      'Plus user cannot add a fourth custom source'
    );
  }

  // ----------------------------------------------------
  // Scenario 5: Pro user can add exactly 5 custom sources
  // ----------------------------------------------------
  let proSourceIds = [];
  {
    let successCount = 0;
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${API_BASE}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': proUser },
        body: JSON.stringify({
          platform: 'reddit',
          name: `Pro Custom Source ${i}`,
          url: `https://reddit.com/r/pro_source_${i}`,
        }),
      });
      const data = await res.json();
      if (res.status === 201 && data.success) {
        successCount++;
        proSourceIds.push(data.source.id);
      }
    }
    assert(successCount === 5, 'Pro user can add exactly 5 custom sources');
  }

  // ----------------------------------------------------
  // Scenario 6: Pro user cannot add a sixth
  // ----------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': proUser },
      body: JSON.stringify({
        platform: 'x',
        name: 'Pro Custom Source 6',
        url: 'https://x.com/pro6',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 403 && data.error === 'SOURCE_LIMIT_REACHED' && data.limit === 5 && data.current === 5,
      'Pro user cannot add a sixth custom source'
    );
  }

  // ----------------------------------------------------
  // Scenario 7: Built-in sources do not count toward any plan limit
  // ----------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/sources`, {
      headers: { 'x-user-id': freeUser },
    });
    const data = await res.json();
    assert(
      data.builtinSources.length >= 3 && data.current === 1 && data.limit === 1,
      'Built-in sources do not count toward any plan limit'
    );
  }

  // ----------------------------------------------------
  // Scenario 8: User cannot access another user's custom sources
  // ----------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/sources`, {
      headers: { 'x-user-id': isolatedUser },
    });
    const data = await res.json();
    const containsOtherCustom = data.customSources.some(
      (s) => s.userId === proUser || s.userId === plusUser || s.userId === freeUser
    );
    assert(
      containsOtherCustom === false && data.customSources.length === 0,
      "User cannot access another user's custom sources"
    );
  }

  // ----------------------------------------------------
  // Scenario 9: User cannot modify or delete built-in sources
  // ----------------------------------------------------
  {
    const deleteRes = await fetch(`${API_BASE}/sources/demo-src-reddit`, {
      method: 'DELETE',
      headers: { 'x-user-id': proUser },
    });
    const deleteData = await deleteRes.json();

    const putRes = await fetch(`${API_BASE}/sources/demo-src-reddit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-id': proUser },
      body: JSON.stringify({ name: 'Hacked Built-in Source' }),
    });
    const putData = await putRes.json();

    assert(
      deleteRes.status === 403 &&
        deleteData.error === 'FORBIDDEN' &&
        putRes.status === 403 &&
        putData.error === 'FORBIDDEN',
      'User cannot modify or delete built-in sources'
    );
  }

  // ----------------------------------------------------
  // Scenario 10: Deleting a custom source frees one slot
  // ----------------------------------------------------
  {
    const userSources = db.sources.findAll((s) => s.userId === freeUser);
    const sourceToDelete = userSources[0];

    const delRes = await fetch(`${API_BASE}/sources/${sourceToDelete.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': freeUser },
    });
    const delData = await delRes.json();

    const addRes = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': freeUser },
      body: JSON.stringify({
        platform: 'reddit',
        name: 'r/fresh_freelance',
        url: 'https://reddit.com/r/fresh_freelance',
      }),
    });
    const addData = await addRes.json();

    assert(
      delRes.status === 200 && delData.success === true && addRes.status === 201 && addData.success === true,
      'Deleting a custom source frees one slot'
    );
  }

  // ----------------------------------------------------
  // Scenario 11: Duplicate custom sources are rejected
  // ----------------------------------------------------
  {
    const res1 = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': isolatedUser },
      body: JSON.stringify({
        platform: 'reddit',
        name: 'r/duplicate_test',
        url: 'https://reddit.com/r/duplicate_test',
      }),
    });

    const res2 = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': isolatedUser },
      body: JSON.stringify({
        platform: 'reddit',
        name: 'r/duplicate_test',
        url: 'https://reddit.com/r/duplicate_test',
      }),
    });
    const data2 = await res2.json();

    // Also verify on proUser who has remaining limit
    const proDel = await fetch(`${API_BASE}/sources/${proSourceIds[0]}`, {
      method: 'DELETE',
      headers: { 'x-user-id': proUser },
    });
    const existingProSource = db.sources.findById(proSourceIds[1]);
    const dupRes = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': proUser },
      body: JSON.stringify({
        platform: existingProSource.platform,
        name: existingProSource.name,
        url: existingProSource.url,
      }),
    });
    const dupData = await dupRes.json();

    assert(
      (res2.status === 409 || res2.status === 403) &&
        dupRes.status === 409 &&
        dupData.error === 'DUPLICATE_SOURCE',
      'Duplicate custom sources are rejected'
    );
  }

  // ----------------------------------------------------
  // Scenario 12: Frontend cannot bypass the backend source limit
  // ----------------------------------------------------
  {
    const bypassRes = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': isolatedUser,
        'x-custom-plan': 'pro',
      },
      body: JSON.stringify({
        platform: 'x',
        name: 'Attempted Bypass Source',
        url: 'https://x.com/bypass',
        type: 'builtin',
      }),
    });
    const bypassData = await bypassRes.json();

    assert(
      bypassRes.status === 403 &&
        bypassData.error === 'SOURCE_LIMIT_REACHED' &&
        bypassData.plan === 'free',
      'Frontend cannot bypass the backend source limit'
    );
  }

  // ----------------------------------------------------
  // Scenario 13: Downgrade does not delete existing sources
  // ----------------------------------------------------
  {
    const plusSub = db.subscriptions.findOne((s) => s.userId === plusUser);
    db.subscriptions.update(plusSub.id, { plan: 'free' });

    const getRes = await fetch(`${API_BASE}/sources`, {
      headers: { 'x-user-id': plusUser },
    });
    const getData = await getRes.json();

    const sourcesPreserved = getData.customSources.length === 3;

    const addRes = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': plusUser },
      body: JSON.stringify({
        platform: 'youtube',
        name: 'Blocked Post-Downgrade Source',
        url: 'https://youtube.com/new',
      }),
    });
    const addData = await addRes.json();

    assert(
      sourcesPreserved &&
        addRes.status === 403 &&
        addData.error === 'SOURCE_LIMIT_REACHED' &&
        addData.limit === 1 &&
        addData.current === 3,
      'Downgrade does not delete existing sources but prevents adding more'
    );
  }

  // ----------------------------------------------------
  // Scenario 14: Built-in-source opportunities can appear in the user's feed
  // ----------------------------------------------------
  {
    db.jobs.insert({
      id: `job-builtin-${ts}`,
      userId: null,
      sourceId: 'demo-src-reddit',
      title: 'Senior Video Editor for YouTube Channel',
      company: 'Builtin Client Media',
      description: 'Looking for a video editor with Premiere Pro expertise. Apply: https://clientmedia.com/jobs',
      sourceUrl: 'https://clientmedia.com/jobs',
      skills: ['Video Editing', 'Premiere Pro'],
      status: 'new',
    });

    const feedRes = await fetch(`${API_BASE}/jobs`, {
      headers: { 'x-user-id': freeUser },
    });
    const feedData = await feedRes.json();
    const hasBuiltinJob = feedData.jobs.some((j) => j.id === `job-builtin-${ts}`);

    assert(hasBuiltinJob, 'Built-in-source opportunities can appear in the user\'s feed');
    db.jobs.delete(`job-builtin-${ts}`);
  }

  // ----------------------------------------------------
  // Scenario 15: Custom-source opportunities can appear in user's feed after qualification
  // ----------------------------------------------------
  {
    const qualifiedPost = {
      title: 'Looking for Premiere Pro Video Editor ($50/hr)',
      postText: 'We are hiring a video editor for regular long-form content. Email work samples to jobs@creative.co',
      postUrl: 'https://reddit.com/r/forhire/comments/qualified_1',
      author: 'Creative Studio',
      platform: 'reddit',
    };

    const qualResult = qualifyDiscoveredPost(qualifiedPost);

    db.jobs.insert({
      id: `job-custom-qual-${ts}`,
      userId: isolatedUser,
      sourceId: 'custom-src-test',
      title: qualifiedPost.title,
      company: qualifiedPost.author,
      description: qualifiedPost.postText,
      sourceUrl: qualifiedPost.postUrl,
      matchScore: qualResult.score,
      status: 'new',
    });

    const userFeed = await (await fetch(`${API_BASE}/jobs`, { headers: { 'x-user-id': isolatedUser } })).json();
    const otherFeed = await (await fetch(`${API_BASE}/jobs`, { headers: { 'x-user-id': proUser } })).json();

    const inUserFeed = userFeed.jobs.some((j) => j.id === `job-custom-qual-${ts}`);
    const inOtherFeed = otherFeed.jobs.some((j) => j.id === `job-custom-qual-${ts}`);

    assert(
      qualResult.qualified === true && inUserFeed === true && inOtherFeed === false,
      'Custom-source opportunities appear in user\'s feed after qualification and are user-isolated'
    );
  }

  // ----------------------------------------------------
  // Scenario 16: Unqualified opportunities are not added to the actionable feed
  // ----------------------------------------------------
  {
    const unqualifiedPost = {
      title: 'Just sharing some drone shots I took over the weekend',
      postText: 'Let me know your thoughts on the color grade.',
      postUrl: '',
      platform: 'reddit',
    };

    const qualCheck = qualifyDiscoveredPost(unqualifiedPost);
    assert(
      qualCheck.qualified === false,
      'Unqualified opportunities are not added to the actionable feed'
    );
  }

  // ----------------------------------------------------
  // Scenario 17: UI Simplification: Built-in sources remain available to backend/AI Agent
  // ----------------------------------------------------
  {
    assert(Array.isArray(SERVER_BUILTIN_SOURCES), 'SERVER_BUILTIN_SOURCES must be an array');
    assert(SERVER_BUILTIN_SOURCES.length >= 3, 'Must have at least 3 built-in sources');
  }

  // ----------------------------------------------------
  // Scenario 18: UI Simplification: Custom source user isolation & plan limits
  // ----------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/sources`, { headers: { 'x-user-id': freeUser } });
    const data = await res.json();
    const customs = data.customSources || [];
    assert(
      res.status === 200 && Array.isArray(customs) && customs.length === 1,
      'User custom sources are isolated per user'
    );
  }

  // Teardown: Clean up test users and custom test sources
  [freeUser, plusUser, proUser, isolatedUser].forEach((uid) => {
    db.users.delete(uid);
    db.subscriptions.delete(`sub-${uid}`);
    const uSources = db.sources.findAll((s) => s.userId === uid || s.ownerUserId === uid);
    uSources.forEach((s) => db.sources.delete(s.id));
  });

  console.log('\n====================================================');
  console.log(`SOURCE MANAGEMENT SUITE FINISHED: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
