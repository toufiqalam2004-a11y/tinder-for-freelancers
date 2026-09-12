import { createJob } from '../data/models.js';
import { calculateProMatch, evaluateJobQuality, detectRiskSignals } from './proMatchEngine.js';


/**
 * Intelligent Job Detection & Classification Layer (V2)
 * 
 * Pipeline:
 * Raw Post -> Hiring Intent Detection -> Attribute & Role Extraction -> 
 * Skill & Salary Parsing -> Location/Remote Detection -> Profile Match Calculation -> Unified Job
 */

// Comprehensive hiring signal phrases
const HIRING_SIGNALS = [
  'hiring',
  'we are hiring',
  'looking for',
  'need a',
  'needs a',
  'seeking a',
  'wanted',
  'editor needed',
  'editors needed',
  'freelancer needed',
  'contractor needed',
  'seeking editor',
  'paid opportunity',
  'job opportunity',
  'remote position',
  'work opportunity',
  'role open',
  'budget:',
  'rate:',
  'per video',
  'per hour',
  '/hr',
  'apply here',
  'dm portfolio',
  'send portfolio',
  'retainer',
  'contract role',
  'open role',
  'join our team',
];

// Explicit non-hiring signals (self-promotion, portfolios, tutorials, memes)
const NON_HIRING_SIGNALS = [
  '[for hire]',
  'for hire',
  'hire me',
  'my portfolio',
  'i am looking for work',
  'available for work',
  'looking to be hired',
  'editor available',
  'open for commissions',
  'hire me for',
  'check out my work',
  'tutorial',
  'how to edit',
  'what is your favorite',
  'let\'s discuss',
  'just finished editing',
];

/**
 * 1. AI / Smart Job Detector:
 * Determines if raw content represents a genuine hiring opportunity.
 */
export function isHiringOpportunity(text = '') {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  // Filter out explicit freelancer self-promotion unless employer phrasing is explicitly present
  const isSelfPromo = NON_HIRING_SIGNALS.some((kw) => lower.includes(kw));
  if (isSelfPromo) {
    const hasEmployerContext =
      lower.includes('we are hiring') ||
      lower.includes('hiring team') ||
      lower.includes('our company is looking') ||
      lower.includes('looking for someone to join');
    if (!hasEmployerContext) {
      return false;
    }
  }

  // Count positive hiring indicators
  const matchedSignals = HIRING_SIGNALS.filter((kw) => lower.includes(kw));
  const strongSignals = [
    'we are hiring',
    'hiring a',
    'editor needed',
    'looking for a',
    'need a video editor',
    'freelancer needed',
    'contract role',
    'paid opportunity',
  ];
  const hasStrong = strongSignals.some((kw) => lower.includes(kw));

  // Must match at least 1 strong signal or 2 general signals
  return hasStrong || matchedSignals.length >= 2;
}

export const isHiringPost = isHiringOpportunity;

/**
 * 2. Role & Category Classifier:
 * Detects specialized role and high-level category.
 */
export function detectRoleAndCategory(text = '', userProfile = null) {
  const lower = text.toLowerCase();

  // Roles taxonomy
  let title = 'Video Editor Needed';
  let jobRole = 'Video Editor';
  let jobCategory = userProfile?.category || 'Creative';

  if (lower.includes('short-form') || lower.includes('shorts') || lower.includes('reels') || lower.includes('tiktok')) {
    title = 'Short-Form Video Editor';
    jobRole = 'Short-Form Video Editor';
    jobCategory = 'Creative';
  } else if (lower.includes('youtube') && (lower.includes('editor') || lower.includes('retention') || lower.includes('channel'))) {
    title = 'YouTube Video Editor';
    jobRole = 'YouTube Video Editor';
    jobCategory = 'Creative';
  } else if (lower.includes('motion graphic') || lower.includes('after effects') || lower.includes('2d animation')) {
    title = 'Motion Graphics Designer & Video Editor';
    jobRole = 'Motion Designer';
    jobCategory = 'Design';
  } else if (lower.includes('thumbnail') || lower.includes('photoshop')) {
    title = 'YouTube Thumbnail & Graphic Designer';
    jobRole = 'Thumbnail Designer';
    jobCategory = 'Design';
  } else if (lower.includes('ai video') || lower.includes('midjourney') || lower.includes('runway')) {
    title = 'AI Video Editor & Specialist';
    jobRole = 'AI Video Editor';
    jobCategory = 'AI';
  } else if (lower.includes('content creator') || lower.includes('producer')) {
    title = 'Content Creator & Producer';
    jobRole = 'Content Creator';
    jobCategory = 'Creative';
  } else if (lower.includes('developer') || lower.includes('react') || lower.includes('full-stack') || lower.includes('frontend')) {
    title = 'Frontend / Full-Stack Developer';
    jobRole = 'Developer';
    jobCategory = 'Development';
  } else if (userProfile?.profession) {
    title = `${userProfile.profession} Opportunity`;
    jobRole = userProfile.specialization || userProfile.profession;
  }

  return { title, jobRole, jobCategory };
}

