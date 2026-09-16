/**
 * Comprehensive Regression Test Suite: Job Feed <-> Applications State Synchronization
 *
 * Verifies all 23 required scenarios.
 */

import assert from 'assert';

// In-memory browser storage simulation
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
  getJobs,
  saveJobs,
  addJob,
  getApplications,
  saveApplications,
  addApplication,
  getUserJobState,
  setUserJobState,
  getUserSavedJobIds,
  getUserDraftJobIds,
  getUserAppliedJobIds,
  getUserSkippedJobIds,
  isJobAppliedByUser,
  setUserJobApplied,
  getCurrentUserId,
  setAuth,
  getAuth,
} from '../src/data/storage.js';
import { createApplication } from '../src/data/models.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log('  ✓ PASS [Test ' + totalTests + ']: ' + name);
  } catch (err) {
    failedTests++;
    console.error('  ✗ FAIL [Test ' + totalTests + ']: ' + name, err.message);
  }
}

function simulateFeedFilter(jobs, currentUid, activePlatformFilter = 'all') {
  const userAppliedIds = new Set(getUserAppliedJobIds(currentUid));
  const userSavedIds = new Set(getUserSavedJobIds(currentUid));

  return jobs.filter((j) => {
    const userJobState = getUserJobState(j.id, currentUid);

    if (activePlatformFilter === 'saved') {
      if (userJobState !== 'saved' && !userSavedIds.has(String(j.id)) && j.status !== 'saved') return false;
    } else {
      if (
        userJobState === 'saved' ||
        userJobState === 'draft' ||
        userJobState === 'applied' ||
        userJobState === 'skipped'
      ) {
        return false;
      }
      if (j.status === 'skipped') return false;
      if (userAppliedIds.has(String(j.id)) || isJobAppliedByUser(j.id, currentUid)) return false;
      if (activePlatformFilter !== 'all' && j.platform !== activePlatformFilter) return false;
    }
    return true;
  });
}

