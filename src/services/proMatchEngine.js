import { JOB_QUALITY_LEVELS } from '../utils/constants.js';

/**
 * Advanced Multi-Factor Pro Match Engine (V4)
 * 
 * Component Weights:
 * - Role Alignment: 30%
 * - Skills Match: 25%
 * - Experience Level: 15%
 * - Specialization: 10%
 * - Job Type Match: 5%
 * - Remote Preference: 5%
 * - Salary Expectation: 5%
 * - Portfolio / CV Relevance: 5%
 * Total = 100%
 */

// Risk signal patterns in job postings
const RISK_PATTERNS = [
  { pattern: /pay upfront|registration fee|pay for training|buy equipment from us|send check/i, label: 'Mentions upfront payment or fees' },
  { pattern: /urgent hire today|start in 1 hour|no experience needed \$[1-9]\d{2,}\/hr/i, label: 'Unrealistic urgency or compensation' },
  { pattern: /bit\.ly|tinyurl\.com|t\.me\/|telegram only|whatsapp only for interview/i, label: 'Requests off-platform interview via messaging link' },
  { pattern: /bank details|ssn|id card copy before interview/i, label: 'Requests sensitive personal info prematurely' },
];

/**
 * Parses numeric salary bounds from job salary strings (e.g., "$3,000/mo", "$40/hr", "$500 per video")
 */
function parseSalaryAmount(salaryStr = '') {
  if (!salaryStr || typeof salaryStr !== 'string') return null;
  const cleaned = salaryStr.replace(/,/g, '');
  const match = cleaned.match(/\$?(\d+)(?:\s*-\s*\$?(\d+))?/);
  if (!match) return null;
  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  return { min, max };
}

/**
 * Calculates weighted match score, component breakdown, positive reasons, and caution warnings.
 */
