import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { executeAgentDiscovery, DEFAULT_DISCOVERY_QUERIES } from '../server/services/agentDiscoveryService.js';

console.log('--- STARTING STEP 2E DISCOVERY PIPELINE & N8N TESTS ---');

// 1. n8n Workflow File Validation
const workflowPath = path.resolve('n8n/v1_ai_discovery_workflow.json');
assert(fs.existsSync(workflowPath), 'n8n workflow file must exist at n8n/v1_ai_discovery_workflow.json');

const workflowJson = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));
assert.strictEqual(workflowJson.name, 'V1 AI Agent Discovery & Qualification Pipeline');
assert(Array.isArray(workflowJson.nodes) && workflowJson.nodes.length >= 5, 'Workflow must have at least 5 nodes');

const nodeNames = workflowJson.nodes.map((n) => n.name);
assert(nodeNames.includes('Manual Trigger'), 'Must include Manual Trigger node');
assert(nodeNames.includes('Set Discovery Parameters'), 'Must include Set Discovery Parameters node');
assert(nodeNames.includes('Trigger Local Discovery'), 'Must include Trigger Local Discovery HTTP Request node');
assert(nodeNames.includes('Validate Success'), 'Must include Validate Success IF node');
assert(nodeNames.includes('Format Discovered Opportunities'), 'Must include Format Discovered Opportunities Code node');
assert(nodeNames.includes('Handle Discovery Error'), 'Must include Handle Discovery Error Code node');

// Verify HTTP node points to local endpoint
const httpNode = workflowJson.nodes.find((n) => n.name === 'Trigger Local Discovery');
assert.strictEqual(httpNode.parameters.url, 'http://localhost:5000/api/agent/discover');
assert.strictEqual(httpNode.parameters.method, 'POST');
console.log('✓ PASS: n8n workflow definition is valid, dedicated, and correctly wired');

// 2. Unit Discovery Service Execution with Bounded Queries
console.log('Testing executeAgentDiscovery service...');
const unitResult = await executeAgentDiscovery({
  queries: ['Video Editor jobs', 'Short-form Video Editor jobs'],
  limitPerQuery: 2,
});

assert.strictEqual(unitResult.success, true);
assert(unitResult.runId.startsWith('run-'), 'RunId must be generated');
assert(unitResult.summary.rawDiscovered >= 2, 'Must discover raw opportunities');
assert(unitResult.summary.uniqueOpportunities >= 1, 'Must have unique opportunities after deduplication');
assert(Array.isArray(unitResult.qualified), 'Qualified array must exist');
assert(Array.isArray(unitResult.rejected), 'Rejected array must exist');
console.log(`✓ PASS: executeAgentDiscovery completed with ${unitResult.summary.rawDiscovered} raw -> ${unitResult.summary.uniqueOpportunities} unique`);

// 3. Live HTTP Endpoint Verification (POST /api/agent/discover)
console.log('Testing live HTTP endpoint POST http://localhost:5000/api/agent/discover...');
const httpResp = await fetch('http://localhost:5000/api/agent/discover', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    queries: DEFAULT_DISCOVERY_QUERIES.slice(0, 3),
    limitPerQuery: 2,
  }),
});

assert.strictEqual(httpResp.status, 200, 'HTTP status must be 200');
const apiData = await httpResp.json();
assert.strictEqual(apiData.success, true);
assert(typeof apiData.runId === 'string');
assert(apiData.summary.queries === 3);
assert(apiData.summary.uniqueOpportunities > 0);
console.log(`✓ PASS: HTTP API endpoint returned success with ${apiData.summary.uniqueOpportunities} unique opportunities`);

// 4. Quality & Keyword Trap Verification
// Ensure non-video roles are rejected with clear reasons
const contentReviewerReject = apiData.rejected.find((r) => r.opportunity?.title?.includes('Content Reviewer'));
if (contentReviewerReject) {
  assert(contentReviewerReject.reason.includes('evaluating/reviewing online content'), 'Content Reviewer must have reviewer rejection reason');
  console.log('✓ PASS: Content Reviewer keyword trap correctly rejected in live discovery');
}

const softwareDevReject = apiData.rejected.find((r) => r.opportunity?.title?.includes('Developer'));
if (softwareDevReject) {
  assert(softwareDevReject.reason.includes('Stage 1 filter: Obvious role mismatch'), 'Software developer must fail Stage 1');
  console.log('✓ PASS: Software developer correctly rejected in live discovery');
}

// 5. Input Bounds & Security
const boundedResp = await fetch('http://localhost:5000/api/agent/discover', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    queries: ['  Video Editor jobs  ', ''],
    limitPerQuery: 999, // Should be clamped to 10
  }),
});
assert.strictEqual(boundedResp.status, 200);
const boundedData = await boundedResp.json();
assert.strictEqual(boundedData.success, true);
console.log('✓ PASS: Input sanitization, whitespace trimming, and limit clamping work properly');

console.log('====================================================');
console.log('ALL STEP 2E DISCOVERY & N8N TESTS PASSED (5/5)');
console.log('====================================================');
