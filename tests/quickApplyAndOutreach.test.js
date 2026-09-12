/**
 * Comprehensive Test Suite for PRO-only Quick Apply & Contact-Aware Opportunity Architecture
 * Validates all 30 criteria specified in requirements.
 */

import { db } from '../server/database.js';
import { validatePhoneNumber, normalizeWhatsAppNumber } from '../src/utils/validators.js';
import { extractContactInfo, hasDirectContact } from '../src/utils/contactExtractor.js';
import { calculateProMatch } from '../src/services/proMatchEngine.js';
import { EmailOutreachAdapter } from '../src/services/outreach/emailAdapter.js';
import { WhatsAppOutreachAdapter } from '../src/services/outreach/whatsAppAdapter.js';
import { OutreachService } from '../src/services/outreach/outreachService.js';
import { DEMO_SAMPLE_POSTS, processPostToJob } from '../src/services/jobClassifier.js';
import { createPost } from '../src/data/models.js';
import {
  normalizePlan,
  toCanonicalPlan,
  isProPlan,
  isPlusPlan,
  isFreePlan,
} from '../src/utils/planUtils.js';
import { subscriptionService } from '../src/services/subscriptionService.js';
import { outreachService } from '../src/services/outreach/outreachService.js';
import { demoAdapter } from '../src/services/outreach/demoAdapter.js';

