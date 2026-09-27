import assert from 'node:assert';
import {
  canonicalizeUrl,
  generateDedupeKey,
  deduplicateOpportunities,
} from '../src/services/deduplicationService.js';
import {
  LOCAL_TEST_PROFILE,
  qualifyOpportunities,
} from '../src/services/opportunityQualificationEngine.js';

console.log('--- STARTING STEP 2D MULTI-QUERY DEDUPLICATION TESTS ---');

// 1. URL Canonicalization Test
const rawUrl1 = 'https://remotive.com/remote-jobs/video-editor-2091144/?utm_source=twitter&utm_medium=social&ref=newsletter#apply-section';
const canonical1 = canonicalizeUrl(rawUrl1);
assert.strictEqual(
  canonical1,
  'https://remotive.com/remote-jobs/video-editor-2091144',
  'Must strip tracking parameters, fragment, and trailing slash'
);

const rawUrl2 = 'https://remotive.com/remote-jobs/video-editor-2091144/';
const canonical2 = canonicalizeUrl(rawUrl2);
assert.strictEqual(
  canonical2,
  'https://remotive.com/remote-jobs/video-editor-2091144',
  'Must normalize trailing slashes on equivalent endpoints'
);
console.log('✓ PASS: URL canonicalization correctly normalizes query params, fragments, and slashes');

// 2. Stable Dedupe Key Generation Hierarchy
// Case A: External Job ID present
const jobWithId = { id: 'remotive-2091144', sourceUrl: 'https://remotive.com/job/1', title: 'Video Editor' };
assert.strictEqual(generateDedupeKey(jobWithId), 'id:remotive-2091144');

// Case B: Canonical Application URL takes priority over Source URL
const jobWithAppUrl = {
  applicationUrl: 'https://jobs.lever.co/company/abc-123?utm_source=remotive',
  sourceUrl: 'https://remotive.com/job/1',
  title: 'Video Editor',
};
assert.strictEqual(
  generateDedupeKey(jobWithAppUrl),
  'app_url:https://jobs.lever.co/company/abc-123'
);

// Case C: Canonical Source URL used when application URL absent
const jobWithSrcOnly = {
  sourceUrl: 'https://remotive.com/job/1/?ref=jobboard',
  title: 'Video Editor',
};
assert.strictEqual(
  generateDedupeKey(jobWithSrcOnly),
  'src_url:https://remotive.com/job/1'
);

// Case D: Fallback to Company + Title normalization
const jobWithNoUrls = {
  company: 'Apex Media, LLC.',
  title: 'Lead Short-Form Video Editor!',
};
assert.strictEqual(
  generateDedupeKey(jobWithNoUrls),
  'entity:apex media llc::lead shortform video editor'
);
console.log('✓ PASS: Stable dedupe key respects 4-tier identifier hierarchy');

