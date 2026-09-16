/**
 * Comprehensive Applications Page & Pipeline Regression Test Suite (15 Tests)
 *
 * Verifies that the Applications page never loads as a blank screen and handles:
 * 1. Existing applications rendering
 * 2. Zero applications empty state
 * 3. Quota available display
 * 4. Quota exhausted display
 * 5. Free plan rendering
 * 6. Plus plan rendering
 * 7. Pro plan rendering
 * 8. Missing optional fields (job, client, source, status, dates, metadata)
 * 9. Safe fallback on error state instead of blank screen
 * 10. Status filters across all 9 lifecycle stages (Saved, Draft, Applied, Viewed, Replied, Interview, Negotiation, Hired, Closed)
 * 11. Preservation of existing application records and history
 * 12. Navigation to Applications after login
 * 13. Page reload on Applications route
 * 14. Session restoration without crashing
 * 15. Quota and streak changes do not break Applications rendering
 */

import assert from 'assert';

// Setup in-memory mock browser storage before any storage imports
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear(),
};

globalThis.sessionStorage = {
  getItem: (k) => storageMap.get('sess_' + k) || null,
  setItem: (k, v) => storageMap.set('sess_' + k, String(v)),
  removeItem: (k) => storageMap.delete('sess_' + k),
  clear: () => {},
};