export function calculateProMatch(job = {}, profile = {}) {
  const jobText = `${job.title || ''} ${job.description || ''} ${job.jobRole || ''}`.toLowerCase();
  const reasons = [];
  const cautionReasons = [];

  // User Profile Attributes
  const userRole = (profile.primaryRole || profile.profession || '').toLowerCase();
  const secondaryRoles = (profile.secondaryRoles || []).map((r) => r.toLowerCase());
  const userSpecialization = (profile.specialization || '').toLowerCase();
  
  // Normalize user skills
  const rawSkills = profile.skills || [];
  const userSkills = rawSkills.map((s) => (typeof s === 'string' ? { name: s, level: 'Advanced' } : s));
  
  const userYears = profile.yearsOfExperience !== undefined ? Number(profile.yearsOfExperience) : 3;
  const preferredJobTypes = profile.preferredJobTypes || ['freelance', 'contract'];
  const remotePreference = profile.remotePreference || 'remote';
  const expectedSalaryMin = Number(profile.expectedSalaryMin) || 500;
  const hasPortfolio = !!(profile.portfolioUrl || (profile.portfolioLinks && profile.portfolioLinks.length > 0));
  const hasCv = !!profile.cvUrl;

  // -------------------------------------------------------------
  // 1. Role Alignment (30%)
  // -------------------------------------------------------------
  let roleScore = 0;
  const jobRole = (job.jobRole || job.title || '').toLowerCase();

  if (userRole && (jobText.includes(userRole) || jobRole.includes(userRole))) {
    roleScore = 30;
    reasons.push(`✓ Primary role match: Perfect fit for "${profile.primaryRole || profile.profession}"`);
  } else if (secondaryRoles.some((r) => r && (jobText.includes(r) || jobRole.includes(r)))) {
    roleScore = 24;
    reasons.push('✓ Matches one of your secondary target roles');
  } else if (userRole && userRole.split(' ').some((word) => word.length > 3 && jobText.includes(word))) {
    roleScore = 18;
    reasons.push('✓ Relevant field overlap with your professional background');
  } else {
    roleScore = 10;
    cautionReasons.push(`⚠ Different core domain than your primary role (${profile.primaryRole || profile.profession || 'Video Editor'})`);
  }

  // -------------------------------------------------------------
  // 2. Skills Match (25%)
  // -------------------------------------------------------------
  let skillsScore = 0;
  const matchedSkills = [];
  const missingJobSkills = [];

  if (userSkills.length > 0) {
    userSkills.forEach((skillObj) => {
      const sName = (skillObj.name || '').toLowerCase();
      if (sName && jobText.includes(sName)) {
        matchedSkills.push(skillObj);
      }
    });

    const matchRatio = matchedSkills.length / Math.max(userSkills.length, 3);
    skillsScore = Math.min(25, Math.round(matchRatio * 25) + (matchedSkills.length > 0 ? 8 : 0));
    skillsScore = Math.min(25, skillsScore);

    if (matchedSkills.length > 0) {
      const topNames = matchedSkills.slice(0, 3).map((s) => s.name).join(', ');
      reasons.push(`✓ Matches key skills: ${topNames}`);
    } else {
      cautionReasons.push('⚠ Core profile skills not explicitly mentioned in this post');
    }

    // Check required skills on job
    const jobReqs = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];
    jobReqs.forEach((req) => {
      const rLower = req.toLowerCase();
      const userHas = userSkills.some((s) => (s.name || '').toLowerCase().includes(rLower) || rLower.includes((s.name || '').toLowerCase()));
      if (!userHas) missingJobSkills.push(req);
    });

    if (missingJobSkills.length > 0) {
      cautionReasons.push(`⚠ May require additional skill: ${missingJobSkills.slice(0, 2).join(', ')}`);
    }
  } else {
    skillsScore = 12; // Baseline if no skills populated
  }

  // -------------------------------------------------------------
  // 3. Experience Level (15%)
  // -------------------------------------------------------------
  let experienceScore = 0;
  const isSeniorJob = jobText.includes('senior') || jobText.includes('lead') || jobText.includes('expert') || jobText.includes('5+ years');

  if (userYears >= 5) {
    if (isSeniorJob) {
      experienceScore = 15;
      reasons.push(`✓ Senior experience (${userYears}+ yrs) matches high-impact client demand`);
    } else {
      experienceScore = 13;
      reasons.push(`✓ Strong ${userYears} years track record easily satisfies requirements`);
    }
  } else if (userYears >= 2) {
    if (isSeniorJob) {
      experienceScore = 8;
      cautionReasons.push('⚠ Client is seeking senior level; competitive experience required');
    } else {
      experienceScore = 15;
      reasons.push(`✓ Mid-level experience (${userYears} yrs) is well suited for this scope`);
    }
  } else {
    if (isSeniorJob) {
      experienceScore = 4;
      cautionReasons.push('⚠ Position asks for extensive experience');
    } else {
      experienceScore = 13;
      reasons.push('✓ Good match for entry / early-career talent');
    }
  }

  // -------------------------------------------------------------
  // 4. Specialization Match (10%)
  // -------------------------------------------------------------
  let specializationScore = 0;
  if (userSpecialization && jobText.includes(userSpecialization)) {
    specializationScore = 10;
    reasons.push(`✓ Aligns directly with specialization: "${profile.specialization}"`);
  } else if (userSpecialization && userSpecialization.split(' ').some((w) => w.length > 3 && jobText.includes(w))) {
    specializationScore = 7;
    reasons.push(`✓ Related to your ${profile.specialization} specialization`);
  } else {
    specializationScore = 4;
  }

  // -------------------------------------------------------------
  // 5. Job Type Match (5%)
  // -------------------------------------------------------------
  let jobTypeScore = 0;
  const currentJobType = (job.jobType || 'freelance').toLowerCase();
  if (preferredJobTypes.includes(currentJobType) || preferredJobTypes.includes('all')) {
    jobTypeScore = 5;
    reasons.push(`✓ Matches preferred arrangement: ${currentJobType.toUpperCase()}`);
  } else {
    jobTypeScore = 2;
    cautionReasons.push(`⚠ Opportunity is ${currentJobType} (your preference: ${preferredJobTypes.join(', ')})`);
  }

  // -------------------------------------------------------------
  // 6. Remote Preference (5%)
  // -------------------------------------------------------------
  let remoteScore = 0;
  const isJobRemote = job.remote === true || jobText.includes('remote') || (job.location || '').toLowerCase().includes('remote');
  
  if (remotePreference === 'remote') {
    if (isJobRemote) {
      remoteScore = 5;
      reasons.push('✓ 100% Remote flexibility');
    } else {
      remoteScore = 1;
      cautionReasons.push('⚠ Not listed as remote (your preference: Remote)');
    }
  } else {
    remoteScore = 5;
    if (isJobRemote) reasons.push('✓ Offers remote option');
  }

  // -------------------------------------------------------------
  // 7. Salary Alignment (5%)
  // -------------------------------------------------------------
  let salaryScore = 3; // default neutral if negotiable
  const parsedSalary = parseSalaryAmount(job.salary);

  if (parsedSalary) {
    if (parsedSalary.min >= expectedSalaryMin || parsedSalary.max >= expectedSalaryMin) {
      salaryScore = 5;
      reasons.push(`✓ Compensation (${job.salary}) meets or exceeds minimum expectation`);
    } else {
      salaryScore = 2;
      cautionReasons.push(`⚠ Listed rate (${job.salary}) may be below your minimum target`);
    }
  } else {
    salaryScore = 4;
    reasons.push('✓ Flexible / negotiable rate structure');
  }

  // -------------------------------------------------------------
  // 8. Portfolio / CV Relevance (5%)
  // -------------------------------------------------------------
  let portfolioScore = 0;
  if (hasPortfolio && hasCv) {
    portfolioScore = 5;
    reasons.push('✓ Portfolio & verified CV ready to showcase for this role');
  } else if (hasPortfolio || hasCv) {
    portfolioScore = 3;
    reasons.push('✓ Profile assets available to apply');
  } else {
    portfolioScore = 1;
    cautionReasons.push('⚠ Add CV or Portfolio link to maximize application impact');
  }

  // Total weighted score
  const totalScore = Math.min(
    99,
    Math.max(
      35,
      roleScore +
        skillsScore +
        experienceScore +
        specializationScore +
        jobTypeScore +
        remoteScore +
        salaryScore +
        portfolioScore
    )
  );

  // Fallback reasons if sparse
  if (reasons.length < 2) {
    reasons.push('✓ Active opportunity in your career category');
    reasons.push('✓ Verified hiring lead ready for outreach');
  }

  return {
    matchScore: totalScore,
    matchReasons: reasons,
    matchCautionReasons: cautionReasons,
    breakdown: {
      role: { score: roleScore, max: 30, label: 'Role Alignment' },
      skills: { score: skillsScore, max: 25, label: 'Skills Match' },
      experience: { score: experienceScore, max: 15, label: 'Experience Level' },
      specialization: { score: specializationScore, max: 10, label: 'Specialization' },
      jobType: { score: jobTypeScore, max: 5, label: 'Job Type' },
      remote: { score: remoteScore, max: 5, label: 'Remote Location' },
      salary: { score: salaryScore, max: 5, label: 'Salary Target' },
      portfolio: { score: portfolioScore, max: 5, label: 'Portfolio & CV' },
    },
  };
}