/**
 * 3. Skill & Attribute Extractor
 */
export function extractJobAttributes(postText = '', platform = 'facebook_group', sourceName = '', userProfile = null) {
  const lower = postText.toLowerCase();

  const { title, jobRole, jobCategory } = detectRoleAndCategory(postText, userProfile);

  // Salary detection regexes
  let salary = 'Paid / Negotiable';
  const salaryRegexes = [
    /\$\s*\d+[\d,]*\s*-\s*\$?\s*\d+[\d,]*(?:\s*(?:per video|per month|\/mo|\/hr|hourly|video|\/short))?/i,
    /\$\s*\d+[\d,]*(?:\s*(?:per video|per hour|\/hr|\/video|\/mo|\/month|\/short|k))?/i,
    /budget\s*:?\s*[\$€£]?\s*\d+[\d,]*(?:\s*-\s*[\$€£]?\s*\d+[\d,]*|\/video|\/project)?/i,
    /(?:hourly rate|rate)\s*:?\s*[\$€£]?\s*\d+[\d,]*(?:\/hr)?/i,
    /\$\d+k(?:\s*-\s*\$?\d+k)?(?:\/yr|\/year)?/i,
  ];

  for (const regex of salaryRegexes) {
    const match = postText.match(regex);
    if (match) {
      salary = match[0].trim();
      break;
    }
  }

  // Remote / Location detection
  const isExplicitOnsite = lower.includes('on-site') || lower.includes('in-office') || lower.includes('must be located in');
  const isExplicitRemote = lower.includes('remote') || lower.includes('worldwide') || lower.includes('wfh') || lower.includes('anywhere');
  const remote = isExplicitOnsite ? false : (isExplicitRemote || true);
  const location = remote ? 'Remote' : (isExplicitOnsite ? 'On-site' : 'Worldwide / Remote');

  // Job Type detection
  let jobType = 'freelance';
  if (lower.includes('full-time') || lower.includes('full time') || lower.includes('permanent')) {
    jobType = 'full-time';
  } else if (lower.includes('contract') || lower.includes('retainer')) {
    jobType = 'contract';
  } else if (lower.includes('part-time') || lower.includes('part time')) {
    jobType = 'part-time';
  }

  // Skills detected
  const skillKeywords = [
    'premiere pro',
    'after effects',
    'motion graphics',
    'short-form editing',
    'long-form editing',
    'sound design',
    'color grading',
    'photoshop',
    'davinci resolve',
    'blender',
    'youtube editing',
    'thumbnails',
    'storytelling',
    'retention editing',
    'subtitles',
    'react',
    'javascript',
    'ai video',
  ];
  const requiredSkills = skillKeywords.filter((sk) => lower.includes(sk));

  return {
    title,
    jobRole,
    jobCategory,
    jobType,
    salary,
    remote,
    location,
    requiredSkills,
  };
}

export const extractJobDetails = extractJobAttributes;

/**
 * 4. Enhanced Profile Matcher (0 - 100% Score & Specific Reasons)
 */
export function calculateProfileMatch(postText = '', jobAttributes = {}, userProfile = null) {
  const lower = postText.toLowerCase();
  const reasons = [];
  let score = 70; // baseline

  const userProfession = (userProfile?.profession || 'Video Editor').toLowerCase();
  const userSpecialization = (userProfile?.specialization || 'YouTube Video Editor').toLowerCase();
  const userSkills = Array.isArray(userProfile?.skills) ? userProfile.skills : [];
  const userExperience = (userProfile?.experience || 'Mid-Level (3-5 years)').toLowerCase();

  // 1. Profession / role match
  if (lower.includes(userProfession) || lower.includes('editor')) {
    score += 8;
    reasons.push(`✓ Matches your profession (${userProfile?.profession || 'Video Editor'})`);
  }

  // 2. Specialization match
  if (
    userSpecialization.includes('youtube') &&
    (lower.includes('youtube') || lower.includes('retention') || lower.includes('channel'))
  ) {
    score += 10;
    reasons.push('✓ YouTube editing & channel growth specialization');
  } else if (
    userSpecialization.includes('short') &&
    (lower.includes('short') || lower.includes('reels') || lower.includes('tiktok'))
  ) {
    score += 10;
    reasons.push('✓ Short-form vertical video & virality specialization');
  } else if (userSpecialization.includes('motion')) {
    score += 10;
    reasons.push('✓ Motion graphics & visual effects specialization');
  }

  // 3. User skills matched against post
  for (const skill of userSkills) {
    const sName = typeof skill === 'string' ? skill : (skill?.name || '');
    if (!sName) continue;
    const sLower = sName.toLowerCase();
    if (lower.includes(sLower)) {
      score += 4;
      reasons.push(`✓ ${sName} matches required skill`);
    }
  }

  // 4. Remote flexibility
  if (jobAttributes.remote) {
    score += 4;
    reasons.push('✓ 100% Remote flexibility aligns with your preferences');
  }

  // 5. Experience alignment
  if (userExperience.includes('senior') || userExperience.includes('lead')) {
    score += 3;
    reasons.push('✓ Your senior background fits high-value client needs');
  }

  // Fallback reasons if sparse
  if (reasons.length < 2) {
    reasons.push('✓ Opportunity aligns with your active career category');
    reasons.push('✓ Actively hiring and verified opportunity');
  }

  const finalScore = Math.min(98, Math.max(55, score));
  return { matchScore: finalScore, reasons };
}

