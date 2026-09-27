import { execFileSync } from 'node:child_process';
import { deduplicateOpportunities } from '../src/services/deduplicationService.js';
import {
  LOCAL_TEST_PROFILE,
  qualifyOpportunities,
} from '../src/services/opportunityQualificationEngine.js';

console.log('=== STEP 2D: MULTI-QUERY DISCOVERY + DEDUPLICATION PIPELINE ===\n');

const TARGET_QUERIES = [
  'Video Editor jobs',
  'Short-form Video Editor jobs',
  'Reels Editor jobs',
  'YouTube Shorts Video Editor jobs',
  'Motion Graphics Video Editor jobs',
  'AI Video Editor jobs',
];

console.log('Phase 1: Executing multi-query discovery via Agent Reach...');
console.log(`Configured queries (${TARGET_QUERIES.length}):`);
TARGET_QUERIES.forEach((q, i) => console.log(`  [${i + 1}] "${q}"`));
console.log('');

// Python script to run bounded multi-query search (up to 5 per query)
const pythonDiscoveryScript = `
import sys, json
sys.path.insert(0, r'C:\\Users\\toufi\\.agent-reach')
from agent_reach_mcp_adapter import search_public_hiring

queries = ${JSON.stringify(TARGET_QUERIES)}
all_results = []

for q in queries:
    try:
        jobs = search_public_hiring(q, limit=5)
        for j in jobs:
            j_copy = dict(j)
            j_copy['query'] = q
            all_results.append(j_copy)
    except Exception as e:
        print(f"Error querying {q}: {e}", file=sys.stderr)

print(json.dumps(all_results))
`;

let rawOutput;
try {
  rawOutput = execFileSync('C:\\Users\\toufi\\.agent-reach-venv\\Scripts\\python.exe', ['-c', pythonDiscoveryScript], {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
} catch (err) {
  console.error('Fatal error invoking Agent Reach multi-query:', err.message);
  process.exit(1);
}

const rawDiscovered = JSON.parse(rawOutput.trim());
console.log(`Total raw opportunities fetched across ${TARGET_QUERIES.length} queries: ${rawDiscovered.length}`);

// Inspect query breakdown
const countByQuery = {};
rawDiscovered.forEach((item) => {
  countByQuery[item.query] = (countByQuery[item.query] || 0) + 1;
});
Object.entries(countByQuery).forEach(([q, count]) => {
  console.log(`  • "${q}": ${count} opportunities`);
});
console.log('');

// Phase 2: Canonicalization & Deduplication
console.log('Phase 2: Canonicalizing URLs and deduplicating cross-query results...');
const dedupeResult = deduplicateOpportunities(rawDiscovered);
console.log(`Unique opportunities remaining: ${dedupeResult.uniqueOpportunities.length}`);
console.log(`Duplicates collapsed: ${dedupeResult.duplicateCount}\n`);

if (dedupeResult.duplicatePairs.length > 0) {
  console.log('Sample duplicates collapsed:');
  dedupeResult.duplicatePairs.slice(0, 3).forEach((pair, idx) => {
    console.log(`  [Dedupe ${idx + 1}] Key: ${pair.dedupeKey}`);
    console.log(`    Primary: "${pair.primaryTitle}" (${pair.primaryCompany})`);
    console.log(`    Duplicate: "${pair.duplicateTitle}" (${pair.duplicateCompany})`);
  });
  console.log('');
}

// Phase 3: Two-Stage Qualification
console.log('Phase 3: Running Two-Stage AI Qualification Engine against Video Editor Profile...');
const qualification = qualifyOpportunities(dedupeResult.uniqueOpportunities, LOCAL_TEST_PROFILE);

// Compose Final Result Schema
const finalOutput = {
  summary: {
    queries: TARGET_QUERIES.length,
    rawDiscovered: rawDiscovered.length,
    uniqueOpportunities: dedupeResult.uniqueOpportunities.length,
    qualified: qualification.summary.qualified,
    rejected: qualification.summary.rejected,
  },
  qualified: qualification.qualified,
  rejected: qualification.rejected,
};

console.log('=== SUMMARY STATISTICS ===');
console.log(JSON.stringify(finalOutput.summary, null, 2));

console.log('\n=== QUALIFIED OPPORTUNITIES COUNT ===:', finalOutput.qualified.length);
if (finalOutput.qualified.length > 0) {
  finalOutput.qualified.forEach((q, idx) => {
    console.log(`[Qualified ${idx + 1}] ${q.opportunity.title} | ${q.opportunity.company} (Score: ${q.matchScore}%)`);
    console.log(`   Reason: ${q.reason}`);
    console.log(`   Sources: ${q.opportunity.sources?.join(', ') || q.opportunity.source}`);
  });
} else {
  console.log('No qualified video editor jobs found in the live remote feed batch (feed returned non-video roles).');
}

console.log('\n=== REJECTED OPPORTUNITIES COUNT ===:', finalOutput.rejected.length);
finalOutput.rejected.slice(0, 5).forEach((r, idx) => {
  console.log(`[Rejected ${idx + 1}] ${r.opportunity.title} | ${r.opportunity.company}`);
  console.log(`   Reason: ${r.reason}`);
});

console.log('\n=== COMPLETE FINAL RESULT JSON ===');
console.log(JSON.stringify(finalOutput, null, 2));