// 3. Multi-Query Collapse & Source Merging
const rawMultiQueryBatch = [
  // Discovered by Query 1: "Video Editor jobs"
  {
    title: 'Lead Short-Form Video Editor',
    company: 'Apex Media',
    description: 'Looking for a skilled Video Editor proficient in Adobe Premiere Pro and After Effects for viral YouTube Shorts.',
    source: 'Remotive',
    sourceUrl: 'https://remotive.com/job/apex-video-1/?utm_source=search1',
    applicationUrl: 'https://remotive.com/job/apex-video-1',
    query: 'Video Editor jobs',
    remote: true,
    skills: ['Adobe Premiere Pro', 'After Effects'],
  },
  // Discovered by Query 2: "Short-form Video Editor jobs" (Same job, different query & tracking param)
  {
    title: 'Lead Short-Form Video Editor',
    company: 'Apex Media',
    description: 'Looking for a skilled Video Editor proficient in Adobe Premiere Pro and After Effects for viral YouTube Shorts.',
    source: 'Remotive',
    sourceUrl: 'https://remotive.com/job/apex-video-1/?utm_source=search2#details',
    applicationUrl: 'https://remotive.com/job/apex-video-1/',
    query: 'Short-form Video Editor jobs',
    remote: true,
    skills: ['Adobe Premiere Pro', 'After Effects'],
  },
  // Discovered by Query 3: "YouTube Shorts Video Editor jobs" (Same job syndicated to Hacker News)
  {
    title: 'Lead Short-Form Video Editor',
    company: 'Apex Media',
    description: 'Looking for a skilled Video Editor proficient in Adobe Premiere Pro and After Effects for viral YouTube Shorts.',
    source: 'HackerNews',
    sourceUrl: 'https://news.ycombinator.com/item?id=88231',
    applicationUrl: 'https://remotive.com/job/apex-video-1',
    query: 'YouTube Shorts Video Editor jobs',
    remote: true,
    skills: ['Adobe Premiere Pro', 'After Effects'],
  },
  // Distinct job 2: Motion Graphics
  {
    title: 'Motion Graphics Designer & Video Editor',
    company: 'Studio Nexus',
    description: 'Seeking a freelance Motion Graphics and AI Video Editor to create promotional video reels using After Effects.',
    source: 'Remotive',
    sourceUrl: 'https://remotive.com/job/motion-1',
    query: 'Motion Graphics Video Editor jobs',
    remote: true,
    skills: ['Motion Graphics', 'Adobe Premiere Pro', 'After Effects'],
  },
  // Distinct job 3: Keyword trap (Content Reviewer)
  {
    title: 'Content Reviewer - United States',
    company: 'TELUS Digital',
    description: 'Analyze and evaluate online search and video results for quality.',
    source: 'Remotive',
    sourceUrl: 'https://remotive.com/job/telus-1',
    query: 'AI Video Editor jobs',
    remote: true,
    skills: ['video', 'AI/ML'],
  },
];

const dedupeResult = deduplicateOpportunities(rawMultiQueryBatch);
assert.strictEqual(dedupeResult.uniqueOpportunities.length, 3, '5 raw items across 3 queries must collapse to exactly 3 unique opportunities');
assert.strictEqual(dedupeResult.duplicateCount, 2, 'Must record exactly 2 collapsed duplicates');

const apexJob = dedupeResult.uniqueOpportunities.find((o) => o.company === 'Apex Media');
assert(apexJob, 'Apex Media job must exist');
assert.strictEqual(apexJob.sources.length, 2, 'Must merge unique sources [Remotive, HackerNews]');
assert(apexJob.sources.includes('Remotive') && apexJob.sources.includes('HackerNews'));
assert.strictEqual(apexJob.discoveredQueries.length, 3, 'Must track all 3 discovering queries');
assert.strictEqual(apexJob.primarySource, 'Remotive', 'Must preserve original primary source');
assert.strictEqual(apexJob.sourceUrl, 'https://remotive.com/job/apex-video-1/?utm_source=search1', 'Must preserve original source URL');
console.log('✓ PASS: Duplicate collapse merges sources and query origins while preserving raw URLs');

// 4. End-to-End Multi-Query Qualification Pipeline
const qualification = qualifyOpportunities(dedupeResult.uniqueOpportunities, LOCAL_TEST_PROFILE);

const summary = {
  queries: 5,
  rawDiscovered: rawMultiQueryBatch.length,
  uniqueOpportunities: dedupeResult.uniqueOpportunities.length,
  qualified: qualification.summary.qualified,
  rejected: qualification.summary.rejected,
};

assert.strictEqual(summary.rawDiscovered, 5);
assert.strictEqual(summary.uniqueOpportunities, 3);
assert.strictEqual(summary.qualified, 2, 'Apex Media and Studio Nexus should qualify');
assert.strictEqual(summary.rejected, 1, 'TELUS Content Reviewer must be rejected');

console.log('✓ PASS: End-to-end multi-query discovery, deduplication, and qualification pipeline');
console.log('====================================================');
console.log('ALL STEP 2D MULTI-QUERY TESTS PASSED (4/4)');
console.log('====================================================');