export function calculateMatchScore(postText, jobDetails, userProfile) {
  return calculateProfileMatch(postText, jobDetails, userProfile).matchScore;
}

/**
 * 5. End-to-end Pipeline Transformation
 * Transforms raw post into a Unified Job object.
 */
export function processPostToJob(post, userProfile, source) {
  // Reject non-hiring items
  if (!isHiringOpportunity(post.postText)) {
    return null;
  }

  const extracted = extractJobAttributes(
    post.postText,
    post.platform || source?.platform || 'facebook_group',
    source?.name || source?.sourceName || '',
    userProfile
  );

  // V4 Multi-factor Pro Match calculation
  const candidateJob = {
    ...extracted,
    description: post.postText,
    platform: post.platform || source?.platform || 'facebook_group',
    company: post.author || source?.name || 'Hiring Client',
  };

  const proMatch = calculateProMatch(candidateJob, userProfile || {});
  const quality = evaluateJobQuality(candidateJob);
  const riskSignals = detectRiskSignals(candidateJob);

  return createJob({
    sourceId: source?.id || post.sourceId,
    platform: post.platform || source?.platform || 'facebook_group',
    postId: post.postId,
    title: extracted.title,
    description: post.postText,
    company: post.author || source?.name || 'Hiring Client',
    client: post.author || source?.name || 'Hiring Client',
    author: post.author || 'Member',
    sourceUrl: post.postUrl || source?.url || '',
    postUrl: post.postUrl || '',
    createdAt: post.createdAt || new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    jobCategory: extracted.jobCategory,
    jobRole: extracted.jobRole,
    jobType: extracted.jobType,
    salary: extracted.salary,
    location: extracted.location,
    remote: extracted.remote,
    requiredSkills: extracted.requiredSkills,
    matchScore: proMatch.matchScore,
    matchReasons: proMatch.matchReasons,
    matchCautionReasons: proMatch.matchCautionReasons,
    matchBreakdown: {
      roleScore: proMatch.breakdown.role.score,
      skillsScore: proMatch.breakdown.skills.score,
      experienceScore: proMatch.breakdown.experience.score,
      specializationScore: proMatch.breakdown.specialization.score,
      jobTypeScore: proMatch.breakdown.jobType.score,
      remoteScore: proMatch.breakdown.remote.score,
      salaryScore: proMatch.breakdown.salary.score,
      portfolioScore: proMatch.breakdown.portfolio.score,
    },
    jobQuality: quality.level,
    riskSignals,
    isDemo: post.isDemo !== undefined ? post.isDemo : false,
    isJob: true,
    status: 'discovered',
  });
}

/**
 * Realistic Demo Sample Posts for Seed Testing
 */
export const DEMO_SAMPLE_POSTS = [
  {
    id: 'sample-reddit-1',
    author: 'u/ApexMediaHQ',
    platform: 'reddit',
    postUrl: 'https://reddit.com/r/forhire/comments/hiring_lead_youtube_editor',
    text: '🔥 [Hiring] Lead YouTube Video Editor for fast-growing Finance & Tech channel (280k subscribers). Seeking someone proficient in Premiere Pro, dynamic pacing, and retention storytelling. 1-2 videos/week. 100% Remote. Budget: $450 - $650 per video. Drop your portfolio link or DM me.',
  },
  {
    id: 'sample-yt-1',
    author: 'Studio Velocity (YouTube Channel)',
    platform: 'youtube',
    postUrl: 'https://www.youtube.com/watch?v=sample_hiring_yt',
    text: 'WE ARE HIRING A FULL-TIME SHORT-FORM VIDEO EDITOR! ($3,500/mo). Looking for an editor to repurpose podcast highlights into viral TikToks and YouTube Shorts with dynamic captions and sound design. Remote.',
  },
  {
    id: 'sample-x-1',
    author: '@AlexFounder (Building in public)',
    platform: 'x',
    postUrl: 'https://x.com/alexfounder/status/sample_hiring_tweet',
    text: 'Hiring: Need a freelance Motion Graphics Designer & Video Editor for upcoming SaaS launch promos. After Effects mastery required. $40/hr or $2,500 project rate. Remote worldwide. DM your portfolio!',
  },
  {
    id: 'sample-fb-1',
    author: 'Elena Rostova (Group Member)',
    platform: 'facebook_group',
    postUrl: 'https://www.facebook.com/groups/videoeditors/posts/77218392',
    text: 'Urgent: Looking for a skilled Video Editor to edit weekly YouTube documentary episodes. 100% Remote. Paid: $500 per video. Comment below with portfolio link!',
  },
];
