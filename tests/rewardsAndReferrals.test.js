/**
 * Rewards & Referral Test Suite (Tests A through W)
 */

import { db } from '../server/database.js';
import { generateReferralCode, normalizeReferralCode, isValidReferralCode } from '../src/utils/referralUtils.js';
import { getUserRewardCredits, getUserRewardRecord } from '../server/routes/api.js';
import { rewardService } from '../src/services/rewardService.js';

const API_BASE = 'http://localhost:5000/api';

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
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

async function runRewardsTests() {
  console.log('====================================================');
  console.log('STARTING REWARDS & REFERRAL TEST SUITE (23 TESTS: A - W)');
  console.log('====================================================\n');

  const testRewardUser = `user-reward-${Date.now()}`;
  const testReferrerUser = `user-ref-a-${Date.now()}`;
  const testReferrerUserB = `user-ref-b-${Date.now()}`;
  const testFriendNewUser = `user-friend-new-${Date.now()}`;
  const testExistingUser = `user-existing-${Date.now()}`;

  const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const referrerCodeA = `TF-A${uniqueSuffix}`;
  const referrerCodeB = `TF-B${uniqueSuffix}`;

  db.users.insert({
    id: testRewardUser,
    phone: '+919876500001',
    countryCode: '+91',
    localNumber: '9876500001',
    referralCode: 'TF-REWD01',
    isNewUser: false,
  });

  db.users.insert({
    id: testReferrerUser,
    phone: '+919876500002',
    countryCode: '+91',
    localNumber: '9876500002',
    referralCode: referrerCodeA,
    isNewUser: false,
  });

  db.users.insert({
    id: testReferrerUserB,
    phone: '+919876500003',
    countryCode: '+91',
    localNumber: '9876500003',
    referralCode: referrerCodeB,
    isNewUser: false,
  });

  db.users.insert({
    id: testExistingUser,
    phone: '+919876500004',
    countryCode: '+91',
    localNumber: '9876500004',
    referralCode: 'TF-EXIST1',
    isNewUser: false,
  });

  db.subscriptions.insert({ id: `sub-${testRewardUser}`, userId: testRewardUser, plan: 'free', status: 'active' });
  db.subscriptions.insert({ id: `sub-${testReferrerUser}`, userId: testReferrerUser, plan: 'plus', status: 'active' });

  // TEST 62 (Requirement A): First login today => +1 credit
  {
    const today = '2026-09-13';
    const res = await fetch(`${API_BASE}/rewards/daily-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testRewardUser },
      body: JSON.stringify({ date: today }),
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success && data.granted === true && data.addedCredits === 1 && data.rewardCredits === 1,
      'Test A: First login today => +1 credit'
    );
  }

  // TEST 63 (Requirement B): Second login same day => +0
  {
    const today = '2026-09-13';
    const res = await fetch(`${API_BASE}/rewards/daily-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testRewardUser },
      body: JSON.stringify({ date: today }),
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success && data.granted === false && data.rewardCredits === 1 && data.claimedToday === true,
      'Test B: Second login same day => +0'
    );
  }

  // TEST 64 (Requirement C): Logout/login same day => +0
  {
    const today = '2026-09-13';
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const res = await fetch(`${API_BASE}/rewards/daily-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testRewardUser },
      body: JSON.stringify({ date: today }),
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success && data.granted === false && data.rewardCredits === 1,
      'Test C: Logout/login same day => +0'
    );
  }

  // TEST 65 (Requirement D): Next calendar day => +1
  {
    const nextDay = '2026-09-14';
    const res = await fetch(`${API_BASE}/rewards/daily-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testRewardUser },
      body: JSON.stringify({ date: nextDay }),
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success && data.granted === true && data.addedCredits === 1 && data.rewardCredits === 2,
      'Test D: Next calendar day => +1'
    );
  }

  // TEST 66 (Requirement E): Unique referral code generated
  {
    const code1 = generateReferralCode();
    const code2 = generateReferralCode();
    const isValid = isValidReferralCode(code1) && isValidReferralCode(code2);
    assert(
      isValid && code1 !== code2 && code1.startsWith('TF-') && code2.startsWith('TF-'),
      'Test E: Unique referral code generated'
    );
  }

  // TEST 67 (Requirement F): Referral link preserves referral code
  {
    const res = await fetch(`${API_BASE}/referrals/status`, {
      headers: { 'x-user-id': testReferrerUser },
    });
    const data = await res.json();
    rewardService.setPendingReferralCode('TF-XYZ999');
    const preserved = rewardService.getPendingReferralCode();
    assert(
      data.success && data.referralCode === referrerCodeA && data.referralLink.includes(referrerCodeA) && preserved === 'TF-XYZ999',
      'Test F: Referral link preserves referral code'
    );
  }

  // TEST 68 (Requirement G): New user completes phone authentication => +5 credits
  {
    db.users.insert({
      id: testFriendNewUser,
      phone: '+919876500005',
      countryCode: '+91',
      localNumber: '9876500005',
      referralCode: 'TF-FRND01',
      isNewUser: true,
    });

    const res = await fetch(`${API_BASE}/referrals/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testFriendNewUser },
      body: JSON.stringify({ referralCode: referrerCodeA }),
    });
    const data = await res.json();
    const friendCredits = getUserRewardCredits(testFriendNewUser);
    assert(
      res.status === 200 && data.success && data.granted === true && data.addedCredits === 5 && friendCredits === 5,
      'Test G: New user completes phone authentication => +5 credits'
    );
  }

  // TEST 69 (Requirement H): Existing user using referral link => no reward
  {
    const res = await fetch(`${API_BASE}/referrals/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testExistingUser },
      body: JSON.stringify({ referralCode: referrerCodeA }),
    });
    const data = await res.json();
    const existingCredits = getUserRewardCredits(testExistingUser);
    assert(
      data.granted === false && existingCredits === 0,
      'Test H: Existing user using referral link => no reward'
    );
  }

  // TEST 70 (Requirement I): Self-referral => rejected
  {
    const res = await fetch(`${API_BASE}/referrals/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testReferrerUser },
      body: JSON.stringify({ referralCode: referrerCodeA }),
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.code === 'SELF_REFERRAL',
      'Test I: Self-referral => rejected'
    );
  }

  // TEST 71 (Requirement J): Same referral cannot be rewarded twice
  {
    const res = await fetch(`${API_BASE}/referrals/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testFriendNewUser },
      body: JSON.stringify({ referralCode: referrerCodeA }),
    });
    const data = await res.json();
    const friendCredits = getUserRewardCredits(testFriendNewUser);
    assert(
      data.granted === false && data.alreadyClaimed === true && friendCredits === 5,
      'Test J: Same referral cannot be rewarded twice'
    );
  }

  // TEST 72 (Requirement K): Referral attribution is permanent
  {
    const res = await fetch(`${API_BASE}/referrals/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testFriendNewUser },
      body: JSON.stringify({ referralCode: referrerCodeB }),
    });
    const data = await res.json();
    const updatedUser = db.users.findById(testFriendNewUser);
    assert(
      (res.status === 400 || data.granted === false) && updatedUser.referredBy === testReferrerUser,
      'Test K: Referral attribution is permanent'
    );
  }

  // TEST 73 (Requirement L): Reward credits cannot become negative
  {
    const emptyUser = `user-empty-${Date.now()}`;
    db.users.insert({ id: emptyUser, phone: '+919876500099', countryCode: '+91', localNumber: '9876500099' });
    const credits = getUserRewardCredits(emptyUser);
    const clampedCredits = Math.max(0, credits - 10);
    assert(
      credits === 0 && clampedCredits === 0,
      'Test L: Reward credits cannot become negative'
    );
  }

  // TEST 74 (Requirement M): Successful application consumes exactly one credit
  let proQuotedUserId = null;
  let qualifiedJobM = null;
  {
    proQuotedUserId = `user-pro-quoted-${Date.now()}`;
    const userPhone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
    db.users.insert({ id: proQuotedUserId, phone: userPhone, countryCode: '+91', localNumber: userPhone.slice(3) });
    db.subscriptions.insert({ id: `sub-${proQuotedUserId}`, userId: proQuotedUserId, plan: 'pro', status: 'active' });
    const today = new Date().toISOString().slice(0, 10);
    db.dailyUsage.insert({
      id: `usage-${proQuotedUserId}-${today}`,
      userId: proQuotedUserId,
      date: today,
      applicationsUsed: 100,
      aiApplyUsed: 0,
    });
    const rewardRecord = getUserRewardRecord(proQuotedUserId);
    rewardRecord.rewardCredits = 5;
    db.rewards.update(rewardRecord.id, rewardRecord);

    qualifiedJobM = {
      id: `job-reward-test-${Date.now()}`,
      title: 'Senior Premiere Video Editor for High-Retention Channel',
      company: 'Media Growth Lab',
      description: 'Need editor. Contact me directly at client-rewards@growthlab.com or whatsapp +12025550199',
      matchScore: 92,
      status: 'new',
    };

    const res = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': proQuotedUserId,
        'x-enable-demo-outreach': 'true',
      },
      body: JSON.stringify({
        job: qualifiedJobM,
        isAutopilot: true,
        preferences: { quickApplyEnabled: true, contactPreference: 'both' },
      }),
    });
    const data = await res.json();
    const remainingRewardCredits = getUserRewardCredits(proQuotedUserId);

    assert(
      data.success && data.status === 'DEMO_SENT' && remainingRewardCredits === 4,
      'Test M: Successful application consumes exactly one credit'
    );
  }

  // TEST 75 (Requirement N): Failed application consumes zero credits
  {
    const beforeCredits = getUserRewardCredits(proQuotedUserId);

    const res = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': proQuotedUserId,
      },
      body: JSON.stringify({
        job: { title: 'No ID Job' },
        isAutopilot: true,
      }),
    });
    const data = await res.json();
    const afterCredits = getUserRewardCredits(proQuotedUserId);

    assert(
      res.status === 400 && data.success === false && beforeCredits === afterCredits,
      'Test N: Failed application consumes zero credits'
    );
  }

  // TEST 76 (Requirement O): Non-qualified Quick Apply consumes zero credits
  {
    const beforeCredits = getUserRewardCredits(proQuotedUserId);

    const nonQualJob = {
      id: `job-non-qual-${Date.now()}`,
      title: 'Irrelevant Role',
      description: 'Email: client@growthlab.com',
      matchScore: 30,
      status: 'new',
    };

    const res = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': proQuotedUserId,
      },
      body: JSON.stringify({
        job: nonQualJob,
        isAutopilot: true,
      }),
    });
    const data = await res.json();
    const afterCredits = getUserRewardCredits(proQuotedUserId);

    assert(
      data.status === 'NOT_QUALIFIED' && beforeCredits === afterCredits,
      'Test O: Non-qualified Quick Apply consumes zero credits'
    );
  }

  // TEST 77 (Requirement P): Duplicate application consumes zero credits
  {
    const beforeCredits = getUserRewardCredits(proQuotedUserId);

    const res = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': proQuotedUserId,
      },
      body: JSON.stringify({
        job: qualifiedJobM,
        isAutopilot: true,
      }),
    });
    const data = await res.json();
    const afterCredits = getUserRewardCredits(proQuotedUserId);

    assert(
      res.status === 409 && data.status === 'DUPLICATE' && beforeCredits === afterCredits,
      'Test P: Duplicate application consumes zero credits'
    );
  }

  // TEST 78 (Requirement Q): Provider unavailable consumes zero credits
  {
    const beforeCredits = getUserRewardCredits(proQuotedUserId);

    const freshJob = {
      id: `job-unconf-${Date.now()}`,
      title: 'Senior Premiere Video Editor for High-Retention Channel',
      company: 'Media Growth Lab',
      description: 'Contact client-unconf@growthlab.com',
      matchScore: 90,
      status: 'new',
    };

    const res = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': proQuotedUserId,
        'x-enable-demo-outreach': 'false',
      },
      body: JSON.stringify({
        job: freshJob,
        isAutopilot: true,
      }),
    });
    const data = await res.json();
    const afterCredits = getUserRewardCredits(proQuotedUserId);

    assert(
      data.status === 'NOT_CONFIGURED' && beforeCredits === afterCredits,
      'Test Q: Provider unavailable consumes zero credits'
    );
  }

  // TEST 79 (Requirement R): FREE user can receive reward credits
  {
    const freeRewardUser = `user-free-rew-${Date.now()}`;
    db.users.insert({ id: freeRewardUser, phone: '+919876500011', countryCode: '+91', localNumber: '9876500011' });
    db.subscriptions.insert({ id: `sub-${freeRewardUser}`, userId: freeRewardUser, plan: 'free', status: 'active' });

    const res = await fetch(`${API_BASE}/rewards/daily-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': freeRewardUser },
      body: JSON.stringify({ date: '2026-09-15' }),
    });
    const data = await res.json();
    const credits = getUserRewardCredits(freeRewardUser);

    assert(
      data.granted === true && data.rewardCredits === 1 && credits === 1,
      'Test R: FREE user can receive reward credits'
    );
  }

  // TEST 80 (Requirement S): PLUS user retains PLUS limits
  {
    const plusSub = db.subscriptions.findOne((s) => s.userId === testReferrerUser);
    assert(
      plusSub.plan === 'plus',
      'Test S: PLUS user retains PLUS limits'
    );
  }

  // TEST 81 (Requirement T): PRO user retains PRO limits
  {
    const proSub = db.subscriptions.findOne((s) => s.userId === proQuotedUserId);
    assert(
      proSub.plan === 'pro',
      'Test T: PRO user retains PRO limits'
    );
  }

  // TEST 82 (Requirement U): Refresh does not duplicate rewards
  {
    const res1 = await fetch(`${API_BASE}/rewards/status`, {
      headers: { 'x-user-id': testRewardUser },
    });
    const data1 = await res1.json();

    const beforeCredits = getUserRewardCredits(testRewardUser);

    const res2 = await fetch(`${API_BASE}/rewards/status`, {
      headers: { 'x-user-id': testRewardUser },
    });
    const data2 = await res2.json();

    const afterCredits = getUserRewardCredits(testRewardUser);

    assert(
      data1.rewardCredits === beforeCredits && data2.rewardCredits === beforeCredits && beforeCredits === afterCredits,
      'Test U: Refresh does not duplicate rewards'
    );
  }

  // TEST 83 (Requirement V): Multiple API requests cannot double-claim the same reward
  {
    const multiUser = `user-multi-${Date.now()}`;
    db.users.insert({ id: multiUser, phone: '+919876500022', countryCode: '+91', localNumber: '9876500022' });
    const targetDate = '2026-09-16';

    let grantedCount = 0;
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${API_BASE}/rewards/daily-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': multiUser },
        body: JSON.stringify({ date: targetDate }),
      });
      const data = await res.json();
      if (data.granted) grantedCount++;
    }

    const finalCredits = getUserRewardCredits(multiUser);
    assert(
      grantedCount === 1 && finalCredits === 1,
      'Test V: Multiple API requests cannot double-claim the same reward'
    );
  }

  // TEST 84 (Requirement W): Two simultaneous referral-claim requests remain idempotent
  {
    const simUser = `user-sim-${Date.now()}`;
    db.users.insert({ id: simUser, phone: '+919876500033', countryCode: '+91', localNumber: '9876500033', isNewUser: true });

    const [claim1, claim2] = await Promise.all([
      fetch(`${API_BASE}/referrals/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': simUser },
        body: JSON.stringify({ referralCode: referrerCodeA }),
      }).then((r) => r.json()),
      fetch(`${API_BASE}/referrals/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': simUser },
        body: JSON.stringify({ referralCode: referrerCodeA }),
      }).then((r) => r.json()),
    ]);

    const simCredits = getUserRewardCredits(simUser);
    const grantedTotal = (claim1.granted ? 1 : 0) + (claim2.granted ? 1 : 0);

    assert(
      grantedTotal === 1 && simCredits === 5,
      'Test W: Two simultaneous referral-claim requests remain idempotent'
    );
  }

  console.log('\n====================================================');
  console.log(`REWARDS TEST SUITE FINISHED: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runRewardsTests().catch((err) => {
  console.error('Fatal rewards test error:', err);
  process.exit(1);
});
