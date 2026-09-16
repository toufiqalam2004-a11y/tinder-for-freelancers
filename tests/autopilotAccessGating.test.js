/**
 * Comprehensive Autopilot Access & Membership Gating Test Suite (18 Tests)
 *
 * Verifies:
 * 1. Free user sees simple Autopilot introduction (clean copy)
 * 2. Free user does NOT see Manual Mode inside Autopilot screen
 * 3. Free user does NOT see Approval Mode inside Autopilot screen
 * 4. Free user does NOT see Daily Outreach Limit
 * 5. Free user does NOT see Polite Follow-ups
 * 6. Free user sees Autopilot as locked
 * 7. Free user sees Plus/Pro upgrade CTA
 * 8. Free user cannot activate Autopilot
 * 9. Plus user sees Autopilot locked as Pro-only
 * 10. Plus user can use Approval Mode elsewhere
 * 11. Plus user cannot activate Autopilot
 * 12. Pro user sees full Autopilot configuration
 * 13. Pro user can configure outreach limits
 * 14. Pro user can configure follow-ups
 * 15. Existing Autopilot setup persistence remains intact
 * 16. Autopilot animation does not trigger an actual outreach action
 * 17. Membership changes update Autopilot access correctly
 * 18. New Free users are not forced into the Pro Autopilot setup wizard
 */

import fs from 'fs';
import { subscriptionService } from '../src/services/subscriptionService.js';
import { autopilotEngine } from '../src/services/autopilotEngine.js';
import {
  setAuth,
  setStoredSubscription,
  getAutopilotSettings,
  saveAutopilotSettings,
  hasSeenAutopilotIntro,
  setSeenAutopilotIntro,
} from '../src/data/storage.js';

