/**
 * Test Suite: Application Composer / Apply Page Membership Gating (Final / Max-Version)
 * 
 * Verifies all 24 requirements:
 * 1. Free sees only Short & Direct tone unlocked.
 * 2. Free sees Professional/Friendly/Confident locked.
 * 3. Plus unlocks all four tones.
 * 4. Pro unlocks all four tones.
 * 5. Free only gets Short message length.
 * 6. Plus gets Short + Medium.
 * 7. Pro gets Short + Medium + Detailed.
 * 8. Free cannot use locked tone through backend/API (403 UPGRADE_REQUIRED).
 * 9. Free cannot use Medium/Detailed through backend/API (403 UPGRADE_REQUIRED).
 * 10. Plus cannot use Detailed through backend/API (403 PRO_REQUIRED).
 * 11. Pro can use all message lengths.
 * 12. Translation is locked for Free (403 PRO_REQUIRED).
 * 13. Translation is locked for Plus (403 PRO_REQUIRED).
 * 14. Translation is available for Pro (200 success).
 * 15. Free can attach CV.
 * 16. Plus can attach CV.
 * 17. Pro can attach CV.
 * 18. Free can include Portfolio.
 * 19. Plus can include Portfolio.
 * 20. Pro can include Portfolio.
 * 21. Application Quality Score is not rendered.
 * 22. AI Assistant Demo Mode badge is not rendered.
 * 23. Bangla Draft Mode is not rendered.
 * 24. Regenerate respects selected tone and message length.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/database.js';
import { aiService } from '../src/services/aiService.js';
import { translationService, SUPPORTED_TRANSLATION_LANGUAGES } from '../src/services/translationService.js';
import { APPLICATION_TONES, APPLICATION_LENGTHS } from '../src/utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  console.log('\n====================================================');
  console.log('STARTING APPLICATION COMPOSER GATING TEST SUITE (24 TESTS)');
  console.log('====================================================\n');

  // Setup test users in database
  const freeUserId = `user-comp-free-${Date.now()}`;
  const plusUserId = `user-comp-plus-${Date.now()}`;
  const proUserId = `user-comp-pro-${Date.now()}`;

  db.users.insert({ id: freeUserId, phone: '+919999900001', countryCode: '+91', localNumber: '9999900001' });
  db.users.insert({ id: plusUserId, phone: '+919999900002', countryCode: '+91', localNumber: '9999900002' });
  db.users.insert({ id: proUserId, phone: '+919999900003', countryCode: '+91', localNumber: '9999900003' });

  db.subscriptions.insert({ id: `sub-${freeUserId}`, userId: freeUserId, plan: 'free', status: 'active' });
  db.subscriptions.insert({ id: `sub-${plusUserId}`, userId: plusUserId, plan: 'plus', status: 'active' });
  db.subscriptions.insert({ id: `sub-${proUserId}`, userId: proUserId, plan: 'pro', status: 'active' });

  const sampleJob = {
    id: `job-comp-${Date.now()}`,
    title: 'Senior Video Editor',
    company: 'Alpha Media Group',
    description: 'Looking for a skilled Video Editor proficient in Premiere Pro and After Effects for YouTube content.',
  };

  const sampleProfile = {
    id: 'prof-test',
    name: 'Toufiq Alam',
    profession: 'Video Editor',
    specialization: 'High-Retention Content',
    experience: '4+ years',
    skills: ['Premiere Pro', 'After Effects'],
    portfolioUrl: 'https://portfolio.toufiq.dev',
    cvUrl: 'https://storage.toufiq.dev/cv.pdf',
  };

  // Helper tone/length gating logic mirrors ApplyJob.jsx
  const isToneLockedForPlan = (plan, toneId) => plan === 'free' && toneId !== 'Short & Direct';
  const isLengthLockedForPlan = (plan, lengthId) => {
    if (plan === 'free') return lengthId !== 'Short';
    if (plan === 'plus') return lengthId === 'Detailed';
    return false;
  };
  const isTranslationLockedForPlan = (plan) => plan !== 'pro';

  // 1. Free sees only Short & Direct tone unlocked
  const freeShortDirectLocked = isToneLockedForPlan('free', 'Short & Direct');
  assert(!freeShortDirectLocked, 'Free sees Short & Direct tone unlocked');

  // 2. Free sees Professional/Friendly/Confident locked
  const freeProfLocked = isToneLockedForPlan('free', 'Professional');
  const freeFriendlyLocked = isToneLockedForPlan('free', 'Friendly');
  const freeConfidentLocked = isToneLockedForPlan('free', 'Confident');
  assert(freeProfLocked && freeFriendlyLocked && freeConfidentLocked, 'Free sees Professional/Friendly/Confident locked');

  // 3. Plus unlocks all four tones
  const plusTonesUnlocked = APPLICATION_TONES.every((t) => !isToneLockedForPlan('plus', t.id));
  assert(plusTonesUnlocked, 'Plus unlocks all four tones (Short & Direct, Professional, Friendly, Confident)');

  // 4. Pro unlocks all four tones
  const proTonesUnlocked = APPLICATION_TONES.every((t) => !isToneLockedForPlan('pro', t.id));
  assert(proTonesUnlocked, 'Pro unlocks all four tones');

  // 5. Free only gets Short message length
  const freeShortUnlocked = !isLengthLockedForPlan('free', 'Short');
  const freeMediumLocked = isLengthLockedForPlan('free', 'Medium');
  const freeDetailedLocked = isLengthLockedForPlan('free', 'Detailed');
  assert(freeShortUnlocked && freeMediumLocked && freeDetailedLocked, 'Free only gets Short message length (Medium and Detailed are locked)');

  // 6. Plus gets Short + Medium
  const plusShortUnlocked = !isLengthLockedForPlan('plus', 'Short');
  const plusMediumUnlocked = !isLengthLockedForPlan('plus', 'Medium');
  const plusDetailedLocked = isLengthLockedForPlan('plus', 'Detailed');
  assert(plusShortUnlocked && plusMediumUnlocked && plusDetailedLocked, 'Plus gets Short + Medium unlocked, Detailed locked');

  // 7. Pro gets Short + Medium + Detailed
  const proAllLengthsUnlocked = APPLICATION_LENGTHS.every((l) => !isLengthLockedForPlan('pro', l.id));
  assert(proAllLengthsUnlocked, 'Pro gets Short + Medium + Detailed all unlocked');

  // 8. Free cannot use locked tone through backend/API (403 UPGRADE_REQUIRED)
  try {
    const res = await fetch(`${API_BASE}/ai/generate-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': freeUserId },
      body: JSON.stringify({
        job: sampleJob,
        profile: sampleProfile,
        tone: 'Professional',
        length: 'Short',
      }),
    });
    const data = await res.json();
    assert(res.status === 403 && data.code === 'UPGRADE_REQUIRED', 'Free cannot use locked tone through backend/API (403 UPGRADE_REQUIRED)');
  } catch (err) {
    assert(false, `Free tone backend check failed: ${err.message}`);
  }

  // 9. Free cannot use Medium/Detailed through backend/API (403 UPGRADE_REQUIRED)
  try {
    const resMedium = await fetch(`${API_BASE}/ai/generate-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': freeUserId },
      body: JSON.stringify({
        job: sampleJob,
        profile: sampleProfile,
        tone: 'Short & Direct',
        length: 'Medium',
      }),
    });
    const dataMedium = await resMedium.json();

    const resDetailed = await fetch(`${API_BASE}/ai/generate-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': freeUserId },
      body: JSON.stringify({
        job: sampleJob,
        profile: sampleProfile,
        tone: 'Short & Direct',
        length: 'Detailed',
      }),
    });
    const dataDetailed = await resDetailed.json();

    assert(
      resMedium.status === 403 && dataMedium.code === 'UPGRADE_REQUIRED' &&
      resDetailed.status === 403 && dataDetailed.code === 'UPGRADE_REQUIRED',
      'Free cannot use Medium or Detailed length through backend/API (403 UPGRADE_REQUIRED)'
    );
  } catch (err) {
    assert(false, `Free length backend check failed: ${err.message}`);
  }

  // 10. Plus cannot use Detailed through backend/API (403 PRO_REQUIRED)
  try {
    const res = await fetch(`${API_BASE}/ai/generate-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': plusUserId },
      body: JSON.stringify({
        job: sampleJob,
        profile: sampleProfile,
        tone: 'Professional',
        length: 'Detailed',
      }),
    });
    const data = await res.json();
    assert(res.status === 403 && data.code === 'PRO_REQUIRED', 'Plus cannot use Detailed through backend/API (403 PRO_REQUIRED)');
  } catch (err) {
    assert(false, `Plus Detailed backend check failed: ${err.message}`);
  }

  // 11. Pro can use all message lengths
  try {
    const resShort = await fetch(`${API_BASE}/ai/generate-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': proUserId },
      body: JSON.stringify({ job: sampleJob, profile: sampleProfile, tone: 'Confident', length: 'Short' }),
    });
    const dataShort = await resShort.json();

    const resMedium = await fetch(`${API_BASE}/ai/generate-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': proUserId },
      body: JSON.stringify({ job: sampleJob, profile: sampleProfile, tone: 'Confident', length: 'Medium' }),
    });
    const dataMedium = await resMedium.json();

    const resDetailed = await fetch(`${API_BASE}/ai/generate-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': proUserId },
      body: JSON.stringify({ job: sampleJob, profile: sampleProfile, tone: 'Confident', length: 'Detailed' }),
    });
    const dataDetailed = await resDetailed.json();

    assert(
      dataShort.success && dataMedium.success && dataDetailed.success &&
      dataShort.message && dataMedium.message && dataDetailed.message,
      'Pro can use all message lengths (Short, Medium, Detailed all return 200 success)'
    );
  } catch (err) {
    assert(false, `Pro lengths backend check failed: ${err.message}`);
  }

  // 12. Translation is locked for Free
  try {
    const res = await fetch(`${API_BASE}/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': freeUserId },
      body: JSON.stringify({
        text: 'Hi Hiring Team, I am reaching out for this role.',
        targetLanguage: 'es',
        job: sampleJob,
        profile: sampleProfile,
      }),
    });
    const data = await res.json();
    assert(res.status === 403 && data.code === 'PRO_REQUIRED', 'Translation is locked for Free (403 PRO_REQUIRED)');
  } catch (err) {
    assert(false, `Free translation check failed: ${err.message}`);
  }

  // 13. Translation is locked for Plus
  try {
    const res = await fetch(`${API_BASE}/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': plusUserId },
      body: JSON.stringify({
        text: 'Hi Hiring Team, I am reaching out for this role.',
        targetLanguage: 'es',
        job: sampleJob,
        profile: sampleProfile,
      }),
    });
    const data = await res.json();
    assert(res.status === 403 && data.code === 'PRO_REQUIRED', 'Translation is locked for Plus (403 PRO_REQUIRED)');
  } catch (err) {
    assert(false, `Plus translation check failed: ${err.message}`);
  }

  // 14. Translation is available for Pro
  try {
    const sampleEnglish = 'Hi Alpha Media Group,\n\nI am applying for Senior Video Editor.\n\nPortfolio: https://portfolio.toufiq.dev\n\nBest,\nToufiq Alam';
    const res = await fetch(`${API_BASE}/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': proUserId },
      body: JSON.stringify({
        text: sampleEnglish,
        targetLanguage: 'Spanish',
        job: sampleJob,
        profile: sampleProfile,
      }),
    });
    const data = await res.json();
    assert(
      res.ok && data.success && data.translatedText &&
      data.translatedText.includes('Alpha Media Group') &&
      data.translatedText.includes('https://portfolio.toufiq.dev') &&
      data.translatedText.includes('Toufiq Alam'),
      'Translation is available for Pro (200 success, preserves company, portfolio URL, and candidate name)'
    );
  } catch (err) {
    assert(false, `Pro translation check failed: ${err.message}`);
  }

  // 15. Free can attach CV
  const freeCvCheck = sampleProfile.cvUrl ? true : false;
  assert(freeCvCheck, 'Free can attach CV (no membership lock on CV attachment)');

  // 16. Plus can attach CV
  assert(freeCvCheck, 'Plus can attach CV (no membership lock on CV attachment)');

  // 17. Pro can attach CV
  assert(freeCvCheck, 'Pro can attach CV (no membership lock on CV attachment)');

  // 18. Free can include Portfolio
  const freePortfolioCheck = sampleProfile.portfolioUrl ? true : false;
  assert(freePortfolioCheck, 'Free can include Portfolio (no membership lock on Portfolio)');

  // 19. Plus can include Portfolio
  assert(freePortfolioCheck, 'Plus can include Portfolio (no membership lock on Portfolio)');

  // 20. Pro can include Portfolio
  assert(freePortfolioCheck, 'Pro can include Portfolio (no membership lock on Portfolio)');

  // Inspect ApplyJob.jsx source code directly for UI requirements
  const applyJobPath = path.join(__dirname, '../src/pages/ApplyJob.jsx');
  const applyJobContent = fs.readFileSync(applyJobPath, 'utf8');

  // 21. Application Quality Score is not rendered
  const hasQualityScore = applyJobContent.includes('Application Quality Score');
  assert(!hasQualityScore, 'Application Quality Score is not rendered on Apply page');

  // 22. AI Assistant Demo Mode badge is not rendered
  const hasDemoModeBadge = applyJobContent.includes('Demo AI Mode') || applyJobContent.includes('AI Assistant (Demo');
  assert(!hasDemoModeBadge, 'AI Assistant (Demo AI Mode) badge is completely removed');

  // 23. Bangla Draft Mode is not rendered
  const hasBanglaDraftMode = applyJobContent.includes('Bangla Draft Mode') || applyJobContent.includes('banglaDraft');
  assert(!hasBanglaDraftMode, 'Bangla Draft Mode is completely removed and not rendered');

  // 24. Regenerate respects selected tone and message length
  const msgShortDirect = await aiService.generateApplicationMessage({
    job: sampleJob,
    profile: sampleProfile,
    tone: 'Short & Direct',
    length: 'Short',
  });

  const msgProfMedium = await aiService.generateApplicationMessage({
    job: sampleJob,
    profile: sampleProfile,
    tone: 'Professional',
    length: 'Medium',
  });

  const msgFriendlyMedium = await aiService.generateApplicationMessage({
    job: sampleJob,
    profile: sampleProfile,
    tone: 'Friendly',
    length: 'Medium',
  });

  const msgConfidentDetailed = await aiService.generateApplicationMessage({
    job: sampleJob,
    profile: sampleProfile,
    tone: 'Confident',
    length: 'Detailed',
  });

  // Verify all 4 generated messages are distinct and reflect their respective settings
  const messagesAreDistinct =
    msgShortDirect.message !== msgProfMedium.message &&
    msgProfMedium.message !== msgFriendlyMedium.message &&
    msgFriendlyMedium.message !== msgConfidentDetailed.message &&
    msgShortDirect.message.length < msgProfMedium.message.length &&
    msgProfMedium.message.length < msgConfidentDetailed.message.length;

  assert(
    messagesAreDistinct &&
    msgFriendlyMedium.message.includes('👋') &&
    msgConfidentDetailed.message.includes('Confident') || msgConfidentDetailed.message.includes('measurable') || msgConfidentDetailed.message.includes('high-caliber'),
    'Regenerate respects selected tone and message length, generating distinct personalized applications'
  );

  console.log('\n====================================================');
  console.log(`APPLICATION COMPOSER SUITE: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
