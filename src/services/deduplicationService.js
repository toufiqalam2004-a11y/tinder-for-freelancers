/**
 * Job Deduplication Service
 * Prevents showing duplicate opportunities across platforms and multiple fetches.
 * Matches by:
 * 1. Exact Source Post ID
 * 2. Exact Post / Source URL
 * 3. Title + Company normalized similarity
 */

function normalizeString(str = '') {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates string similarity index (Dice's Coefficient / Bigram)
 */
function getSimilarity(s1, s2) {
  const n1 = normalizeString(s1);
  const n2 = normalizeString(s2);
  if (n1 === n2) return 1.0;
  if (n1.length < 2 || n2.length < 2) return 0;

  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(n1);
  const b2 = getBigrams(n2);
  let intersection = 0;
  b1.forEach((val) => {
    if (b2.has(val)) intersection++;
  });

  return (2.0 * intersection) / (b1.size + b2.size);
}

export class DeduplicationService {
  /**
   * Checks if an incoming candidate job is a duplicate of any existing job.
   * @param {Object} candidateJob
   * @param {Array} existingJobs
   * @returns {{ isDuplicate: boolean, existingJob: Object | null, reason?: string }}
   */
  isDuplicate(candidateJob, existingJobs = []) {
    if (!candidateJob || !Array.isArray(existingJobs) || existingJobs.length === 0) {
      return { isDuplicate: false, existingJob: null };
    }

    const candidatePostId = candidateJob.postId ? String(candidateJob.postId).trim() : null;
    const candidateUrl = candidateJob.sourceUrl || candidateJob.postUrl;
    const candidateNormalizedTitle = normalizeString(candidateJob.title);

    for (const existing of existingJobs) {
      // 1. Check exact postId match
      if (candidatePostId && existing.postId && String(existing.postId).trim() === candidatePostId) {
        return { isDuplicate: true, existingJob: existing, reason: 'postId' };
      }

      // 2. Check exact URL match (ignoring tracking queries if possible)
      if (candidateUrl && (existing.sourceUrl || existing.postUrl)) {
        const existingUrl = existing.sourceUrl || existing.postUrl;
        if (candidateUrl.split('?')[0] === existingUrl.split('?')[0]) {
          return { isDuplicate: true, existingJob: existing, reason: 'url' };
        }
      }

      // 3. Check Title + Company / Client similarity (fuzzy matching >= 85%)
      if (candidateNormalizedTitle && existing.title) {
        const existingNormalizedTitle = normalizeString(existing.title);
        const titleSim = getSimilarity(candidateNormalizedTitle, existingNormalizedTitle);

        if (titleSim >= 0.88) {
          const cCompany = normalizeString(candidateJob.company || candidateJob.author);
          const eCompany = normalizeString(existing.company || existing.author);
          if (cCompany && eCompany && getSimilarity(cCompany, eCompany) >= 0.7) {
            return { isDuplicate: true, existingJob: existing, reason: 'content_similarity' };
          }
        }
      }
    }

    return { isDuplicate: false, existingJob: null };
  }

  /**
   * Deduplicates an incoming array of raw jobs against an existing repository.
   * @param {Array} newJobs
   * @param {Array} existingJobs
   * @returns {{ uniqueJobs: Array, duplicateCount: number }}
   */
  filterDuplicates(newJobs = [], existingJobs = []) {
    const uniqueJobs = [];
    const pool = [...existingJobs];
    let duplicateCount = 0;

    for (const job of newJobs) {
      const check = this.isDuplicate(job, pool);
      if (check.isDuplicate) {
        duplicateCount++;
      } else {
        uniqueJobs.push(job);
        pool.push(job);
      }
    }

    return { uniqueJobs, duplicateCount };
  }
}

export const deduplicationService = new DeduplicationService();
