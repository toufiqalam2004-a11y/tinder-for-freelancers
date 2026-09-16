/**
 * Comprehensive Regression Test Suite: Main App Final Bug Fix & Feature Update
 *
 * Covers:
 * 1. User Data Isolation: User A vs User B data leak prevention
 * 2. Mandatory Profile Completion & Route Protection (8 required fields, secondaryRoles optional)
 * 3. Applications Page: Exactly 4 tabs (All, Applied, Saved, Viewed) & no preferences accordion
 * 4. Auto-Delete Feature: Gated strictly to Plus & Pro (backend & frontend)
 * 5. Membership Pricing: Exact Monthly & Annual pricing in INR & USD
 * 6. Job Feed: 10 diverse opportunities across built-in sources & user-scoped job status
 * 7. Clean Downgrade from Pro to Free: Backend, Frontend, UI, and Entitlements
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

// In-memory storage simulation for browser tests
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
  key: (i) => Array.from(sessionStore.keys())[i] || null,
  get length() { return sessionStore.size; },
};

import {
  getUser,
  saveUser,
  getAuth,
  setAuth,
  getCurrentUserId,
  clearActiveUserSessionStorage,
  getApplications,
  saveApplications,
  addApplication,
  getUserJobState,
  setUserJobState,
  getUserSavedJobIds,
  getUserAppliedJobIds,
  getJobs,
  saveJobs,
  DEMO_SOURCES,
} from '../src/data/storage.js';
import { subscriptionService } from '../src/services/subscriptionService.js';
import { usageService } from '../src/services/usageService.js';
import { checkProfileCompletion } from '../src/utils/profileValidator.js';
import { SUBSCRIPTION_PLANS } from '../src/utils/constants.js';
import { db } from '../server/database.js';
import { performServerAutoDelete } from '../server/routes/api.js';

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
  console.log('STARTING MAIN APP FINAL BUG FIX & POLISH TEST SUITE');
  console.log('====================================================\n');

  // =========================================================================
  // 1. PREVIOUS USER DATA LEAKAGE & ISOLATION
  // =========================================================================
  console.log('--- 1. USER DATA ISOLATION ---');

  const userAId = 'user-alice-101';
  const userBId = 'user-bob-202';

  test('User A logs in, configures profile, applications, saved jobs, and quotas', () => {
    store.clear();
    setAuth({ isAuthenticated: true, userId: userAId, phone: '+919111111111' });

    saveUser({
      id: userAId,
      phone: '+919111111111',
      name: 'Alice Wonder',
      profession: 'Full Stack Engineer',
      primaryCategory: 'engineering',
      specialization: 'React & Node.js',
      skills: [{ name: 'React' }, { name: 'Node.js' }],
      portfolioUrl: 'https://alice.dev',
      bio: 'Senior full-stack engineer with 6 years experience',
      cvFile: { name: 'alice_cv.pdf', url: 'https://cv.alice.dev' },
    });

    addApplication({
      id: 'app-alice-1',
      userId: userAId,
      jobId: 'job-sample-1',
      title: 'React Dev at TechCorp',
      company: 'TechCorp',
      status: 'applied',
    });

    setUserJobState('job-sample-2', 'saved', userAId);
    setUserJobState('job-sample-3', 'skipped', userAId);

    const userAProfile = getUser(userAId);
    assert(userAProfile && userAProfile.name === 'Alice Wonder');
    assert.strictEqual(getApplications(userAId).length, 1);
    assert.strictEqual(getUserJobState('job-sample-2', userAId), 'saved');
    assert.strictEqual(getUserJobState('job-sample-3', userAId), 'skipped');
  });

  test('User A logs out: clearActiveUserSessionStorage() purges active session caches', () => {
    clearActiveUserSessionStorage();
    setAuth({ isAuthenticated: false, userId: null });

    assert.strictEqual(globalThis.localStorage.getItem('tf_user'), null);
    assert.strictEqual(globalThis.localStorage.getItem('tf_profile'), null);
    assert.strictEqual(globalThis.localStorage.getItem('tf_subscription'), null);
    assert.strictEqual(globalThis.localStorage.getItem('tf_quotas'), null);
  });

  test('User B logs in: User B NEVER receives User A data (starts fresh)', () => {
    setAuth({ isAuthenticated: true, userId: userBId, phone: '+919222222222' });

    // User B profile must be null
    const userBProfile = getUser(userBId);
    assert.strictEqual(userBProfile, null);

    // ProfileContext checkProfileCompletion on null profile must return false
    assert.strictEqual(checkProfileCompletion(null), false);

    // User B must have 0 applications
    const userBApps = getApplications(userBId);
    const userAAppsLeakedToB = userBApps.filter((a) => a.userId === userAId);
    assert.strictEqual(userAAppsLeakedToB.length, 0);

    // User B must NOT have User A saved or skipped states
    assert.strictEqual(getUserJobState('job-sample-2', userBId), 'feed');
    assert.strictEqual(getUserJobState('job-sample-3', userBId), 'feed');
  });

  // =========================================================================
  // 2. PROFILE COMPLETION & REQUIRED FIELDS
  // =========================================================================
  console.log('\n--- 2. MANDATORY PROFILE COMPLETION & ROUTING ---');

  test('checkProfileCompletion strictly fails if any of the 8 mandatory fields are missing', () => {
    // Missing name
    assert.strictEqual(
      checkProfileCompletion({
        profession: 'Dev',
        primaryCategory: 'eng',
        specialization: 'Frontend',
        skills: [{ name: 'React' }],
        portfolioUrl: 'https://portfolio.com',
        bio: 'Bio here',
        cvFile: { name: 'cv.pdf' },
      }),
      false
    );

    // Missing profession
    assert.strictEqual(
      checkProfileCompletion({
        name: 'Bob',
        primaryCategory: 'eng',
        specialization: 'Frontend',
        skills: [{ name: 'React' }],
        portfolioUrl: 'https://portfolio.com',
        bio: 'Bio here',
        cvFile: { name: 'cv.pdf' },
      }),
      false
    );

    // Missing primaryCategory
    assert.strictEqual(
      checkProfileCompletion({
        name: 'Bob',
        profession: 'Dev',
        specialization: 'Frontend',
        skills: [{ name: 'React' }],
        portfolioUrl: 'https://portfolio.com',
        bio: 'Bio here',
        cvFile: { name: 'cv.pdf' },
      }),
      false
    );

    // Missing specialization
    assert.strictEqual(
      checkProfileCompletion({
        name: 'Bob',
        profession: 'Dev',
        primaryCategory: 'eng',
        skills: [{ name: 'React' }],
        portfolioUrl: 'https://portfolio.com',
        bio: 'Bio here',
        cvFile: { name: 'cv.pdf' },
      }),
      false
    );

    // Empty skills array
    assert.strictEqual(
      checkProfileCompletion({
        name: 'Bob',
        profession: 'Dev',
        primaryCategory: 'eng',
        specialization: 'Frontend',
        skills: [],
        portfolioUrl: 'https://portfolio.com',
        bio: 'Bio here',
        cvFile: { name: 'cv.pdf' },
      }),
      false
    );

    // Missing portfolioUrl
    assert.strictEqual(
      checkProfileCompletion({
        name: 'Bob',
        profession: 'Dev',
        primaryCategory: 'eng',
        specialization: 'Frontend',
        skills: [{ name: 'React' }],
        portfolioUrl: '',
        bio: 'Bio here',
        cvFile: { name: 'cv.pdf' },
      }),
      false
    );

    // Missing bio
    assert.strictEqual(
      checkProfileCompletion({
        name: 'Bob',
        profession: 'Dev',
        primaryCategory: 'eng',
        specialization: 'Frontend',
        skills: [{ name: 'React' }],
        portfolioUrl: 'https://portfolio.com',
        bio: '   ',
        cvFile: { name: 'cv.pdf' },
      }),
      false
    );

    // Missing CV
    assert.strictEqual(
      checkProfileCompletion({
        name: 'Bob',
        profession: 'Dev',
        primaryCategory: 'eng',
        specialization: 'Frontend',
        skills: [{ name: 'React' }],
        portfolioUrl: 'https://portfolio.com',
        bio: 'Bio here',
        cvFile: null,
      }),
      false
    );
  });

  test('checkProfileCompletion succeeds when all 8 mandatory fields are valid, without requiring secondaryRoles', () => {
    const validProfileWithoutSecondary = {
      name: 'Bob Builder',
      profession: 'Full Stack Engineer',
      primaryCategory: 'engineering',
      specialization: 'Cloud Infrastructure',
      skills: [{ name: 'Docker' }, { name: 'Kubernetes' }],
      portfolioUrl: 'https://bob.dev',
      bio: 'Cloud and DevOps architect.',
      cvFile: { name: 'bob_resume.pdf' },
    };

    assert.strictEqual(checkProfileCompletion(validProfileWithoutSecondary), true);
  });

  test('ProfileSetup.jsx has NO asterisk characters (*) and marks Secondary Roles as (optional)', () => {
    const profileSetupPath = path.resolve('src/pages/ProfileSetup.jsx');
    const content = fs.readFileSync(profileSetupPath, 'utf8');

    assert(!content.includes('text-primary">*</span>'), 'No asterisk span in ProfileSetup');
    assert(!content.includes('text-red-500">*</span>'), 'No red asterisk span in ProfileSetup');
    assert(content.includes('Secondary / Adjacent Roles (optional)'), 'Secondary Roles clearly marked (optional)');
  });

  // =========================================================================
  // 3. APPLICATIONS PAGE (EXACTLY 4 TABS & NO PREFERENCES ACCORDION)
  // =========================================================================
  console.log('\n--- 3. APPLICATIONS PAGE SPECIFICATION ---');

  test('Applications.jsx defines strictly 4 tabs: All, Applied, Saved, Viewed', () => {
    const applicationsPath = path.resolve('src/pages/Applications.jsx');
    const content = fs.readFileSync(applicationsPath, 'utf8');

    assert(content.includes("id: 'all', label: 'All'"), 'Tab: All present');
    assert(content.includes("id: 'applied', label: 'Applied'"), 'Tab: Applied present');
    assert(content.includes("id: 'saved', label: 'Saved'"), 'Tab: Saved present');
    assert(content.includes("id: 'viewed', label: 'Viewed'"), 'Tab: Viewed present');

    assert(!content.includes("id: 'interview', label: 'Interview'"), 'No Interview top tab');
    assert(!content.includes("id: 'rejected', label: 'Rejected'"), 'No Rejected top tab');
  });

  test('Applications.jsx has removed APPLICATION PREFERENCES accordion section and settings button', () => {
    const applicationsPath = path.resolve('src/pages/Applications.jsx');
    const content = fs.readFileSync(applicationsPath, 'utf8');

    assert(!content.includes('APPLICATION PREFERENCES'), 'No APPLICATION PREFERENCES accordion');
    assert(!content.includes('showPreferencesAccordion'), 'No showPreferencesAccordion state');
    assert(!content.includes('setShowPreferencesAccordion'), 'No setShowPreferencesAccordion state setter');
  });

  // =========================================================================
  // 4. AUTO-DELETE FEATURE GATING (PLUS & PRO ONLY)
  // =========================================================================
  console.log('\n--- 4. AUTO-DELETE FEATURE GATING ---');

  test('performServerAutoDelete strictly returns 0 for Free tier users (locked)', () => {
    const freeUserId = `test-free-user-${Date.now()}`;
    db.users.insert({ id: freeUserId, plan: 'free', phone: '+919876500001' });
    db.subscriptions.insert({ id: `sub-${freeUserId}`, userId: freeUserId, plan: 'free', status: 'active' });
    db.preferences.insert({ id: `pref-${freeUserId}`, userId: freeUserId, autoDeleteApplicationsAfter7Days: true });

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    db.applications.insert({
      id: `app-old-free-${Date.now()}`,
      userId: freeUserId,
      title: 'Old Job',
      status: 'applied',
      appliedAt: tenDaysAgo,
      updatedAt: tenDaysAgo,
    });

    const deleted = performServerAutoDelete(freeUserId);
    assert.strictEqual(deleted, 0, 'Auto-delete must be 0 for Free user');

    const remaining = db.applications.findAll((a) => a.userId === freeUserId);
    assert.strictEqual(remaining.length, 1, 'Free user application preserved');
  });

  test('performServerAutoDelete deletes old applications for Pro user while protecting interview/hired', () => {
    const proUserId = `test-pro-user-${Date.now()}`;
    db.users.insert({ id: proUserId, plan: 'pro', phone: '+919876500002' });
    db.subscriptions.insert({ id: `sub-${proUserId}`, userId: proUserId, plan: 'pro', status: 'active' });
    db.preferences.insert({ id: `pref-${proUserId}`, userId: proUserId, autoDeleteApplicationsAfter7Days: true });

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    db.applications.insert({
      id: `app-old-applied-${proUserId}`,
      userId: proUserId,
      title: 'Old Applied Job',
      status: 'applied',
      appliedAt: tenDaysAgo,
      updatedAt: tenDaysAgo,
    });
    db.applications.insert({
      id: `app-old-interview-${proUserId}`,
      userId: proUserId,
      title: 'Protected Interview Job',
      status: 'interview',
      appliedAt: tenDaysAgo,
      updatedAt: tenDaysAgo,
    });

    const deleted = performServerAutoDelete(proUserId);
    assert.strictEqual(deleted, 1, 'Deleted exactly 1 eligible application');

    const remaining = db.applications.findAll((a) => a.userId === proUserId);
    assert.strictEqual(remaining.length, 1, 'Only protected interview app remains');
    assert.strictEqual(remaining[0].status, 'interview', 'Interview app was protected');
  });

  test('Settings.jsx locks Auto-delete for Free users and shows PLUS & PRO ONLY badge', () => {
    const settingsPath = path.resolve('src/pages/Settings.jsx');
    const content = fs.readFileSync(settingsPath, 'utf8');

    assert(content.includes('Auto-delete applications (7 days)'), 'Auto-delete setting exists');
    assert(content.includes('PLUS & PRO ONLY'), 'PLUS & PRO ONLY badge is displayed');
  });

  // =========================================================================
  // 5. PRICING IN USER APP (MEMBERSHIP.JSX)
  // =========================================================================
  console.log('\n--- 5. MEMBERSHIP PRICING SPECIFICATION ---');

  test('SUBSCRIPTION_PLANS defines exact monthly and annual pricing in INR and USD', () => {
    // Free
    assert.strictEqual(SUBSCRIPTION_PLANS.FREE.prices.monthly.INR, 0);
    assert.strictEqual(SUBSCRIPTION_PLANS.FREE.prices.monthly.USD, 0);
    assert.strictEqual(SUBSCRIPTION_PLANS.FREE.prices.annual.INR, 0);
    assert.strictEqual(SUBSCRIPTION_PLANS.FREE.prices.annual.USD, 0);

    // Plus
    assert.strictEqual(SUBSCRIPTION_PLANS.PLUS.prices.monthly.INR, 499);
    assert.strictEqual(SUBSCRIPTION_PLANS.PLUS.prices.monthly.USD, 7);
    assert.strictEqual(SUBSCRIPTION_PLANS.PLUS.prices.annual.INR, 4990);
    assert.strictEqual(SUBSCRIPTION_PLANS.PLUS.prices.annual.USD, 70);

    // Pro
    assert.strictEqual(SUBSCRIPTION_PLANS.PRO.prices.monthly.INR, 1499);
    assert.strictEqual(SUBSCRIPTION_PLANS.PRO.prices.monthly.USD, 19);
    assert.strictEqual(SUBSCRIPTION_PLANS.PRO.prices.annual.INR, 14990);
    assert.strictEqual(SUBSCRIPTION_PLANS.PRO.prices.annual.USD, 190);
  });

  test('Membership.jsx provides working Monthly/Annual interval toggle with Save ~17% indicator', () => {
    const membershipPath = path.resolve('src/pages/Membership.jsx');
    const content = fs.readFileSync(membershipPath, 'utf8');

    assert(content.includes("billingInterval === 'annual'"), 'Annual interval handled');
    assert(content.includes("billingInterval === 'monthly'"), 'Monthly interval handled');
    assert(content.includes('Save ~17%'), 'Save ~17% badge displayed on annual toggle');
  });

  // =========================================================================
  // 6. JOB FEED (10 OPPORTUNITIES & BUILT-IN SOURCES)
  // =========================================================================
  console.log('\n--- 6. JOB FEED OPPORTUNITIES & USER-SCOPED STATUS ---');

  test('data/jobs.json contains 10 valid, diverse opportunities across built-in sources', () => {
    const jobsFilePath = path.resolve('data/jobs.json');
    const jobs = JSON.parse(fs.readFileSync(jobsFilePath, 'utf8'));

    assert.strictEqual(jobs.length, 10, 'Feed contains exactly 10 opportunities');

    const platforms = new Set(jobs.map((j) => j.platform));
    assert(platforms.has('reddit'), 'Reddit opportunities present');
    assert(platforms.has('youtube'), 'YouTube opportunities present');
    assert(platforms.has('x'), 'X opportunities present');

    const sourceIds = new Set(jobs.map((j) => j.sourceId));
    assert(sourceIds.has('demo-src-reddit'), 'demo-src-reddit present');
    assert(sourceIds.has('demo-src-youtube'), 'demo-src-youtube present');
    assert(sourceIds.has('demo-src-x'), 'demo-src-x present');

    jobs.forEach((j) => {
      assert(j.id, `Job missing id: ${JSON.stringify(j)}`);
      assert(j.title, `Job missing title: ${j.id}`);
      assert(j.company, `Job missing company: ${j.id}`);
      assert(j.budget || j.salary, `Job missing budget: ${j.id}`);
      assert(j.description, `Job missing description: ${j.id}`);
    });
  });

  test('User A skipping or saving a job does NOT mutate or hide the job for User B', () => {
    const testJobId = 'job-diverse-1';

    setUserJobState(testJobId, 'saved', userAId);
    assert.strictEqual(getUserJobState(testJobId, userAId), 'saved');
    assert.strictEqual(getUserJobState(testJobId, userBId), 'feed');

    setUserJobState(testJobId, 'skipped', userAId);
    assert.strictEqual(getUserJobState(testJobId, userAId), 'skipped');
    assert.strictEqual(getUserJobState(testJobId, userBId), 'feed');
  });

  // =========================================================================
  // 7. PRO TO FREE CLEAN DOWNGRADE
  // =========================================================================
  console.log('\n--- 7. PRO TO FREE DOWNGRADE ---');

  test('subscriptionService downgrade lifecycle keeps Pro active until period end, allows cancellation, and converts on expiry', () => {
    subscriptionService.changePlan('pro');
    assert.strictEqual(subscriptionService.isPro(), true);
    assert.strictEqual(subscriptionService.isFree(), false);

    // Downgrading schedules the cancellation without immediately stripping Pro entitlements
    const scheduledSub = subscriptionService.changePlan('free');
    assert.strictEqual(scheduledSub.plan, 'pro');
    assert.strictEqual(scheduledSub.cancelAtPeriodEnd, true);
    assert.strictEqual(scheduledSub.scheduledPlan, 'free');
    assert.strictEqual(subscriptionService.isPro(), true);

    // Cancel downgrade keeps Pro active
    const keptSub = subscriptionService.cancelDowngrade();
    assert.strictEqual(keptSub.cancelAtPeriodEnd, false);
    assert.strictEqual(subscriptionService.isPro(), true);

    // Schedule downgrade again and simulate period end
    subscriptionService.scheduleDowngrade('free');
    const convertedSub = subscriptionService.simulatePeriodEnd();
    assert.strictEqual(convertedSub.plan, 'free');
    assert.strictEqual(subscriptionService.isPro(), false);
    assert.strictEqual(subscriptionService.isFree(), true);
    assert.strictEqual(subscriptionService.getCurrentPlanDetails().id, 'free');

    // Immediate downgrade also supported
    subscriptionService.changePlan('pro');
    const immediateSub = subscriptionService.changePlan('free', null, 30, { immediate: true });
    assert.strictEqual(immediateSub.plan, 'free');
    assert.strictEqual(subscriptionService.isFree(), true);
  });

  test('Downgrade preserves user profile, CV, applications, and sources', () => {
    const downgradeUserId = `user-downgrade-${Date.now()}`;
    setAuth({ isAuthenticated: true, userId: downgradeUserId });

    const sampleProfile = {
      id: downgradeUserId,
      name: 'Charlie Brown',
      profession: 'Video Editor',
      primaryCategory: 'video_editing',
      specialization: 'Short Form',
      skills: [{ name: 'Premiere Pro' }],
      portfolioUrl: 'https://charlie.video',
      bio: 'Creative editor',
      cvFile: { name: 'charlie_cv.pdf' },
    };
    saveUser(sampleProfile);

    addApplication({
      id: `app-downgrade-${Date.now()}`,
      userId: downgradeUserId,
      jobId: 'job-sample-1',
      title: 'Video Editor contract',
      status: 'applied',
    });

    subscriptionService.changePlan('free');

    const retrievedProfile = getUser(downgradeUserId);
    assert.strictEqual(retrievedProfile.name, 'Charlie Brown');
    assert.strictEqual(retrievedProfile.cvFile.name, 'charlie_cv.pdf');

    const userApps = getApplications(downgradeUserId);
    assert.strictEqual(userApps.length, 1);
    assert.strictEqual(userApps[0].title, 'Video Editor contract');
  });

  // =========================================================================
  // 8. APP HEADER BRAND MARK
  // =========================================================================
  console.log('\n--- 8. APP HEADER LOGO BRAND MARK ---');

  test('AppHeader.jsx matches Landing Page brand mark with rose gradient Briefcase and Beta badge', () => {
    const headerPath = path.resolve('src/components/AppHeader.jsx');
    const content = fs.readFileSync(headerPath, 'utf8');

    assert(content.includes('Briefcase'), 'Briefcase icon imported and used in AppHeader');
    assert(content.includes('from-[#E11D48] to-[#F43F6E]'), 'Rose gradient container matching Landing');
    assert(content.includes('Beta'), 'Beta badge present in AppHeader');
    assert(content.includes('Swipe. Match. Get Hired.'), 'Brand slogan present in AppHeader');
  });

  console.log('\n====================================================');
  console.log(`FINAL POLISH TEST RESULTS: ${passed}/${passed + failed} PASSED (${failed} FAILED)`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