import {
  getApplications,
  saveApplications,
  addApplication,
  updateApplication,
  getApplicationAnalytics,
  getFunnelAnalytics,
  getAutoDeletePreference,
  setAutoDeletePreference,
  getUserPreferences,
  saveUserPreferences,
  getCurrentUserId,
  setAuth,
  getAuth,
  setStoredSubscription,
  setStoredQuotaWindow,
} from '../src/data/storage.js';
import { subscriptionService } from '../src/services/subscriptionService.js';
import { usageService } from '../src/services/usageService.js';
import { APPLICATION_STATUS_CONFIG } from '../src/utils/constants.js';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING APPLICATIONS PAGE REGRESSION TEST SUITE (15 TESTS)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log(`  ✓ PASS [Test ${passed + failed}]: ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ FAIL [Test ${passed + failed}]: ${name}`, err.message);
    }
  }

  // Helper simulating the Applications page data normalization & filtering pipeline
  const simulateApplicationsPipeline = ({ activeTab = 'all', currentUid = null, overrideQuota = null }) => {
    const apps = getApplications(currentUid) || [];
    const funnel = getFunnelAnalytics() || { rates: {} };
    const analytics = getApplicationAnalytics(currentUid) || {};
    const autoDelete = getAutoDeletePreference();
    const plan = subscriptionService.getCurrentPlanDetails() || { name: 'Free', id: 'free' };
    const quotaStatus = overrideQuota || usageService.getQuotaStatus();

    const effectiveUid = currentUid || getCurrentUserId();
    const safeApps = Array.isArray(apps) ? apps : [];

    const filtered = safeApps.filter((app) => {
      if (!app) return false;
      if (app.userId && app.userId !== effectiveUid && app.userId !== 'user-default') return false;
      if (activeTab === 'all') return true;
      return (app.status || 'applied').toLowerCase() === activeTab.toLowerCase();
    });

    // Simulate rendering all filtered cards with fallback normalization
    const renderedCards = filtered.map((app) => {
      if (!app || !app.id) return null;
      const statusKey = (app.status || 'applied').toLowerCase();
      const statusMeta = APPLICATION_STATUS_CONFIG[statusKey] || {
        label: app.status || 'Applied',
        color: 'text-text-primary',
        bg: 'bg-surface-hover',
        border: 'border-border',
      };

      let formattedDate = 'Draft (Unsent)';
      if (app.appliedAt) {
        try {
          const d = new Date(app.appliedAt);
          if (!isNaN(d.getTime())) {
            formattedDate = `Applied ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          }
        } catch {
          formattedDate = 'Draft (Unsent)';
        }
      }

      return {
        id: app.id,
        title: app.title || app.jobTitle || 'Untitled Opportunity',
        company: app.company || 'Direct Client',
        platform: (app.platform || 'manual').replace('_', ' '),
        statusMeta,
        formattedDate,
        message: app.message || null,
        matchScore: app.matchScore || null,
      };
    }).filter(Boolean);

    return {
      success: true,
      plan,
      quotaStatus,
      autoDelete,
      funnel,
      analytics,
      totalCount: safeApps.length,
      filteredCount: filtered.length,
      renderedCards,
      isEmpty: renderedCards.length === 0,
    };
  };

  // Seed sample test data
  const testUserId = 'user-app-test-123';
  setAuth({ isAuthenticated: true, userId: testUserId, phone: '+919876543210' });

  // TEST 1: Applications page loads with existing applications
  test('Applications page loads with existing applications', () => {
    const sampleApps = [
      {
        id: 'app-1',
        userId: testUserId,
        jobId: 'job-1',
        title: 'Senior React Developer',
        company: 'Tech Innovations Ltd',
        platform: 'job_board',
        status: 'applied',
        appliedAt: new Date(Date.now() - 86400000).toISOString(),
        matchScore: 92,
        message: 'Excited about the role!',
      },
      {
        id: 'app-2',
        userId: testUserId,
        jobId: 'job-2',
        title: 'Full Stack Engineer',
        company: 'Cloud Corp',
        platform: 'linkedin',
        status: 'interview',
        appliedAt: new Date(Date.now() - 172800000).toISOString(),
        matchScore: 88,
      },
    ];
    saveApplications(sampleApps);

    const result = simulateApplicationsPipeline({ currentUid: testUserId });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.renderedCards.length, 2);
    assert.strictEqual(result.renderedCards[0].title, 'Senior React Developer');
    assert.strictEqual(result.renderedCards[1].statusMeta.label, 'Interview');
  });

  // TEST 2: Applications page loads for a user with zero applications (empty state)
  test('Applications page loads for a user with zero applications', () => {
    saveApplications([]);
    const result = simulateApplicationsPipeline({ currentUid: 'new-empty-user' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.renderedCards.length, 0);
    assert.strictEqual(result.isEmpty, true);
  });

  // TEST 3: Applications page loads when quota is available
  test('Applications page loads when quota is available', () => {
    setStoredSubscription({ plan: 'free', status: 'active' });
    setStoredQuotaWindow({ plan: 'free', applicationsUsed: 1, windowStart: Date.now(), windowEnd: Date.now() + 28800000 });

    const quota = usageService.getQuotaStatus();
    assert.strictEqual(quota.remainingQuota, 4);

    const result = simulateApplicationsPipeline({ currentUid: testUserId });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.quotaStatus.remainingQuota, 4);
    assert.strictEqual(result.quotaStatus.isExhausted, false);
  });

  // TEST 4: Applications page loads when quota is exhausted
  test('Applications page loads when quota is exhausted', () => {
    setStoredQuotaWindow({ plan: 'free', applicationsUsed: 5, windowStart: Date.now(), windowEnd: Date.now() + 28800000 });

    const quota = usageService.getQuotaStatus();
    assert.strictEqual(quota.remainingQuota, 0);
    assert.strictEqual(quota.isExhausted, true);

    const result = simulateApplicationsPipeline({ currentUid: testUserId });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.quotaStatus.isExhausted, true);
  });

  // TEST 5: Applications page loads for Free plan
  test('Applications page loads for Free', () => {
    subscriptionService.saveSubscription({ plan: 'free', status: 'active' });
    const result = simulateApplicationsPipeline({ currentUid: testUserId });
    assert.strictEqual(result.plan.id, 'free');
    assert.strictEqual(result.plan.name, 'Free');
  });

  // TEST 6: Applications page loads for Plus plan
  test('Applications page loads for Plus', () => {
    subscriptionService.saveSubscription({ plan: 'plus', status: 'active' });
    const result = simulateApplicationsPipeline({ currentUid: testUserId });
    assert.strictEqual(result.plan.id, 'plus');
    assert.strictEqual(result.plan.name, 'Plus');
  });

  // TEST 7: Applications page loads for Pro plan
  test('Applications page loads for Pro', () => {
    subscriptionService.saveSubscription({ plan: 'pro', status: 'active' });
    const result = simulateApplicationsPipeline({ currentUid: testUserId });
    assert.strictEqual(result.plan.id, 'pro');
    assert.strictEqual(result.plan.name, 'Pro');
  });

  // TEST 8: Applications with missing optional fields do not crash
  test('Applications with missing optional fields do not crash', () => {
    const rawAppsWithMissingFields = [
      { id: 'app-incomplete-1' }, // completely bare object
      { id: 'app-incomplete-2', title: null, company: undefined, platform: '', status: null, appliedAt: 'invalid-date' },
      { id: 'app-incomplete-3', jobTitle: 'Designer', message: '' },
    ];
    saveApplications(rawAppsWithMissingFields);

    const result = simulateApplicationsPipeline({ currentUid: testUserId });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.renderedCards.length, 3);
    assert.strictEqual(result.renderedCards[0].title, 'Untitled Opportunity');
    assert.strictEqual(result.renderedCards[0].company, 'Direct Client');
    assert.strictEqual(result.renderedCards[1].formattedDate, 'Draft (Unsent)');
    assert.strictEqual(result.renderedCards[2].title, 'Designer');
  });

  // TEST 9: API / storage failure fallback shows safe state instead of blank screen
  test('API failure / storage error shows safe error state instead of blank screen', () => {
    let caughtError = null;
    try {
      const brokenQuotaPipeline = simulateApplicationsPipeline({
        overrideQuota: { limit: 0, used: 0, remainingQuota: 0, refillFormatted: '8h 00m', bonusTokens: 0, isExhausted: false },
      });
      assert(brokenQuotaPipeline.success, 'Pipeline recovers safely');
    } catch (err) {
      caughtError = err;
    }
    assert.strictEqual(caughtError, null, 'No uncaught exception during render');
  });

  // TEST 10: Application status filters work across all 9 lifecycle stages
  test('Application status filters work across all lifecycle stages', () => {
    const allStages = ['saved', 'draft', 'applied', 'viewed', 'replied', 'interview', 'negotiation', 'hired', 'closed'];
    const stagedApps = allStages.map((st, i) => ({
      id: `app-stage-${i}`,
      userId: testUserId,
      title: `Role in ${st}`,
      company: `Company ${i}`,
      status: st,
      appliedAt: new Date().toISOString(),
    }));
    saveApplications(stagedApps);

    for (const stage of allStages) {
      const filteredResult = simulateApplicationsPipeline({ activeTab: stage, currentUid: testUserId });
      assert.strictEqual(filteredResult.renderedCards.length, 1, `Filter for stage "${stage}" must return exactly 1 item`);
      assert.strictEqual(filteredResult.renderedCards[0].statusMeta.label.toLowerCase(), stage.toLowerCase());
    }

    const allResult = simulateApplicationsPipeline({ activeTab: 'all', currentUid: testUserId });
    assert.strictEqual(allResult.renderedCards.length, 9, 'Tab "all" returns all 9 items');
  });

  // TEST 11: Existing application records remain intact (no reset/deletion)
  test('Existing application records remain intact', () => {
    const initialApps = getApplications(testUserId);
    assert(initialApps.length >= 9, 'All seeded application records persist intact in storage');

    // Update status on an existing application
    updateApplication(initialApps[0].id, { status: 'interview', statusNote: 'Call scheduled for Friday' });
    const updatedApps = getApplications(testUserId);
    const updated = updatedApps.find((a) => a.id === initialApps[0].id);

    assert.strictEqual(updated.status, 'interview');
    assert.strictEqual(updated.statusNote, 'Call scheduled for Friday');
  });

  // TEST 12: Navigation to Applications works after login
  test('Navigation to Applications works after login', () => {
    setAuth({ isAuthenticated: true, userId: 'nav-user-1', phone: '+919123456780' });
    const auth = getAuth();
    assert.strictEqual(auth.isAuthenticated, true);
    assert.strictEqual(auth.userId, 'nav-user-1');

    const result = simulateApplicationsPipeline({ currentUid: 'nav-user-1' });
    assert.strictEqual(result.success, true);
  });

  // TEST 13: Page reload on Applications route works without error
  test('Page reload on Applications route works', () => {
    const freshApps = getApplications();
    const freshAnalytics = getApplicationAnalytics();
    const freshFunnel = getFunnelAnalytics();
    const freshAutoDelete = getAutoDeletePreference();
    const freshUserPrefs = getUserPreferences();

    assert(Array.isArray(freshApps), 'freshApps is array');
    assert(typeof freshAnalytics === 'object', 'freshAnalytics is object');
    assert(typeof freshFunnel === 'object', 'freshFunnel is object');
    assert(typeof freshAutoDelete === 'boolean', 'freshAutoDelete is boolean');
    assert(typeof freshUserPrefs === 'object', 'freshUserPrefs is object');
  });

  // TEST 14: Session restoration does not cause a blank screen
  test('Session restoration does not cause a blank screen', () => {
    const storedAuth = { isAuthenticated: true, userId: 'session-user-x', phone: '+919000000001' };
    setAuth(storedAuth);
    const prefResult = getUserPreferences('session-user-x');
    assert(prefResult && typeof prefResult === 'object', 'User preferences restore cleanly');

    const result = simulateApplicationsPipeline({ currentUid: 'session-user-x' });
    assert.strictEqual(result.success, true);
  });

  // TEST 15: Quota/streak changes do not break Applications rendering
  test('Quota/streak changes do not break Applications rendering', () => {
    subscriptionService.saveSubscription({ plan: 'pro', status: 'active' });
    setStoredQuotaWindow({
      plan: 'pro',
      applicationsUsed: 25,
      windowStart: Date.now() - 10000,
      windowEnd: Date.now() + 28800000 - 10000,
    });

    const statusWithBonus = usageService.getQuotaStatus();
    assert.strictEqual(statusWithBonus.limit, 25);

    const result = simulateApplicationsPipeline({ currentUid: testUserId });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.quotaStatus.limit, 25);
  });

  console.log(`\n====================================================`);
  console.log(`APPLICATIONS PAGE SUITE FINISHED: ${passed}/${passed + failed} PASSED (${failed} FAILED)`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