/**
 * Evaluates Job Quality based on posting completeness and actionable details.
 */
export function evaluateJobQuality(job = {}) {
  const text = `${job.title || ''} ${job.description || ''}`.trim();
  let qualityPoints = 0;

  if (text.length > 180) qualityPoints += 2;
  else if (text.length > 80) qualityPoints += 1;

  if (job.salary && !['negotiable', 'not specified', 'unpaid'].includes(job.salary.toLowerCase())) {
    qualityPoints += 2;
  }

  if (Array.isArray(job.requiredSkills) && job.requiredSkills.length >= 2) {
    qualityPoints += 2;
  }

  if (job.contactMethod || text.includes('@') || text.includes('apply') || text.includes('dm')) {
    qualityPoints += 2;
  }

  if (job.company && job.company !== 'Hiring Client' && job.company !== 'Member') {
    qualityPoints += 1;
  }

  if (qualityPoints >= 6) {
    return {
      level: JOB_QUALITY_LEVELS.HIGH,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      badge: 'High Quality',
    };
  }
  if (qualityPoints >= 3) {
    return {
      level: JOB_QUALITY_LEVELS.MEDIUM,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      badge: 'Standard Quality',
    };
  }
  return {
    level: JOB_QUALITY_LEVELS.LIMITED,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    badge: 'Limited Info',
  };
}

/**
 * Scans job post for potential risk signals without false alarms.
 */
export function detectRiskSignals(job = {}) {
  const text = `${job.title || ''} ${job.description || ''}`;
  const signals = [];

  RISK_PATTERNS.forEach(({ pattern, label }) => {
    if (pattern.test(text)) {
      signals.push(label);
    }
  });

  return signals;
}

/**
 * Calculates user Profile Strength (0 - 100%) and actionable improvement checklist.
 */
export function calculateProfileStrength(profile = {}) {
  let score = 0;
  const tips = [];

  if (profile.name?.trim()) score += 10;
  else tips.push({ id: 'name', label: 'Add your full name', pts: 10 });

  if (profile.profession?.trim() || profile.primaryRole?.trim()) score += 15;
  else tips.push({ id: 'role', label: 'Set primary target role', pts: 15 });

  if (profile.specialization?.trim()) score += 10;
  else tips.push({ id: 'spec', label: 'Add specific niche or specialization', pts: 10 });

  const skills = profile.skills || [];
  if (skills.length >= 5) score += 20;
  else if (skills.length >= 1) {
    score += 10;
    tips.push({ id: 'skills', label: 'Add at least 5 skills for better matching', pts: 10 });
  } else {
    tips.push({ id: 'skills', label: 'Add your technical & creative skills', pts: 20 });
  }

  if (profile.portfolioUrl || (profile.portfolioLinks && profile.portfolioLinks.length > 0)) {
    score += 15;
  } else {
    tips.push({ id: 'portfolio', label: 'Add portfolio link to showcase work', pts: 15 });
  }

  if (profile.cvUrl) score += 15;
  else tips.push({ id: 'cv', label: 'Upload your CV / Resume', pts: 15 });

  if (profile.bio?.trim() && profile.bio.length > 30) score += 10;
  else tips.push({ id: 'bio', label: 'Write a short professional bio', pts: 10 });

  if (profile.preferredJobTypes && profile.preferredJobTypes.length > 0) score += 5;

  return {
    score: Math.min(100, score),
    tips,
  };
}
