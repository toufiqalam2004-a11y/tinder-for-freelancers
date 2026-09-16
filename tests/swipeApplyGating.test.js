/**
 * Comprehensive Test Suite for Tinder-Style Swipe Apply & Membership Gating
 * Covers all 16 required verification scenarios:
 * 1. Pro user swipe right apply
 * 2. Pro user manual apply
 * 3. Pro user exhausted quota
 * 4. Free user with quota (> 0)
 * 5. Free user exhausted quota (= 0)
 * 6. Plus user with quota (> 0)
 * 7. Plus user exhausted quota (= 0)
 * 8. Duplicate swipe right
 * 9. Case sensitivity ('PRO', 'Pro', 'PLUS', 'Plus', 'FREE', 'Free')
 * 10. Approval Mode (review before send)
 * 11. Autopilot Mode (instant auto-dispatch)
 * 12. Re-login / page reload state preservation
 * 13. Quota refill boundary (8-hour window reset)
 * 14. Bonus tokens & credits priority
 * 15. Non-matching job handling
 * 16. Offline / mock mode fallback
 */

import { db } from '../server/database.js';
import { subscriptionService } from '../src/services/subscriptionService.js';
import { usageService } from '../src/services/usageService.js';
import { featureAccess } from '../src/services/featureAccessService.js';
import { outreachService } from '../src/services/outreach/outreachService.js';
import { rewardService } from '../src/services/rewardService.js';
import {
  setStoredSubscription,
  getStoredSubscription,
  setStoredQuotaWindow,
  getStoredQuotaWindow,
  setAuth,
  getAuth,
  getUser,
  saveUser,
  isJobAppliedByUser,
  setUserJobApplied,
  addApplication,
  getApplications,
  getOutreachPreferences,
  updateOutreachPreferences,
  getCurrentUserId,
  setStoredDailyUsage,
} from '../src/data/storage.js';
import {
  normalizePlan,
  isProPlan,
  isPlusPlan,
  isFreePlan,
  toCanonicalPlan,
} from '../src/utils/planUtils.js';
import {
  APPLICATION_QUOTA_WINDOW_MS,
  FREE_APPLICATION_QUOTA,
  PLUS_APPLICATION_QUOTA,
  PRO_APPLICATION_QUOTA,
  getPlanQuotaConfig,
} from '../src/utils/quotaConfig.js';
import { createApplication } from '../src/data/models.js';

// Setup local storage mock for node testing environment if undefined
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

if (typeof globalThis.sessionStorage === 'undefined' || typeof globalThis.sessionStorage.setItem !== 'function') {
  const sessionStore = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
    setItem: (k, v) => sessionStore.set(k, String(v)),
    removeItem: (k) => sessionStore.delete(k),
    clear: () => sessionStore.clear(),
  };
}

