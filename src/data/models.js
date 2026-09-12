let counter = Date.now();

function generateId() {
  return `${++counter}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createUser(fields = {}) {
  // Support both legacy array of strings and structured skills objects: { name, level, category }
  const rawSkills = fields.skills || [];
  const structuredSkills = rawSkills.map((s) => {
    if (typeof s === 'string') {
      return { name: s, level: 'Advanced', category: fields.category || 'General' };
    }
    return s;
  });

  // Support multiple portfolio links with backward compatibility for portfolioUrl
  let portfolioLinks = fields.portfolioLinks || [];
  if (portfolioLinks.length === 0 && fields.portfolioUrl) {
    portfolioLinks = [
      {
        id: 'port-1',
        title: 'Primary Portfolio',
        url: fields.portfolioUrl,
        category: fields.category || 'General',
        isPrimary: true,
      },
    ];
  }

  return {
    id: fields.id || generateId(),
    name: fields.name || '',
    email: fields.email || '',
    phone: fields.phone || '',
    profession: fields.profession || '',
    primaryRole: fields.primaryRole || fields.profession || '',
    secondaryRoles: fields.secondaryRoles || [],
    category: fields.category || '',
    specialization: fields.specialization || '',
    skills: structuredSkills,
    experience: fields.experience || '',
    yearsOfExperience: fields.yearsOfExperience !== undefined ? Number(fields.yearsOfExperience) : 3,
    bio: fields.bio || '',
    portfolioUrl: fields.portfolioUrl || (portfolioLinks[0]?.url || ''),
    portfolioLinks,
    cvUrl: fields.cvUrl || '',
    cvParsedSkills: fields.cvParsedSkills || [],
    
    // Pro Career & Work Preferences
    preferredJobTypes: fields.preferredJobTypes || ['freelance', 'contract'],
    remotePreference: fields.remotePreference || 'remote', // 'remote' | 'hybrid' | 'onsite' | 'any'
    expectedSalaryMin: fields.expectedSalaryMin || 500,
    expectedSalaryMax: fields.expectedSalaryMax || 3000,
    salaryType: fields.salaryType || 'per_month', // 'per_project' | 'per_hour' | 'per_month'
    currency: fields.currency || 'USD',
    availability: fields.availability || 'Immediately', // 'Immediately' | '2_weeks' | 'part_time'
    
    // V6 Scalable Account Architecture
    headline: fields.headline || 'High-Retention Video Editor for Creators & Brands',
    accountType: fields.accountType || 'freelancer', // 'freelancer' | 'client' | 'agency'
    workspaces: fields.workspaces || [
      {
        id: 'ws-personal',
        name: 'Personal Workspace',
        type: 'personal',
        role: 'owner',
        createdAt: new Date().toISOString(),
      },
    ],
    activeWorkspaceId: fields.activeWorkspaceId || 'ws-personal',
    profiles: fields.profiles || [
      {
        id: 'prof-primary',
        title: fields.profession || 'Video Editor',
        headline: fields.headline || 'High-Retention Video Editor for Creators & Brands',
        profession: fields.profession || 'Video Editor',
        specialization: fields.specialization || 'YouTube & Short-form',
        skills: structuredSkills,
        experience: fields.experience || '3+ years',
        portfolioUrl: fields.portfolioUrl || (portfolioLinks[0]?.url || ''),
        isActive: true,
      },
    ],
    activeProfileId: fields.activeProfileId || 'prof-primary',
    userPreferences: fields.userPreferences || {
      preferredRoles: fields.preferredRoles || ['Video Editor', 'Motion Designer'],
      preferredSkills: fields.preferredSkills || ['Premiere Pro', 'After Effects'],
      preferredIndustries: ['YouTube', 'Creators', 'Tech Startups'],
      preferredJobTypes: fields.preferredJobTypes || ['freelance', 'contract'],
      remotePreference: fields.remotePreference || 'remote',
      minSalary: fields.expectedSalaryMin || 500,
      minMatchScore: 70,
      excludedRoles: [],
      excludedSources: [],
      negativeFeedback: [],
    },
    
    createdAt: fields.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createWorkspace(fields = {}) {
  return {
    id: fields.id || `ws-${generateId()}`,
    ownerId: fields.ownerId || 'usr-1',
    name: fields.name || 'Personal Workspace',
    type: fields.type || 'personal', // 'personal' | 'agency' | 'team'
    role: fields.role || 'owner',
    members: fields.members || [
      {
        id: `mem-${generateId()}`,
        userId: 'usr-1',
        name: 'You (Owner)',
        role: 'owner',
        permissions: ['view', 'edit', 'manage', 'send', 'analytics'],
      },
    ],
    createdAt: fields.createdAt || new Date().toISOString(),
  };
}

export function createClientProfile(fields = {}) {
  return {
    id: fields.id || `client-${generateId()}`,
    company: fields.company || '',
    website: fields.website || '',
    description: fields.description || '',
    industry: fields.industry || 'Technology',
    location: fields.location || 'Remote',
    verified: fields.verified !== undefined ? fields.verified : true,
    createdAt: new Date().toISOString(),
  };
}

export function createAgencyProfile(fields = {}) {
  return {
    id: fields.id || `agency-${generateId()}`,
    agencyName: fields.agencyName || '',
    teamSize: fields.teamSize || '1-10',
    services: fields.services || ['Video Production', 'Content Strategy'],
    website: fields.website || '',
    description: fields.description || '',
    createdAt: new Date().toISOString(),
  };
}

export function createUserPreferences(fields = {}) {
  return {
    preferredRoles: fields.preferredRoles || ['Video Editor', 'Motion Designer'],
    preferredSkills: fields.preferredSkills || ['Premiere Pro', 'After Effects'],
    preferredIndustries: fields.preferredIndustries || ['YouTube Creators', 'Tech Startups', 'E-commerce'],
    preferredJobTypes: fields.preferredJobTypes || ['freelance', 'contract'],
    remotePreference: fields.remotePreference || 'remote',
    minSalary: fields.minSalary || 500,
    minMatchScore: fields.minMatchScore || 70,
    excludedRoles: fields.excludedRoles || [],
    excludedSources: fields.excludedSources || [],
    negativeFeedback: fields.negativeFeedback || [],
    updatedAt: new Date().toISOString(),
  };
}

export function createSourceHealth(fields = {}) {
  return {
    sourceId: fields.sourceId,
    platform: fields.platform,
    status: fields.status || 'healthy', // 'healthy' | 'syncing' | 'warning' | 'disconnected' | 'error'
    lastSyncAt: fields.lastSyncAt || new Date().toISOString(),
    latencyMs: fields.latencyMs || 42,
    message: fields.message || 'Connected and operating normally',
  };
}

export function createSavedSearch(fields = {}) {
  return {
    id: fields.id || `search-${generateId()}`,
    name: fields.name || 'My Search Alert',
    query: fields.query || '',
    platform: fields.platform || 'all',
    minScore: fields.minScore || 70,
    remote: fields.remote || 'all',
    jobType: fields.jobType || 'all',
    category: fields.category || 'all',
    alertEnabled: fields.alertEnabled !== undefined ? fields.alertEnabled : true,
    createdAt: fields.createdAt || new Date().toISOString(),
    lastAlertAt: fields.lastAlertAt || null,
  };
}

export function createNotification(fields = {}) {
  return {
    id: fields.id || `notif-${generateId()}`,
    type: fields.type || 'high_match', // 'high_match' | 'application_update' | 'saved_search_alert' | 'system'
    title: fields.title || 'Notification',
    message: fields.message || '',
    jobId: fields.jobId || null,
    applicationId: fields.applicationId || null,
    searchId: fields.searchId || null,
    read: fields.read !== undefined ? fields.read : false,
    createdAt: fields.createdAt || new Date().toISOString(),
  };
}


export function createJobSource(fields = {}) {
  const platform = fields.platform || 'facebook_group';
  let type = fields.type || fields.sourceType;
  if (!type) {
    if (platform === 'reddit') type = fields.query ? 'reddit_search' : 'reddit_subreddit';
    else if (platform === 'youtube') type = 'youtube_search';
    else if (platform === 'x') type = 'x_search';
    else if (platform === 'manual_import') type = 'manual_import';
    else type = 'facebook_manual';
  }

  const name = fields.name || fields.sourceName || fields.groupName || (fields.query ? `Search: "${fields.query}"` : 'Untitled Source');
  const url = fields.url || fields.sourceUrl || fields.groupUrl || '';

  return {
    id: fields.id || generateId(),
    userId: fields.userId || null,
    platform,
    name,
    type,
    url,
    query: fields.query || '',
    enabled: fields.enabled !== undefined ? fields.enabled : true,
    lastFetchedAt: fields.lastFetchedAt || fields.lastCheckedAt || null,
    status: fields.status || 'connected',
    createdAt: fields.createdAt || new Date().toISOString(),
    sourceName: name,
    sourceUrl: url,
    sourceType: type,
    groupName: name,
    groupUrl: url,
    lastCheckedAt: fields.lastFetchedAt || fields.lastCheckedAt || null,
  };
}

export function createPost(fields = {}) {
  return {
    postId: fields.postId || generateId(),
    sourceId: fields.sourceId || null,
    postText: fields.postText || '',
    postUrl: fields.postUrl || '',
    author: fields.author || 'Anonymous Member',
    platform: fields.platform || 'facebook_group',
    createdAt: fields.createdAt || new Date().toISOString(),
    fetchedAt: fields.fetchedAt || new Date().toISOString(),
    title: fields.title || '',
    metadata: fields.metadata || {},
    isDemo: fields.isDemo !== undefined ? fields.isDemo : false,
  };
}

export function createJob(fields = {}) {
  return {
    id: fields.id || generateId(),
    sourceId: fields.sourceId || null,
    platform: fields.platform || 'facebook_group',
    postId: fields.postId || null,
    title: fields.title || '',
    description: fields.description || '',
    company: fields.company || fields.client || fields.author || 'Hiring Client',
    client: fields.client || fields.company || fields.author || 'Hiring Client',
    author: fields.author || fields.company || 'Member',
    sourceUrl: fields.sourceUrl || fields.postUrl || fields.url || '',
    postUrl: fields.postUrl || fields.sourceUrl || fields.url || '',
    createdAt: fields.createdAt || new Date().toISOString(),
    fetchedAt: fields.fetchedAt || new Date().toISOString(),
    jobCategory: fields.jobCategory || fields.category || 'Creative',
    jobRole: fields.jobRole || fields.title || 'Video Editor',
    jobType: fields.jobType || 'freelance',
    requiredSkills: fields.requiredSkills || fields.skills || [],
    salary: fields.salary || 'Negotiable',
    location: fields.location || 'Remote',
    remote: fields.remote !== undefined ? fields.remote : true,
    matchScore: fields.matchScore !== undefined ? fields.matchScore : 85,
    matchReasons: fields.matchReasons || [
      '✓ Matches your profile specialization',
      '✓ Remote opportunity',
    ],
    matchCautionReasons: fields.matchCautionReasons || [],
    matchBreakdown: fields.matchBreakdown || {
      roleScore: 30,
      skillsScore: 25,
      experienceScore: 15,
      specializationScore: 10,
      jobTypeScore: 5,
      remoteScore: 5,
      salaryScore: 5,
      portfolioScore: 5,
    },
    jobQuality: fields.jobQuality || 'High Quality', // 'High Quality' | 'Standard Quality' | 'Limited Info'
    riskSignals: fields.riskSignals || [], // e.g. ['Mentions upfront software fee']
    status: fields.status || 'discovered',
    isDemo: fields.isDemo !== undefined ? fields.isDemo : true,
    isJob: fields.isJob !== undefined ? fields.isJob : true,
    metadata: fields.metadata || {},
    experience: fields.experience || '',
    contactMethod: fields.contactMethod || '',
  };
}

/**
 * Enhanced Application Model (V3 Specification)
 */
export function createApplication(fields = {}) {
  const initialStatus = fields.status || 'applied';
  const now = new Date().toISOString();

  return {
    id: fields.id || `app-${generateId()}`,
    jobId: fields.jobId || null,
    userId: fields.userId || null,
    title: fields.title || fields.jobTitle || '',
    jobTitle: fields.jobTitle || fields.title || '',
    company: fields.company || 'Hiring Client',
    platform: fields.platform || 'facebook_group',
    sourceUrl: fields.sourceUrl || '',
    message: fields.message || '',
    originalGeneratedMessage: fields.originalGeneratedMessage || fields.message || '',
    tone: fields.tone || 'Professional',
    length: fields.length || 'Medium',
    language: fields.language || 'English',
    cvAttached: fields.cvAttached !== undefined ? fields.cvAttached : true,
    portfolioIncluded: fields.portfolioIncluded !== undefined ? fields.portfolioIncluded : true,
    applicationMethod: fields.applicationMethod || 'Email', // 'Email' | 'WhatsApp' | 'Manual'
    recipient: fields.recipient || '',
    status: initialStatus, // 'saved' | 'draft' | 'applied' | 'viewed' | 'interview' | 'shortlisted' | 'rejected' | 'hired'
    statusHistory: fields.statusHistory || [
      {
        status: initialStatus,
        timestamp: fields.appliedAt || now,
        note: initialStatus === 'draft' ? 'Draft saved' : 'Application recorded',
      },
    ],
    matchScore: fields.matchScore || null,
    matchReasons: fields.matchReasons || [],
    appliedAt: initialStatus === 'draft' ? null : (fields.appliedAt || now),
    createdAt: fields.createdAt || now,
    updatedAt: fields.updatedAt || now,
  };
}

/**
 * V5 Autopilot Lead Model
 */
export function createLead(fields = {}) {
  const now = new Date().toISOString();
  return {
    id: fields.id || `lead-${generateId()}`,
    sourceId: fields.sourceId || null,
    sourcePostId: fields.sourcePostId || null,
    platform: fields.platform || 'reddit', // 'reddit' | 'youtube' | 'x' | 'facebook_group' | 'manual_import'
    name: fields.name || 'Hiring Lead',
    username: fields.username || '',
    company: fields.company || 'Hiring Client',
    role: fields.role || 'Opportunity Lead',
    profileUrl: fields.profileUrl || '',
    website: fields.website || '',
    email: fields.email || null,
    phone: fields.phone || null,
    location: fields.location || 'Remote',
    opportunityType: fields.opportunityType || 'Client Opportunity', // 'Job Opportunity' | 'Client Opportunity'
    title: fields.title || 'Discovered Opportunity',
    description: fields.description || '',
    sourceUrl: fields.sourceUrl || '',
    matchScore: fields.matchScore || 85,
    qualificationScore: fields.qualificationScore || 80,
    qualificationReasons: fields.qualificationReasons || [],
    status: fields.status || 'discovered', // 'discovered' | 'qualified' | 'ready_to_contact' | 'waiting_approval' | 'approved' | 'sent' | 'replied' | 'interested' | 'not_interested' | 'follow_up_due' | 'meeting' | 'closed' | 'rejected'
    riskLevel: fields.riskLevel || 'Low', // 'Low' | 'Medium' | 'High'
    research: fields.research || null,
    outreachMessage: fields.outreachMessage || null,
    lastContactedAt: fields.lastContactedAt || null,
    followUpCount: fields.followUpCount || 0,
    isDemo: fields.isDemo !== undefined ? fields.isDemo : false,
    createdAt: fields.createdAt || now,
    updatedAt: now,
  };
}

/**
 * V5 Lead Research Model
 */
export function createLeadResearch(fields = {}) {
  return {
    id: fields.id || `res-${generateId()}`,
    leadId: fields.leadId,
    clientSummary: fields.clientSummary || '',
    opportunityContext: fields.opportunityContext || '',
    verifiedNeed: fields.verifiedNeed || '',
    suggestedAngle: fields.suggestedAngle || '',
    // Clearly distinguish verified known info vs AI inferences
    knownInfo: fields.knownInfo || [],
    aiInferences: fields.aiInferences || [],
    confidenceScore: fields.confidenceScore || 85,
    createdAt: fields.createdAt || new Date().toISOString(),
  };
}

/**
 * V5 Outreach Message Model
 */
export function createOutreachMessage(fields = {}) {
  return {
    id: fields.id || `msg-${generateId()}`,
    leadId: fields.leadId,
    method: fields.method || 'email', // 'email' | 'whatsapp' | 'both'
    tone: fields.tone || 'Professional', // 'Professional' | 'Friendly' | 'Confident' | 'Casual' | 'Short & Direct'
    subject: fields.subject || '',
    opening: fields.opening || '',
    valueProposition: fields.valueProposition || '',
    relevantExperience: fields.relevantExperience || '',
    portfolio: fields.portfolio || '',
    cta: fields.cta || 'Would you be open to a quick 10-minute conversation this week?',
    signature: fields.signature || '',
    fullBody: fields.fullBody || '',
    isEdited: fields.isEdited !== undefined ? fields.isEdited : false,
    approved: fields.approved !== undefined ? fields.approved : false,
    sentAt: fields.sentAt || null,
    status: fields.status || 'draft', // 'draft' | 'approved' | 'sent' | 'replied' | 'rejected'
    isDemo: fields.isDemo !== undefined ? fields.isDemo : false,
    createdAt: fields.createdAt || new Date().toISOString(),
  };
}

/**
 * V5 Agent Task Model
 */
export function createAgentTask(fields = {}) {
  return {
    id: fields.id || `task-${generateId()}`,
    type: fields.type || 'discover', // 'discover' | 'research' | 'qualify' | 'generate_message' | 'send' | 'follow_up' | 'process_reply'
    leadId: fields.leadId || null,
    status: fields.status || 'pending', // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    description: fields.description || '',
    createdAt: fields.createdAt || new Date().toISOString(),
    completedAt: fields.completedAt || null,
    error: fields.error || null,
  };
}

/**
 * V5 Agent Activity Log Model
 */
export function createAgentActivity(fields = {}) {
  return {
    id: fields.id || `act-${generateId()}`,
    leadId: fields.leadId || null,
    leadName: fields.leadName || '',
    action: fields.action || 'Discovered Lead',
    detail: fields.detail || '',
    status: fields.status || 'success', // 'success' | 'warning' | 'error' | 'info'
    timestamp: fields.timestamp || new Date().toISOString(),
  };
}

/**
 * V5 Autopilot Settings Model
 */
export function createAutopilotSettings(fields = {}) {
  return {
    status: fields.status || 'paused', // 'active' | 'paused'
    mode: fields.mode || 'approval', // 'manual' | 'approval' | 'autopilot' (defaults to approval)
    services: fields.services || ['Video Editing', 'Motion Design', 'Content Repurposing'],
    opportunityTypes: fields.opportunityTypes || ['Freelance', 'Contract', 'Client Work'],
    sources: fields.sources || ['reddit', 'youtube', 'x', 'manual_import'],
    minMatchScore: fields.minMatchScore !== undefined ? fields.minMatchScore : 80,
    targetAudience: fields.targetAudience || ['Creators', 'YouTubers', 'Startups', 'Founders'],
    outreachMethod: fields.outreachMethod || 'both', // 'email' | 'whatsapp' | 'both'
    dailyLimit: fields.dailyLimit !== undefined ? fields.dailyLimit : 5,
    requireApprovalFirstContact: fields.requireApprovalFirstContact !== undefined ? fields.requireApprovalFirstContact : true,
    requireApprovalNewRecipient: fields.requireApprovalNewRecipient !== undefined ? fields.requireApprovalNewRecipient : true,
    enableFollowUps: fields.enableFollowUps !== undefined ? fields.enableFollowUps : true,
    followUpDays: fields.followUpDays || [3, 7],
    maxFollowUps: fields.maxFollowUps !== undefined ? fields.maxFollowUps : 2,
    autoPauseOnError: fields.autoPauseOnError !== undefined ? fields.autoPauseOnError : true,
    isConfigured: fields.isConfigured !== undefined ? fields.isConfigured : false,
    autopilotSetupCompleted: fields.autopilotSetupCompleted !== undefined ? fields.autopilotSetupCompleted : false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Subscription & Membership Model (Demo Mode)
 */
export function createSubscription(fields = {}) {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: fields.id || `sub-${generateId()}`,
    userId: fields.userId || 'usr-default',
    plan: fields.plan || 'free', // 'free' | 'plus' | 'pro'
    status: fields.status || 'active', // 'active' | 'expired' | 'cancelled'
    currency: fields.currency || 'INR', // 'INR' | 'USD'
    price: fields.price !== undefined ? fields.price : 0,
    startDate: fields.startDate || now.toISOString(),
    endDate: fields.endDate || (fields.plan === 'free' ? null : thirtyDaysLater.toISOString()),
    autoRenew: fields.autoRenew !== undefined ? fields.autoRenew : true,
    isDemo: true,
    credits: fields.credits || [], // Array of purchased credit items
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Purchased Application Credits Model
 */
export function createCreditItem(fields = {}) {
  const now = new Date();
  const validity = (fields.validityDays || 30) * 24 * 60 * 60 * 1000;

  return {
    id: fields.id || `cred-${generateId()}`,
    packageId: fields.packageId || 'credits_20',
    amount: fields.amount || 20,
    remaining: fields.remaining !== undefined ? fields.remaining : (fields.amount || 20),
    price: fields.price || 0,
    currency: fields.currency || 'INR',
    purchasedAt: fields.purchasedAt || now.toISOString(),
    expiresAt: fields.expiresAt || new Date(now.getTime() + validity).toISOString(),
    isDemo: true,
  };
}

/**
 * Daily Usage Tracker Model
 */
export function createDailyUsage(fields = {}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return {
    date: fields.date || todayStr,
    applicationsUsed: fields.applicationsUsed || 0,
    aiApplyUsed: fields.aiApplyUsed || 0,
    savedSearchesCreated: fields.savedSearchesCreated || 0,
    updatedAt: new Date().toISOString(),
  };
}


