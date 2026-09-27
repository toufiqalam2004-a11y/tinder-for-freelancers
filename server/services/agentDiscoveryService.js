import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../database.js';
import { deduplicateOpportunities } from '../../src/services/deduplicationService.js';
import {
  LOCAL_TEST_PROFILE,
  qualifyOpportunities,
} from '../../src/services/opportunityQualificationEngine.js';

export const DEFAULT_DISCOVERY_QUERIES = [
  'Video Editor jobs',
  'Short-form Video Editor jobs',
  'Reels Editor jobs',
  'YouTube Shorts Video Editor jobs',
  'Motion Graphics Video Editor jobs',
  'AI Video Editor jobs',
];

// In-memory ring buffer of recent discovery telemetry runs (max 20)
const discoveryRunHistory = [];
const MAX_RUN_HISTORY = 20;

export function getDiscoveryRuns() {
  return [...discoveryRunHistory];
}

export function getDiscoveryTelemetry() {
  const totalRuns = discoveryRunHistory.length;
  let totalDiscovered = 0;
  let totalUnique = 0;
  let totalQualified = 0;
  let totalRejected = 0;
  let totalIngested = 0;
  let totalDuplicates = 0;

  discoveryRunHistory.forEach((r) => {
    const raw = r.rawDiscovered || r.rawCount || 0;
    const uniq = r.uniqueOpportunities || r.uniqueCount || 0;
    totalDiscovered += raw;
    totalUnique += uniq;
    totalQualified += r.qualified || r.qualifiedCount || 0;
    totalRejected += r.rejected || r.rejectedCount || 0;
    totalIngested += r.ingested || r.ingestedCount || 0;
    totalDuplicates += r.duplicates !== undefined ? r.duplicates : Math.max(0, raw - uniq);
  });

  const latest = discoveryRunHistory[0] || null;
  const latestRunMetrics = latest
    ? {
        runId: latest.runId || latest.id,
        queries: latest.queries || latest.queriesRun || 6,
        rawDiscovered: latest.rawDiscovered || latest.rawCount || 0,
        unique: latest.uniqueOpportunities || latest.uniqueCount || 0,
        qualified: latest.qualified || latest.qualifiedCount || 0,
        rejected: latest.rejected || latest.rejectedCount || 0,
        duplicates: latest.duplicates !== undefined ? latest.duplicates : Math.max(0, (latest.rawDiscovered || latest.rawCount || 0) - (latest.uniqueOpportunities || latest.uniqueCount || 0)),
        ingested: latest.ingested !== undefined ? latest.ingested : (latest.ingestedCount || 0),
        durationMs: latest.durationMs || 0,
        status: latest.status || 'SUCCESS',
        timestamp: latest.timestamp || null,
      }
    : {
        runId: null,
        queries: 0,
        rawDiscovered: 0,
        unique: 0,
        qualified: 0,
        rejected: 0,
        duplicates: 0,
        ingested: 0,
        durationMs: 0,
        status: 'IDLE',
        timestamp: null,
      };

  const cumulativeMetrics = {
    totalRuns,
    rawDiscovered: totalDiscovered,
    unique: totalUnique,
    qualified: totalQualified,
    rejected: totalRejected,
    duplicates: Math.max(0, totalDuplicates),
    ingested: totalIngested,
  };

  return {
    totalRuns,
    totalDiscovered,
    totalUnique,
    totalQualified,
    totalRejected,
    totalIngested,
    totalDuplicates: Math.max(0, totalDuplicates),
    lastRunAt: discoveryRunHistory[0]?.timestamp || null,
    latestRun: latestRunMetrics,
    cumulative: cumulativeMetrics,
    recentRuns: discoveryRunHistory.slice(0, 10),
  };
}

/**
 * Executes bounded multi-query discovery via Agent Reach,
 * applies URL canonicalization & deduplication, and passes
 * unique opportunities through the Two-Stage AI Qualification Engine.
 *
 * When persist: true, saves qualified opportunities into db.jobs
 * so they appear directly in the user-facing Job Feed.
 */