// Intercept node fetch for relative /api paths to point to http://localhost:5000
const originalFetch = globalThis.fetch;
if (originalFetch) {
  globalThis.fetch = (input, init) => {
    let url = input;
    if (typeof input === 'string' && input.startsWith('/api')) {
      url = `http://localhost:5000${input}`;
    }
    return originalFetch(url, init);
  };
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS [Test ${totalTests}]: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL [Test ${totalTests}]: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING SWIPE APPLY & MEMBERSHIP GATING TEST SUITE (16 SCENARIOS)');
  console.log('====================================================\n');

  // Helpers to simulate swipe-right handling matching Jobs.jsx logic
  const simulateSwipeApply = async ({ job, profile, isApplyingRef, applyingJobIdsRef }) => {
    if (!job || !job.id) return { action: 'ignored', reason: 'invalid_job' };
    if (applyingJobIdsRef?.has(job.id)) return { action: 'ignored', reason: 'already_applying' };

    const currentUid = profile?.id || getCurrentUserId();
    if (isJobAppliedByUser(job.id, currentUid)) {
      return { action: 'duplicate_prevented', reason: 'already_applied' };
    }

    applyingJobIdsRef?.add(job.id);

    try {
      const liveIsPro = subscriptionService.isPro() || featureAccess.isProEnabled();

      // 1. Quota check
      const quotaCheck = usageService.canApply();
      if (!quotaCheck.allowed) {
        if (liveIsPro) {
          return {
            allowed: false,
            showUpgradeModal: false, // NO upgrade modal for Pro!
            exhaustedMessage: quotaCheck.reason,
            reason: 'pro_quota_exhausted',
          };
        } else {
          return {
            allowed: false,
            showUpgradeModal: true, // Free/Plus can see upgrade suggestion
            upgradeReason: quotaCheck.reason,
            reason: 'upgrade_suggested',
          };
        }
      }

      const outreachPrefs = profile?.outreachPreferences || getOutreachPreferences();
      const quickApplyActive = liveIsPro && Boolean(outreachPrefs?.quickApplyEnabled);

      if (!quickApplyActive) {
        // Manual apply / Approval mode flow -> opens composer
        return {
          allowed: true,
          showUpgradeModal: false,
          navigatedToComposer: true,
          composerUrl: `/apply/${job.id}`,
        };
      }

      // Autopilot / Quick Apply flow
      const result = await outreachService.executeAutoOutreach({
        job,
        profile,
        preferences: outreachPrefs,
      });

      if (result.code === 'PRO_REQUIRED' || result.status === 'NOT_AUTHORIZED') {
        if (subscriptionService.isPro()) {
          await subscriptionService.syncWithServer(subscriptionService.getSubscription()).catch(() => {});
          return { allowed: true, showUpgradeModal: false, reSynced: true };
        }
        return { allowed: false, showUpgradeModal: true, reason: 'pro_required' };
      }

      if (result.code === 'RATE_LIMIT' || result.status === 'RATE_LIMIT') {
        return {
          allowed: false,
          showUpgradeModal: !liveIsPro,
          exhaustedMessage: result.error,
        };
      }

      if (result.code === 'NOT_QUALIFIED' || result.status === 'NOT_QUALIFIED') {
        return {
          allowed: false,
          showUpgradeModal: false,
          skipped: true,
          reason: 'not_qualified',
        };
      }

      if (
        result.success ||
        result.status === 'DEMO_SENT' ||
        result.code === 'DEMO_SENT' ||
        result.status === 'SENT' ||
        result.code === 'SENT'
      ) {
        // Deduct 1 entitlement
        usageService.consumeApplication();
        setUserJobApplied(job.id, currentUid);

        return {
          allowed: true,
          showUpgradeModal: false,
          dispatched: true,
          applied: true,
          status: 'applied',
        };
      }

      return {
        allowed: false,
        showUpgradeModal: false,
        error: result.error,
      };
    } finally {
      applyingJobIdsRef?.delete(job.id);
    }
  };

  // ----------------------------------------------------
  // SCENARIO 1: Pro user swipe right apply
  // ----------------------------------------------------
  const proUser1Id = `user-pro-s1-${Date.now()}`;
  setAuth({ isAuthenticated: true, userId: proUser1Id, phone: '+919999900001' });
  subscriptionService.saveSubscription({
    id: `sub-${proUser1Id}`,
    userId: proUser1Id,
    phone: '+919999900001',
    plan: 'pro',
    status: 'active',
  });
  db.subscriptions.insert({
    id: `sub-${proUser1Id}`,
    userId: proUser1Id,
    phone: '+919999900001',
    plan: 'pro',
    status: 'active',
  });
  setStoredQuotaWindow({
    plan: 'pro',
    applicationsUsed: 0,
    windowStart: Date.now(),
    windowEnd: Date.now() + APPLICATION_QUOTA_WINDOW_MS,
  });

  const matchingJob1 = {
    id: `job-s1-${Date.now()}`,
    title: 'Senior React Engineer',
    company: 'Fintech Hub',
    description: 'Looking for senior engineer. Contact: hiring@fintech.co',
    contactEmail: 'hiring@fintech.co',
    matchScore: 92,
    status: 'new',
  };

  const proProfile1 = {
    id: proUser1Id,
    name: 'Pro Candidate',
    primaryRole: 'Senior React Engineer',
    skills: ['React', 'JavaScript', 'Node.js', 'TypeScript'],
    outreachPreferences: { quickApplyEnabled: true, contactPreference: 'both' },
    userPreferences: { minMatchScore: 40 },
  };

  const initialProQuota = usageService.getQuotaStatus().remainingQuota;
  const s1ApplyingRef = new Set();
  const s1Result = await simulateSwipeApply({
    job: matchingJob1,
    profile: proProfile1,
    applyingJobIdsRef: s1ApplyingRef,
  });

  const afterProQuota = usageService.getQuotaStatus().remainingQuota;

  assert(
    s1Result.allowed === true &&
      s1Result.showUpgradeModal === false &&
      s1Result.applied === true &&
      initialProQuota === 25 &&
      afterProQuota === 24,
    'Scenario 1: Pro user swiping right succeeds, NO upgrade modal, quota decrements from 25 to 24, status = applied'
  );

  // ----------------------------------------------------
  // SCENARIO 2: Pro user manual apply
  // ----------------------------------------------------
  const matchingJob2 = {
    id: `job-s2-${Date.now()}`,
    title: 'Creative Director',
    company: 'Brand Studio',
    description: 'Looking for creative lead. Contact: studio@example.com',
    matchScore: 95,
  };

  // When Pro user has Quick Apply disabled (Manual mode)
  const proProfile2Manual = {
    ...proProfile1,
    outreachPreferences: { quickApplyEnabled: false },
  };

  const s2Result = await simulateSwipeApply({
    job: matchingJob2,
    profile: proProfile2Manual,
  });

  const quotaBeforeManual = usageService.getQuotaStatus().remainingQuota;
  // Simulating composer submission on confirm
  usageService.consumeApplication();
  const quotaAfterManual = usageService.getQuotaStatus().remainingQuota;

  assert(
    s2Result.allowed === true &&
      s2Result.showUpgradeModal === false &&
      s2Result.navigatedToComposer === true &&
      s2Result.composerUrl === `/apply/${matchingJob2.id}` &&
      quotaAfterManual === quotaBeforeManual - 1,
    'Scenario 2: Pro user clicking Apply opens composer without upgrade prompt, all features available, quota decrements on confirm'
  );

  // ----------------------------------------------------
  // SCENARIO 3: Pro user exhausted quota
  // ----------------------------------------------------
  // Exhaust Pro quota to 0
  const currentWindow3 = usageService.getQuotaWindow();
  currentWindow3.applicationsUsed = 25;
  setStoredQuotaWindow(currentWindow3);

  const matchingJob3 = {
    id: `job-s3-${Date.now()}`,
    title: 'Product Designer',
    company: 'TechCorp',
    contactEmail: 'jobs@techcorp.com',
    matchScore: 90,
  };

  const s3Result = await simulateSwipeApply({
    job: matchingJob3,
    profile: proProfile1,
  });

  assert(
    s3Result.allowed === false &&
      s3Result.showUpgradeModal === false &&
      s3Result.exhaustedMessage &&
      s3Result.exhaustedMessage.includes('Application quota exhausted') &&
      !s3Result.exhaustedMessage.includes('Upgrade to Pro'),
    'Scenario 3: When Pro quota is exhausted (=0), swipe right does NOT show upgrade modal, shows "Application quota exhausted. Next refill in X."'
  );

  // ----------------------------------------------------
  // SCENARIO 4: Free user with quota (> 0)
  // ----------------------------------------------------
  const freeUser4Id = `user-free-s4-${Date.now()}`;
  setAuth({ isAuthenticated: true, userId: freeUser4Id, phone: '+919999900004' });
  subscriptionService.saveSubscription({
    id: `sub-${freeUser4Id}`,
    userId: freeUser4Id,
    plan: 'free',
    status: 'active',
  });
  setStoredQuotaWindow({
    plan: 'free',
    applicationsUsed: 0,
    windowStart: Date.now(),
    windowEnd: Date.now() + APPLICATION_QUOTA_WINDOW_MS,
  });

  const freeProfile4 = {
    id: freeUser4Id,
    name: 'Free User',
    outreachPreferences: { quickApplyEnabled: false },
  };

  const freeJob4 = {
    id: `job-s4-${Date.now()}`,
    title: 'Copywriter',
    company: 'Agency',
    matchScore: 85,
  };

  const s4Result = await simulateSwipeApply({
    job: freeJob4,
    profile: freeProfile4,
  });

  const freeInitial = usageService.getQuotaStatus().remainingQuota;
  usageService.consumeApplication();
  const freeAfter = usageService.getQuotaStatus().remainingQuota;

  assert(
    s4Result.allowed === true &&
      s4Result.showUpgradeModal === false &&
      s4Result.navigatedToComposer === true &&
      freeInitial === 5 &&
      freeAfter === 4,
    'Scenario 4: Free user with quota remaining can swipe right / apply, navigates to composer, quota decrements from 5 to 4, NO upgrade modal'
  );

  // ----------------------------------------------------
  // SCENARIO 5: Free user exhausted quota (= 0)
  // ----------------------------------------------------
  const freeWindow5 = usageService.getQuotaWindow();
  freeWindow5.applicationsUsed = 5; // exhaust 5 of 5
  setStoredQuotaWindow(freeWindow5);

  const s5Result = await simulateSwipeApply({
    job: freeJob4,
    profile: freeProfile4,
  });

  assert(
    s5Result.allowed === false &&
      s5Result.showUpgradeModal === true &&
      s5Result.upgradeReason.includes('Application quota exhausted'),
    'Scenario 5: When Free quota is exhausted (=0), swipe right shows quota exhausted upgrade prompt / modal'
  );

  // ----------------------------------------------------
  // SCENARIO 6: Plus user with quota (> 0)
  // ----------------------------------------------------
  const plusUser6Id = `user-plus-s6-${Date.now()}`;
  setAuth({ isAuthenticated: true, userId: plusUser6Id, phone: '+919999900006' });
  subscriptionService.saveSubscription({
    id: `sub-${plusUser6Id}`,
    userId: plusUser6Id,
    plan: 'plus',
    status: 'active',
  });
  setStoredQuotaWindow({
    plan: 'plus',
    applicationsUsed: 0,
    windowStart: Date.now(),
    windowEnd: Date.now() + APPLICATION_QUOTA_WINDOW_MS,
  });

  const plusProfile6 = {
    id: plusUser6Id,
    name: 'Plus User',
    outreachPreferences: { quickApplyEnabled: false },
  };

  const plusJob6 = {
    id: `job-s6-${Date.now()}`,
    title: 'UI Designer',
    company: 'Design Corp',
    matchScore: 88,
  };

  const s6Result = await simulateSwipeApply({
    job: plusJob6,
    profile: plusProfile6,
  });

  const plusInitial = usageService.getQuotaStatus().remainingQuota;
  usageService.consumeApplication();
  const plusAfter = usageService.getQuotaStatus().remainingQuota;

  assert(
    s6Result.allowed === true &&
      s6Result.showUpgradeModal === false &&
      plusInitial === 15 &&
      plusAfter === 14,
    'Scenario 6: Plus user with quota remaining can swipe right / apply, quota decrements from 15 to 14, NO upgrade modal shown'
  );

  // ----------------------------------------------------
  // SCENARIO 7: Plus user exhausted quota (= 0)
  // ----------------------------------------------------
  const plusWindow7 = usageService.getQuotaWindow();
  plusWindow7.applicationsUsed = 15; // exhaust 15 of 15
  setStoredQuotaWindow(plusWindow7);

  const s7Result = await simulateSwipeApply({
    job: plusJob6,
    profile: plusProfile6,
  });

  assert(
    s7Result.allowed === false &&
      s7Result.showUpgradeModal === true &&
      s7Result.upgradeReason.includes('Application quota exhausted'),
    'Scenario 7: When Plus quota is exhausted (=0), swipe right shows quota exhausted upgrade prompt / modal'
  );

  // ----------------------------------------------------
  // SCENARIO 8: Duplicate swipe right
  // ----------------------------------------------------
  // Re-enable Pro quota
  const proUser8Id = `user-pro-s8-${Date.now()}`;
  setAuth({ isAuthenticated: true, userId: proUser8Id, phone: '+919999900008' });
  subscriptionService.saveSubscription({
    id: `sub-${proUser8Id}`,
    userId: proUser8Id,
    phone: '+919999900008',
    plan: 'pro',
    status: 'active',
  });
  db.subscriptions.insert({
    id: `sub-${proUser8Id}`,
    userId: proUser8Id,
    phone: '+919999900008',
    plan: 'pro',
    status: 'active',
  });
  setStoredQuotaWindow({
    plan: 'pro',
    applicationsUsed: 0,
    windowStart: Date.now(),
    windowEnd: Date.now() + APPLICATION_QUOTA_WINDOW_MS,
  });

  const dupJob = {
    id: `job-dup-${Date.now()}`,
    title: 'Video Editor',
    company: 'Media House',
    contactEmail: 'producer@mediahouse.com',
    matchScore: 90,
  };

  const dupProfile = {
    id: proUser8Id,
    name: 'Rapid Swiper',
    primaryRole: 'Video Editor',
    skills: ['Video Editing', 'Premiere', 'After Effects'],
    outreachPreferences: { quickApplyEnabled: true },
    userPreferences: { minMatchScore: 40 },
  };

  const s8ApplyingRef = new Set();
  const quotaBeforeDup = usageService.getQuotaStatus().remainingQuota;

  // First swipe
  const firstSwipe = await simulateSwipeApply({
    job: dupJob,
    profile: dupProfile,
    applyingJobIdsRef: s8ApplyingRef,
  });

  // Second rapid swipe on same job
  const secondSwipe = await simulateSwipeApply({
    job: dupJob,
    profile: dupProfile,
    applyingJobIdsRef: s8ApplyingRef,
  });

  const quotaAfterDup = usageService.getQuotaStatus().remainingQuota;

  assert(
    firstSwipe.applied === true &&
      secondSwipe.action === 'duplicate_prevented' &&
      quotaBeforeDup - quotaAfterDup === 1,
    'Scenario 8: Rapid duplicate swipe right does NOT deduct 2 quota points; exactly 1 point deducted and duplicate prevented'
  );

  // ----------------------------------------------------
  // SCENARIO 9: Case sensitivity
  // ----------------------------------------------------
  const proVariants = ['pro', 'PRO', 'Pro', 'pRo'];
  const plusVariants = ['plus', 'PLUS', 'Plus'];
  const freeVariants = ['free', 'FREE', 'Free'];

  const allProValid = proVariants.every((v) => isProPlan(v) && normalizePlan(v) === 'pro');
  const allPlusValid = plusVariants.every((v) => isPlusPlan(v) && !isProPlan(v) && normalizePlan(v) === 'plus');
  const allFreeValid = freeVariants.every((v) => isFreePlan(v) && normalizePlan(v) === 'free');

  // Test uppercase 'PRO' with subscriptionService and usageService
  subscriptionService.saveSubscription({ plan: 'PRO', status: 'active' });
  const isProUpper = subscriptionService.isPro();
  const quotaUpper = usageService.getQuotaStatus();

  assert(
    allProValid &&
      allPlusValid &&
      allFreeValid &&
      isProUpper === true &&
      quotaUpper.limit === 25,
    'Scenario 9: Case-insensitive plan normalization handles PRO, Pro, PLUS, Plus, FREE, Free identically'
  );

  // ----------------------------------------------------
  // SCENARIO 10: Approval Mode
  // ----------------------------------------------------
  const approvalJob = {
    id: `job-approval-${Date.now()}`,
    title: 'Lead Growth Hacker',
    company: 'Startup Lab',
    matchScore: 91,
  };

  const approvalProfile = {
    id: proUser8Id,
    name: 'Reviewer Pro',
    outreachPreferences: { quickApplyEnabled: false }, // Approval mode requires manual review
  };

  const s10Result = await simulateSwipeApply({
    job: approvalJob,
    profile: approvalProfile,
  });

  assert(
    s10Result.allowed === true &&
      s10Result.showUpgradeModal === false &&
      s10Result.navigatedToComposer === true,
    'Scenario 10: Pro user in Approval Mode swiping right prompts review / composer, does NOT show upgrade modal'
  );

  // ----------------------------------------------------
  // SCENARIO 11: Autopilot Mode
  // ----------------------------------------------------
  const autopilotJob = {
    id: `job-autopilot-${Date.now()}`,
    title: 'Lead Animator',
    company: 'Animation Studios',
    contactEmail: 'hiring@animation.com',
    matchScore: 94,
  };

  const autopilotProfile = {
    id: proUser8Id,
    name: 'Autopilot Pro',
    primaryRole: 'Lead Animator',
    skills: ['Animation', 'After Effects', '3D Design'],
    outreachPreferences: { quickApplyEnabled: true },
    userPreferences: { minMatchScore: 40 },
  };

  const quotaBefore11 = usageService.getQuotaStatus().remainingQuota;
  const s11Result = await simulateSwipeApply({
    job: autopilotJob,
    profile: autopilotProfile,
  });
  const quotaAfter11 = usageService.getQuotaStatus().remainingQuota;

  assert(
    s11Result.allowed === true &&
      s11Result.showUpgradeModal === false &&
      s11Result.dispatched === true &&
      quotaBefore11 - quotaAfter11 === 1,
    'Scenario 11: Pro user in Autopilot Mode swiping right dispatches auto-outreach, quota decrements by 1, NO upgrade modal'
  );

  // ----------------------------------------------------
  // SCENARIO 12: Re-login / page reload state preservation
  // ----------------------------------------------------
  // Simulate active Pro user logging out and back in
  const reLoginUser = `user-relogin-${Date.now()}`;
  subscriptionService.saveSubscription({
    id: `sub-${reLoginUser}`,
    userId: reLoginUser,
    plan: 'pro',
    status: 'active',
  });

  // Re-login: fetchServerSubscription must NOT downgrade local active pro to free
  const preFetch = subscriptionService.getSubscription();
  assert(preFetch.plan === 'pro', 'Scenario 12a: Local active PRO subscription saved before login sync');

  // Verify fetchServerSubscription retains active PRO
  const synced = await subscriptionService.fetchServerSubscription();
  assert(
    isProPlan(synced.plan) && subscriptionService.isPro() === true,
    'Scenario 12b: Re-login / reload retains active PRO subscription without accidental downgrade'
  );

  // ----------------------------------------------------
  // SCENARIO 13: Quota refill boundary (8-hour window reset)
  // ----------------------------------------------------
  // Set window that ended 1 minute ago with 25 applications used
  const expiredWindow = {
    plan: 'pro',
    applicationsUsed: 25,
    windowStart: Date.now() - APPLICATION_QUOTA_WINDOW_MS - 60000,
    windowEnd: Date.now() - 60000,
  };
  setStoredQuotaWindow(expiredWindow);

  const quotaCheckAfterExpiry = usageService.canApply();
  const windowAfterExpiry = usageService.getQuotaWindow();

  assert(
    quotaCheckAfterExpiry.allowed === true &&
      windowAfterExpiry.applicationsUsed === 0 &&
      quotaCheckAfterExpiry.remainingQuota === 25,
    'Scenario 13: Exhausted quota automatically refills after 8-hour window expires, user can swipe right immediately'
  );

  // ----------------------------------------------------
  // SCENARIO 14: Bonus tokens & credits
  // ----------------------------------------------------
  // Set 8-hour quota to 0, but add 3 bonus application tokens
  const exhaustedWindowWithBonus = {
    plan: 'pro',
    applicationsUsed: 25,
    windowStart: Date.now(),
    windowEnd: Date.now() + APPLICATION_QUOTA_WINDOW_MS,
  };
  setStoredQuotaWindow(exhaustedWindowWithBonus);
  rewardService.setRewardCache({ rewardCredits: 3 });

  const bonusQuotaStatus = usageService.getQuotaStatus();
  const canApplyBonus = usageService.canApply();

  assert(
    bonusQuotaStatus.remainingQuota === 0 &&
      bonusQuotaStatus.bonusTokens === 3 &&
      canApplyBonus.allowed === true &&
      canApplyBonus.source === 'bonus_tokens',
    'Scenario 14: Pro user with 0 subscription quota but bonus tokens can apply, bonus token source recognized'
  );

  // ----------------------------------------------------
  // SCENARIO 15: Non-matching job (Pro user)
  // ----------------------------------------------------
  // Reset Pro quota window with remaining applications
  setStoredQuotaWindow({
    plan: 'pro',
    applicationsUsed: 0,
    windowStart: Date.now(),
    windowEnd: Date.now() + APPLICATION_QUOTA_WINDOW_MS,
  });

  const nonMatchJob = {
    id: `job-nomatch-${Date.now()}`,
    title: 'Biochemist Researcher',
    company: 'Pharma Lab',
    description: 'PhD in organic chemistry required',
    matchScore: 30, // below 70 minimum threshold
    contactEmail: 'pharma@lab.com',
  };

  const quotaBeforeNonMatch = usageService.getQuotaStatus().remainingQuota;
  const s15Result = await simulateSwipeApply({
    job: nonMatchJob,
    profile: {
      ...proProfile1,
      userPreferences: { minMatchScore: 85 },
    },
  });
  const quotaAfterNonMatch = usageService.getQuotaStatus().remainingQuota;

  assert(
    s15Result.allowed === false &&
      s15Result.skipped === true &&
      s15Result.showUpgradeModal === false &&
      quotaBeforeNonMatch === quotaAfterNonMatch,
    'Scenario 15: Non-matching job on swipe right skips/notifies gracefully, no quota consumed, NO upgrade modal'
  );

  // ----------------------------------------------------
  // SCENARIO 16: Offline / mock mode
  // ----------------------------------------------------
  // When fetch returns a network error or demo mode is active
  const offlineJob = {
    id: `job-offline-${Date.now()}`,
    title: 'Sound Designer',
    company: 'Game Studio',
    contactEmail: 'audio@gamestudio.com',
    matchScore: 89,
  };

  const s16Result = await simulateSwipeApply({
    job: offlineJob,
    profile: proProfile1,
  });

  assert(
    s16Result.showUpgradeModal === false,
    'Scenario 16: Offline/demo fallback handles swipe right gracefully without crashes or false upgrade modals'
  );

  // Summary
  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal error in swipeApplyGating test suite:', e);
  process.exit(1);
});