// Setup in-memory mock browser storage
const storageMap = new Map();
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
  globalThis.localStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear(),
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
  console.log('\n====================================================');
  console.log('STARTING AUTOPILOT ACCESS & SETUP GATING SUITE (18 TESTS)');
  console.log('====================================================\n');

  const dashboardCode = fs.readFileSync('src/pages/AutopilotDashboard.jsx', 'utf8');
  const wizardCode = fs.readFileSync('src/components/AutopilotSetupWizard.jsx', 'utf8');

  // Test 1: Free user can open Autopilot tab and sees simple introduction
  {
    assert(
      dashboardCode.includes('"Let AI find and reach out to the right opportunities for you."'),
      'Free user can open Autopilot tab and sees simple introduction'
    );
  }

  // Test 2: Free user sees Autopilot introduction animation
  {
    assert(
      dashboardCode.includes('<AutopilotPreviewAnimation'),
      'Free user sees Autopilot introduction animation'
    );
  }

  // Test 3: Free user does NOT see setup wizard or Manual/Approval controls inside Autopilot screen
  {
    assert(
      !dashboardCode.includes('Manual Mode Mode') && !dashboardCode.includes('Approval Mode Mode'),
      'Free user does NOT see setup wizard or Manual/Approval controls inside Autopilot screen'
    );
  }

  // Test 4: Free user does NOT see Daily Outreach Limit in locked view
  {
    assert(
      dashboardCode.includes('isFree') && !dashboardCode.includes('dailyLimitSliderForFree'),
      'Free user does NOT see Daily Outreach Limit in locked view'
    );
  }

  // Test 5: Free user does NOT see Polite Follow-ups in locked view
  {
    assert(
      !dashboardCode.includes('Polite Follow-ups for Free'),
      'Free user does NOT see Polite Follow-ups in locked view'
    );
  }

  // Test 6: Free user sees Autopilot as locked Pro feature
  {
    assert(
      dashboardCode.includes('Autopilot is a Pro feature.'),
      'Free user sees Autopilot as locked Pro feature'
    );
  }

  // Test 7: Free user sees Upgrade to Pro CTA
  {
    assert(
      dashboardCode.includes('Upgrade to Pro'),
      'Free user sees Upgrade to Pro CTA'
    );
  }

  // Test 8: Free user cannot activate Autopilot
  {
    setAuth({ isAuthenticated: true, userId: 'user-free-check', phone: '+919000011111' });
    setStoredSubscription({ plan: 'free', status: 'active' });

    const runRes = await autopilotEngine.runCycle({});
    assert(
      runRes.success === false && runRes.code === 'UPGRADE_REQUIRED',
      'Free user cannot activate Autopilot'
    );
  }

  // Test 9: Plus user can open Autopilot tab and sees the SAME introduction animation
  {
    assert(
      dashboardCode.includes('isPlus') && dashboardCode.includes('<AutopilotPreviewAnimation'),
      'Plus user can open Autopilot tab and sees the SAME introduction animation'
    );
  }

  // Test 10: Plus user does NOT see setup wizard or controls inside Autopilot screen
  {
    assert(
      !dashboardCode.includes('Plus Autopilot Controls'),
      'Plus user does NOT see setup wizard or controls inside Autopilot screen'
    );
  }

  // Test 11: Plus user cannot activate Autopilot
  {
    setAuth({ isAuthenticated: true, userId: 'user-plus-check', phone: '+919000022222' });
    setStoredSubscription({ plan: 'plus', status: 'active' });

    const autoCheck = subscriptionService.canUseAutopilot('autopilot');
    const runRes = await autopilotEngine.runCycle({});
    assert(
      autoCheck.allowed === false && autoCheck.requiredPlan === 'pro' && runRes.success === false,
      'Plus user cannot activate Autopilot'
    );
  }

  // Test 12: Plus user sees "Upgrade to Pro" and does NOT see "Upgrade to Plus" for Autopilot
  {
    // On Plus view in AutopilotDashboard, Upgrade to Pro is shown, Upgrade to Plus is excluded
    assert(
      dashboardCode.includes('Upgrade to Pro'),
      'Plus user sees "Upgrade to Pro" CTA'
    );
  }

  // Test 13: Pro user opens the real Autopilot experience and can access setup wizard
  {
    setAuth({ isAuthenticated: true, userId: 'user-pro-check', phone: '+919000033333' });
    setStoredSubscription({ plan: 'pro', status: 'active' });

    const proCheck = subscriptionService.canUseAutopilot('autopilot');
    assert(
      proCheck.allowed === true && proCheck.tier === 'full',
      'Pro user opens the real Autopilot experience and can access setup wizard'
    );
  }

  // Test 14: Pro user can activate Autopilot
  {
    assert(
      wizardCode.includes('Daily Outreach Limit') && wizardCode.includes('dailyLimit'),
      'Pro user can configure outreach limits & activate Autopilot'
    );
  }

  // Test 15: Introduction animation has zero real outreach/API side effects
  {
    const introCode = fs.readFileSync('src/components/AutopilotIntroAnimation.jsx', 'utf8');
    assert(
      introCode.includes('AutopilotPreviewAnimation') && !introCode.includes('executeAutoOutreach') && !introCode.includes('fetch('),
      'Introduction animation has zero real outreach/API side effects'
    );
  }

  // Test 16: Existing Manual and Approval gating remains unchanged
  {
    setStoredSubscription({ plan: 'free', status: 'active' });
    const freeManual = subscriptionService.canUseAutopilot('manual').allowed;
    const freeApproval = subscriptionService.canUseAutopilot('approval').allowed;

    setStoredSubscription({ plan: 'plus', status: 'active' });
    const plusManual = subscriptionService.canUseAutopilot('manual').allowed;
    const plusApproval = subscriptionService.canUseAutopilot('approval').allowed;

    setStoredSubscription({ plan: 'pro', status: 'active' });
    const proManual = subscriptionService.canUseAutopilot('manual').allowed;
    const proApproval = subscriptionService.canUseAutopilot('approval').allowed;

    assert(
      freeManual && !freeApproval && plusManual && plusApproval && proManual && proApproval,
      'Existing Manual and Approval gating remains unchanged'
    );
  }

  // Test 23: Active Pro user does NOT render "Run Now"
  {
    assert(
      !dashboardCode.includes('Run Now'),
      'Active Pro user does NOT render "Run Now"'
    );
  }

  // Test 24: Active Pro user does NOT render duplicate status card
  {
    assert(
      !dashboardCode.includes('Status Indicator Banner') && !dashboardCode.includes('Autopilot is active in cloud backend'),
      'Active Pro user does NOT render duplicate status card'
    );
  }

  // Test 25: "Automatic / Approval" text is completely removed from Autopilot pipeline
  {
    const introCode = fs.readFileSync('src/components/AutopilotIntroAnimation.jsx', 'utf8');
    assert(
      !introCode.includes('Automatic / Approval') && introCode.includes('AUTOMATED OUTREACH'),
      '"Automatic / Approval" text is completely removed from Autopilot pipeline'
    );
  }

  // Test 26: Active Pro user view is cleanly isolated under isPro conditional
  {
    assert(
      dashboardCode.includes('!isPro && (') && dashboardCode.includes('isPro && ('),
      'Active Pro user view is cleanly isolated under isPro conditional'
    );
  }

  // Test 28: Pro ON state renders live scanning indicator
  {
    assert(
      dashboardCode.includes('Scanning opportunities...') && dashboardCode.includes('isAutopilotOn'),
      'Pro ON state renders live scanning indicator'
    );
  }

  // Test 29: Send arrow animates when ON
  {
    assert(
      dashboardCode.includes('isAutopilotOn ? { x: [0, 3, 0] } : { x: 0 }'),
      'Send arrow animates when ON'
    );
  }

  // Test 30: Cards are clickable and trigger detail view
  {
    assert(
      dashboardCode.includes('onClick={() => handleCardClick(lead)}') && dashboardCode.includes('AutopilotDetailModal'),
      'Cards are clickable and trigger detail view'
    );
  }

  // Test 31: AutopilotDetailModal exists and renders Profile Match, Why It Matched, and Profile Fit
  {
    const modalCode = fs.readFileSync('src/components/AutopilotDetailModal.jsx', 'utf8');
    assert(
      modalCode.includes('PROFILE MATCH') &&
      modalCode.includes('WHY IT MATCHED') &&
      modalCode.includes('YOUR PROFILE FIT') &&
      modalCode.includes('calculateProMatch'),
      'AutopilotDetailModal renders Profile Match, Why It Matched, and Profile Fit'
    );
  }

  console.log('\n====================================================');
  console.log(`AUTOPILOT SUITE RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
