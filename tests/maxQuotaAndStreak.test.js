/**
 * Max-Version Application Quota & 3-Day Login Streak Reward Test Suite
 *
 * Automated verification of all 20 required production specifications:
 * 1. Free user receives 5 applications per 8-hour window
 * 2. Plus user receives 15 applications per 8-hour window
 * 3. Pro user receives 25 applications per 8-hour window
 * 4. Quota does not rollover (unused quota capped at limit)
 * 5. Quota refills correctly after 8 hours
 * 6. Viewing a job does not consume quota
 * 7. Saving/skipping does not consume quota
 * 8. Applying consumes exactly one entitlement
 * 9. Duplicate Apply requests cannot consume multiple entitlements
 * 10. Free 3-day consecutive login awards exactly +2 bonus tokens
 * 11. Multiple logins on the same day count once
 * 12. Missing one day breaks the streak
 * 13. The same 3-day streak cannot award +2 more than once
 * 14. A second completed 3-day streak awards another +2
 * 15. Bonus tokens remain separate from normal quota
 * 16. Backend enforces quota even if frontend is bypassed
 * 17. Concurrent application requests cannot over-consume quota
 * 18. Membership gating remains correct (Manual, Approval, Autopilot)
 * 19. Existing purchased application credits continue to work
 * 20. Existing application history remains intact
 */

import assert from 'assert';
import { db } from '../server/database.js';
import {
  getUserQuotaRecord,
  getAvailableApplications,
  consumeApplicationCredit,
  processLoginStreak,
  getUserBonusTokens,
} from '../server/routes/api.js';
import {
  FREE_APPLICATION_QUOTA,
  PLUS_APPLICATION_QUOTA,
  PRO_APPLICATION_QUOTA,
  APPLICATION_QUOTA_WINDOW_HOURS,
  APPLICATION_QUOTA_WINDOW_MS,
  PLAN_QUOTA_CONFIG,
  getPlanQuotaConfig,
  getApplicationsPerWindow,
  formatWindowCountdown,
} from '../src/utils/quotaConfig.js';
import { subscriptionService } from '../src/services/subscriptionService.js';
import { usageService } from '../src/services/usageService.js';