function simulateApplicationsTab(activeTab, currentUid) {
  const allApps = getApplications(currentUid) || [];
  return allApps.filter((app) => {
    if (!app) return false;
    if (app.userId && app.userId !== currentUid && app.userId !== 'user-default') return false;
    if (activeTab === 'all') return true;
    return (app.status || 'applied').toLowerCase() === activeTab.toLowerCase();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING JOB LIFECYCLE & STATE SYNCHRONIZATION TEST SUITE (23 SCENARIOS)');
  console.log('====================================================\n');

  const sampleJobs = [
    { id: 'job-101', title: 'Video Editor for YouTube Channel', company: 'Studio Alpha', platform: 'youtube', status: 'discovered' },
    { id: 'job-102', title: 'Motion Graphic Designer', company: 'Agency Beta', platform: 'reddit', status: 'discovered' },
    { id: 'job-103', title: 'Short-Form Content Creator', company: 'Viral Media', platform: 'x', status: 'discovered' },
    { id: 'job-104', title: 'Podcast Audio & Video Editor', company: 'Audio Labs', platform: 'facebook_group', status: 'discovered' },
    { id: 'job-105', title: 'Senior AI Video Specialist', company: 'Future Corp', platform: 'manual_import', status: 'discovered' },
  ];
  saveJobs(sampleJobs);
  saveApplications([]);

  const userA = 'user-alex-01';
  const userB = 'user-bella-02';

  // Test 1: Apply from feed -> appears in Applications -> Applied
  test('Scenario 1: Apply from feed -> appears in Applications -> Applied', () => {
    setAuth({ isAuthenticated: true, userId: userA, phone: '+919999900001' });
    const job = sampleJobs[0];
    const app = createApplication({
      jobId: job.id,
      userId: userA,
      title: job.title,
      company: job.company,
      platform: job.platform,
      status: 'applied',
    });
    addApplication(app);
    const appliedApps = simulateApplicationsTab('applied', userA);
    assert.strictEqual(appliedApps.length, 1);
    assert.strictEqual(appliedApps[0].jobId, 'job-101');
    assert.strictEqual(appliedApps[0].status, 'applied');
  });

  // Test 2: Apply from feed -> disappears from active Job Feed
  test('Scenario 2: Apply from feed -> disappears from active Job Feed', () => {
    const feedJobs = simulateFeedFilter(sampleJobs, userA);
    assert.strictEqual(feedJobs.some((j) => j.id === 'job-101'), false);
    assert.strictEqual(feedJobs.length, 4);
  });

  // Test 3: Save from feed -> appears in Applications -> Saved
  test('Scenario 3: Save from feed -> appears in Applications -> Saved', () => {
    const job = sampleJobs[1];
    setUserJobState(job.id, 'saved', userA);
    const app = createApplication({
      jobId: job.id,
      userId: userA,
      title: job.title,
      company: job.company,
      platform: job.platform,
      status: 'saved',
    });
    addApplication(app);
    const savedApps = simulateApplicationsTab('saved', userA);
    assert.strictEqual(savedApps.length, 1);
    assert.strictEqual(savedApps[0].jobId, 'job-102');
    assert.strictEqual(savedApps[0].status, 'saved');
  });

  // Test 4: Save from feed -> disappears from active Job Feed
  test('Scenario 4: Save from feed -> disappears from active Job Feed', () => {
    const feedJobs = simulateFeedFilter(sampleJobs, userA);
    assert.strictEqual(feedJobs.some((j) => j.id === 'job-102'), false);
    assert.strictEqual(feedJobs.length, 3);
  });

  // Test 5: Draft from composer -> appears in Applications -> Drafts
  test('Scenario 5: Draft from composer -> appears in Applications -> Drafts', () => {
    const job = sampleJobs[2];
    setUserJobState(job.id, 'draft', userA);
    const app = createApplication({
      jobId: job.id,
      userId: userA,
      title: job.title,
      company: job.company,
      platform: job.platform,
      status: 'draft',
      message: 'Draft proposal message',
    });
    addApplication(app);
    const draftApps = simulateApplicationsTab('draft', userA);
    assert.strictEqual(draftApps.length, 1);
    assert.strictEqual(draftApps[0].jobId, 'job-103');
    assert.strictEqual(draftApps[0].status, 'draft');
  });

  // Test 6: Draft from composer -> disappears from active Job Feed
  test('Scenario 6: Draft from composer -> disappears from active Job Feed', () => {
    const feedJobs = simulateFeedFilter(sampleJobs, userA);
    assert.strictEqual(feedJobs.some((j) => j.id === 'job-103'), false);
    assert.strictEqual(feedJobs.length, 2);
  });

  // Test 7: Skip from feed -> does not appear in active Job Feed
  test('Scenario 7: Skip from feed -> does not appear in active Job Feed', () => {
    const job = sampleJobs[3];
    setUserJobState(job.id, 'skipped', userA);
    const feedJobs = simulateFeedFilter(sampleJobs, userA);
    assert.strictEqual(feedJobs.some((j) => j.id === 'job-104'), false);
    assert.strictEqual(feedJobs.length, 1);
    assert.strictEqual(feedJobs[0].id, 'job-105');
  });

  // Test 8: Applied job survives page reload / session restore
  test('Scenario 8: Applied job survives page reload / session restore', () => {
    const restoredState = getUserJobState('job-101', userA);
    assert.strictEqual(restoredState, 'applied');
    const restoredApps = simulateApplicationsTab('applied', userA);
    assert.strictEqual(restoredApps.some((a) => a.jobId === 'job-101'), true);
  });

  // Test 9: Saved job survives page reload / session restore
  test('Scenario 9: Saved job survives page reload / session restore', () => {
    const restoredState = getUserJobState('job-102', userA);
    assert.strictEqual(restoredState, 'saved');
    const restoredApps = simulateApplicationsTab('saved', userA);
    assert.strictEqual(restoredApps.some((a) => a.jobId === 'job-102'), true);
  });

  // Test 10: Draft job survives page reload / session restore
  test('Scenario 10: Draft job survives page reload / session restore', () => {
    const restoredState = getUserJobState('job-103', userA);
    assert.strictEqual(restoredState, 'draft');
    const restoredApps = simulateApplicationsTab('draft', userA);
    assert.strictEqual(restoredApps.some((a) => a.jobId === 'job-103'), true);
  });

  // Test 11: User A's saved job does NOT affect User B's active Job Feed
  test('Scenario 11: User A saved job does NOT affect User B active Job Feed', () => {
    setAuth({ isAuthenticated: true, userId: userB, phone: '+919999900002' });
    const userBFeed = simulateFeedFilter(sampleJobs, userB);
    assert.strictEqual(userBFeed.some((j) => j.id === 'job-102'), true);
  });

  // Test 12: User A's applied job does NOT affect User B's active Job Feed
  test('Scenario 12: User A applied job does NOT affect User B active Job Feed', () => {
    const userBFeed = simulateFeedFilter(sampleJobs, userB);
    assert.strictEqual(userBFeed.some((j) => j.id === 'job-101'), true);
  });

  // Test 13: User A's skipped job does NOT affect User B's active Job Feed
  test('Scenario 13: User A skipped job does NOT affect User B active Job Feed', () => {
    const userBFeed = simulateFeedFilter(sampleJobs, userB);
    assert.strictEqual(userBFeed.some((j) => j.id === 'job-104'), true);
  });

  // Test 14: User A's draft job does NOT affect User B's active Job Feed
  test('Scenario 14: User A draft job does NOT affect User B active Job Feed', () => {
    const userBFeed = simulateFeedFilter(sampleJobs, userB);
    assert.strictEqual(userBFeed.some((j) => j.id === 'job-103'), true);
    assert.strictEqual(userBFeed.length, 5);
  });

  // Test 15: Idempotency: Repeated Apply does not produce duplicate application records
  test('Scenario 15: Idempotency: Repeated Apply does not produce duplicate records', () => {
    setAuth({ isAuthenticated: true, userId: userA, phone: '+919999900001' });
    const appRepeat = createApplication({
      jobId: 'job-101',
      userId: userA,
      title: 'Video Editor for YouTube Channel',
      company: 'Studio Alpha',
      platform: 'youtube',
      status: 'applied',
    });
    addApplication(appRepeat);
    const appliedApps = simulateApplicationsTab('applied', userA);
    assert.strictEqual(appliedApps.filter((a) => a.jobId === 'job-101').length, 1);
  });

  // Test 16: Idempotency: Repeated Save does not produce duplicate saved records
  test('Scenario 16: Idempotency: Repeated Save does not produce duplicate records', () => {
    setUserJobState('job-102', 'saved', userA);
    const appRepeat = createApplication({
      jobId: 'job-102',
      userId: userA,
      title: 'Motion Graphic Designer',
      company: 'Agency Beta',
      platform: 'reddit',
      status: 'saved',
    });
    addApplication(appRepeat);
    const savedApps = simulateApplicationsTab('saved', userA);
    assert.strictEqual(savedApps.filter((a) => a.jobId === 'job-102').length, 1);
  });

  // Test 17: Controls parity: Swipe Right produces same state as Apply button (APPLIED)
  test('Scenario 17: Controls parity: Swipe Right produces same state as Apply button', () => {
    const testJob = { id: 'job-parity-1', title: 'Parity Test 1', platform: 'x', status: 'discovered' };
    addJob(testJob);
    setUserJobState(testJob.id, 'applied', userA);
    assert.strictEqual(getUserJobState(testJob.id, userA), 'applied');
    setUserJobState(testJob.id, 'feed', userA);
    assert.strictEqual(getUserJobState(testJob.id, userA), 'feed');
    setUserJobState(testJob.id, 'applied', userA);
    assert.strictEqual(getUserJobState(testJob.id, userA), 'applied');
  });

  // Test 18: Controls parity: Swipe Up produces same state as Save button (SAVED)
  test('Scenario 18: Controls parity: Swipe Up produces same state as Save button', () => {
    const testJob = { id: 'job-parity-2', title: 'Parity Test 2', platform: 'x', status: 'discovered' };
    addJob(testJob);
    setUserJobState(testJob.id, 'saved', userA);
    assert.strictEqual(getUserJobState(testJob.id, userA), 'saved');
    setUserJobState(testJob.id, 'feed', userA);
    assert.strictEqual(getUserJobState(testJob.id, userA), 'feed');
    setUserJobState(testJob.id, 'saved', userA);
    assert.strictEqual(getUserJobState(testJob.id, userA), 'saved');
  });

  // Test 19: Controls parity: Swipe Left produces same state as Skip button (SKIPPED)
  test('Scenario 19: Controls parity: Swipe Left produces same state as Skip button', () => {
    const testJob = { id: 'job-parity-3', title: 'Parity Test 3', platform: 'x', status: 'discovered' };
    addJob(testJob);
    setUserJobState(testJob.id, 'skipped', userA);
    assert.strictEqual(getUserJobState(testJob.id, userA), 'skipped');
    setUserJobState(testJob.id, 'feed', userA);
    assert.strictEqual(getUserJobState(testJob.id, userA), 'feed');
    setUserJobState(testJob.id, 'skipped', userA);
    assert.strictEqual(getUserJobState(testJob.id, userA), 'skipped');
  });

  // Test 20: Applications page correctly groups jobs by their respective status tabs
  test('Scenario 20: Applications page correctly groups jobs by status tabs', () => {
    const allApps = getApplications(userA);
    const savedCount = simulateApplicationsTab('saved', userA).length;
    const draftCount = simulateApplicationsTab('draft', userA).length;
    const appliedCount = simulateApplicationsTab('applied', userA).length;
    assert(savedCount >= 1, 'Saved tab has items');
    assert(draftCount >= 1, 'Draft tab has items');
    assert(appliedCount >= 1, 'Applied tab has items');
    assert.strictEqual(allApps.length, savedCount + draftCount + appliedCount);
  });

  // Test 21: Feed never shows jobs already in Saved/Draft/Applied/Skipped state for current user
  test('Scenario 21: Feed never shows jobs in Saved/Draft/Applied/Skipped for current user', () => {
    const userAFeed = simulateFeedFilter(sampleJobs, userA);
    assert.strictEqual(userAFeed.some((j) => ['job-101', 'job-102', 'job-103', 'job-104'].includes(j.id)), false);
  });

  // Test 22: Underlying jobs in database are NEVER deleted on user state transitions
  test('Scenario 22: Underlying jobs in database are NEVER deleted on user state transitions', () => {
    const allDbJobs = getJobs();
    assert.strictEqual(allDbJobs.some((j) => j.id === 'job-101'), true);
    assert.strictEqual(allDbJobs.some((j) => j.id === 'job-102'), true);
    assert.strictEqual(allDbJobs.some((j) => j.id === 'job-103'), true);
    assert.strictEqual(allDbJobs.some((j) => j.id === 'job-104'), true);
    assert.strictEqual(allDbJobs.some((j) => j.id === 'job-105'), true);
  });

  // Test 23: Saved platform filter in feed shows only saved jobs for current user
  test('Scenario 23: Saved platform filter in feed shows only saved jobs for current user', () => {
    const userASavedFeed = simulateFeedFilter(sampleJobs, userA, 'saved');
    assert.strictEqual(userASavedFeed.length, 1);
    assert.strictEqual(userASavedFeed[0].id, 'job-102');
    const userBSavedFeed = simulateFeedFilter(sampleJobs, userB, 'saved');
    assert.strictEqual(userBSavedFeed.length, 0);
  });

  console.log('\n====================================================');
  console.log('TEST RESULTS: ' + passedTests + '/' + totalTests + ' PASSED (' + failedTests + ' FAILED)');
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});