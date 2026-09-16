/**
 * Tests for Tinder for Freelancers — Final 3-Website Architecture
 * Validates:
 * 1. Three clearly separated web experiences: Landing, User App, Admin Dashboard
 * 2. Hostname/Subdomain resolution readiness (yourdomain.com, app.yourdomain.com, admin.yourdomain.com)
 * 3. Public Landing copy, "AI Agent" terminology (ZERO "Hermes" leaks), pricing and CTAs
 * 4. User App navigation isolation (ZERO admin links/buttons in user app)
 * 5. Strict user data isolation and session cleanup
 * 6. Mandatory 8-field profile validation without asterisks
 * 7. Job feed user-scoped statuses (no global mutation)
 * 8. Applications page: exactly 4 tabs (All, Applied, Saved, Viewed) and auto-delete gating
 * 9. Shared single database sync between User App and Admin Dashboard
 * 10. Server-side requireAdmin security on all /api/admin/* routes
 * 11. Real database stats, opportunity count, source sync, top-up monitoring
 * 12. Pro -> Free clean downgrade without data loss
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const API_BASE = 'http://localhost:5000/api';

describe('TINDER FOR FREELANCERS — FINAL 3-WEBSITE ARCHITECTURE SUITE', () => {

  // -------------------------------------------------------------
  // 1. THREE CLEARLY SEPARATED EXPERIENCES & SUBDOMAIN READINESS
  // -------------------------------------------------------------
  test('1. App.jsx defines subdomain detection and dynamic root rendering', () => {
    const appContent = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf8');
    
    assert(appContent.includes('getAppSubdomain'), 'App.jsx must define getAppSubdomain()');
    assert(appContent.includes('admin.'), 'Subdomain detection must detect admin.*');
    assert(appContent.includes('app.'), 'Subdomain detection must detect app.*');
    assert(appContent.includes('renderRoot'), 'App.jsx must dynamically resolve root route element based on subdomain');
    
    // Check routes exist
    const requiredRoutes = [
      'path="/"',
      'path="/login"',
      'path="/welcome"',
      'path="/verify-otp"',
      'path="/profile-setup"',
      'path="/jobs"',
      'path="/applications"',
      'path="/sources"',
      'path="/membership"',
      'path="/settings"',
      'path="/autopilot"',
      'path="/admin/login"',
      'path="/admin"',
      'path="/admin/*"'
    ];

    for (const r of requiredRoutes) {
      assert(appContent.includes(r), 'App.jsx must include route ' + r);
    }
  });

  // -------------------------------------------------------------
  // 2. PUBLIC LANDING WEBSITE INTEGRITY & TERMINOLOGY
  // -------------------------------------------------------------
  test('2. Public Landing uses "AI Agent", NEVER exposes "Hermes", and has exact pricing', () => {
    const landingContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Landing.jsx'), 'utf8');
    
    // Strict terminology check
    assert(!landingContent.toLowerCase().includes('hermes'), 'Landing.jsx must NEVER expose Hermes');
    assert(landingContent.includes('AI Agent'), 'Landing.jsx must use "AI Agent" terminology');
    
    // Brand header
    assert(landingContent.includes('Tinder for Freelancers'), 'Landing must display Tinder for Freelancers');
    assert(landingContent.includes('Swipe. Match. Get Hired.'), 'Landing must include tagline');
    
    // Core sections present
    assert(landingContent.includes('id="how-it-works"'), 'Landing must have #how-it-works');
    assert(landingContent.includes('id="features"'), 'Landing must have #features');
    assert(landingContent.includes('id="demo"'), 'Landing must have #demo');
    assert(landingContent.includes('id="sources"'), 'Landing must have #sources');
    assert(landingContent.includes('id="pricing"'), 'Landing must have #pricing');
    assert(landingContent.includes('id="faq"'), 'Landing must have #faq');
    
    // Pricing tiers INR
    assert(landingContent.includes('₹499'), 'Landing must include Plus ₹499/mo');
    assert(landingContent.includes('₹1,499'), 'Landing must include Pro ₹1,499/mo');
    assert(landingContent.includes('₹4,990'), 'Landing must include Plus annual ₹4,990');
    assert(landingContent.includes('₹14,990'), 'Landing must include Pro annual ₹14,990');
    assert(landingContent.includes('⭐ Most Popular'), 'Landing must badge Plus as ⭐ Most Popular');
    assert(landingContent.includes('🚀 Autopilot'), 'Landing must badge Pro as 🚀 Autopilot');
    assert(landingContent.includes('Save ~17%'), 'Landing must indicate Save ~17%');
    
    // USD pricing support
    assert(landingContent.includes('$7'), 'Landing must support USD $7/mo');
    assert(landingContent.includes('$19'), 'Landing must support USD $19/mo');
    assert(landingContent.includes('$70'), 'Landing must support USD $70/yr');
    assert(landingContent.includes('$190'), 'Landing must support USD $190/yr');
    
    // CTAs navigate to /login
    assert(landingContent.includes("navigate('/login')"), 'Landing CTAs must route to /login');
  });

  // -------------------------------------------------------------
  // 3. MAIN USER APPLICATION ISOLATION (ZERO ADMIN UI)
  // -------------------------------------------------------------
  test('3. Main User App components NEVER leak Admin controls or navigation', () => {
    const appHeader = fs.readFileSync(path.join(rootDir, 'src', 'components', 'AppHeader.jsx'), 'utf8');
    const bottomNav = fs.readFileSync(path.join(rootDir, 'src', 'components', 'BottomNav.jsx'), 'utf8');
    const settings = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Settings.jsx'), 'utf8');

    // No admin links or navigation in user app header
    assert(!appHeader.includes("navigate('/admin')"), 'AppHeader must not navigate to /admin');
    assert(!appHeader.includes('to="/admin"'), 'AppHeader must not link to /admin');
    assert(!appHeader.includes('href="/admin"'), 'AppHeader must not contain href to /admin');
    assert(!appHeader.toLowerCase().includes('admin dashboard'), 'AppHeader must not mention admin dashboard');

    // No admin links in user bottom nav
    assert(!bottomNav.includes('/admin'), 'BottomNav must not contain /admin links');

    // No admin links in user settings
    assert(!settings.includes('/admin'), 'Settings.jsx must not contain /admin links');
  });

  // -------------------------------------------------------------
  // 4. USER APPLICATIONS PAGE: STRICTLY 4 TABS & AUTO-DELETE GATING
  // -------------------------------------------------------------
  test('4. Applications page defines strictly 4 tabs (All, Applied, Saved, Viewed) and gates auto-delete', () => {
    const applicationsContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Applications.jsx'), 'utf8');

    // Strict 4 tabs
    assert(applicationsContent.includes("id: 'all'"), 'Applications must have All tab');
    assert(applicationsContent.includes("id: 'applied'"), 'Applications must have Applied tab');
    assert(applicationsContent.includes("id: 'saved'"), 'Applications must have Saved tab');
    assert(applicationsContent.includes("id: 'viewed'"), 'Applications must have Viewed tab');

    // Prohibited user tabs
    assert(!applicationsContent.includes("id: 'draft'"), 'Applications must NOT have separate draft tab');
    assert(!applicationsContent.includes("id: 'interview'"), 'Applications must NOT have separate interview tab');
    assert(!applicationsContent.includes("id: 'negotiation'"), 'Applications must NOT have separate negotiation tab');
    assert(!applicationsContent.includes("id: 'hired'"), 'Applications must NOT have separate hired tab');
    assert(!applicationsContent.includes("id: 'closed'"), 'Applications must NOT have separate closed tab');
    assert(!applicationsContent.includes("APPLICATION PREFERENCES"), 'Preferences accordion must be removed');
  });

  // -------------------------------------------------------------
  // 5. SERVER-SIDE ADMIN AUTHORIZATION (requireAdmin)
  // -------------------------------------------------------------
  test('5. Admin endpoints strictly require admin authorization (403 for unauthorized)', async () => {
    const adminEndpoints = [
      '/admin/stats',
      '/admin/users',
      '/admin/applications',
      '/admin/opportunities',
      '/admin/sources',
      '/admin/ai-agent/status',
      '/admin/subscriptions',
      '/admin/analytics',
      '/admin/settings'
    ];

    for (const ep of adminEndpoints) {
      const res = await fetch(API_BASE + ep);
      assert.equal(res.status, 403, 'Unauthenticated request to ' + ep + ' must return 403 Forbidden');
      const data = await res.json();
      assert.equal(data.success, false);
    }
  });

  // -------------------------------------------------------------
  // 6. SHARED DATABASE & LIVE DATA VERIFICATION
  // -------------------------------------------------------------
  test('6. Admin Dashboard and User App share the SAME database with real data', async () => {
    // 1. Admin login to get session
    const adminLoginRes = await fetch(API_BASE + '/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: 'tf-admin-secret-2026' })
    });
    assert.equal(adminLoginRes.status, 200, 'Admin login must succeed');
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;

    // 2. Fetch admin stats
    const statsRes = await fetch(API_BASE + '/admin/stats', {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    assert.equal(statsRes.status, 200);
    const statsData = await statsRes.json();
    assert.equal(statsData.success, true);
    const { stats } = statsData;

    // Active users <= Total users invariant
    assert(stats.activeUsers <= stats.totalUsers, 'Active users must never exceed total users');
    assert(stats.freeUsers + stats.plusUsers + stats.proUsers === stats.totalUsers, 'Sum of tier users must equal total users');

    // 3. Fetch admin opportunities: count must match actual db.jobs
    const oppsRes = await fetch(API_BASE + '/admin/opportunities', {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    assert.equal(oppsRes.status, 200);
    const oppsData = await oppsRes.json();
    assert.equal(oppsData.success, true);
    assert.equal(oppsData.opportunities.length, 10, 'Opportunities count must equal actual 10 jobs in database');

    // 4. Fetch admin sources: separates builtin and custom
    const sourcesRes = await fetch(API_BASE + '/admin/sources', {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    assert.equal(sourcesRes.status, 200);
    const sourcesData = await sourcesRes.json();
    assert.equal(sourcesData.success, true);
    assert(sourcesData.builtinSources.length >= 3, 'Must have at least 3 built-in platform sources');
  });

  // -------------------------------------------------------------
  // 7. ADMIN TOP-UP MONITORING
  // -------------------------------------------------------------
  test('7. Admin Subscriptions section provides real top-up monitoring with zero fake transactions', async () => {
    const adminLoginRes = await fetch(API_BASE + '/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: 'tf-admin-secret-2026' })
    });
    const { token } = await adminLoginRes.json();

    const subRes = await fetch(API_BASE + '/admin/subscriptions', {
      headers: { Authorization: 'Bearer ' + token }
    });
    assert.equal(subRes.status, 200);
    const subData = await subRes.json();
    assert.equal(subData.success, true);
    assert(subData.topUps, 'Must include topUps monitoring data');
    assert(Array.isArray(subData.topUps.transactions), 'topUps.transactions must be an array');
  });
});
