import { execFileSync } from 'node:child_process';
import { LOCAL_TEST_PROFILE, qualifyOpportunities } from '../src/services/opportunityQualificationEngine.js';

console.log('=== STEP 2C: AI JOB QUALIFICATION & RELEVANCE ENGINE PIPELINE ===\n');

// 1. Fetch 10 raw opportunities via Agent Reach MCP adapter (unfiltered/mixed)
const pythonCode = `
import sys, json
sys.path.insert(0, r'C:\\Users\\toufi\\.agent-reach')
from agent_reach_mcp_adapter import search_public_hiring
jobs = search_public_hiring('Video Editor, Short-form Video Editor, Reels Editor, YouTube Shorts Editor, Motion Graphics Editor, AI Video Editor', 10)
print(json.dumps(jobs))
`;

console.log('1. Querying Agent Reach for up to 10 raw opportunities (mixed results)...');
let rawOutput;
try {
  rawOutput = execFileSync('C:\\Users\\toufi\\.agent-reach-venv\\Scripts\\python.exe', ['-c', pythonCode], {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
} catch (err) {
  console.error('Error invoking Agent Reach:', err.message);
  process.exit(1);
}

const rawOpportunities = JSON.parse(rawOutput.trim());
console.log(`Discovered ${rawOpportunities.length} raw opportunities from Agent Reach.\n`);

console.log('Raw opportunities discovered:');
rawOpportunities.forEach((job, idx) => {
  console.log(`  [${idx + 1}] ${job.title} | ${job.company} (${job.source})`);
});
console.log('\n-------------------------------------------------------------');

// 2. Run through Two-Stage AI Qualification Engine
console.log('2. Executing Two-Stage AI Qualification against Local Test Profile:');
console.log(`   Target Profession: ${LOCAL_TEST_PROFILE.profession}`);
console.log(`   Specializations: ${LOCAL_TEST_PROFILE.specializations.join(', ')}`);
console.log(`   Experience: ${LOCAL_TEST_PROFILE.experience} (${LOCAL_TEST_PROFILE.yearsOfExperience} yrs)`);
console.log(`   Work Preference: ${LOCAL_TEST_PROFILE.workPreference}\n`);

const qualificationResults = qualifyOpportunities(rawOpportunities, LOCAL_TEST_PROFILE);

console.log('=== QUALIFICATION RESULTS JSON ===');
console.log(JSON.stringify(qualificationResults, null, 2));