export async function executeAgentDiscovery(options = {}) {
  const {
    queries = DEFAULT_DISCOVERY_QUERIES,
    limitPerQuery = 5,
    profile = LOCAL_TEST_PROFILE,
    persist = false,
    rawItems = null,
  } = options;
  const startTime = Date.now();
  // 1. Sanitize & clamp query list
  const rawQueries = Array.isArray(queries) && queries.length > 0 ? queries : DEFAULT_DISCOVERY_QUERIES;
  const safeQueries = rawQueries
    .slice(0, 10)
    .map((q) => (typeof q === 'string' ? q.trim().slice(0, 100) : ''))
    .filter((q) => q.length > 0);

  const safeLimit = Math.max(1, Math.min(parseInt(limitPerQuery, 10) || 5, 10));

  // 2. Discover via Agent Reach (Python stdio runner)
  const repoAdapterDir = path.resolve('integrations/agent_reach');
  const externalAdapterDir = process.env.AGENT_REACH_ADAPTER_DIR || 'C:\\Users\\toufi\\.agent-reach';
  const adapterDir = fs.existsSync(path.join(repoAdapterDir, 'agent_reach_mcp_adapter.py'))
    ? repoAdapterDir
    : externalAdapterDir;
  const pythonBin = process.env.AGENT_REACH_PYTHON_BIN || 'C:\\Users\\toufi\\.agent-reach-venv\\Scripts\\python.exe';

  const pythonScript = `
import sys, json
sys.path.insert(0, ${JSON.stringify(adapterDir)})
from agent_reach_mcp_adapter import search_public_hiring

queries = ${JSON.stringify(safeQueries)}
limit = ${safeLimit}
all_results = []

for q in queries:
    try:
        jobs = search_public_hiring(q, limit=limit)
        for j in jobs:
            j_copy = dict(j)
            j_copy['query'] = q
            all_results.append(j_copy)
    except Exception as e:
        print(f"Error querying {q}: {e}", file=sys.stderr)

print(json.dumps(all_results))
`;

  let rawDiscovered = [];
  try {
    if (Array.isArray(options.rawItems)) {
      rawDiscovered = options.rawItems;
    } else {
      const rawOutput = execFileSync(pythonBin, ['-c', pythonScript], {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 45000,
      });
      rawDiscovered = JSON.parse(rawOutput.trim());
    }
  } catch (err) {
    const errorRun = {
      id: `run-${Date.now()}-err`,
      runId: `run-${Date.now()}-err`,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      queries: safeQueries.length,
      queriesRun: safeQueries.length,
      rawDiscovered: 0,
      rawCount: 0,
      uniqueOpportunities: 0,
      uniqueCount: 0,
      qualified: 0,
      qualifiedCount: 0,
      rejected: 0,
      rejectedCount: 0,
      ingested: 0,
      ingestedCount: 0,
      status: 'FAILED',
      errorMessage: err.message,
    };
    discoveryRunHistory.unshift(errorRun);
    if (discoveryRunHistory.length > MAX_RUN_HISTORY) discoveryRunHistory.pop();
    throw new Error(`Agent Reach multi-query discovery failed: ${err.message}`);
  }

  // 3. Canonicalize & Deduplicate
  const dedupeResult = deduplicateOpportunities(rawDiscovered);

  // 4. Two-Stage AI Qualification
  const qualification = qualifyOpportunities(dedupeResult.uniqueOpportunities, profile);

  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let ingestedCount = 0;

  // 5. Ingestion into Existing db.jobs (when persist: true)
  if (persist && Array.isArray(qualification.qualified) && db.jobs) {
    const existingDbJobs = db.jobs.findAll();

    for (const qual of qualification.qualified) {
      const opp = qual.opportunity || {};
      const srcUrl = opp.sourceUrl || opp.postUrl || '';
      const appUrl = opp.applicationUrl || '';
      const dedupeKey = opp.dedupeKey || '';

      // Check if job already exists in database
      const alreadyExists = existingDbJobs.some((j) => {
        if (dedupeKey && j.dedupeKey && j.dedupeKey === dedupeKey) return true;
        if (srcUrl && (j.sourceUrl === srcUrl || j.postUrl === srcUrl)) return true;
        if (appUrl && j.applicationUrl && j.applicationUrl === appUrl) return true;
        return false;
      });

      if (!alreadyExists) {
        const jobId = `job-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const jobRecord = {
          id: jobId,
          userId: null,
          user_id: null,
          sourceId: 'agent-reach',
          source_id: 'agent-reach',
          platform: (opp.primarySource || opp.source || 'Agent Reach').toLowerCase(),
          title: opp.title || 'Video Editor',
          description: opp.description || '',
          company: opp.company || 'Hiring Client',
          client: opp.company || 'Hiring Client',
          author: opp.company || 'Member',
          sourceUrl: srcUrl,
          source_url: srcUrl,
          postUrl: srcUrl,
          post_url: srcUrl,
          applicationUrl: appUrl || null,
          application_url: appUrl || null,
          skills: qual.matchedSkills && qual.matchedSkills.length > 0 ? qual.matchedSkills : (opp.skills || []),
          category: 'Creative',
          jobRole: opp.title || 'Video Editor',
          job_role: opp.title || 'Video Editor',
          jobType: opp.jobType || 'freelance',
          job_type: opp.jobType || 'freelance',
          salary: opp.salary || 'Paid / Negotiable',
          location: opp.location || 'Remote',
          isRemote: opp.remote !== undefined ? opp.remote : true,
          is_remote: opp.remote !== undefined ? opp.remote : true,
          remote: opp.remote !== undefined ? opp.remote : true,
          matchScore: qual.matchScore || 85,
          match_score: qual.matchScore || 85,
          matchReasons: [qual.reason],
          match_reasons: [qual.reason],
          status: 'new',
          isDemo: false,
          is_demo: false,
          isJob: true,
          is_job: true,
          isAiDiscovered: true,
          is_ai_discovered: true,
          dedupeKey,
          createdAt: new Date().toISOString(),
          created_at: new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        };

        db.jobs.insert(jobRecord);
        existingDbJobs.push(jobRecord);
        ingestedCount++;
      }
    }
  }

  const durationMs = Date.now() - startTime;

  const duplicatesCount = Math.max(0, rawDiscovered.length - dedupeResult.uniqueOpportunities.length);

  // 6. Record run telemetry in history
  const runRecord = {
    id: runId,
    runId,
    timestamp: new Date().toISOString(),
    durationMs,
    queries: safeQueries.length,
    queriesRun: safeQueries.length,
    rawDiscovered: rawDiscovered.length,
    rawCount: rawDiscovered.length,
    uniqueOpportunities: dedupeResult.uniqueOpportunities.length,
    uniqueCount: dedupeResult.uniqueOpportunities.length,
    qualified: qualification.summary.qualified,
    qualifiedCount: qualification.summary.qualified,
    rejected: qualification.summary.rejected,
    rejectedCount: qualification.summary.rejected,
    duplicates: duplicatesCount,
    duplicatesCount: duplicatesCount,
    ingested: ingestedCount,
    ingestedCount: ingestedCount,
    status: 'SUCCESS',
  };

  discoveryRunHistory.unshift(runRecord);
  if (discoveryRunHistory.length > MAX_RUN_HISTORY) {
    discoveryRunHistory.pop();
  }

  return {
    success: true,
    runId,
    timestamp: runRecord.timestamp,
    durationMs,
    summary: {
      queries: safeQueries.length,
      rawDiscovered: rawDiscovered.length,
      uniqueOpportunities: dedupeResult.uniqueOpportunities.length,
      qualified: qualification.summary.qualified,
      rejected: qualification.summary.rejected,
      duplicates: duplicatesCount,
      ingested: ingestedCount,
    },
    totalRaw: rawDiscovered.length,
    totalUnique: dedupeResult.uniqueOpportunities.length,
    totalQualified: qualification.summary.qualified,
    totalRejected: qualification.summary.rejected,
    totalDuplicates: duplicatesCount,
    totalIngested: ingestedCount,
    qualified: qualification.qualified,
    rejected: qualification.rejected,
  };
}
