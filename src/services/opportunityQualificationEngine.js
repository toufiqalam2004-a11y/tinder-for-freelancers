import { calculateProMatch } from './proMatchEngine.js';
import { isHiringOpportunity } from './jobClassifier.js';

/**
 * Prompt injection sanitizer to neutralize untrusted input from public posts.
 * Defuses adversarial instructions, delimiters, and key leaks.
 */
export function sanitizePromptInput(text = '', maxLength = 1200) {
  if (typeof text !== 'string') return '';
  let clean = text.trim().slice(0, maxLength);
  clean = clean.replace(/`/g, "'''");
  clean = clean.replace(/ignore (all )?previous instructions/gi, '[filtered instruction]');
  clean = clean.replace(/reveal (all )?(api|secret|key|password|token)/gi, '[filtered inquiry]');
  clean = clean.replace(/system directive|system prompt/gi, '[filtered directive]');
  clean = clean.replace(/\[(?:INST|SYS)\]|<\/?s>|<\|.*?\|>/gi, '');
  return clean;
}

/**
 * Default isolated test profile matching the V1 creative specification.
 * Not stored in Supabase or production databases.
 */
export const LOCAL_TEST_PROFILE = {
  profession: 'Video Editor',
  primaryRole: 'Video Editor',
  category: 'Creative',
  specialization: 'Short-form Video Editing',
  specializations: [
    'Short-form Video Editing',
    'Reels',
    'YouTube Shorts',
    'Motion Graphics',
    'AI Video Editing',
  ],
  skills: [
    'Adobe Premiere Pro',
    'Adobe After Effects',
    'Motion Graphics',
    'Sound Design',
    'Short-form editing',
    'YouTube Shorts',
    'Instagram Reels',
    'TikTok',
    'AI video tools',
  ],
  experience: 'Intermediate',
  yearsOfExperience: 3,
  workPreference: 'Remote preferred',
  remotePreference: 'remote',
  expectedSalaryMin: 500,
};

/**
 * Stage 1: Deterministic validation & basic boundary checks.
 * Flags missing fields, malformed URLs, spam/self-promo, and obvious domain mismatches.
 */
export function validateOpportunityStage1(opportunity = {}, profile = LOCAL_TEST_PROFILE) {
  if (!opportunity || typeof opportunity !== 'object') {
    return { valid: false, reason: 'Invalid opportunity payload' };
  }

  // 1. Title validation
  const title = (opportunity.title || '').trim();
  if (!title) {
    return { valid: false, reason: 'Missing or empty opportunity title' };
  }

  // 2. Description validation
  const description = (opportunity.description || '').trim();
  if (!description || description.length < 20) {
    return { valid: false, reason: 'Description is missing or too brief to qualify (<20 chars)' };
  }

  // 3. Source URL validation
  const sourceUrl = (opportunity.sourceUrl || '').trim();
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { valid: false, reason: 'Missing or invalid sourceUrl (must be valid HTTP/HTTPS URL)' };
  }

  // 4. Application URL validation (if present)
  if (opportunity.applicationUrl && !/^https?:\/\//i.test(opportunity.applicationUrl)) {
    return { valid: false, reason: 'Malformed applicationUrl format' };
  }

  // 5. Recognizable hiring opportunity intent
  const fullText = `${title} ${description}`;
  const isKnownHiringSource = opportunity.source === 'Remotive' || opportunity.source === 'HackerNews';
  if (!isKnownHiringSource && !isHiringOpportunity(fullText)) {
    return { valid: false, reason: 'Does not meet hiring intent thresholds (likely self-promo or general discussion)' };
  }

  // 6. Obvious domain / role mismatch check
  const targetRole = (profile.primaryRole || profile.profession || 'Video Editor').toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (targetRole.includes('video') || targetRole.includes('editor')) {
    const incompatibleDomains = [
      'frontend web application developer',
      'full-stack rails engineer',
      'shopify developer',
      '.net full-stack',
      'data scientist',
      'independent software developer',
      'ai engineer / architect',
      'kundenservice',
      'customer service',
      'accountant',
      'sales representative',
      'devops',
      'qa engineer',
      'content moderator',
      'ai evaluator',
    ];

    const matchedMismatch = incompatibleDomains.find((d) => lowerTitle.includes(d));
    if (matchedMismatch) {
      // Check if description specifies video editing duties as primary responsibility
      const hasCoreVideoDuties = /\b(video editor|editing videos|premiere pro|after effects|short-form video|reels editor)\b/i.test(description);
      if (!hasCoreVideoDuties) {
        return {
          valid: false,
          reason: `Stage 1 filter: Obvious role mismatch (${title} is in engineering/support/moderation, not creative video production)`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Stage 2: AI & Semantic Qualification.
 * Evaluates role relevance, skill overlap, specialization, remote fit, and experience.
 * Does not accept jobs based solely on isolated keyword matches.
 */
export function qualifyOpportunityStage2(opportunity = {}, profile = LOCAL_TEST_PROFILE) {
  // Sanitize untrusted input to defend against prompt injection
  const safeTitle = sanitizePromptInput(opportunity.title || '', 120);
  const safeDesc = sanitizePromptInput(opportunity.description || '', 1200);
  const safeText = `${safeTitle} ${safeDesc}`.toLowerCase();

  const userRole = (profile.primaryRole || profile.profession || 'Video Editor').toLowerCase();
  const userSpecializations = (profile.specializations || [profile.specialization || '']).map((s) => s.toLowerCase());
  const userSkills = profile.skills || [];

  // 1. Role & Job Description Relevance
  // Check if creative video editing is a primary function rather than a tangential word
  const creativeVideoSignals = [
    'video editor',
    'video editing',
    'editor needed',
    'short-form editor',
    'reels editor',
    'youtube editor',
    'shorts editor',
    'motion graphics',
    'after effects',
    'premiere pro',
    'davinci resolve',
    'video producer',
    'video production',
    'video creator',
    'content creator & editor',
    'ai video',
  ];

  const hasCreativeVideoFocus = creativeVideoSignals.some((sig) => safeText.includes(sig));

  // Check for false positives: e.g. "Content Reviewer" where video is only reviewed for policy, not edited
  const isPassiveReviewer =
    safeTitle.toLowerCase().includes('content reviewer') ||
    safeTitle.toLowerCase().includes('content moderator') ||
    safeTitle.toLowerCase().includes('search evaluator') ||
    safeTitle.toLowerCase().includes('data annotator') ||
    safeTitle.toLowerCase().includes('ai evaluator');

  // 2. Skill Overlap
  const matchedSkills = [];
  const missingSkills = [];

  userSkills.forEach((skill) => {
    const sName = typeof skill === 'string' ? skill : skill.name;
    if (sName && safeText.includes(sName.toLowerCase())) {
      matchedSkills.push(sName);
    }
  });

  // Check opportunity's required skills against user
  const oppSkills = Array.isArray(opportunity.skills) ? opportunity.skills : [];
  oppSkills.forEach((req) => {
    const rLower = (typeof req === 'string' ? req : '').toLowerCase();
    if (!rLower) return;
    const userHas = userSkills.some((s) => {
      const uLower = (typeof s === 'string' ? s : s.name || '').toLowerCase();
      return uLower.includes(rLower) || rLower.includes(uLower);
    });
    if (!userHas && !missingSkills.includes(req)) {
      missingSkills.push(req);
    }
  });

  // 3. Specialization overlap
  const matchedSpecializations = userSpecializations.filter((spec) => spec && safeText.includes(spec));

  // 4. Remote & Experience Fit
  const remoteFit = opportunity.remote !== undefined ? Boolean(opportunity.remote) : (safeText.includes('remote') ? true : null);
  
  let experienceFit = null;
  const isSenior = safeText.includes('senior') || safeText.includes('lead') || safeText.includes('5+ years');
  const isEntry = safeText.includes('junior') || safeText.includes('entry') || safeText.includes('no experience');
  if (profile.experience === 'Intermediate' || profile.yearsOfExperience === 3) {
    if (isSenior) {
      experienceFit = false; // Competitive gap
    } else {
      experienceFit = true;
    }
  }

  // 5. Calculate Pro Match Score (Reusing existing V4 multi-factor engine)
  const candidateJob = {
    title: safeTitle,
    description: safeDesc,
    jobRole: opportunity.jobRole || safeTitle,
    remote: remoteFit === true,
    location: opportunity.location || 'Remote',
    salary: opportunity.salary || 'Negotiable',
    jobType: opportunity.jobType || 'freelance',
    requiredSkills: oppSkills,
  };

  const proMatch = calculateProMatch(candidateJob, profile);
  let matchScore = proMatch.matchScore;

  // 6. Final Qualification Determination
  let relevant = false;
  let reason = '';

  if (isPassiveReviewer) {
    relevant = false;
    matchScore = Math.min(matchScore, 42);
    reason = `Role is ${safeTitle} (evaluating/reviewing online content) rather than producing or editing creative videos.`;
  } else if (!hasCreativeVideoFocus) {
    relevant = false;
    matchScore = Math.min(matchScore, 45);
    reason = `Job description does not require primary video editing or motion graphics skills for "${profile.primaryRole || profile.profession}".`;
  } else if (matchScore >= 60) {
    relevant = true;
    const topSkills = matchedSkills.slice(0, 3).join(', ');
    const specReason = matchedSpecializations.length > 0 ? ` Aligns with ${matchedSpecializations[0]}.` : '';
    reason = `Strong role alignment for ${profile.primaryRole || profile.profession}.${specReason}${topSkills ? ` Overlaps with: ${topSkills}.` : ''} Remote fit confirmed.`;
  } else {
    relevant = false;
    reason = `Match score (${matchScore}%) below qualification threshold (60%). Missing key candidate specializations.`;
  }

  return {
    relevant,
    matchScore,
    reason,
    matchedSkills,
    missingSkills: missingSkills.slice(0, 5),
    remoteFit,
    experienceFit,
    opportunity: {
      ...opportunity,
      title: safeTitle,
      description: safeDesc,
    },
  };
}

/**
 * End-to-end Opportunity Qualification Pipeline.
 * Stage 1 (Deterministic filter) -> Stage 2 (Semantic AI qualification) -> Normalized output.
 */
export function qualifyOpportunities(opportunities = [], profile = LOCAL_TEST_PROFILE) {
  const qualified = [];
  const rejected = [];

  for (const opp of opportunities) {
    // Stage 1: Deterministic validation
    const stage1 = validateOpportunityStage1(opp, profile);
    if (!stage1.valid) {
      rejected.push({
        relevant: false,
        matchScore: 0,
        reason: stage1.reason,
        matchedSkills: [],
        missingSkills: [],
        remoteFit: opp.remote !== undefined ? Boolean(opp.remote) : null,
        experienceFit: null,
        opportunity: opp,
      });
      continue;
    }

    // Stage 2: AI / Semantic qualification
    const stage2 = qualifyOpportunityStage2(opp, profile);
    if (stage2.relevant) {
      qualified.push(stage2);
    } else {
      rejected.push(stage2);
    }
  }

  // Deterministically sort qualified by matchScore descending (relevance signal)
  qualified.sort((a, b) => b.matchScore - a.matchScore);

  return {
    summary: {
      discovered: opportunities.length,
      qualified: qualified.length,
      rejected: rejected.length,
    },
    qualified,
    rejected,
  };
}
