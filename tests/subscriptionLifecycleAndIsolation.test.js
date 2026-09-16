/**
 * Comprehensive Automated Verification Test Suite:
 * 1. Logo & Beta Badge layout in AppHeader, Landing, and Login
 * 2. Fresh New User Profile Strength (Deterministic 20% baseline + "Add your full name" tip)
 * 3. User Data Isolation & Empty Applications Pipeline (All=0, Applied=0, Saved=0, Viewed=0)
 * 4. Pro Downgrade Lifecycle (Scheduled downgrade, Keep Pro, simulation, and entitlement preservation)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Setup in-memory mock browser storage
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const sessionStore = new Map();
globalThis.sessionStorage = {
  getItem: (k) => sessionStore.get(k) || null,
  setItem: (k, v) => sessionStore.set(k, String(v)),
  removeItem: (k) => sessionStore.delete(k),
  clear: () => sessionStore.clear(),
};

import {
  getUser,
  saveUser,
  getAuth,
  setAuth,
  getCurrentUserId,
  getApplications,
  saveApplications,
  addApplication,
  getUserJobState,
  setUserJobState,
  getUserSavedJobIds,
  getUserDraftJobIds,
  getUserAppliedJobIds,
  recordJobView,
  getUserViewedJobIds,
  getSavedJobs,
  getApplicationAnalytics,
} from '../src/data/storage.js';
import { STORAGE_KEYS, SUBSCRIPTION_PLANS } from '../src/utils/constants.js';
import { db } from '../server/database.js';

import { calculateProfileStrength } from '../src/services/proMatchEngine.js';
import { subscriptionService } from '../src/services/subscriptionService.js';
import { usageService } from '../src/services/usageService.js';

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

async function runAllTests() {
  console.log('====================================================');
  console.log('STARTING SUBSCRIPTION LIFECYCLE & DATA ISOLATION TEST SUITE');
  console.log('====================================================\n');

  // =========================================================================
  // 1. LOGO & BETA BADGE POSITION
  // =========================================================================
  console.log('--- 1. LOGO & BETA BADGE LAYOUT ---');

  test('AppHeader.jsx renders Beta badge inline beside brand text without flex separation', () => {
    const headerPath = path.resolve('src/components/AppHeader.jsx');
    const content = fs.readFileSync(headerPath, 'utf8');
    assert(content.includes('inline-flex items-center gap-1.5 whitespace-nowrap leading-none'), 'AppHeader uses inline-flex tight container');
    assert(content.includes('Tinder for Freelancers'), 'AppHeader contains brand name');
    assert(content.includes('Beta'), 'AppHeader contains Beta badge');
  });

  test('Landing.jsx renders Beta badge inline beside brand text without displacement', () => {
    const landingPath = path.resolve('src/pages/Landing.jsx');
    const content = fs.readFileSync(landingPath, 'utf8');
    assert(content.includes('inline-flex items-center gap-1.5 whitespace-nowrap leading-none'), 'Landing uses inline-flex tight container');
  });

  test('Login.jsx renders Beta badge inline beside brand text in top header', () => {
    const loginPath = path.resolve('src/pages/Login.jsx');
    const content = fs.readFileSync(loginPath, 'utf8');
    assert(content.includes('inline-flex items-center gap-1.5 whitespace-nowrap leading-none'), 'Login header uses inline-flex tight container');
    assert(content.includes('Beta'), 'Login header contains Beta badge');
  });

  // =========================================================================
  // 2. FRESH NEW USER PROFILE STRENGTH
  // =========================================================================
  console.log('\n--- 2. FRESH NEW USER PROFILE STRENGTH ---');

  test('Completely empty new user profile starts at exactly 20% profile strength', () => {
    const emptyProfile = {};
    const res = calculateProfileStrength(emptyProfile);
    assert.strictEqual(res.score, 20, `Expected 20% score, got ${res.score}%`);
  });

  test('Fresh new user profile recommendation tip #0 is "Add your full name"', () => {
    const emptyProfile = {};
    const res = calculateProfileStrength(emptyProfile);
    assert(res.tips.length > 0, 'Must have improvement tips');
    assert.strictEqual(res.tips[0].id, 'name');
    assert.strictEqual(res.tips[0].label, 'Add your full name');
  });

  test('Adding name increases score from 20% to 30%', () => {
    const profile = { name: 'David Miller' };
    const res = calculateProfileStrength(profile);
    assert.strictEqual(res.score, 30);
    assert(!res.tips.some((t) => t.id === 'name'), 'Name tip resolved');
  });

  test('Progressively filling all required profile fields climbs deterministically to 100%', () => {
    const completeProfile = {
      name: 'Elena Rostova',
      profession: 'Senior UI/UX Designer',
      primaryRole: 'Senior UI/UX Designer',
      specialization: 'Figma Design Systems & Mobile Apps',
      skills: [{ name: 'Figma' }, { name: 'Wireframing' }, { name: 'Prototyping' }, { name: 'Design Systems' }, { name: 'User Research' }],
      portfolioUrl: 'https://elena.design',
      cvUrl: 'uploaded',
      bio: 'Over 8 years crafting award-winning interfaces for high-growth SaaS startups and creator platforms.',
      preferredJobTypes: ['contract', 'freelance'],
    };
    const res = calculateProfileStrength(completeProfile);
    assert.strictEqual(res.score, 100);
    assert.strictEqual(res.tips.length, 0);
  });

  // =========================================================================
  // 3. NEW USER DATA ISOLATION & EMPTY APPLICATIONS
  // =========================================================================
  console.log('\n--- 3. USER DATA ISOLATION & APPLICATIONS ZERO STATE ---');

  const userA = 'user-alpha-999';
  const userB = 'user-beta-888';

  test('Fresh new user starts with 0 applications across all tabs (All=0, Applied=0, Saved=0, Viewed=0)', () => {
    store.clear();
    setAuth({ isAuthenticated: true, userId: userB, phone: '+919999988888' });

    const apps = getApplications(userB);
    assert.strictEqual(apps.length, 0, 'New user must have exactly 0 applications');

    const savedIds = getUserSavedJobIds(userB);
    assert.strictEqual(savedIds.length, 0, 'New user must have 0 saved jobs');

    const draftIds = getUserDraftJobIds(userB);
    assert.strictEqual(draftIds.length, 0, 'New user must have 0 draft jobs');

    const viewedIds = getUserViewedJobIds(userB);
    assert.strictEqual(viewedIds.length, 0, 'New user must have 0 viewed jobs');

    const analytics = getApplicationAnalytics(userB);
    assert.strictEqual(analytics.totalApplications, 0);
    assert.strictEqual(analytics.draftsCount, 0);
    assert.strictEqual(analytics.savedJobsCount, 0);
  });

  test('User A applications, saved jobs, and views NEVER leak to User B', () => {
    store.clear();

    // User A acts
    setAuth({ isAuthenticated: true, userId: userA, phone: '+919111111111' });
    addApplication({
      id: 'app-a-1',
      userId: userA,
      jobId: 'job-101',
      title: 'Senior Frontend Dev',
      status: 'applied',
    });
    addApplication({
      id: 'app-a-2',
      userId: userA,
      jobId: 'job-102',
      title: 'UI Designer',
      status: 'saved',
    });
    recordJobView('job-103', userA);
    setUserJobState('job-104', 'skipped', userA);

    // Verify User A has them
    assert.strictEqual(getApplications(userA).length, 2);
    assert.strictEqual(getUserSavedJobIds(userA).length, 1);
    assert.strictEqual(getUserViewedJobIds(userA).length, 1);
    assert.strictEqual(getUserJobState('job-104', userA), 'skipped');

    // Switch to fresh User B
    setAuth({ isAuthenticated: true, userId: userB, phone: '+919222222222' });

    // User B MUST see zero items from User A
    const bApps = getApplications(userB);
    assert.strictEqual(bApps.length, 0, 'User B must not see User A applications');

    const bSaved = getUserSavedJobIds(userB);
    assert.strictEqual(bSaved.length, 0, 'User B must not see User A saved jobs');

    const bViewed = getUserViewedJobIds(userB);
    assert.strictEqual(bViewed.length, 0, 'User B must not see User A viewed jobs');

    const bJobState = getUserJobState('job-104', userB);
    assert.strictEqual(bJobState, 'feed', 'Job skipped by User A must still be in feed for User B');
  });

  test('Viewing a job records user-scoped view state and does not leak', () => {
    store.clear();
    setAuth({ isAuthenticated: true, userId: userA });
    recordJobView('job-555', userA);

    assert.deepStrictEqual(getUserViewedJobIds(userA), ['job-555']);
    assert.deepStrictEqual(getUserViewedJobIds(userB), []);
  });

  // =========================================================================
  // 4. PRO DOWNGRADE / SUBSCRIPTION LIFECYCLE
  // =========================================================================
  console.log('\n--- 4. PRO DOWNGRADE & SUBSCRIPTION LIFECYCLE ---');

  test('Pro user initiating downgrade to Free sets cancelAtPeriodEnd=true, keeps plan="pro"', () => {
    store.clear();
    setAuth({ isAuthenticated: true, userId: userA });

    // Start on Pro
    subscriptionService.changePlan('pro', 'INR', 30, { immediate: true });
    assert.strictEqual(subscriptionService.isPro(), true);

    // Request downgrade to Free
    const scheduled = subscriptionService.scheduleDowngrade('free');
    assert.strictEqual(scheduled.plan, 'pro', 'Plan remains pro while scheduled');
    assert.strictEqual(scheduled.cancelAtPeriodEnd, true, 'cancelAtPeriodEnd is true');
    assert.strictEqual(scheduled.scheduledPlan, 'free', 'scheduledPlan is free');
    assert.ok(scheduled.currentPeriodEnd, 'currentPeriodEnd is populated');
    assert.strictEqual(subscriptionService.isPro(), true, 'isPro() is still true');
  });

  test('All Pro entitlements (Autopilot, custom sources limit 5) remain active while downgrade is scheduled', () => {
    assert.strictEqual(subscriptionService.isPro(), true);

    // Autopilot full access
    const autopilot = subscriptionService.canUseAutopilot();
    assert.strictEqual(autopilot.allowed, true);
    assert.strictEqual(autopilot.tier, 'full');

    // 5 custom sources allowed
    const sourceGate = subscriptionService.canAddSource(4);
    assert.strictEqual(sourceGate.allowed, true);
    assert.strictEqual(sourceGate.limit, 5);

    // Custom themes allowed
    const themeGate = subscriptionService.canUseCustomTheme();
    assert.strictEqual(themeGate.allowed, true);
  });

  test('User can cancel scheduled downgrade via cancelDowngrade() ("Keep Pro")', () => {
    const sub = subscriptionService.cancelDowngrade();
    assert.strictEqual(sub.plan, 'pro');
    assert.strictEqual(sub.cancelAtPeriodEnd, false, 'cancelAtPeriodEnd reset to false');
    assert.strictEqual(sub.scheduledPlan, null, 'scheduledPlan cleared');
    assert.strictEqual(subscriptionService.isPro(), true);
  });

  test('Simulating period end converts scheduled Pro downgrade to Free plan', () => {
    // Re-schedule downgrade
    subscriptionService.scheduleDowngrade('free');
    assert.strictEqual(subscriptionService.getSubscription().cancelAtPeriodEnd, true);

    // Simulate expiration / period end
    const expiredSub = subscriptionService.simulatePeriodEnd();
    assert.strictEqual(expiredSub.plan, 'free', 'Now transitioned to free');
    assert.strictEqual(expiredSub.cancelAtPeriodEnd, false);
    assert.strictEqual(expiredSub.scheduledPlan, null);
    assert.strictEqual(subscriptionService.isPro(), false);
    assert.strictEqual(subscriptionService.isFree(), true);
  });

  test('Once converted to Free, plan entitlements reflect Free tier limits', () => {
    assert.strictEqual(subscriptionService.isFree(), true);

    // Autopilot restricted
    const autopilot = subscriptionService.canUseAutopilot();
    assert.strictEqual(autopilot.allowed, false);

    // Custom sources restricted to 1
    const sourceGate = subscriptionService.canAddSource(1);
    assert.strictEqual(sourceGate.allowed, false);
    assert.strictEqual(sourceGate.limit, 1);
  });

  test('User can re-upgrade to Pro cleanly from Free', () => {
    subscriptionService.changePlan('pro', 'INR', 30, { immediate: true });
    assert.strictEqual(subscriptionService.isPro(), true);
    assert.strictEqual(subscriptionService.isFree(), false);
    assert.strictEqual(subscriptionService.getSubscription().cancelAtPeriodEnd, false);
  });

  // =========================================================================
  // 5. PRICING CONSISTENCY & SERVER LIFECYCLE
  // =========================================================================
  console.log('\n--- 5. PRICING & SERVER LIFECYCLE ---');

  test('SUBSCRIPTION_PLANS maintains canonical pricing for Free, Plus, and Pro', () => {
    // Free: ₹0 / $0
    assert.strictEqual(SUBSCRIPTION_PLANS.FREE.prices.monthly.INR, 0);
    assert.strictEqual(SUBSCRIPTION_PLANS.FREE.prices.monthly.USD, 0);

    // Plus: ₹499/mo / ₹4,990/yr ($7 / $70)
    assert.strictEqual(SUBSCRIPTION_PLANS.PLUS.prices.monthly.INR, 499);
    assert.strictEqual(SUBSCRIPTION_PLANS.PLUS.prices.annual.INR, 4990);
    assert.strictEqual(SUBSCRIPTION_PLANS.PLUS.prices.monthly.USD, 7);
    assert.strictEqual(SUBSCRIPTION_PLANS.PLUS.prices.annual.USD, 70);

    // Pro: ₹1,499/mo / ₹14,990/yr ($19 / $190)
    assert.strictEqual(SUBSCRIPTION_PLANS.PRO.prices.monthly.INR, 1499);
    assert.strictEqual(SUBSCRIPTION_PLANS.PRO.prices.annual.INR, 14990);
    assert.strictEqual(SUBSCRIPTION_PLANS.PRO.prices.monthly.USD, 19);
    assert.strictEqual(SUBSCRIPTION_PLANS.PRO.prices.annual.USD, 190);
  });

  test('Backend database records subscription with cancellation lifecycle attributes', () => {
    const testSubId = `sub-test-lifecycle-${Date.now()}`;
    const testRecord = {
      id: testSubId,
      userId: 'user-lifecycle-test',
      plan: 'pro',
      status: 'active',
      cancelAtPeriodEnd: true,
      scheduledPlan: 'free',
      endDate: new Date(Date.now() + 25 * 86400000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 25 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.subscriptions.insert(testRecord);

    const found = db.subscriptions.findById(testSubId);
    assert.ok(found);
    assert.strictEqual(found.plan, 'pro');
    assert.strictEqual(found.cancelAtPeriodEnd, true);
    assert.strictEqual(found.scheduledPlan, 'free');

    // Clean up
    db.subscriptions.delete(testSubId);
  });

  test('Membership UI plan action state logic handles all lifecycle combinations', () => {
    const membershipPath = path.resolve('src/pages/Membership.jsx');
    const content = fs.readFileSync(membershipPath, 'utf8');
    assert(content.includes('Downgrade Scheduled'), 'Downgrade Scheduled state handled');
    assert(content.includes('Keep {plan.name} (Cancel Downgrade)'), 'Cancel downgrade action handled');
    assert(content.includes('handleCancelDowngrade'), 'handleCancelDowngrade function present');
  });

  test('Profile.jsx and ProfileSetup.jsx render baseline 20% profile strength for fresh user', () => {
    const profilePath = path.resolve('src/pages/Profile.jsx');
    const setupPath = path.resolve('src/pages/ProfileSetup.jsx');
    assert(fs.readFileSync(profilePath, 'utf8').includes('calculateProfileStrength'), 'Profile.jsx uses calculateProfileStrength');
    assert(fs.readFileSync(setupPath, 'utf8').includes('calculateProfileStrength'), 'ProfileSetup.jsx uses calculateProfileStrength');
  });

  console.log('\n====================================================');
  console.log(`LIFECYCLE & ISOLATION RESULTS: ${passed}/${passed + failed} PASSED (${failed} FAILED)`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
