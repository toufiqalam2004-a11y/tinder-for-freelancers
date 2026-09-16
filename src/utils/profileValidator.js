export function checkProfileCompletion(profile) {
  if (!profile) return false;
  const hasName = Boolean(profile.name && profile.name.trim());
  const hasProfession = Boolean(
    (profile.primaryRole || profile.profession) && (profile.primaryRole || profile.profession).trim()
  );
  const hasCategory = Boolean((profile.category || profile.primaryCategory) && (profile.category || profile.primaryCategory).trim());
  const hasSpecialization = Boolean(profile.specialization && profile.specialization.trim());
  const hasSkills = Array.isArray(profile.skills) && profile.skills.length >= 1;
  const hasBio = Boolean(profile.bio && profile.bio.trim().length > 0);
  const primaryPort = profile.portfolioUrl || (Array.isArray(profile.portfolioLinks) && profile.portfolioLinks[0]?.url) || '';
  const hasPortfolio = Boolean(primaryPort && /^https?:\/\/.+\..+/i.test(primaryPort.trim()));
  const hasCv = Boolean(profile.cvUrl || profile.cvFileName || profile.cvFile);
  const hasValidEmail = profile.email !== undefined ? Boolean(profile.email && String(profile.email).trim().length > 0) : true;

  return Boolean(
    hasName &&
    hasProfession &&
    hasCategory &&
    hasSpecialization &&
    hasSkills &&
    hasBio &&
    hasPortfolio &&
    hasCv &&
    hasValidEmail
  );
}
