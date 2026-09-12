/**
 * Lead Qualification Engine (V5)
 * 
 * Evaluates candidate leads across 7 key criteria:
 * 1. Relevant Need & Intent
 * 2. Role Fit
 * 3. Budget / Compensation Signal
 * 4. Urgency Signal
 * 5. Source Quality & Authenticity
 * 6. User Skill Alignment
 * 7. Contact Info Availability
 * 
 * Generates a transparent 0-100 Qualification Score and clear rationales.
 */

export function qualifyLead(lead = {}, profile = {}) {
  const text = `${lead.title || ''} ${lead.description || ''}`.toLowerCase();
  const reasons = [];
  const cautionReasons = [];
  let score = 0;

  // 1. Relevant Need & Intent (25 pts)
  const explicitNeeds = [
    'looking for',
    'need a',
    'hiring',
    'seeking',
    'recommend a',
    'want to hire',
    'editor needed',
    'contractor needed',
    'help with',
  ];
  if (explicitNeeds.some((n) => text.includes(n))) {
    score += 25;
    reasons.push('✓ Explicit hiring intent clearly stated in post');
  } else {
    score += 15;
    reasons.push('✓ Opportunity implies ongoing content or creative demand');
  }

  // 2. Role Fit with User Profile (20 pts)
  const userRole = (profile.primaryRole || profile.profession || 'Video Editor').toLowerCase();
  if (text.includes(userRole) || text.includes('editor') || text.includes('video')) {
    score += 20;
    reasons.push(`✓ Directly matches your core role: "${profile.primaryRole || profile.profession || 'Video Editor'}"`);
  } else {
    score += 10;
    cautionReasons.push('⚠ General creative need; role is not an exact title match');
  }

  // 3. Budget & Compensation Signal (15 pts)
  const hasBudget =
    /\$\d+|\/hr|per video|budget:|retainer|paid|month/i.test(lead.description || '') ||
    (lead.salary && lead.salary !== 'Negotiable' && lead.salary !== 'Unspecified');
  if (hasBudget) {
    score += 15;
    reasons.push('✓ Budget or verified compensation explicitly mentioned');
  } else {
    score += 8;
    cautionReasons.push('⚠ Budget not specified upfront (rate to be negotiated)');
  }

  // 4. Urgency Signal (10 pts)
  const hasUrgency = /urgent|asap|immediately|this week|starting soon|ongoing/i.test(text);
  if (hasUrgency) {
    score += 10;
    reasons.push('✓ High urgency / active hiring window');
  } else {
    score += 6;
  }

  // 5. Source Quality & Authenticity (10 pts)
  if (lead.platform === 'reddit' || lead.platform === 'youtube' || lead.platform === 'x') {
    score += 10;
    reasons.push(`✓ Publicly verified opportunity from ${lead.platform.toUpperCase()}`);
  } else {
    score += 8;
  }

  // 6. User Skill Alignment (10 pts)
  const skills = profile.skills || [];
  const matched = skills.filter((s) => text.includes((typeof s === 'string' ? s : s.name).toLowerCase()));
  if (matched.length >= 2) {
    score += 10;
    reasons.push(`✓ Overlaps with your skills: ${matched.slice(0, 2).map((s) => (typeof s === 'string' ? s : s.name)).join(', ')}`);
  } else if (matched.length === 1) {
    score += 7;
  } else {
    score += 5;
  }

  // 7. Contact Availability (10 pts)
  const hasDirectContact = !!(lead.email || lead.phone || text.includes('dm') || text.includes('@'));
  if (hasDirectContact) {
    score += 10;
    reasons.push('✓ Actionable direct contact channel accessible');
  } else {
    score += 4;
    cautionReasons.push('⚠ Contact channel may require direct post response');
  }

  const finalScore = Math.min(98, Math.max(35, score));
  let label = 'High Potential';
  let badgeColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';

  if (finalScore < 60) {
    label = 'Low Potential';
    badgeColor = 'text-rose-500 bg-rose-500/10 border-rose-500/30';
  } else if (finalScore < 80) {
    label = 'Good Potential';
    badgeColor = 'text-blue-500 bg-blue-500/10 border-blue-500/30';
  }

  return {
    score: finalScore,
    label,
    badgeColor,
    reasons,
    cautionReasons,
  };
}