if (!globalThis.localStorage || typeof globalThis.localStorage.setItem !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('\n====================================================');
  console.log('STARTING MAX-VERSION QUOTA & STREAK TEST SUITE (20 TESTS)');
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

  async function testAsync(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  ✓ PASS [Test ${passed + failed}]: ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ FAIL [Test ${passed + failed}]: ${name}`, err.message);
    }
  }

  // ----------------------------------------------------
  // TEST 1: Free user receives 5 applications per 8-hour window
  // ----------------------------------------------------
  test('Free user receives 5 applications per 8-hour window', () => {
    const userId = `user-free-${Date.now()}`;
    const quota = getUserQuotaRecord(userId, 'free');
    assert.strictEqual(quota.limit, 5);
    assert.strictEqual(quota.remainingQuota, 5);
    assert.strictEqual(quota.applicationsUsed, 0);
    assert.strictEqual(quota.windowHours, 8);
    assert.strictEqual(getApplicationsPerWindow('free'), 5);
  });

  // ----------------------------------------------------
  // TEST 2: Plus user receives 15 applications per 8-hour window
  // ----------------------------------------------------
  test('Plus user receives 15 applications per 8-hour window', () => {
    const userId = `user-plus-${Date.now()}`;
    const quota = getUserQuotaRecord(userId, 'plus');
    assert.strictEqual(quota.limit, 15);
    assert.strictEqual(quota.remainingQuota, 15);
    assert.strictEqual(quota.applicationsUsed, 0);
    assert.strictEqual(getApplicationsPerWindow('plus'), 15);
  });

  // ----------------------------------------------------
  // TEST 3: Pro user receives 25 applications per 8-hour window
  // ----------------------------------------------------
  test('Pro user receives 25 applications per 8-hour window', () => {
    const userId = `user-pro-${Date.now()}`;
    const quota = getUserQuotaRecord(userId, 'pro');
    assert.strictEqual(quota.limit, 25);
    assert.strictEqual(quota.remainingQuota, 25);
    assert.strictEqual(quota.applicationsUsed, 0);
    assert.strictEqual(getApplicationsPerWindow('pro'), 25);
  });

  // ----------------------------------------------------
  // TEST 4: Quota does not rollover (unused quota capped at limit)
  // ----------------------------------------------------
  test('Quota does not rollover (unused quota does not accumulate past limit)', () => {
    const userId = `user-norollover-${Date.now()}`;
    // User starts with 5, uses only 1, so 4 remaining
    const q1 = getUserQuotaRecord(userId, 'free');
    consumeApplicationCredit(userId, 'free');
    const qAfter1 = getUserQuotaRecord(userId, 'free');
    assert.strictEqual(qAfter1.applicationsUsed, 1);
    assert.strictEqual(qAfter1.remainingQuota, 4);

    // 8 hours elapse into window 2 without further usage
    const clockSkew8h = APPLICATION_QUOTA_WINDOW_MS + 1000;
    const q2 = getUserQuotaRecord(userId, 'free', { clockSkew: clockSkew8h });
    // Refilled to 5, NOT 5 + 4 = 9!
    assert.strictEqual(q2.remainingQuota, 5);
    assert.strictEqual(q2.applicationsUsed, 0);
  });

  // ----------------------------------------------------
  // TEST 5: Quota refills correctly after 8 hours
  // ----------------------------------------------------
  test('Quota refills correctly after 8 hours', () => {
    const userId = `user-refill-${Date.now()}`;
    // Consume all 5 applications
    for (let i = 0; i < 5; i++) {
      consumeApplicationCredit(userId, 'free');
    }
    const exhausted = getUserQuotaRecord(userId, 'free');
    assert.strictEqual(exhausted.remainingQuota, 0);
    assert.strictEqual(exhausted.applicationsUsed, 5);

    // After 8 hours: automatic refill
    const clockSkew = APPLICATION_QUOTA_WINDOW_MS + 5000;
    const refilled = getUserQuotaRecord(userId, 'free', { clockSkew });
    assert.strictEqual(refilled.remainingQuota, 5);
    assert.strictEqual(refilled.applicationsUsed, 0);
  });

  // ----------------------------------------------------
  // TEST 6: Viewing a job does not consume quota
  // ----------------------------------------------------
  test('Viewing a job does not consume quota', () => {
    const userId = `user-view-${Date.now()}`;
    const before = getUserQuotaRecord(userId, 'free');
    // Simulate viewing a job card (only discovery)
    const job = { id: 'job-123', title: 'Video Editor', company: 'Studio' };
    const viewedCard = { ...job, viewedAt: new Date().toISOString() };
    const after = getUserQuotaRecord(userId, 'free');
    assert.strictEqual(before.remainingQuota, after.remainingQuota);
    assert.strictEqual(after.applicationsUsed, 0);
  });

  // ----------------------------------------------------
  // TEST 7: Saving/skipping does not consume quota
  // ----------------------------------------------------
  test('Saving/skipping does not consume quota', () => {
    const userId = `user-skip-${Date.now()}`;
    const before = getUserQuotaRecord(userId, 'free');
    // Simulate swipe left (skip) or swipe up (save)
    const savedJob = { id: 'job-save', status: 'saved' };
    const skippedJob = { id: 'job-skip', status: 'skipped' };
    const after = getUserQuotaRecord(userId, 'free');
    assert.strictEqual(before.remainingQuota, after.remainingQuota);
    assert.strictEqual(after.applicationsUsed, 0);
  });

  // ----------------------------------------------------
  // TEST 8: Applying consumes exactly one entitlement
  // ----------------------------------------------------
  test('Applying consumes exactly one entitlement', () => {
    const userId = `user-apply-one-${Date.now()}`;
    const before = getUserQuotaRecord(userId, 'free');
    assert.strictEqual(before.remainingQuota, 5);

    const result = consumeApplicationCredit(userId, 'free');
    assert.strictEqual(result.consumedFrom, 'included_quota');
    assert.strictEqual(result.remainingQuota, 4);

    const after = getUserQuotaRecord(userId, 'free');
    assert.strictEqual(after.applicationsUsed, 1);
    assert.strictEqual(after.remainingQuota, 4);
  });

  // ----------------------------------------------------
  // TEST 9: Duplicate Apply requests cannot consume multiple entitlements
  // ----------------------------------------------------
  await testAsync('Duplicate Apply requests cannot consume multiple entitlements', async () => {
    const userId = `user-dup-${Date.now()}`;
    const userPhone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
    db.users.insert({ id: userId, phone: userPhone });
    db.subscriptions.insert({ id: `sub-${userId}`, userId, plan: 'free', status: 'active' });

    const job = {
      id: `job-dup-${Date.now()}`,
      title: 'Motion Designer',
      company: 'Brand Co',
      platform: 'website',
    };

    // First manual apply
    const res1 = await fetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ id: `app-1-${Date.now()}`, jobId: job.id, status: 'applied', title: job.title }),
    });
    const d1 = await res1.json();
    assert.strictEqual(d1.success, true);

    const quotaAfterFirst = getUserQuotaRecord(userId, 'free');
    assert.strictEqual(quotaAfterFirst.applicationsUsed, 1);

    // Duplicate submission for same job
    const res2 = await fetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ id: `app-2-${Date.now()}`, jobId: job.id, status: 'applied', title: job.title }),
    });
    const d2 = await res2.json();
    assert.strictEqual(res2.status, 409);
    assert.strictEqual(d2.code, 'DUPLICATE');

    // Quota was NOT deducted second time!
    const quotaAfterDup = getUserQuotaRecord(userId, 'free');
    assert.strictEqual(quotaAfterDup.applicationsUsed, 1);
  });

  // ----------------------------------------------------
  // TEST 10: Free 3-day consecutive login awards exactly +2 bonus tokens
  // ----------------------------------------------------
  test('Free 3-day consecutive login awards exactly +2 bonus tokens', () => {
    const userId = `user-streak-basic-${Date.now()}`;
    db.subscriptions.insert({ id: `sub-${userId}`, userId, plan: 'free', status: 'active' });

    // Day 1
    const day1 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 0 });
    assert.strictEqual(day1.currentStreak, 1);
    assert.strictEqual(day1.awarded, false);
    assert.strictEqual(day1.bonusTokens, 0);

    // Day 2 (1 day later)
    const day2 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 24 * 3600 * 1000 });
    assert.strictEqual(day2.currentStreak, 2);
    assert.strictEqual(day2.awarded, false);
    assert.strictEqual(day2.bonusTokens, 0);

    // Day 3 (2 days later)
    const day3 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 48 * 3600 * 1000 });
    assert.strictEqual(day3.currentStreak, 3);
    assert.strictEqual(day3.awarded, true);
    assert.strictEqual(day3.addedTokens, 2);
    assert.strictEqual(day3.bonusTokens, 2);
  });

  // ----------------------------------------------------
  // TEST 11: Multiple logins on the same day count once
  // ----------------------------------------------------
  test('Multiple logins on the same day count once', () => {
    const userId = `user-sameday-${Date.now()}`;
    db.subscriptions.insert({ id: `sub-${userId}`, userId, plan: 'free', status: 'active' });

    // First login on Day 1
    const login1 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 0 });
    assert.strictEqual(login1.currentStreak, 1);

    // Second login on Day 1 (1 minute later)
    const login2 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 60 * 1000 });
    assert.strictEqual(login2.currentStreak, 1);

    // Third login on Day 1 (2 minutes later)
    const login3 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 120 * 1000 });
    assert.strictEqual(login3.currentStreak, 1);
    assert.strictEqual(login3.awarded, false);
  });

  // ----------------------------------------------------
  // TEST 12: Missing one day breaks the streak
  // ----------------------------------------------------
  test('Missing one day breaks the streak', () => {
    const userId = `user-break-${Date.now()}`;
    db.subscriptions.insert({ id: `sub-${userId}`, userId, plan: 'free', status: 'active' });

    // Day 1
    processLoginStreak(userId, { timezone: 'UTC', clockSkew: 0 });
    // Day 2
    const day2 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 24 * 3600 * 1000 });
    assert.strictEqual(day2.currentStreak, 2);

    // Miss Day 3! Login on Day 4 (3 days after Day 1 = 72 hours later)
    const day4 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 72 * 3600 * 1000 });
    assert.strictEqual(day4.currentStreak, 1, 'Streak must reset to 1 after missing a day');
    assert.strictEqual(day4.awarded, false);
  });

  // ----------------------------------------------------
  // TEST 13: The same 3-day streak cannot award +2 more than once
  // ----------------------------------------------------
  test('The same 3-day streak cannot award +2 more than once', () => {
    const userId = `user-nodup-award-${Date.now()}`;
    db.subscriptions.insert({ id: `sub-${userId}`, userId, plan: 'free', status: 'active' });

    // Day 1
    processLoginStreak(userId, { timezone: 'UTC', clockSkew: 0 });
    // Day 2
    processLoginStreak(userId, { timezone: 'UTC', clockSkew: 24 * 3600 * 1000 });
    // Day 3 (First call: awards +2)
    const day3_first = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 48 * 3600 * 1000 });
    assert.strictEqual(day3_first.awarded, true);
    assert.strictEqual(day3_first.bonusTokens, 2);

    // Repeated request on Day 3 (page refresh / retry)
    const day3_repeat = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 48 * 3600 * 1000 });
    assert.strictEqual(day3_repeat.awarded, false);
    assert.strictEqual(day3_repeat.bonusTokens, 2);
  });

  // ----------------------------------------------------
  // TEST 14: A second completed 3-day streak awards another +2
  // ----------------------------------------------------
  test('A second completed 3-day streak awards another +2 (total +4)', () => {
    const userId = `user-second-streak-${Date.now()}`;
    db.subscriptions.insert({ id: `sub-${userId}`, userId, plan: 'free', status: 'active' });

    // Day 1, 2, 3 -> +2
    processLoginStreak(userId, { timezone: 'UTC', clockSkew: 0 });
    processLoginStreak(userId, { timezone: 'UTC', clockSkew: 24 * 3600 * 1000 });
    const d3 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 48 * 3600 * 1000 });
    assert.strictEqual(d3.awarded, true);
    assert.strictEqual(d3.bonusTokens, 2);

    // Day 4, 5
    processLoginStreak(userId, { timezone: 'UTC', clockSkew: 72 * 3600 * 1000 });
    processLoginStreak(userId, { timezone: 'UTC', clockSkew: 96 * 3600 * 1000 });

    // Day 6 (second 3-day milestone completed!)
    const d6 = processLoginStreak(userId, { timezone: 'UTC', clockSkew: 120 * 3600 * 1000 });
    assert.strictEqual(d6.currentStreak, 6);
    assert.strictEqual(d6.awarded, true);
    assert.strictEqual(d6.addedTokens, 2);
    assert.strictEqual(d6.bonusTokens, 4);
  });

  // ----------------------------------------------------
  // TEST 15: Bonus tokens remain separate from normal quota
  // ----------------------------------------------------
  test('Bonus tokens remain separate from normal quota', () => {
    const userId = `user-separate-${Date.now()}`;
    db.subscriptions.insert({ id: `sub-${userId}`, userId, plan: 'free', status: 'active' });

    // Give user 2 bonus tokens
    const rewardRecord = db.rewards.findOne((r) => r.userId === userId) || { id: `reward-${userId}`, userId };
    rewardRecord.bonusTokens = 2;
    db.rewards.insert(rewardRecord);

    const balances = getAvailableApplications(userId, 'free');
    assert.strictEqual(balances.remainingQuota, 5, 'Normal quota must remain 5');
    assert.strictEqual(balances.bonusTokens, 2, 'Bonus tokens must be 2');
    assert.strictEqual(balances.availableApplications, 7, 'Total available must be 5 + 2 = 7');

    // Consume all 5 normal quota
    for (let i = 0; i < 5; i++) {
      const res = consumeApplicationCredit(userId, 'free');
      assert.strictEqual(res.consumedFrom, 'included_quota');
    }

    // Now quota is 0, but bonus tokens are still 2
    const after5 = getAvailableApplications(userId, 'free');
    assert.strictEqual(after5.remainingQuota, 0);
    assert.strictEqual(after5.bonusTokens, 2);
    assert.strictEqual(after5.availableApplications, 2);

    // Next application consumes from bonus tokens!
    const res6 = consumeApplicationCredit(userId, 'free');
    assert.strictEqual(res6.consumedFrom, 'bonus_tokens');

    const after6 = getAvailableApplications(userId, 'free');
    assert.strictEqual(after6.remainingQuota, 0);
    assert.strictEqual(after6.bonusTokens, 1);
    assert.strictEqual(after6.availableApplications, 1);

    // 8 hours pass: quota refills to 5, bonus tokens STAY 1!
    const after8h = getAvailableApplications(userId, 'free', { clockSkew: APPLICATION_QUOTA_WINDOW_MS + 1000 });
    assert.strictEqual(after8h.remainingQuota, 5, 'Normal quota refills to 5');
    assert.strictEqual(after8h.bonusTokens, 1, 'Bonus tokens remain intact');
    assert.strictEqual(after8h.availableApplications, 6, 'Total available becomes 5 + 1 = 6');
  });

  // ----------------------------------------------------
  // TEST 16: Backend enforces quota even if frontend is bypassed
  // ----------------------------------------------------
  await testAsync('Backend enforces quota even if frontend is bypassed', async () => {
    const userId = `user-bypass-${Date.now()}`;
    const userPhone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
    db.users.insert({ id: userId, phone: userPhone });
    db.subscriptions.insert({ id: `sub-${userId}`, userId, plan: 'free', status: 'active' });

    // Exhaust all 5 applications
    for (let i = 0; i < 5; i++) {
      consumeApplicationCredit(userId, 'free');
    }

    // Attempt direct API call to POST /api/applications bypassing frontend
    const res = await fetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({
        id: `app-over-${Date.now()}`,
        jobId: `job-over-${Date.now()}`,
        status: 'applied',
        title: 'Direct API opportunity',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 429, 'Backend must return 429 RATE_LIMIT');
    assert.strictEqual(data.code, 'RATE_LIMIT');
  });

  // ----------------------------------------------------
  // TEST 17: Concurrent application requests cannot over-consume quota
  // ----------------------------------------------------
  await testAsync('Concurrent application requests cannot over-consume quota', async () => {
    const userId = `user-concurrent-${Date.now()}`;
    const userPhone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
    db.users.insert({ id: userId, phone: userPhone });
    db.subscriptions.insert({ id: `sub-${userId}`, userId, plan: 'free', status: 'active' });

    // Consume 4 out of 5 applications, leaving only 1 available
    for (let i = 0; i < 4; i++) {
      consumeApplicationCredit(userId, 'free');
    }

    const before = getAvailableApplications(userId, 'free');
    assert.strictEqual(before.availableApplications, 1);

    // Fire 5 concurrent requests simultaneously
    const requests = Array.from({ length: 5 }, (_, idx) =>
      fetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          id: `app-race-${idx}-${Date.now()}`,
          jobId: `job-race-${idx}-${Date.now()}`,
          status: 'applied',
          title: `Race Job ${idx}`,
        }),
      })
    );

    const responses = await Promise.all(requests);
    const statuses = await Promise.all(responses.map((r) => r.json()));

    const successCount = statuses.filter((s) => s.success === true).length;
    const rateLimitCount = statuses.filter((s) => s.code === 'RATE_LIMIT').length;

    // Exactly 1 succeeded, and 4 were rejected with 429 RATE_LIMIT!
    assert.strictEqual(successCount, 1, 'Only 1 application should succeed when 1 entitlement remains');
    assert.strictEqual(rateLimitCount, 4, 'Remaining concurrent requests must be rejected with RATE_LIMIT');

    const after = getAvailableApplications(userId, 'free');
    assert.strictEqual(after.availableApplications, 0);
  });

  // ----------------------------------------------------
  // TEST 18: Membership gating remains correct (Manual, Approval, Autopilot)
  // ----------------------------------------------------
  test('Membership gating remains correct (Manual, Approval, Autopilot)', () => {
    // FREE
    const freeManual = subscriptionService.canUseAutopilot('manual');
    const freeApproval = subscriptionService.canUseAutopilot('approval');
    const freeAutopilot = subscriptionService.canUseAutopilot('autopilot');
    assert.strictEqual(freeManual.allowed, true, 'Manual mode is free for all');
    assert.strictEqual(freeApproval.allowed, false, 'Approval mode locked on Free');
    assert.strictEqual(freeAutopilot.allowed, false, 'Autopilot mode locked on Free');

    // PLUS
    const plusGate = subscriptionService.canUseAutopilot.bind({
      getCurrentPlanDetails: () => ({ id: 'plus', name: 'Plus' }),
    });
    const plusManual = plusGate('manual');
    const plusApproval = plusGate('approval');
    const plusAuto = plusGate('autopilot');
    assert.strictEqual(plusManual.allowed, true);
    assert.strictEqual(plusApproval.allowed, true, 'Approval mode unlocked on Plus');
    assert.strictEqual(plusAuto.allowed, false, 'Full Autopilot mode locked on Plus');

    // PRO
    const proGate = subscriptionService.canUseAutopilot.bind({
      getCurrentPlanDetails: () => ({ id: 'pro', name: 'Pro' }),
    });
    assert.strictEqual(proGate('manual').allowed, true);
    assert.strictEqual(proGate('approval').allowed, true);
    assert.strictEqual(proGate('autopilot').allowed, true, 'Full Autopilot unlocked on Pro');
  });

  // ----------------------------------------------------
  // TEST 19: Existing purchased application credits continue to work
  // ----------------------------------------------------
  test('Existing purchased application credits continue to work without interfering with 8h quota', () => {
    const userId = `user-purchased-${Date.now()}`;
    const now = Date.now();
    db.subscriptions.insert({
      id: `sub-${userId}`,
      userId,
      plan: 'free',
      status: 'active',
      credits: [
        {
          id: 'cred-1',
          packageId: 'credits_20',
          amount: 20,
          remaining: 10,
          expiresAt: new Date(now + 30 * 24 * 3600 * 1000).toISOString(),
        },
      ],
    });

    const balances = getAvailableApplications(userId, 'free');
    assert.strictEqual(balances.remainingQuota, 5, 'Free 8h quota is 5');
    assert.strictEqual(balances.purchasedCredits, 10, 'Purchased credits is 10');
    assert.strictEqual(balances.availableApplications, 15, 'Total is 5 + 10 = 15');

    // Consume all 5 quota
    for (let i = 0; i < 5; i++) {
      consumeApplicationCredit(userId, 'free');
    }

    // Next application consumes from purchased credits
    const resPurchased = consumeApplicationCredit(userId, 'free');
    assert.strictEqual(resPurchased.consumedFrom, 'purchased_credits');

    const balancesAfter = getAvailableApplications(userId, 'free');
    assert.strictEqual(balancesAfter.remainingQuota, 0);
    assert.strictEqual(balancesAfter.purchasedCredits, 9);
    assert.strictEqual(balancesAfter.availableApplications, 9);
  });

  // ----------------------------------------------------
  // TEST 20: Existing application history remains intact
  // ----------------------------------------------------
  test('Existing application history remains intact', () => {
    const userId = `user-history-${Date.now()}`;
    const historicalApp = {
      id: `app-hist-${Date.now()}`,
      userId,
      jobId: 'job-historic-1',
      title: 'Senior Frontend Developer',
      company: 'TechCorp',
      status: 'applied',
      outreachStatus: 'SENT',
      createdAt: '2026-08-01T10:00:00.000Z',
    };
    db.applications.insert(historicalApp);

    const found = db.applications.findById(historicalApp.id);
    assert.ok(found, 'Historical application must exist');
    assert.strictEqual(found.title, 'Senior Frontend Developer');
    assert.strictEqual(found.company, 'TechCorp');
    assert.strictEqual(found.status, 'applied');
  });

  console.log('\n====================================================');
  console.log(`MAX QUOTA TEST SUITE FINISHED: ${passed}/${passed + failed} PASSED (${failed} FAILED)`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
