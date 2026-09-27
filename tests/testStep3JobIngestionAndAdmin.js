/**
 * Step 3 Integration Test:
 * Connect Qualified AI-Discovered Jobs to Existing Job System + Admin AI Agent Monitoring
 */
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/database.js';

const BASE_URL = 'http://localhost:5000';
const ADMIN_PASSKEY = process.env.ADMIN_SECRET_KEY || 'tf-admin-secret-2026';

const sampleVideoEditorOpportunity = {
  title: 'Lead Short-Form Video Editor (YouTube Shorts & Reels)',
  company: 'Creator Media Studio',
  description: 'Looking for a talented Video Editor to cut high-retention vertical videos, color grade, add kinetic subtitles and sound effects in Premiere Pro and After Effects.',
  source: 'Agent Reach',
  sourceUrl: 'https://remote-creators.example.com/jobs/video-editor-step3-test',
  applicationUrl: 'https://remote-creators.example.com/jobs/video-editor-step3-test/apply',
  location: 'Remote',
  remote: true,
  skills: ['Premiere Pro', 'After Effects', 'Short-form Video', 'Reels', 'Color Grading'],
  salary: '$40 - $60 / hr',
  jobType: 'freelance',
  postedAt: new Date().toISOString(),
};

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('Step 3: AI-Discovered Jobs Feed Ingestion & Admin AI Agent Telemetry', async (t) => {
  let adminToken = null;

  // 1. Admin Authentication
  await t.test('1. Admin authenticates via /api/admin/auth/login', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.token, 'Expected admin token');
    adminToken = data.token;
  });

  // 2. Discover endpoint with persist: true and qualified opportunity
  await t.test('2. POST /api/agent/discover persists qualified jobs to db.jobs', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/agent/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persist: true,
        limitPerQuery: 2,
        rawItems: [sampleVideoEditorOpportunity],
      }),
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.summary.rawDiscovered, 1);
    assert.strictEqual(data.summary.uniqueOpportunities, 1);
    assert.strictEqual(data.summary.qualified, 1);
    assert.strictEqual(data.summary.ingested, 1);
    assert.strictEqual(data.totalIngested, 1);

    // Verify job persisted in local database
    const allJobs = db.jobs.findAll();
    const aiDiscoveredJobs = allJobs.filter((j) => j.isAiDiscovered === true);
    assert.ok(aiDiscoveredJobs.length >= 1, 'AI jobs should exist in db.jobs');

    const sampleJob = aiDiscoveredJobs.find((j) => j.sourceUrl?.includes('video-editor-step3-test'));
    assert.ok(sampleJob, 'Specific ingested job should be found in db.jobs');
    assert.strictEqual(sampleJob.isAiDiscovered, true);
    assert.strictEqual(sampleJob.status, 'new');
    assert.strictEqual(sampleJob.title, sampleVideoEditorOpportunity.title);
    assert.strictEqual(sampleJob.company, sampleVideoEditorOpportunity.company);
    assert.ok(sampleJob.matchScore >= 60, `Match score ${sampleJob.matchScore} should be >= 60`);
    assert.ok(sampleJob.matchReasons && sampleJob.matchReasons.length > 0, 'Should have match reasons');
  });

  // 3. User Feed Visibility Verification
  await t.test('3. GET /api/jobs returns AI-discovered opportunities in user feed', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/jobs`);
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.jobs), 'Response should contain jobs array');

    const aiJobInFeed = data.jobs.find((j) => j.isAiDiscovered === true && j.sourceUrl?.includes('video-editor-step3-test'));
    assert.ok(aiJobInFeed, 'Feed should include the AI-discovered job');
    assert.strictEqual(aiJobInFeed.status, 'new');
    assert.strictEqual(aiJobInFeed.isAiDiscovered, true);
  });

  // 4. Admin AI Agent Status & Telemetry
  await t.test('4. GET /api/admin/ai-agent/status returns Hermes + Agent Reach telemetry', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/ai-agent/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.aiAgent, 'aiAgent object should be present');
    assert.strictEqual(data.aiAgent.isConfigured, true);
    assert.strictEqual(data.aiAgent.services.hermes, 'connected');
    assert.strictEqual(data.aiAgent.services.agentReach, 'connected');
    assert.strictEqual(data.aiAgent.services.qualificationEngine, 'connected');
    assert.strictEqual(data.aiAgent.services.n8n, 'ready');

    assert.ok(typeof data.aiAgent.metrics.aiIngested === 'number');
    assert.ok(data.aiAgent.metrics.aiIngested >= 1, 'aiIngested should be at least 1');

    assert.ok(Array.isArray(data.aiAgent.recentRuns), 'recentRuns should be an array');
    assert.ok(data.aiAgent.recentRuns.length > 0, 'recentRuns should have logged the discovery run');

    const latestRun = data.aiAgent.recentRuns[0];
    assert.ok(latestRun.id, 'Run should have an ID');
    assert.ok(latestRun.timestamp, 'Run should have a timestamp');
    assert.strictEqual(latestRun.status, 'SUCCESS');
    assert.strictEqual(latestRun.ingestedCount, 1);
  });

  // 5. Admin Trigger Discovery Endpoint
  await t.test('5. POST /api/admin/ai-agent/discover allows admin to trigger discovery directly', async () => {
    const adminOpportunity = {
      ...sampleVideoEditorOpportunity,
      sourceUrl: 'https://remote-creators.example.com/jobs/video-editor-admin-trigger',
      applicationUrl: 'https://remote-creators.example.com/jobs/video-editor-admin-trigger/apply',
    };

    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/ai-agent/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        persist: true,
        limitPerQuery: 2,
        rawItems: [adminOpportunity],
      }),
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.totalIngested, 1);
    assert.ok(data.durationMs >= 0);
  });

  // Cleanup: Clean fixtures so other test suites stay isolated
  await t.test('6. Cleanup created test jobs', async () => {
    const all = db.jobs.findAll();
    db.jobs.data = all.filter((j) => !j.sourceUrl?.includes('video-editor-step3-test') && !j.sourceUrl?.includes('video-editor-admin-trigger'));
    db.jobs.save();
    assert.ok(true, 'Test AI jobs cleaned successfully');
  });
});