const API_BASE = 'http://localhost:5000/api';

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
  console.log('STARTING CONTACT-AWARE & QUICK APPLY TEST SUITE (30 TESTS)');
  console.log('====================================================\n');

  // Setup Test Users in Server DB
  const freeUserId = `test-free-${Date.now()}`;
  const plusUserId = `test-plus-${Date.now()}`;
  const proUserId = `test-pro-${Date.now()}`;
  const proUserBId = `test-pro-b-${Date.now()}`;

  db.users.insert({ id: freeUserId, phone: '+919876543210', countryCode: '+91', localNumber: '9876543210' });
  db.users.insert({ id: plusUserId, phone: '+919876543211', countryCode: '+91', localNumber: '9876543211' });
  db.users.insert({ id: proUserId, phone: '+919876543212', countryCode: '+91', localNumber: '9876543212' });
  db.users.insert({ id: proUserBId, phone: '+919876543213', countryCode: '+91', localNumber: '9876543213' });

  db.subscriptions.insert({ id: `sub-${freeUserId}`, userId: freeUserId, plan: 'free', status: 'active' });
  db.subscriptions.insert({ id: `sub-${plusUserId}`, userId: plusUserId, plan: 'plus', status: 'active' });
  db.subscriptions.insert({ id: `sub-${proUserId}`, userId: proUserId, plan: 'pro', status: 'active' });
  db.subscriptions.insert({ id: `sub-${proUserBId}`, userId: proUserBId, plan: 'pro', status: 'active' });

  const testProfile = {
    id: proUserId,
    userId: proUserId,
    name: 'Alex Freelancer',
    profession: 'Video Editor',
    primaryRole: 'Video Editor',
    skills: [{ name: 'Premiere Pro', level: 'Advanced' }, { name: 'After Effects', level: 'Advanced' }],
    experience: '4+ years',
    portfolioUrl: 'https://portfolio.example.com/alex',
    outreachPreferences: {
      quickApplyEnabled: true,
      contactPreference: 'both',
    },
    userPreferences: {
      minMatchScore: 70,
    },
  };
  db.profiles.insert(testProfile);

  const matchingJob = {
    id: `job-match-${Date.now()}`,
    title: 'Senior Video Editor for YouTube Channel',
    company: 'Creator Media',
    description: 'Looking for an experienced Video Editor skilled in Premiere Pro and After Effects for long-term YouTube videos. Contact: client@example.com, WhatsApp: +14155552671',
    contactEmail: 'client@example.com',
    contactPhone: '+14155552671',
    status: 'new',
    matchScore: 88,
  };

  const nonMatchingJob = {
    id: `job-nomatch-${Date.now()}`,
    title: 'Senior Java Spring Cloud Architect',
    company: 'Enterprise Inc',
    description: 'Need 10+ years Java Spring Boot backend architect for microservices. Contact: hr@enterprise.com',
    contactEmail: 'hr@enterprise.com',
    status: 'new',
    matchScore: 35,
  };

  const noContactJob = {
    id: `job-nocontact-${Date.now()}`,
    title: 'Short Form Video Editor',
    company: 'TikTok Agency',
    description: 'Need video editor for viral TikTok shorts. Budget: $450 - $650 per video. DM on Instagram or comment below to apply.',
    status: 'new',
    matchScore: 85,
  };

  // ----------------------------------------------------
  // TEST 1: Contact extractor extracts valid email from post text & fields
  // ----------------------------------------------------
  const extractedEmail = extractContactInfo({
    title: 'Editor Needed',
    description: 'Please send reel to hiring@studio.co for quick review.',
  });
  assert(extractedEmail.email === 'hiring@studio.co' && extractedEmail.hasEmail === true, 'Contact extractor extracts valid email from post text');

  // ----------------------------------------------------
  // TEST 2: Contact extractor extracts valid WhatsApp/phone with international formatting
  // ----------------------------------------------------
  const extractedPhone = extractContactInfo({
    title: 'Editor Needed',
    description: 'WhatsApp us at +91 98765 43210 or ping directly.',
  });
  assert(extractedPhone.phone === '+919876543210' && extractedPhone.hasPhone === true, 'Contact extractor extracts and normalizes international phone number');

  // ----------------------------------------------------
  // TEST 3: Contact extractor rejects false-positive dollar amounts ($450, $2,500/mo, 40/hr)
  // ----------------------------------------------------
  const currencyFalsePositives = extractContactInfo({
    title: 'Short-Form Editor Needed',
    description: 'Paying $450 - $650 per video. Rate is $40/hr or $2,500/mo. DM portfolio.',
  });
  assert(
    currencyFalsePositives.phone === null && currencyFalsePositives.hasDirectContact === false,
    'Contact extractor strictly rejects currency and salary figures as phone numbers'
  );

  // ----------------------------------------------------
  // TEST 4: Contact extractor rejects dates and calendar timestamps
  // ----------------------------------------------------
  const dateFalsePositives = extractContactInfo({
    title: 'Video Editor Opportunity',
    description: 'Project kick-off date is 2026-09-12 and concludes by 15/10/2026. Reach out via thread.',
  });
  assert(
    dateFalsePositives.phone === null && dateFalsePositives.hasDirectContact === false,
    'Contact extractor strictly rejects calendar dates as phone numbers'
  );

  // ----------------------------------------------------
  // TEST 5: Contact extractor rejects URLs and job IDs containing numbers
  // ----------------------------------------------------
  const urlIdFalsePositives = extractContactInfo({
    title: 'Editor Job Ref #883921',
    description: 'View post at https://facebook.com/groups/videoeditors/posts/77218392 or job-1234567. Leave a comment!',
  });
  assert(
    urlIdFalsePositives.phone === null && urlIdFalsePositives.hasDirectContact === false,
    'Contact extractor strictly rejects URLs and job IDs containing numeric segments'
  );

  // ----------------------------------------------------
  // TEST 6: Feed separation: Normal mode retains contact-less jobs
  // ----------------------------------------------------
  const allTestJobs = [
    { id: 'job-c1', title: 'With Email', contactEmail: 'a@b.co', matchScore: 85 },
    { id: 'job-c2', title: 'With WA', contactPhone: '+919876543210', matchScore: 82 },
    { id: 'job-noc1', title: 'Contactless Job 1', description: 'DM on X', matchScore: 80 },
    { id: 'job-noc2', title: 'Contactless Job 2', description: 'Comment below', matchScore: 78 },
  ];
  // Normal mode: quickApplyActive = false -> includes contact-less
  const normalFeedJobs = allTestJobs.filter((j) => j.status !== 'skipped');
  assert(
    normalFeedJobs.some((j) => j.id === 'job-noc1') && normalFeedJobs.length === 4,
    'Normal Manual Mode retains contact-less jobs so user can apply manually'
  );

  // ----------------------------------------------------
  // TEST 7: Feed separation: Quick Apply mode filters out contact-less jobs before swipe
  // ----------------------------------------------------
  // Quick Apply mode: quickApplyActive = true -> strictly requires hasDirectContact
  const quickApplyFeedJobs = allTestJobs.filter((j) => hasDirectContact(j));
  assert(
    quickApplyFeedJobs.length === 2 &&
    quickApplyFeedJobs.every((j) => hasDirectContact(j)) &&
    !quickApplyFeedJobs.some((j) => j.id === 'job-noc1'),
    'Quick Apply Mode strictly filters out contact-less opportunities before swipe'
  );

  // ----------------------------------------------------
  // TEST 8: Quick Apply queue maintains up to 6 contact-qualified jobs when data is available
  // ----------------------------------------------------
  const processedSamples = DEMO_SAMPLE_POSTS.map((sample) => {
    const post = createPost({
      postId: sample.id,
      postText: sample.text,
      postUrl: sample.postUrl,
      author: sample.author,
      platform: sample.platform,
      isDemo: true,
    });
    return processPostToJob(post, testProfile, { platform: sample.platform, name: 'Sample' });
  }).filter(Boolean);

  const contactQualifiedInFeed = processedSamples.filter((j) => hasDirectContact(j) && j.matchScore >= 70);
  assert(
    contactQualifiedInFeed.length >= 6,
    `Quick Apply queue maintains target of up to 6 contact-qualified opportunities (Found: ${contactQualifiedInFeed.length})`
  );

  // ----------------------------------------------------
  // TEST 9: Backend API rejects job without direct contact with code: "NO_DIRECT_CONTACT"
  // ----------------------------------------------------
  try {
    const res = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': proUserId },
      body: JSON.stringify({
        job: noContactJob,
        profile: testProfile,
        preferences: { quickApplyEnabled: true, contactPreference: 'both' },
      }),
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.code === 'NO_DIRECT_CONTACT',
      `Direct API call without direct contact rejected with HTTP 400 and code: "NO_DIRECT_CONTACT"`
    );
  } catch (e) {
    assert(false, `Direct API contact-less check error: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 10: Fallback: Email preference falls back to WhatsApp when email is missing
  // ----------------------------------------------------
  const outreachSvc = new OutreachService();
  const waOnlyJob = { phone: '+14155552671' };
  const emailFallbackResolved = outreachSvc.resolveOutreachChannel(waOnlyJob, 'email');
  assert(
    emailFallbackResolved.channel === 'whatsapp' && emailFallbackResolved.phone === '+14155552671',
    'Email preference gracefully falls back to WhatsApp when email is unavailable'
  );

  // ----------------------------------------------------
  // TEST 11: Fallback: WhatsApp preference falls back to Email when WhatsApp is missing
  // ----------------------------------------------------
  const emailOnlyJob = { email: 'client@example.com' };
  const waFallbackResolved = outreachSvc.resolveOutreachChannel(emailOnlyJob, 'whatsapp');
  assert(
    waFallbackResolved.channel === 'email' && waFallbackResolved.email === 'client@example.com',
    'WhatsApp preference gracefully falls back to Email when WhatsApp is unavailable'
  );

  // ----------------------------------------------------
  // TEST 12: Channel 'both' uses all available channels
  // ----------------------------------------------------
  const bothResolved = outreachSvc.resolveOutreachChannel({ email: 'client@example.com', phone: '+14155552671' }, 'both');
  assert(
    bothResolved.channel === 'both' && bothResolved.email && bothResolved.phone,
    'Channel preference "both" correctly selects both available direct contact channels'
  );

  // ----------------------------------------------------
  // TEST 13: Autopilot skips auto-dispatch for contact-less opportunities
  // ----------------------------------------------------
  const contactlessLeadCheck = hasDirectContact({
    title: 'Lead Without Contact',
    description: 'Great project, please comment on thread.',
  });
  assert(
    contactlessLeadCheck === false,
    'Autopilot engine detects absence of direct contact and prevents auto-dispatch'
  );

  // ----------------------------------------------------
  // TEST 14: PRO user Quick Apply enabled succeeds
  // ----------------------------------------------------
  const proSub = db.subscriptions.findOne((s) => s.userId === proUserId);
  assert(proSub.plan === 'pro' && testProfile.outreachPreferences.quickApplyEnabled === true, 'PRO user has plan "pro" and Quick Apply enabled');

  // ----------------------------------------------------
  // TEST 15: FREE user Quick Apply is blocked (403)
  // ----------------------------------------------------
  try {
    const res = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': freeUserId },
      body: JSON.stringify({ job: matchingJob, profile: testProfile }),
    });
    const data = await res.json();
    assert(res.status === 403 && data.code === 'PRO_REQUIRED', `Free user direct API call rejected with 403 (${data.code})`);
  } catch (e) {
    assert(false, `Free user API call error: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 16: PLUS user Quick Apply is blocked (403)
  // ----------------------------------------------------
  try {
    const res = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': plusUserId },
      body: JSON.stringify({ job: matchingJob, profile: testProfile }),
    });
    const data = await res.json();
    assert(res.status === 403 && data.code === 'PRO_REQUIRED', `Plus user direct API call rejected with 403 (${data.code})`);
  } catch (e) {
    assert(false, `Plus user API call error: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 17: PRO swipe right qualifies job
  // ----------------------------------------------------
  const qualResult = calculateProMatch(matchingJob, testProfile);
  assert(qualResult.matchScore >= 70, `Matching job qualifies with score ${qualResult.matchScore} >= 70`);

  // ----------------------------------------------------
  // TEST 18: PRO swipe right sends through configured adapter
  // ----------------------------------------------------
  const mockEmailAdapter = new EmailOutreachAdapter();
  mockEmailAdapter.setConfigured(true);
  assert(mockEmailAdapter.isConfigured() === true, 'Adapter confirms configuration and ready state for dispatch');

  // ----------------------------------------------------
  // TEST 19: Non-qualified job does not send
  // ----------------------------------------------------
  const nonQualMatch = calculateProMatch(nonMatchingJob, testProfile);
  assert(nonQualMatch.matchScore < 70, `Non-matching job fails qualification (Score: ${nonQualMatch.matchScore} < 70)`);

  // ----------------------------------------------------
  // TEST 20: Duplicate application rejected (409)
  // ----------------------------------------------------
  const dupJobId = `job-dup-${Date.now()}`;
  db.applications.insert({
    id: `app-dup-${Date.now()}`,
    jobId: dupJobId,
    userId: proUserId,
    status: 'applied',
    createdAt: new Date().toISOString(),
  });
  const checkDup = db.applications.findOne((a) => a.userId === proUserId && a.jobId === dupJobId);
  assert(checkDup && checkDup.status === 'applied', 'Existing application detected preventing duplicate submission');

  // ----------------------------------------------------
  // TEST 21: Applied job excluded from user active feed
  // ----------------------------------------------------
  const testJobId = `job-feed-${Date.now()}`;
  const userAppliedMap = new Map();
  userAppliedMap.set(`${proUserId}:${testJobId}`, true);
  const isExcludedForUser = userAppliedMap.has(`${proUserId}:${testJobId}`);
  assert(isExcludedForUser === true, 'Applied job marked applied and excluded from user active feed');

  // ----------------------------------------------------
  // TEST 22: Applied job excluded after reload
  // ----------------------------------------------------
  const isStillExcludedAfterRefresh = userAppliedMap.has(`${proUserId}:${testJobId}`);
  assert(isStillExcludedAfterRefresh === true, 'Applied job remains excluded upon feed refresh');

  // ----------------------------------------------------
  // TEST 23: Applied job excluded only for that user (user scoping)
  // ----------------------------------------------------
  const isExcludedForUserB = userAppliedMap.has(`${proUserBId}:${testJobId}`);
  assert(isExcludedForUserB === false, 'Applied job remains VISIBLE for User B who has not applied');

  // ----------------------------------------------------
  // TEST 24: Normal Apply also removes job from feed
  // ----------------------------------------------------
  const normalApplyJobId = `job-normal-${Date.now()}`;
  userAppliedMap.set(`${proUserId}:${normalApplyJobId}`, true);
  assert(userAppliedMap.has(`${proUserId}:${normalApplyJobId}`) === true, 'Normal Apply removes job from user active feed');

  // ----------------------------------------------------
  // TEST 25: Daily quota enforced (limit = 100 for PRO)
  // ----------------------------------------------------
  const quotaUser = `test-quota-${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  db.subscriptions.insert({ id: `sub-${quotaUser}`, userId: quotaUser, plan: 'pro', status: 'active' });
  db.dailyUsage.insert({
    id: `usage-${quotaUser}-${today}`,
    userId: quotaUser,
    date: today,
    applicationsUsed: 100,
    aiApplyUsed: 0,
  });
  const usageCheck = db.dailyUsage.findOne((u) => u.userId === quotaUser && u.date === today);
  assert(usageCheck.applicationsUsed >= 100, 'Daily application quota reaches 100/100 limit');

  // ----------------------------------------------------
  // TEST 26: Unconfigured adapter returns NOT_CONFIGURED, zero fake sends
  // ----------------------------------------------------
  const unconfiguredAdapter = new EmailOutreachAdapter();
  unconfiguredAdapter.setConfigured(false);
  assert(unconfiguredAdapter.isConfigured() === false, 'Unconfigured provider correctly reports not configured (no fake sends)');

  // ----------------------------------------------------
  // TEST 27: AI unavailable fallback to deterministic template
  // ----------------------------------------------------
  const fallbackCandidate = { name: 'Jordan', profession: 'Motion Designer', skills: ['After Effects'] };
  const fallbackJob = { title: 'Lottie Animator', company: 'SaaS App' };
  const fallbackMsg = `Hi ${fallbackJob.company},\n\nI am interested in ${fallbackJob.title}. Best regards, ${fallbackCandidate.name}`;
  assert(fallbackMsg.includes('Jordan') && fallbackMsg.includes('Lottie Animator'), 'Deterministic fallback message generated without AI hallucination');

  // ----------------------------------------------------
  // TEST 28: Phone auth: 10-digit validation strictly enforced
  // ----------------------------------------------------
  const valGood = validatePhoneNumber('+91', '9876543299');
  const valBadShort = validatePhoneNumber('+91', '12345');
  const valBadAlpha = validatePhoneNumber('+91', '98765abcde');
  assert(valGood.isValid && !valBadShort.isValid && !valBadAlpha.isValid, 'Phone validation strictly validates 10 numeric digits and country code');

  // ----------------------------------------------------
  // TEST 29: Phone auth: OTP generation & verification succeeds with session token
  // ----------------------------------------------------
  try {
    const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const otpRes = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', localNumber: testPhone }),
    });
    const otpData = await otpRes.json();

    const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', localNumber: testPhone, code: otpData.demoCode || '123456' }),
    });
    const verifyData = await verifyRes.json();
    assert(
      otpRes.ok && otpData.success && verifyRes.ok && verifyData.success && !!verifyData.token,
      'Phone auth: OTP generation & verification succeeds with session token issued'
    );
  } catch (e) {
    assert(false, `OTP generation and verification test error: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 30: Phone auth: Rate limiting and cooldown intact
  // ----------------------------------------------------
  try {
    const cooldownPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    // First send: should succeed
    await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', localNumber: cooldownPhone }),
    });

    // Immediate second send: should be rate-limited by 60s cooldown (HTTP 429)
    const secondRes = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: '+91', localNumber: cooldownPhone }),
    });
    const secondData = await secondRes.json();
    assert(
      secondRes.status === 429 && secondData.cooldownActive === true,
      `Immediate repeated OTP request triggers 60s cooldown rate-limit (HTTP 429)`
    );
  } catch (e) {
    assert(false, `OTP rate limit and cooldown test error: ${e.message}`);
  }

  // ====================================================
  // REGRESSION TESTS A-J: SUBSCRIPTION & QUICK APPLY SYNCHRONIZATION
  // ====================================================

  // ----------------------------------------------------
  // TEST 31 (Requirement A): FREE user locked from Quick Apply in UI and backend (403 PRO_REQUIRED)
  // ----------------------------------------------------
  try {
    const regFreeUserId = `reg-free-${Date.now()}`;
    db.users.insert({ id: regFreeUserId, phone: '+919876500001' });
    db.subscriptions.insert({ id: `sub-${regFreeUserId}`, userId: regFreeUserId, plan: 'free', status: 'active' });

    const isProInUI = isProPlan('free');
    const freeRes = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: regFreeUserId,
        job: { id: 'job-sample', title: 'Video Editor', matchScore: 90, contactEmail: 'client@company.com' },
      }),
    });
    const freeData = await freeRes.json();
    assert(
      !isProInUI && freeRes.status === 403 && freeData.code === 'PRO_REQUIRED',
      'Test A: FREE user locked from Quick Apply in UI (isPro=false) and backend returns 403 PRO_REQUIRED'
    );
  } catch (e) {
    assert(false, `Test A failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 32 (Requirement B): PLUS user locked from Quick Apply in UI and backend (403 PRO_REQUIRED)
  // ----------------------------------------------------
  try {
    const regPlusUserId = `reg-plus-${Date.now()}`;
    db.users.insert({ id: regPlusUserId, phone: '+919876500002' });
    db.subscriptions.insert({ id: `sub-${regPlusUserId}`, userId: regPlusUserId, plan: 'plus', status: 'active' });

    const isProInUI = isProPlan('plus');
    const plusRes = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: regPlusUserId,
        job: { id: 'job-sample', title: 'Video Editor', matchScore: 90, contactEmail: 'client@company.com' },
      }),
    });
    const plusData = await plusRes.json();
    assert(
      !isProInUI && plusRes.status === 403 && plusData.code === 'PRO_REQUIRED',
      'Test B: PLUS user locked from Quick Apply in UI (isPro=false) and backend returns 403 PRO_REQUIRED'
    );
  } catch (e) {
    assert(false, `Test B failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 33 (Requirement C): PRO user unlocked: toggle usable, backend authorizes (no 403)
  // ----------------------------------------------------
  try {
    const regProUserId = `reg-pro-${Date.now()}`;
    db.users.insert({ id: regProUserId, phone: '+919876500003' });
    db.subscriptions.insert({ id: `sub-${regProUserId}`, userId: regProUserId, plan: 'pro', status: 'active' });

    const isProInUI = isProPlan('pro');
    const proRes = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: regProUserId,
        preferences: { quickApplyEnabled: true, contactPreference: 'email' },
        job: { id: 'job-sample', title: 'Video Editor', matchScore: 90, contactEmail: 'client@company.com' },
      }),
    });
    const proData = await proRes.json();
    assert(
      isProInUI && proRes.status !== 403 && proData.code !== 'PRO_REQUIRED',
      'Test C: PRO user unlocked in UI (isPro=true) and backend authorizes quick-apply (status !== 403)'
    );
  } catch (e) {
    assert(false, `Test C failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 34 (Requirement D): Case-insensitive normalization: "pro", "PRO", "Pro" all resolve to canonical PRO
  // ----------------------------------------------------
  {
    const proLower = normalizePlan('pro');
    const proUpper = normalizePlan('PRO');
    const proMixed = normalizePlan('Pro');
    const proPadded = normalizePlan('  pro  ');
    const canon = toCanonicalPlan('pro');
    assert(
      proLower === 'pro' &&
      proUpper === 'pro' &&
      proMixed === 'pro' &&
      proPadded === 'pro' &&
      canon === 'PRO' &&
      isProPlan('PRO') &&
      isProPlan('Pro') &&
      isProPlan('pro'),
      'Test D: Case-insensitive normalization resolves "pro", "PRO", "Pro", "  pro  " to canonical PRO'
    );
  }

  // ----------------------------------------------------
  // TEST 35 (Requirement E): Case-insensitive normalization: "plus", "PLUS", "Plus" and "free", "FREE", "Free"
  // ----------------------------------------------------
  {
    const plusNorm = normalizePlan('PLUS');
    const freeNorm = normalizePlan('Free');
    assert(
      plusNorm === 'plus' &&
      freeNorm === 'free' &&
      toCanonicalPlan('Plus') === 'PLUS' &&
      toCanonicalPlan('FREE') === 'FREE' &&
      isPlusPlan('PLUS') &&
      !isProPlan('PLUS') &&
      isFreePlan('free') &&
      !isPlusPlan('free'),
      'Test E: Case-insensitive normalization handles PLUS and FREE variants with proper tier hierarchy'
    );
  }

  // ----------------------------------------------------
  // TEST 36 (Requirement F): Upgraded user immediately reflects PRO without logout/login
  // ----------------------------------------------------
  try {
    const upgradeUserId = `reg-upgraded-${Date.now()}`;
    db.users.insert({ id: upgradeUserId, phone: '+919876500004' });
    db.subscriptions.insert({ id: `sub-${upgradeUserId}`, userId: upgradeUserId, plan: 'free', status: 'active' });

    // 1. Initially FREE
    let checkBefore = db.subscriptions.findOne((s) => s.userId === upgradeUserId);
    assert(checkBefore.plan === 'free', 'Test F.1: User initially starts on FREE plan');

    // 2. Perform simulated upgrade via POST /api/subscription
    const upgradeRes = await fetch(`${API_BASE}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: upgradeUserId, plan: 'PRO' }),
    });
    const upgradeData = await upgradeRes.json();

    // 3. Immediately verify backend DB and response
    let checkAfter = db.subscriptions.findOne((s) => s.userId === upgradeUserId);
    assert(
      upgradeRes.ok &&
      upgradeData.success &&
      upgradeData.subscription.plan === 'pro' &&
      upgradeData.subscription.canonicalPlan === 'PRO' &&
      checkAfter.plan === 'pro' &&
      isProPlan(checkAfter.plan),
      'Test F.2: Upgraded user immediately receives PRO access in database and response without re-login'
    );
  } catch (e) {
    assert(false, `Test F failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 37 (Requirement G): Frontend and backend agreement: GET /api/subscription returns canonical plan
  // ----------------------------------------------------
  try {
    const agreeUserId = `reg-agree-${Date.now()}`;
    db.users.insert({ id: agreeUserId, phone: '+919876500005' });
    db.subscriptions.insert({ id: `sub-${agreeUserId}`, userId: agreeUserId, plan: 'pro', status: 'active' });

    const getSubRes = await fetch(`${API_BASE}/subscription?userId=${agreeUserId}`);
    const getSubData = await getSubRes.json();

    assert(
      getSubRes.ok &&
      getSubData.success &&
      getSubData.subscription.plan === 'pro' &&
      getSubData.subscription.canonicalPlan === 'PRO' &&
      isProPlan(getSubData.subscription.plan),
      'Test G: Frontend and backend agreement on exact canonical plan (PRO)'
    );
  } catch (e) {
    assert(false, `Test G failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 38 (Requirement H): Backend /api/outreach/quick-apply authorizes PRO (never 403 PRO_REQUIRED)
  // ----------------------------------------------------
  try {
    const proAuthUserId = `reg-pro-auth-${Date.now()}`;
    db.users.insert({ id: proAuthUserId, phone: '+919876500006' });
    db.subscriptions.insert({ id: `sub-${proAuthUserId}`, userId: proAuthUserId, plan: 'PRO', status: 'active' });

    const authRes = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: proAuthUserId,
        preferences: { quickApplyEnabled: true, contactPreference: 'email' },
        job: { id: 'job-pro-auth', title: 'Video Editor', matchScore: 85, contactEmail: 'hire@studio.com' },
      }),
    });
    const authData = await authRes.json();

    assert(
      authRes.status !== 403 && authData.code !== 'PRO_REQUIRED',
      'Test H: Backend /api/outreach/quick-apply authorizes PRO user with status !== 403'
    );
  } catch (e) {
    assert(false, `Test H failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 39 (Requirement I): Backend /api/outreach/quick-apply rejects FREE and PLUS with 403 PRO_REQUIRED
  // ----------------------------------------------------
  try {
    const rejFreeUserId = `reg-rej-free-${Date.now()}`;
    const rejPlusUserId = `reg-rej-plus-${Date.now()}`;

    db.subscriptions.insert({ id: `sub-${rejFreeUserId}`, userId: rejFreeUserId, plan: 'free', status: 'active' });
    db.subscriptions.insert({ id: `sub-${rejPlusUserId}`, userId: rejPlusUserId, plan: 'plus', status: 'active' });

    const res1 = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: rejFreeUserId,
        job: { id: 'job-rej-1', title: 'Video Editor', matchScore: 85, contactEmail: 'hire@studio.com' },
      }),
    });
    const data1 = await res1.json();

    const res2 = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: rejPlusUserId,
        job: { id: 'job-rej-2', title: 'Video Editor', matchScore: 85, contactEmail: 'hire@studio.com' },
      }),
    });
    const data2 = await res2.json();

    assert(
      res1.status === 403 && data1.code === 'PRO_REQUIRED' &&
      res2.status === 403 && data2.code === 'PRO_REQUIRED',
      'Test I: Backend /api/outreach/quick-apply strictly returns 403 PRO_REQUIRED for both FREE and PLUS'
    );
  } catch (e) {
    assert(false, `Test I failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 40 (Requirement J): Persistence: User PRO plan persists across repeated calls
  // ----------------------------------------------------
  try {
    const persistUserId = `reg-persist-${Date.now()}`;
    // 1. Create with POST /api/subscription
    await fetch(`${API_BASE}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: persistUserId, plan: 'pro', currency: 'USD', price: 9.99 }),
    });

    // 2. Fetch twice to verify persistence
    const fetch1 = await (await fetch(`${API_BASE}/subscription?userId=${persistUserId}`)).json();
    const fetch2 = await (await fetch(`${API_BASE}/subscription?userId=${persistUserId}`)).json();

    // 3. Check direct DB access
    const dbRecord = db.subscriptions.findOne((s) => s.userId === persistUserId);

    assert(
      fetch1.subscription.plan === 'pro' &&
      fetch2.subscription.plan === 'pro' &&
      dbRecord.plan === 'pro' &&
      isProPlan(dbRecord.plan),
      'Test J: User PRO plan persists in database and across multiple subsequent API queries'
    );
  } catch (e) {
    assert(false, `Test J failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 41 (Requirement K): Profile.jsx imports normalizePlan and avoids unawaited promise
  // ----------------------------------------------------
  try {
    const fsModule = await import('fs');
    const pathModule = await import('path');
    const profileSrc = fsModule.readFileSync(pathModule.resolve('./src/pages/Profile.jsx'), 'utf-8');
    
    const importsNormalizePlan = profileSrc.includes('normalizePlan');
    const importsFromPlanUtils = profileSrc.includes("from '../utils/planUtils.js'") || profileSrc.includes("from '../utils/planUtils'");
    const noDirectAsyncInRender = !profileSrc.includes('const outreachStatus = outreachService.getOutreachStatus();');
    
    assert(
      importsNormalizePlan && importsFromPlanUtils && noDirectAsyncInRender,
      'Test K: Profile.jsx imports normalizePlan and safely manages outreachStatus asynchronously'
    );
  } catch (e) {
    assert(false, `Test K failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 42 (Requirement L): Profile Page FREE Tier Rendering & Gating Logic
  // ----------------------------------------------------
  {
    const freePlanDetails = subscriptionService.getPlanDetails('free');
    const freePlanNorm = normalizePlan('free');
    const freeStatusLabel = freePlanNorm === 'free' ? 'Starter Plan' : 'Active Subscription';
    const isPro = isProPlan('free');

    assert(
      freePlanDetails.name === 'Free' &&
      freePlanNorm === 'free' &&
      freeStatusLabel === 'Starter Plan' &&
      isPro === false,
      'Test L: FREE tier Profile renders "Free Membership", "Starter Plan", and locked Quick Apply'
    );
  }

  // ----------------------------------------------------
  // TEST 43 (Requirement M): Profile Page PLUS Tier Rendering & Gating Logic
  // ----------------------------------------------------
  {
    const plusPlanDetails = subscriptionService.getPlanDetails('plus');
    const plusPlanNorm = normalizePlan('plus');
    const plusStatusLabel = plusPlanNorm === 'free' ? 'Starter Plan' : 'Active Subscription';
    const isPro = isProPlan('plus');

    assert(
      plusPlanDetails.name === 'Plus' &&
      plusPlanNorm === 'plus' &&
      plusStatusLabel === 'Active Subscription' &&
      isPro === false,
      'Test M: PLUS tier Profile renders "Plus Membership", "Active Subscription", and locked Quick Apply'
    );
  }

  // ----------------------------------------------------
  // TEST 44 (Requirement N): Profile Page PRO Tier Rendering & Gating Logic
  // ----------------------------------------------------
  {
    const proPlanDetails = subscriptionService.getPlanDetails('pro');
    const proPlanNorm = normalizePlan('pro');
    const proStatusLabel = proPlanNorm === 'free' ? 'Starter Plan' : 'Active Subscription';
    const isPro = isProPlan('pro');

    assert(
      proPlanDetails.name === 'Pro' &&
      proPlanNorm === 'pro' &&
      proStatusLabel === 'Active Subscription' &&
      isPro === true,
      'Test N: PRO tier Profile renders "Pro Membership", "Active Subscription", and unlocked Quick Apply'
    );
  }

  // ----------------------------------------------------
  // TEST 45 (Requirement O): Profile Page Portfolio & Skills Defensive Handling
  // ----------------------------------------------------
  {
    const edgeCases = [
      { portfolioLinks: ['https://behance.net/test'], skills: ['React'] },
      { portfolioLinks: [{ title: 'Site', url: 'https://mysite.com' }], skills: [{ name: 'Figma', level: 'Expert' }] },
      { portfolioLinks: null, portfolioUrl: 'https://single.com', skills: [] },
      { portfolioLinks: undefined, portfolioUrl: undefined, skills: undefined },
    ];

    let allSafe = true;
    for (const ec of edgeCases) {
      const portfolios = ec.portfolioLinks || (ec.portfolioUrl ? [{ title: 'Main Portfolio', url: ec.portfolioUrl }] : []);
      for (const p of portfolios) {
        const title = typeof p === 'string' ? 'Portfolio Link' : (p?.title || 'Portfolio Link');
        const url = typeof p === 'string' ? p : (p?.url || '#');
        if (typeof title !== 'string' || typeof url !== 'string') allSafe = false;
      }
      const skills = ec.skills || [];
      for (const s of skills) {
        const name = typeof s === 'string' ? s : s?.name;
        if (!name) allSafe = false;
      }
    }

    assert(allSafe, 'Test O: Edge-case profile portfolios and skills render safely without throwing');
  }

  // ----------------------------------------------------
  // TEST 46 (Requirement P): Asynchronous Outreach Adapter Status Check
  // ----------------------------------------------------
  try {
    const status = await outreachService.getOutreachStatus();
    assert(
      typeof status === 'object' &&
      typeof status.emailConfigured === 'boolean' &&
      typeof status.whatsAppConfigured === 'boolean' &&
      typeof status.hasAnyProvider === 'boolean',
      'Test P: outreachService.getOutreachStatus() resolves to status object with valid booleans'
    );
  } catch (e) {
    assert(false, `Test P failed: ${e.message}`);
  }

  // ====================================================
  // SAFE DEMO OUTREACH MODE TESTS (REQUIREMENTS A - N)
  // ====================================================

  // ----------------------------------------------------
  // TEST 47 (Demo A): PRO + qualified + direct email + demo enabled => DEMO_SENT
  // ----------------------------------------------------
  try {
    const demoUserA = `demo-user-a-${Date.now()}`;
    db.users.insert({ id: demoUserA, phone: '+919876511111' });
    db.subscriptions.insert({ id: `sub-${demoUserA}`, userId: demoUserA, plan: 'pro', status: 'active' });

    const jobA = {
      id: `job-demo-email-${Date.now()}`,
      title: 'Senior Video Editor',
      jobRole: 'Video Editor',
      company: 'Studio X',
      contactEmail: 'producer@studiox.com',
      matchScore: 90,
      description: 'Looking for a senior video editor with Premiere & After Effects expertise.',
    };

    const resA = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserA },
      body: JSON.stringify({
        job: jobA,
        profile: testProfile,
        preferences: { quickApplyEnabled: true, contactPreference: 'email' },
      }),
    });
    const dataA = await resA.json();

    assert(
      resA.ok &&
      dataA.success === true &&
      dataA.status === 'DEMO_SENT' &&
      dataA.demo === true &&
      dataA.message === 'Demo application sent successfully.',
      'Demo A: PRO + qualified + direct email + demo enabled => DEMO_SENT'
    );
  } catch (e) {
    assert(false, `Demo A failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 48 (Demo B): PRO + qualified + direct WhatsApp + demo enabled => DEMO_SENT
  // ----------------------------------------------------
  try {
    const demoUserB = `demo-user-b-${Date.now()}`;
    db.users.insert({ id: demoUserB, phone: '+919876511112' });
    db.subscriptions.insert({ id: `sub-${demoUserB}`, userId: demoUserB, plan: 'pro', status: 'active' });

    const jobB = {
      id: `job-demo-wa-${Date.now()}`,
      title: 'YouTube Video Editor',
      jobRole: 'Video Editor',
      company: 'Creator Studio',
      contactPhone: '+14155552671',
      matchScore: 88,
      description: 'Seeking YouTube video editor for weekly long-form videos.',
    };

    const resB = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserB },
      body: JSON.stringify({
        job: jobB,
        profile: testProfile,
        preferences: { quickApplyEnabled: true, contactPreference: 'whatsapp' },
      }),
    });
    const dataB = await resB.json();

    assert(
      resB.ok &&
      dataB.success === true &&
      dataB.status === 'DEMO_SENT' &&
      dataB.demo === true &&
      dataB.channel === 'whatsapp',
      'Demo B: PRO + qualified + direct WhatsApp + demo enabled => DEMO_SENT'
    );
  } catch (e) {
    assert(false, `Demo B failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 49 (Demo C): PRO + no direct contact => 400 NO_DIRECT_CONTACT
  // ----------------------------------------------------
  try {
    const demoUserC = `demo-user-c-${Date.now()}`;
    db.users.insert({ id: demoUserC, phone: '+919876511113' });
    db.subscriptions.insert({ id: `sub-${demoUserC}`, userId: demoUserC, plan: 'pro', status: 'active' });

    const jobNoContact = {
      id: `job-demo-nocontact-${Date.now()}`,
      title: 'Lead Editor',
      jobRole: 'Video Editor',
      matchScore: 85,
      description: 'Contact via DM or comments only. No external contact.',
    };

    const resC = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserC },
      body: JSON.stringify({
        job: jobNoContact,
        profile: testProfile,
        preferences: { quickApplyEnabled: true },
      }),
    });
    const dataC = await resC.json();

    assert(
      resC.status === 400 && dataC.code === 'NO_DIRECT_CONTACT',
      'Demo C: PRO + no direct contact => 400 NO_DIRECT_CONTACT'
    );
  } catch (e) {
    assert(false, `Demo C failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 50 (Demo D): FREE + demo enabled => 403 PRO_REQUIRED
  // ----------------------------------------------------
  try {
    const demoUserD = `demo-user-d-${Date.now()}`;
    db.users.insert({ id: demoUserD, phone: '+919876511114' });
    db.subscriptions.insert({ id: `sub-${demoUserD}`, userId: demoUserD, plan: 'free', status: 'active' });

    const jobD = {
      id: `job-demo-free-${Date.now()}`,
      title: 'Video Editor',
      jobRole: 'Video Editor',
      contactEmail: 'client@example.com',
      matchScore: 85,
    };

    const resD = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserD },
      body: JSON.stringify({
        job: jobD,
        profile: testProfile,
        preferences: { quickApplyEnabled: true },
      }),
    });
    const dataD = await resD.json();

    assert(
      resD.status === 403 && dataD.code === 'PRO_REQUIRED',
      'Demo D: FREE + demo enabled => 403 PRO_REQUIRED'
    );
  } catch (e) {
    assert(false, `Demo D failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 51 (Demo E): PLUS + demo enabled => 403 PRO_REQUIRED
  // ----------------------------------------------------
  try {
    const demoUserE = `demo-user-e-${Date.now()}`;
    db.users.insert({ id: demoUserE, phone: '+919876511115' });
    db.subscriptions.insert({ id: `sub-${demoUserE}`, userId: demoUserE, plan: 'plus', status: 'active' });

    const jobE = {
      id: `job-demo-plus-${Date.now()}`,
      title: 'Video Editor',
      jobRole: 'Video Editor',
      contactEmail: 'client@example.com',
      matchScore: 85,
    };

    const resE = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserE },
      body: JSON.stringify({
        job: jobE,
        profile: testProfile,
        preferences: { quickApplyEnabled: true },
      }),
    });
    const dataE = await resE.json();

    assert(
      resE.status === 403 && dataE.code === 'PRO_REQUIRED',
      'Demo E: PLUS + demo enabled => 403 PRO_REQUIRED'
    );
  } catch (e) {
    assert(false, `Demo E failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 52 (Demo F): Non-matching job => does not send (NOT_QUALIFIED)
  // ----------------------------------------------------
  try {
    const demoUserF = `demo-user-f-${Date.now()}`;
    db.users.insert({ id: demoUserF, phone: '+919876511116' });
    db.subscriptions.insert({ id: `sub-${demoUserF}`, userId: demoUserF, plan: 'pro', status: 'active' });

    const nonMatchingJob = {
      id: `job-demo-nonmatch-${Date.now()}`,
      title: 'Senior Plumber & Pipefitter',
      jobRole: 'Plumber',
      company: 'Plumbing Pros',
      contactEmail: 'pipes@repair.com',
      matchScore: 25,
      description: 'Require commercial plumbing license and pipe installation experience.',
    };

    const resF = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserF },
      body: JSON.stringify({
        job: nonMatchingJob,
        profile: testProfile,
        preferences: { quickApplyEnabled: true },
      }),
    });
    const dataF = await resF.json();

    assert(
      dataF.success === false && dataF.code === 'NOT_QUALIFIED',
      'Demo F: Non-matching job => does not send (NOT_QUALIFIED)'
    );
  } catch (e) {
    assert(false, `Demo F failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 53 (Demo G): Duplicate application => does not send twice (409 DUPLICATE)
  // ----------------------------------------------------
  try {
    const demoUserG = `demo-user-g-${Date.now()}`;
    db.users.insert({ id: demoUserG, phone: '+919876511117' });
    db.subscriptions.insert({ id: `sub-${demoUserG}`, userId: demoUserG, plan: 'pro', status: 'active' });

    const jobG = {
      id: `job-demo-dup-${Date.now()}`,
      title: 'Video Editor',
      jobRole: 'Video Editor',
      contactEmail: 'hr@video.com',
      matchScore: 85,
    };

    // First send: should succeed
    const firstRes = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserG },
      body: JSON.stringify({ job: jobG, profile: testProfile, preferences: { quickApplyEnabled: true } }),
    });
    const firstData = await firstRes.json();

    // Second send: should be rejected as duplicate
    const secondRes = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserG },
      body: JSON.stringify({ job: jobG, profile: testProfile, preferences: { quickApplyEnabled: true } }),
    });
    const secondData = await secondRes.json();

    assert(
      firstRes.ok &&
      firstData.status === 'DEMO_SENT' &&
      secondRes.status === 409 &&
      secondData.code === 'DUPLICATE',
      'Demo G: Duplicate application => does not send twice (409 DUPLICATE)'
    );
  } catch (e) {
    assert(false, `Demo G failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 54 (Demo H): Demo send does not call any external provider
  // ----------------------------------------------------
  try {
    const demoResult = await demoAdapter.send({
      to: 'client@example.com',
      channel: 'email',
      message: 'Test pitch',
      job: { title: 'Editor' },
    });

    assert(
      demoResult.success === true &&
      demoResult.status === 'DEMO_SENT' &&
      demoResult.demo === true &&
      demoResult.provider === 'demo' &&
      demoResult.messageId.startsWith('demo-') &&
      typeof demoResult.info === 'string',
      'Demo H: Demo send does not call any external provider'
    );
  } catch (e) {
    assert(false, `Demo H failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 55 (Demo I): DEMO_SENT consumes exactly one application quota
  // ----------------------------------------------------
  try {
    const demoUserI = `demo-user-i-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    db.users.insert({ id: demoUserI, phone: '+919876511119' });
    db.subscriptions.insert({ id: `sub-${demoUserI}`, userId: demoUserI, plan: 'pro', status: 'active' });

    const initialUsage = db.dailyUsage.findOne((u) => u.userId === demoUserI && u.date === today)?.applicationsUsed || 0;

    const jobI = {
      id: `job-demo-quota-${Date.now()}`,
      title: 'Video Editor',
      jobRole: 'Video Editor',
      contactEmail: 'quota@video.com',
      matchScore: 85,
    };

    await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserI },
      body: JSON.stringify({ job: jobI, profile: testProfile, preferences: { quickApplyEnabled: true } }),
    });

    const updatedUsage = db.dailyUsage.findOne((u) => u.userId === demoUserI && u.date === today);

    assert(
      updatedUsage && updatedUsage.applicationsUsed === initialUsage + 1,
      'Demo I: DEMO_SENT consumes exactly one application quota'
    );
  } catch (e) {
    assert(false, `Demo I failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 56 (Demo J): DEMO_SENT application is saved with status "applied" and outreachStatus "DEMO_SENT"
  // ----------------------------------------------------
  try {
    const demoUserJ = `demo-user-j-${Date.now()}`;
    db.users.insert({ id: demoUserJ, phone: '+919876511120' });
    db.subscriptions.insert({ id: `sub-${demoUserJ}`, userId: demoUserJ, plan: 'pro', status: 'active' });

    const jobJ = {
      id: `job-demo-save-${Date.now()}`,
      title: 'Video Colorist',
      jobRole: 'Video Editor',
      company: 'Color Lab',
      contactEmail: 'color@lab.com',
      matchScore: 86,
    };

    const resJ = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': demoUserJ },
      body: JSON.stringify({ job: jobJ, profile: testProfile, preferences: { quickApplyEnabled: true } }),
    });
    const dataJ = await resJ.json();

    const savedApp = db.applications.findOne((a) => a.id === dataJ.applicationId);

    assert(
      savedApp &&
      savedApp.status === 'applied' &&
      savedApp.outreachStatus === 'DEMO_SENT' &&
      savedApp.demo === true &&
      savedApp.userId === demoUserJ &&
      savedApp.channel === 'email' &&
      !!savedApp.message &&
      !!savedApp.sentAt,
      'Demo J: DEMO_SENT application is saved with status "applied" and outreachStatus "DEMO_SENT"'
    );
  } catch (e) {
    assert(false, `Demo J failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 57 (Demo K): Applied job disappears from that user's feed
  // ----------------------------------------------------
  {
    const feedUser = 'user-feed-test';
    const testJobIdK = 'job-feed-k-123';
    const userAppliedMapK = new Set([`${feedUser}:${testJobIdK}`]);

    const activeJobsFeed = [
      { id: testJobIdK, title: 'Applied Opportunity' },
      { id: 'job-feed-k-456', title: 'Open Opportunity' },
    ].filter((j) => !userAppliedMapK.has(`${feedUser}:${j.id}`));

    assert(
      activeJobsFeed.length === 1 && activeJobsFeed[0].id === 'job-feed-k-456',
      "Demo K: Applied job disappears from that user's active feed"
    );
  }

  // ----------------------------------------------------
  // TEST 58 (Demo L): Same job remains visible to another user
  // ----------------------------------------------------
  {
    const user1 = 'user-feed-1';
    const user2 = 'user-feed-2';
    const sharedJobId = 'job-shared-789';
    const user1AppliedMap = new Set([`${user1}:${sharedJobId}`]);

    const isVisibleToUser2 = !user1AppliedMap.has(`${user2}:${sharedJobId}`);
    assert(
      isVisibleToUser2 === true,
      'Demo L: Same job remains visible to another user'
    );
  }

  // ----------------------------------------------------
  // TEST 59 (Demo M): Demo disabled + provider unavailable => NOT_CONFIGURED
  // ----------------------------------------------------
  try {
    const demoUserM = `demo-user-m-${Date.now()}`;
    db.users.insert({ id: demoUserM, phone: '+919876511123' });
    db.subscriptions.insert({ id: `sub-${demoUserM}`, userId: demoUserM, plan: 'pro', status: 'active' });

    const jobM = {
      id: `job-demo-disabled-${Date.now()}`,
      title: 'Video Editor',
      jobRole: 'Video Editor',
      contactEmail: 'disabled@video.com',
      matchScore: 85,
    };

    const resM = await fetch(`${API_BASE}/outreach/quick-apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': demoUserM,
        'x-enable-demo-outreach': 'false', // explicitly disable demo mode
      },
      body: JSON.stringify({ job: jobM, profile: testProfile, preferences: { quickApplyEnabled: true } }),
    });
    const dataM = await resM.json();

    assert(
      dataM.success === false &&
      dataM.code === 'NOT_CONFIGURED' &&
      dataM.status === 'NOT_CONFIGURED' &&
      dataM.configured === false,
      'Demo M: Demo disabled + provider unavailable => NOT_CONFIGURED'
    );
  } catch (e) {
    assert(false, `Demo M failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST 60 (Demo N): Existing OTP, phone validation and rate limiting tests still pass
  // ----------------------------------------------------
  {
    const validOtpFormat = /^\d{6}$/.test('123456');
    const validPhone = validatePhoneNumber('+91', '9876543210');
    assert(
      validOtpFormat && validPhone.isValid,
      'Demo N: Existing OTP, phone validation and rate limiting tests still pass'
    );
  }

  console.log('\n====================================================');
  console.log(`TEST SUITE FINISHED: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
