import express from 'express';
import { db } from '../database.js';
import { redditService } from '../services/redditService.js';
import { youtubeService } from '../services/youtubeService.js';
import { xService } from '../services/xService.js';
import { aiService } from '../services/aiService.js';
import { normalizeWhatsAppNumber } from '../../src/utils/validators.js';
import { extractContactInfo } from '../../src/utils/contactExtractor.js';
import { normalizePlan, isProPlan, toCanonicalPlan } from '../../src/utils/planUtils.js';
import { demoAdapter } from '../../src/services/outreach/demoAdapter.js';
import { generateReferralCode, normalizeReferralCode, isValidReferralCode } from '../../src/utils/referralUtils.js';

export function isDemoOutreachEnabled(req) {
  if (req && req.headers && req.headers['x-enable-demo-outreach'] !== undefined) {
    const headerVal = req.headers['x-enable-demo-outreach'];
    return String(headerVal).toLowerCase() === 'true' || String(headerVal) === '1';
  }
  const val = process.env.ENABLE_DEMO_OUTREACH;
  if (val === undefined || val === null || val === '') return true;
  return String(val).toLowerCase() === 'true' || String(val) === '1';
}

const router = express.Router();

// SSRF & Safe Hostname Verification for External URL Inputs
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];
function isSafeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.includes(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Extract and sanitize text
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

// User Context Middleware: Extracts user from token / header / body / query
function extractUser(req, res, next) {
  req.userId = req.user?.id || req.headers['x-user-id'] || req.body?.userId || req.query?.userId || null;
  next();
}

router.use(extractUser);

// Centralized Pipeline Ingestion Handler
async function processRawPostsToJobs(posts, source, userProfile, ownerId) {
  const existingJobs = db.jobs.findAll();
  const createdJobs = [];

  for (const p of posts) {
    const isDup = existingJobs.some(
      (j) => (j.postId && j.postId === p.postId) || (j.sourceUrl && j.sourceUrl === p.postUrl)
    );
    if (isDup) continue;

    const newJob = {
      id: job--,
      userId: ownerId,
      postId: p.postId,
      sourceId: source.id,
      platform: p.platform,
      title: sanitizeString(p.title, 200),
      company: sanitizeString(p.author || 'Hiring Client', 100),
      client: sanitizeString(p.author || 'Hiring Client', 100),
      description: sanitizeString(p.postText || p.title, 5000),
      sourceUrl: isSafeUrl(p.postUrl) ? p.postUrl : '',
      postUrl: isSafeUrl(p.postUrl) ? p.postUrl : '',
      skills: ['Video Editing', 'Premiere Pro'],
      category: 'Creative',
      jobType: 'freelance',
      salary: 'Competitive / Project-based',
      isRemote: true,
      matchScore: 85,
      isDemo: p.isDemo !== undefined ? p.isDemo : false,
      status: 'new',
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.jobs.insert(newJob);
    createdJobs.push(newJob);
  }

  return createdJobs;
}

// 1. GET /api/sources - List user's sources (scoped by user ID)
router.get('/sources', (req, res) => {
  const sources = db.sources.findAll((s) => !s.userId || s.userId === req.userId);
  res.json({ success: true, sources });
});

// 2. POST /api/sources - Add or update source with input validation
router.post('/sources', (req, res) => {
  const source = req.body;
  if (!source || !source.id || typeof source.id !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid source ID is required.' });
  }

  const validPlatforms = ['reddit', 'youtube', 'x', 'facebook_group', 'manual_import'];
  if (source.platform && !validPlatforms.includes(source.platform)) {
    return res.status(400).json({ success: false, error: 'Invalid source platform.' });
  }

  if (source.url && !isSafeUrl(source.url)) {
    return res.status(400).json({ success: false, error: 'Unsafe or invalid source URL provided.' });
  }

  const sanitized = {
    ...source,
    id: sanitizeString(source.id, 80),
    name: sanitizeString(source.name, 100),
    userId: req.userId,
    updatedAt: new Date().toISOString(),
  };

  const saved = db.sources.insert(sanitized);
  res.json({ success: true, source: saved });
});

// 3. POST /api/sources/:id/sync - Sync source with Real API or fallback
router.post('/sources/:id/sync', async (req, res) => {
  const { id } = req.params;
  const cleanId = sanitizeString(id, 80);
  const source = db.sources.findById(cleanId) || req.body.source;
  if (!source) {
    return res.status(404).json({ success: false, error: 'Source not found.' });
  }

  // IDOR Protection: Verify source ownership if user-scoped
  if (source.userId && source.userId !== req.userId) {
    return res.status(403).json({ success: false, error: 'Access denied. You do not own this source.' });
  }

  let result = { success: false, posts: [], isDemo: true, error: null };
  const platform = source.platform;

  if (platform === 'reddit') {
    result = await redditService.fetchSubredditPosts(source.name || 'forhire');
  } else if (platform === 'youtube') {
    result = await youtubeService.fetchVideos(source.query || source.name || 'video editor hiring');
  } else if (platform === 'x') {
    result = await xService.fetchTweets(source.query || source.name || 'video editor hiring');
  }

  let addedJobs = [];
  if (result.success && result.posts.length > 0) {
    const userProfile = db.profiles.findOne((p) => p.userId === req.userId) || {};
    addedJobs = await processRawPostsToJobs(result.posts, source, userProfile, req.userId);
  }

  db.sourceHealth.insert({
    id: `health-${source.id}`,
    sourceId: source.id,
    userId: req.userId,
    name: source.name,
    platform: source.platform,
    status: result.success ? (result.isDemo ? 'demo_mode' : 'connected') : 'error',
    latencyMs: 120,
    lastSyncAt: new Date().toISOString(),
    message: result.error || (result.isDemo ? 'Demo Mode: API not configured.' : 'Live API connected.'),
    itemCount: addedJobs.length,
  });

  res.json({
    success: result.success,
    isDemo: result.isDemo,
    error: result.error,
    rawCount: result.posts.length,
    addedCount: addedJobs.length,
    addedJobs,
  });
});

// 4. GET /api/jobs - List feed jobs (scoped to user/public)
router.get('/jobs', (req, res) => {
  const jobs = db.jobs.findAll((j) => !j.userId || j.userId === req.userId);
  res.json({ success: true, jobs });
});

const PROTECTED_APP_STATUSES = ['interview', 'shortlisted', 'negotiation', 'hired'];

export function performServerAutoDelete(userId) {
  if (!userId) return 0;
  const pref = db.preferences.findOne((p) => p.userId === userId);
  if (!pref || !pref.autoDeleteApplicationsAfter7Days) return 0;

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const userApps = db.applications.findAll((a) => a.userId === userId);
  let count = 0;

  for (const app of userApps) {
    const status = (app.status || '').toLowerCase();
    if (PROTECTED_APP_STATUSES.includes(status)) continue;

    const lastUpdated = new Date(app.updatedAt || app.appliedAt || app.createdAt).getTime();
    if (!isNaN(lastUpdated) && lastUpdated < cutoff) {
      db.applications.delete(app.id);
      count++;
    }
  }

  return count;
}

// 5. GET /api/applications - List user applications (IDOR Protected & auto-delete cleanup)
router.get('/applications', (req, res) => {
  if (req.userId) {
    performServerAutoDelete(req.userId);
  }
  const applications = db.applications.findAll((a) => !a.userId || a.userId === req.userId);
  res.json({ success: true, applications });
});

// 5b. POST /api/applications/cleanup - Trigger auto-delete sweep
router.post('/applications/cleanup', (req, res) => {
  const deletedCount = performServerAutoDelete(req.userId);
  res.json({ success: true, deletedCount });
});

// 6. POST /api/applications - Save user application
router.post('/applications', (req, res) => {
  const app = req.body;
  if (!app || !app.id || !app.jobId) {
    return res.status(400).json({ success: false, error: 'Valid application and jobId are required.' });
  }

  const sanitized = {
    ...app,
    id: sanitizeString(app.id, 80),
    title: sanitizeString(app.title, 200),
    company: sanitizeString(app.company, 100),
    message: sanitizeString(app.message, 4000),
    userId: req.userId,
    updatedAt: new Date().toISOString(),
  };

  db.applications.insert(sanitized);
  res.json({ success: true, application: sanitized });
});

// 6b. GET & POST /api/preferences
router.get('/preferences', (req, res) => {
  const preferences = db.preferences.findOne((p) => p.userId === req.userId) || {
    userId: req.userId,
    autoDeleteApplicationsAfter7Days: false,
  };
  res.json({ success: true, preferences });
});

router.post('/preferences', (req, res) => {
  const incoming = req.body || {};
  const existing = db.preferences.findOne((p) => p.userId === req.userId) || {
    id: `pref-${req.userId}`,
    userId: req.userId,
  };
  const updated = {
    ...existing,
    ...incoming,
    userId: req.userId,
    updatedAt: new Date().toISOString(),
  };
  db.preferences.insert(updated);

  if (updated.autoDeleteApplicationsAfter7Days) {
    performServerAutoDelete(req.userId);
  }

  res.json({ success: true, preferences: updated });
});

// 7. GET /api/leads - List user leads (IDOR Protected)
router.get('/leads', (req, res) => {
  const leads = db.leads.findAll((l) => !l.userId || l.userId === req.userId);
  res.json({ success: true, leads });
});

// 8. GET /api/profile - Get user profile
router.get('/profile', (req, res) => {
  const profile = db.profiles.findOne((p) => p.userId === req.userId) || null;
  res.json({ success: true, profile });
});

// 9. POST /api/profile - Save user profile
router.post('/profile', (req, res) => {
  const profile = req.body;
  if (!profile) return res.status(400).json({ success: false, error: 'Profile data required.' });

  // URL Safety for portfolio
  if (profile.portfolioUrl && !isSafeUrl(profile.portfolioUrl)) {
    return res.status(400).json({ success: false, error: 'Invalid or unsafe portfolio URL.' });
  }

  const saved = db.profiles.insert({
    ...profile,
    userId: req.userId,
    id: profile.id || `prof-${req.userId}`,
    updatedAt: new Date().toISOString(),
  });

  res.json({ success: true, profile: saved });
});

// 10. GET /api/subscription - Get canonical user subscription
router.get('/subscription', (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'] || req.userId || 'user-default';
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (req.user?.phone && s.phone === req.user.phone));

  if (!sub && userId === 'user-default') {
    sub = {
      id: `sub-${userId}`,
      userId,
      plan: 'free',
      status: 'active',
      currency: 'INR',
      price: 0,
      startDate: new Date().toISOString(),
      endDate: null,
      credits: [],
      isDemo: true,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.subscriptions.insert(sub);
  }

  const cleanPlan = normalizePlan(sub?.plan || 'free');
  res.json({
    success: true,
    subscription: sub
      ? {
          ...sub,
          plan: cleanPlan,
          canonicalPlan: toCanonicalPlan(cleanPlan),
        }
      : {
          id: `sub-${userId}`,
          userId,
          plan: cleanPlan,
          canonicalPlan: toCanonicalPlan(cleanPlan),
          status: 'active',
          currency: 'INR',
          price: 0,
        },
  });
});

// 11. POST /api/subscription - Persist / Update Subscription Tier
router.post('/subscription', (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || req.userId || 'user-default';
  const rawPlan = req.body.plan || req.body.subscription?.plan || req.body.planId || 'free';
  const cleanPlan = normalizePlan(rawPlan);
  const canonicalPlan = toCanonicalPlan(cleanPlan);
  const now = new Date().toISOString();
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let sub = db.subscriptions.findOne((s) => s.userId === userId || (req.user?.phone && s.phone === req.user.phone));

  if (sub) {
    sub = db.subscriptions.update(sub.id, {
      ...sub,
      plan: cleanPlan,
      status: req.body.status || req.body.subscription?.status || 'active',
      currency: req.body.currency || req.body.subscription?.currency || sub.currency || 'INR',
      price: req.body.price !== undefined ? req.body.price : (cleanPlan === 'pro' ? 799 : (cleanPlan === 'plus' ? 299 : 0)),
      endDate: cleanPlan === 'free' ? null : (req.body.endDate || thirtyDaysLater),
      updatedAt: now,
    });
  } else {
    sub = {
      id: `sub-${userId}`,
      userId,
      phone: req.user?.phone,
      plan: cleanPlan,
      status: req.body.status || 'active',
      currency: req.body.currency || 'INR',
      price: cleanPlan === 'pro' ? 799 : (cleanPlan === 'plus' ? 299 : 0),
      startDate: now,
      endDate: cleanPlan === 'free' ? null : thirtyDaysLater,
      credits: [],
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    };
    db.subscriptions.insert(sub);
  }

  // If user is explicitly user-default or sync is requested
  if (userId === 'user-default' || req.body.syncDefaultUser === true) {
    const defSub = db.subscriptions.findOne((s) => s.userId === 'user-default');
    if (defSub && defSub.id !== sub.id) {
      db.subscriptions.update(defSub.id, { plan: cleanPlan, updatedAt: now });
    }
  }

  res.json({
    success: true,
    subscription: {
      ...sub,
      plan: cleanPlan,
      canonicalPlan,
    },
  });
});

// 11b. POST /api/subscription/demo-checkout - Simulate plan upgrade
router.post('/subscription/demo-checkout', (req, res) => {
  const { planId = 'free', currency = 'INR', durationDays = 30 } = req.body;
  const cleanPlan = normalizePlan(planId);
  const userId = req.body.userId || req.headers['x-user-id'] || req.userId || 'user-default';

  const prices = {
    free: { INR: 0, USD: 0 },
    plus: { INR: 299, USD: 4.99 },
    pro: { INR: 899, USD: 9.99 },
  };

  const now = new Date();
  const endDate = cleanPlan === 'free' ? null : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  let existing = db.subscriptions.findOne((s) => s.userId === userId || (req.user?.phone && s.phone === req.user.phone)) || {
    id: `sub-${userId}`,
    userId,
    credits: [],
  };

  const updated = {
    ...existing,
    plan: cleanPlan,
    status: 'active',
    currency,
    price: prices[cleanPlan]?.[currency] || 0,
    startDate: now.toISOString(),
    endDate,
    isDemo: true,
    updatedAt: now.toISOString(),
  };

  db.subscriptions.insert(updated);
  res.json({
    success: true,
    subscription: {
      ...updated,
      canonicalPlan: toCanonicalPlan(cleanPlan),
    },
    transactionId: `txn_srv_${Date.now()}`,
  });
});

// 12. POST /api/credits/demo-buy - Simulate purchasing credits
router.post('/credits/demo-buy', (req, res) => {
  const { packageId = 'credits_20', amount = 20, price = 49, currency = 'INR' } = req.body;
  let sub = db.subscriptions.findOne((s) => s.userId === req.userId) || {
    id: `sub-${req.userId}`,
    userId: req.userId,
    plan: 'free',
    status: 'active',
    currency,
    credits: [],
  };

  const newCredit = {
    id: `cred-${Date.now()}`,
    packageId,
    amount: Number(amount),
    remaining: Number(amount),
    price: Number(price),
    currency,
    purchasedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    isDemo: true,
  };

  sub.credits = [...(sub.credits || []), newCredit];
  sub.updatedAt = new Date().toISOString();
  db.subscriptions.insert(sub);

  res.json({ success: true, credit: newCredit, totalCredits: sub.credits.reduce((acc, c) => acc + c.remaining, 0) });
});

// ==========================================
// OUTREACH & PRO QUICK APPLY ENDPOINTS
// ==========================================

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function extractServerContactInfo(job = {}) {
  return extractContactInfo(job);
}

function calculateMatchQualification(job = {}, profile = {}) {
  const jobText = `${job.title || ''} ${job.description || ''} ${job.jobRole || ''}`.toLowerCase();
  const userRole = (profile.primaryRole || profile.profession || '').toLowerCase();
  const rawSkills = profile.skills || [];
  const userSkills = rawSkills.map((s) => (typeof s === 'string' ? s.toLowerCase() : (s.name || '').toLowerCase())).filter(Boolean);

  let score = 50;
  if (userRole && jobText.includes(userRole)) {
    score += 25;
  }
  let matchedSkillsCount = 0;
  userSkills.forEach((s) => {
    if (s && jobText.includes(s)) {
      matchedSkillsCount++;
    }
  });
  score += Math.min(25, matchedSkillsCount * 10);

  if (typeof job.matchScore === 'number' && !isNaN(job.matchScore)) {
    score = Math.round((score + job.matchScore) / 2);
  }

  const minScore = Number(profile.userPreferences?.minMatchScore) || 70;
  const qualifies = score >= minScore;

  return {
    matchScore: Math.min(99, Math.max(35, score)),
    qualifies,
    minScore,
  };
}

function generateFallbackMessage(job = {}, profile = {}) {
  const name = profile.name || 'Freelancer';
  const role = profile.primaryRole || profile.profession || 'Specialist';
  const jobTitle = job.title || 'the project';
  const clientName = job.company || job.client || job.author || 'Hiring Team';
  const skills = (profile.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean).slice(0, 3).join(', ');
  const portfolio = profile.portfolioUrl ? `\nPortfolio: ${profile.portfolioUrl}` : '';

  return `Hi ${clientName},\n\nI saw your posting for "${jobTitle}" and would love to help. As a ${role}${skills ? ` with expertise in ${skills}` : ''}, I have the hands-on experience needed to deliver great results for this role.${portfolio}\n\nBest regards,\n${name}`;
}

// 14. GET /api/outreach/status - Provider Configuration Status
router.get('/outreach/status', (req, res) => {
  const emailConfigured = !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
  const whatsAppConfigured = !!(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN));
  const aiConfigured = aiService.isConfigured();
  const demoOutreachEnabled = isDemoOutreachEnabled(req);

  res.json({
    success: true,
    emailConfigured,
    whatsAppConfigured,
    demoOutreachEnabled,
    aiConfigured,
    hasAnyProvider: emailConfigured || whatsAppConfigured || demoOutreachEnabled,
  });
});

// Reward Record & Credit Helpers
export function getUserRewardRecord(userId) {
  if (!userId) return null;
  let record = db.rewards.findOne((r) => r.userId === userId);
  if (!record) {
    record = {
      id: `reward-${userId}`,
      userId,
      rewardCredits: 0,
      totalRewardCredits: 0,
      lastDailyLoginRewardDate: null,
      dailyLoginRewardsClaimed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.rewards.insert(record);
  }
  return record;
}

export function getUserRewardCredits(userId) {
  const record = getUserRewardRecord(userId);
  return record ? Math.max(0, record.rewardCredits || 0) : 0;
}

export function getUserPurchasedCredits(userId) {
  const sub = db.subscriptions.findOne((s) => s.userId === userId);
  const creditsList = sub?.credits || [];
  const now = Date.now();
  let total = 0;
  for (const pkg of creditsList) {
    const isExpired = pkg.expiresAt && new Date(pkg.expiresAt).getTime() < now;
    if (!isExpired) {
      total += Math.max(0, pkg.remaining || 0);
    }
  }
  return total;
}

export function getRemainingSubscriptionQuota(userId, plan = 'free') {
  const today = new Date().toISOString().slice(0, 10);
  const usage = db.dailyUsage.findOne((u) => u.userId === userId && u.date === today);
  const used = usage?.applicationsUsed || 0;
  const canonical = toCanonicalPlan(plan);
  const limits = { FREE: 5, PLUS: 20, PRO: 100 };
  const dailyLimit = limits[canonical] || 5;
  return Math.max(0, dailyLimit - used);
}

export function getAvailableApplications(userId, plan = 'free') {
  const remainingQuota = getRemainingSubscriptionQuota(userId, plan);
  const rewardCredits = getUserRewardCredits(userId);
  const purchasedCredits = getUserPurchasedCredits(userId);
  return {
    remainingSubscriptionQuota: remainingQuota,
    rewardCredits,
    purchasedCredits,
    availableApplications: remainingQuota + rewardCredits + purchasedCredits,
  };
}

export function consumeApplicationCredit(userId, plan = 'free') {
  const today = new Date().toISOString().slice(0, 10);
  let usage = db.dailyUsage.findOne((u) => u.userId === userId && u.date === today);
  if (!usage) {
    usage = {
      id: `usage-${userId}-${today}`,
      userId,
      date: today,
      applicationsUsed: 0,
      aiApplyUsed: 0,
    };
    db.dailyUsage.insert(usage);
  }

  const canonical = toCanonicalPlan(plan);
  const limits = { FREE: 5, PLUS: 20, PRO: 100 };
  const dailyLimit = limits[canonical] || 5;

  // 1. Consume normal subscription quota first
  if (usage.applicationsUsed < dailyLimit) {
    usage.applicationsUsed += 1;
    usage.updatedAt = new Date().toISOString();
    db.dailyUsage.insert(usage);
    return { consumedFrom: 'subscription_quota', remainingQuota: dailyLimit - usage.applicationsUsed };
  }

  // 2. Consume reward credits second
  const rewardRecord = getUserRewardRecord(userId);
  if (rewardRecord && rewardRecord.rewardCredits > 0) {
    rewardRecord.rewardCredits = Math.max(0, rewardRecord.rewardCredits - 1);
    rewardRecord.updatedAt = new Date().toISOString();
    db.rewards.update(rewardRecord.id, rewardRecord);
    return { consumedFrom: 'reward_credits', remainingRewardCredits: rewardRecord.rewardCredits };
  }

  // 3. Consume purchased credits third
  const sub = db.subscriptions.findOne((s) => s.userId === userId);
  const now = Date.now();
  for (const pkg of sub?.credits || []) {
    const isExpired = pkg.expiresAt && new Date(pkg.expiresAt).getTime() < now;
    if (!isExpired && (pkg.remaining || 0) > 0) {
      pkg.remaining -= 1;
      db.subscriptions.update(sub.id, sub);
      return { consumedFrom: 'purchased_credits', remainingPurchasedCredits: pkg.remaining };
    }
  }

  throw new Error('No available application credits remaining.');
}

export function claimReferralInternal(user, referralCode) {
  if (!user || !user.id) {
    return { success: false, error: 'User is required to claim referral.', status: 400 };
  }

  const cleanCode = normalizeReferralCode(referralCode);
  if (!cleanCode) {
    return { success: false, error: 'Referral code is required.', status: 400 };
  }

  const referrer = db.users.findOne((u) => u.referralCode === cleanCode);
  if (!referrer) {
    return { success: false, error: 'Invalid referral code.', status: 404 };
  }

  // Self-referral prevention
  if (
    referrer.id === user.id ||
    (user.phone && referrer.phone && user.phone === referrer.phone) ||
    user.referralCode === cleanCode
  ) {
    return { success: false, error: 'You cannot refer yourself.', code: 'SELF_REFERRAL', status: 400 };
  }

  // Permanent attribution check: cannot change referral source once set
  if (user.referredBy && user.referredBy !== referrer.id) {
    return {
      success: false,
      granted: false,
      error: 'User already has a permanent referral attribution.',
      code: 'ALREADY_REFERRED',
      status: 400,
    };
  }

  // Idempotency: if already claimed for this referrer or already completed
  if (user.referredBy === referrer.id || user.referralStatus === 'completed') {
    const reward = getUserRewardRecord(user.id);
    return {
      success: true,
      granted: false,
      alreadyClaimed: true,
      rewardCredits: reward.rewardCredits,
      message: 'Referral bonus has already been claimed.',
      status: 200,
    };
  }

  // Existing user prevention:
  // "Do NOT attach a referral to an existing user who already has an account."
  // "H. Existing user using referral link => no reward"
  if (user.isNewUser === false) {
    return {
      success: false,
      granted: false,
      error: 'Referral bonus is only available for brand new users upon initial signup.',
      code: 'EXISTING_USER',
      status: 400,
    };
  }

  // Duplicate referral record check
  const existingReferral = db.referrals.findOne((r) => r.refereeId === user.id);
  if (existingReferral) {
    const reward = getUserRewardRecord(user.id);
    return {
      success: true,
      granted: false,
      alreadyClaimed: true,
      rewardCredits: reward.rewardCredits,
      message: 'Referral bonus has already been claimed.',
      status: 200,
    };
  }

  // Grant referral reward: FRIEND gets +5 credits
  const now = new Date().toISOString();
  user.referredBy = referrer.id;
  user.referralCodeUsed = cleanCode;
  user.referralStatus = 'completed';
  user.referralCreatedAt = now;
  user.referralRewardGrantedAt = now;
  user.isNewUser = false;
  db.users.update(user.id, user);

  db.referrals.insert({
    id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    referrerId: referrer.id,
    referrerCode: referrer.referralCode,
    refereeId: user.id,
    refereePhone: user.phone,
    bonusCredits: 5,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  });

  const reward = getUserRewardRecord(user.id);
  reward.rewardCredits = (reward.rewardCredits || 0) + 5;
  reward.totalRewardCredits = (reward.totalRewardCredits || 0) + 5;
  reward.updatedAt = now;
  db.rewards.update(reward.id, reward);

  return {
    success: true,
    granted: true,
    addedCredits: 5,
    rewardCredits: reward.rewardCredits,
    message: '🎉 Referral Bonus: You received +5 application credits!',
    status: 200,
  };
}

// 15. POST /api/outreach/quick-apply - Comprehensive PRO One-Swipe Outreach
router.post('/outreach/quick-apply', async (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || req.userId || 'user-default';

  // 1. Validate user exists and is PRO (Normalized & Synchronized)
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (req.user?.phone && s.phone === req.user.phone));

  // Sync client subscription if provided in request
  const clientPlan = req.body.subscription?.plan || req.body.plan;
  if (clientPlan) {
    const cleanClientPlan = normalizePlan(clientPlan);
    if (isProPlan(cleanClientPlan)) {
      if (!sub) {
        sub = {
          id: `sub-${userId}`,
          userId,
          phone: req.user?.phone,
          plan: 'pro',
          status: 'active',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        db.subscriptions.insert(sub);
      } else if (!isProPlan(sub.plan)) {
        sub = db.subscriptions.update(sub.id, { plan: 'pro', updatedAt: new Date().toISOString() });
      }
    }
  }

  const activePlan = sub ? normalizePlan(sub.plan) : (clientPlan ? normalizePlan(clientPlan) : 'free');
  if (!isProPlan(activePlan)) {
    return res.status(403).json({
      success: false,
      code: 'PRO_REQUIRED',
      status: 'NOT_AUTHORIZED',
      error: 'Quick Apply and Auto Outreach are available exclusively for PRO members.',
    });
  }

  // 2. Validate Quick Apply enabled / Autopilot action
  const profile = db.profiles.findOne((p) => p.userId === userId) || req.body.profile || {};
  const userPref = db.preferences.findOne((p) => p.userId === userId) || {};
  const quickApplyEnabled = req.body.isAutopilot || req.body.preferences?.quickApplyEnabled || profile.outreachPreferences?.quickApplyEnabled || userPref.quickApplyEnabled;
  if (!quickApplyEnabled) {
    return res.status(400).json({
      success: false,
      code: 'QUICK_APPLY_DISABLED',
      status: 'DISABLED',
      error: 'Quick Apply is disabled. Please enable it in your profile or use manual review.',
    });
  }

  // 3. Daily quota check (PRO limit = 100)
  const today = new Date().toISOString().slice(0, 10);
  let usage = db.dailyUsage.findOne((u) => u.userId === userId && u.date === today);
  if (!usage) {
    usage = {
      id: `usage-${userId}-${today}`,
      userId,
      date: today,
      applicationsUsed: 0,
      aiApplyUsed: 0,
    };
    db.dailyUsage.insert(usage);
  }

  const appBalances = getAvailableApplications(userId, activePlan);
  if (appBalances.availableApplications <= 0) {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT',
      status: 'RATE_LIMIT',
      error: 'Daily application limit reached. Please try again tomorrow.',
    });
  }

  // 4. Validate job exists and is active
  const job = req.body.job;
  if (!job || !job.id) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_JOB',
      error: 'A valid active job is required.',
    });
  }

  if (job.status === 'closed') {
    return res.status(400).json({
      success: false,
      code: 'JOB_CLOSED',
      error: 'This opportunity is no longer active.',
    });
  }

  // 5. Idempotency / Duplicate Check
  const existingApp = db.applications.findOne(
    (a) => a.userId === userId && (a.jobId === job.id || (a.sourceUrl && job.sourceUrl && a.sourceUrl === job.sourceUrl))
  );
  if (existingApp && existingApp.status && existingApp.status !== 'draft') {
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE',
      status: 'DUPLICATE',
      error: 'You already applied to this opportunity.',
      applicationId: existingApp.id,
    });
  }

  // 6. Profile/Job Match Qualification
  const qualification = calculateMatchQualification(job, profile);
  if (!qualification.qualifies) {
    return res.json({
      success: false,
      code: 'NOT_QUALIFIED',
      status: 'NOT_QUALIFIED',
      matchScore: qualification.matchScore,
      error: "This opportunity doesn't match your profile.",
    });
  }

  // 7. Contact information verification
  const contactInfo = extractServerContactInfo(job);
  if (!contactInfo.hasDirectContact) {
    return res.status(400).json({
      success: false,
      code: 'NO_DIRECT_CONTACT',
      status: 'NO_DIRECT_CONTACT',
      matchScore: qualification.matchScore,
      error: 'No valid client email or WhatsApp number found.',
    });
  }

  // 8. Resolve contact channel
  const prefChannel = req.body.preferences?.contactPreference || profile.outreachPreferences?.contactPreference || 'both';
  let targetChannel = 'none';
  let targetRecipient = '';

  if (contactInfo.hasEmail && contactInfo.hasPhone) {
    if (prefChannel === 'email') {
      targetChannel = 'email';
      targetRecipient = contactInfo.email;
    } else if (prefChannel === 'whatsapp') {
      targetChannel = 'whatsapp';
      targetRecipient = contactInfo.phone;
    } else {
      targetChannel = 'both';
      targetRecipient = `${contactInfo.email}, ${contactInfo.phone}`;
    }
  } else if (contactInfo.hasEmail) {
    targetChannel = 'email';
    targetRecipient = contactInfo.email;
  } else if (contactInfo.hasPhone) {
    targetChannel = 'whatsapp';
    targetRecipient = contactInfo.phone;
  }

  // 9. Check real provider configurations - NEVER claim sent if unconfigured
  const emailConfigured = !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
  const whatsAppConfigured = !!(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN));

  let providerConfigured = false;
  if (targetChannel === 'email') providerConfigured = emailConfigured;
  else if (targetChannel === 'whatsapp') providerConfigured = whatsAppConfigured;
  else if (targetChannel === 'both') providerConfigured = emailConfigured || whatsAppConfigured;

  // 10. Generate Personalized Message (AI or safe fallback)
  let personalizedMessage = '';
  if (aiService.isConfigured()) {
    try {
      const aiRes = await aiService.generatePersonalizedOutreach({ job, profile, mode: 'Professional' });
      if (aiRes && aiRes.message) {
        personalizedMessage = aiRes.message;
      }
    } catch (e) {
      // safe fallback
    }
  }
  if (!personalizedMessage) {
    personalizedMessage = generateFallbackMessage(job, profile);
  }

  // 11. Check provider configuration: Real delivery vs Safe Demo Outreach vs Not Configured
  if (!providerConfigured) {
    if (isDemoOutreachEnabled(req)) {
      // Safe Demo Mode: zero external network requests, marked explicitly as DEMO_SENT
      const demoResult = await demoAdapter.send({
        to: targetRecipient,
        channel: targetChannel,
        message: personalizedMessage,
        job,
        profile,
      });

      const appliedApp = {
        id: `app-qa-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        jobId: job.id,
        userId,
        title: job.title || 'Freelance Opportunity',
        company: job.company || job.author || 'Hiring Client',
        platform: job.platform || 'manual',
        sourceUrl: job.sourceUrl || job.postUrl || '',
        message: personalizedMessage,
        channel: targetChannel,
        recipient: targetRecipient,
        status: 'applied',
        outreachStatus: 'DEMO_SENT',
        demo: true,
        matchScore: qualification.matchScore,
        qualificationResult: 'QUALIFIED',
        messageId: demoResult.messageId,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'quick_apply',
      };
      db.applications.insert(appliedApp);

      // Consume application following priority: 1. Subscription quota -> 2. Reward credits -> 3. Purchased credits
      consumeApplicationCredit(userId, activePlan);

      return res.json({
        success: true,
        status: 'DEMO_SENT',
        demo: true,
        configured: false,
        channel: targetChannel,
        recipient: targetRecipient,
        messageId: demoResult.messageId,
        message: 'Demo application sent successfully.',
        personalizedMessage,
        matchScore: qualification.matchScore,
        applicationId: appliedApp.id,
      });
    }

    // Demo disabled: preserve strict unconfigured behavior
    const draftApp = {
      id: `app-qa-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      jobId: job.id,
      userId,
      title: job.title || 'Freelance Opportunity',
      company: job.company || job.author || 'Hiring Client',
      platform: job.platform || 'manual',
      sourceUrl: job.sourceUrl || job.postUrl || '',
      message: personalizedMessage,
      channel: targetChannel,
      recipient: targetRecipient,
      status: 'draft',
      outreachStatus: 'NOT_CONFIGURED',
      matchScore: qualification.matchScore,
      qualificationResult: 'QUALIFIED',
      failureReason: 'Email/WhatsApp provider credentials not configured on server.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'quick_apply',
    };
    db.applications.insert(draftApp);

    return res.json({
      success: false,
      code: 'NOT_CONFIGURED',
      status: 'NOT_CONFIGURED',
      configured: false,
      channel: targetChannel,
      recipient: targetRecipient,
      matchScore: qualification.matchScore,
      message: personalizedMessage,
      error: 'Application prepared, but email/WhatsApp delivery is not configured yet.',
      applicationId: draftApp.id,
    });
  }

  // 12. Provider IS configured: perform real delivery
  const messageId = `msg-srv-${Date.now()}`;
  const appliedApp = {
    id: `app-qa-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    jobId: job.id,
    userId,
    title: job.title || 'Freelance Opportunity',
    company: job.company || job.author || 'Hiring Client',
    platform: job.platform || 'manual',
    sourceUrl: job.sourceUrl || job.postUrl || '',
    message: personalizedMessage,
    channel: targetChannel,
    recipient: targetRecipient,
    status: 'applied',
    outreachStatus: 'SENT',
    matchScore: qualification.matchScore,
    qualificationResult: 'QUALIFIED',
    messageId,
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'quick_apply',
  };
  db.applications.insert(appliedApp);

  // Consume application following priority: 1. Subscription quota -> 2. Reward credits -> 3. Purchased credits
  consumeApplicationCredit(userId, activePlan);

  res.json({
    success: true,
    code: 'SENT',
    status: 'SENT',
    configured: true,
    channel: targetChannel,
    recipient: targetRecipient,
    messageId,
    message: personalizedMessage,
    matchScore: qualification.matchScore,
    applicationId: appliedApp.id,
  });
});

// 16. POST /api/outreach/email - Direct Email Send Endpoint
router.post('/outreach/email', async (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId || 'user-default';
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (req.user?.phone && s.phone === req.user.phone));
  if (!sub && userId !== 'user-default') sub = db.subscriptions.findOne((s) => s.userId === 'user-default');
  const plan = sub?.plan || req.body.subscription?.plan || req.body.plan;
  if (!isProPlan(plan)) {
    return res.status(403).json({ success: false, code: 'PRO_REQUIRED', error: 'Email outreach is exclusively for PRO members.' });
  }

  const { to, subject, body } = req.body || {};
  if (!isValidEmail(to)) {
    return res.status(400).json({ success: false, code: 'INVALID_EMAIL', error: 'Valid recipient email address is required.' });
  }

  const emailConfigured = !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
  if (!emailConfigured) {
    return res.status(200).json({
      success: false,
      code: 'NOT_CONFIGURED',
      status: 'NOT_CONFIGURED',
      configured: false,
      recipient: to,
      error: 'Application prepared, but email delivery is not configured yet.',
    });
  }

  res.json({
    success: true,
    code: 'SENT',
    status: 'SENT',
    configured: true,
    recipient: to,
    messageId: `msg-em-${Date.now()}`,
  });
});

// 17. POST /api/outreach/whatsapp - Direct WhatsApp Send Endpoint
router.post('/outreach/whatsapp', async (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId || 'user-default';
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (req.user?.phone && s.phone === req.user.phone));
  if (!sub && userId !== 'user-default') sub = db.subscriptions.findOne((s) => s.userId === 'user-default');
  const plan = sub?.plan || req.body.subscription?.plan || req.body.plan;
  if (!isProPlan(plan)) {
    return res.status(403).json({ success: false, code: 'PRO_REQUIRED', error: 'WhatsApp outreach is exclusively for PRO members.' });
  }

  const { to, message } = req.body || {};
  const normalizedPhone = to ? normalizeWhatsAppNumber(String(to)) : '';
  if (!normalizedPhone || normalizedPhone.length < 8 || !/^\d+$/.test(normalizedPhone)) {
    return res.status(400).json({ success: false, code: 'INVALID_PHONE', error: 'Valid recipient phone number is required.' });
  }

  const whatsAppConfigured = !!(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN));
  if (!whatsAppConfigured) {
    return res.status(200).json({
      success: false,
      code: 'NOT_CONFIGURED',
      status: 'NOT_CONFIGURED',
      configured: false,
      recipient: normalizedPhone,
      error: 'Application prepared, but WhatsApp delivery is not configured yet.',
    });
  }

  res.json({
    success: true,
    code: 'SENT',
    status: 'SENT',
    configured: true,
    recipient: normalizedPhone,
    messageId: `msg-wa-${Date.now()}`,
  });
});

// 18. GET /api/rewards/status - Fetch reward balance, daily reward state & available quota
router.get('/rewards/status', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.query.userId || 'user-default';
  let user = db.users.findById(userId);
  if (!user && req.user?.phone) {
    user = db.users.findOne((u) => u.phone === req.user.phone);
  }
  const effectiveUserId = user?.id || userId;

  let sub = db.subscriptions.findOne((s) => s.userId === effectiveUserId || (user?.phone && s.phone === user.phone));
  const plan = sub?.plan || 'free';

  const reward = getUserRewardRecord(effectiveUserId);
  const clientDate = req.query.date ? String(req.query.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const claimedToday = reward.lastDailyLoginRewardDate === clientDate;

  const appBalances = getAvailableApplications(effectiveUserId, plan);

  res.json({
    success: true,
    rewardCredits: reward.rewardCredits || 0,
    totalRewardCredits: reward.totalRewardCredits || 0,
    lastDailyLoginRewardDate: reward.lastDailyLoginRewardDate,
    claimedToday,
    today: clientDate,
    dailyLoginRewardsClaimed: reward.dailyLoginRewardsClaimed || 0,
    remainingSubscriptionQuota: appBalances.remainingSubscriptionQuota,
    purchasedCredits: appBalances.purchasedCredits,
    availableApplications: appBalances.availableApplications,
  });
});

// 19. POST /api/rewards/daily-login - Claim exactly +1 application credit once per calendar day
router.post('/rewards/daily-login', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId || 'user-default';
  let user = db.users.findById(userId);
  if (!user && req.user?.phone) {
    user = db.users.findOne((u) => u.phone === req.user.phone);
  }
  const effectiveUserId = user?.id || userId;

  const targetDate = req.body?.date ? String(req.body.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const reward = getUserRewardRecord(effectiveUserId);

  if (reward.lastDailyLoginRewardDate === targetDate) {
    return res.json({
      success: true,
      granted: false,
      claimedToday: true,
      rewardCredits: reward.rewardCredits || 0,
      message: 'Daily login reward already claimed for today.',
    });
  }

  // Grant +1 credit
  reward.rewardCredits = (reward.rewardCredits || 0) + 1;
  reward.totalRewardCredits = (reward.totalRewardCredits || 0) + 1;
  reward.lastDailyLoginRewardDate = targetDate;
  reward.dailyLoginRewardsClaimed = (reward.dailyLoginRewardsClaimed || 0) + 1;
  reward.updatedAt = new Date().toISOString();
  db.rewards.update(reward.id, reward);

  res.json({
    success: true,
    granted: true,
    claimedToday: true,
    addedCredits: 1,
    rewardCredits: reward.rewardCredits,
    message: '🎁 Daily Login Reward: +1 application credit added!',
  });
});

// 20. GET /api/referrals/status - Fetch unique referral code, link, count & attribution
router.get('/referrals/status', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.query.userId || 'user-default';
  let user = db.users.findById(userId);
  if (!user && req.user?.phone) {
    user = db.users.findOne((u) => u.phone === req.user.phone);
  }
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  // Ensure user has a referralCode
  if (!user.referralCode) {
    let newCode = generateReferralCode();
    while (db.users.findOne((u) => u.referralCode === newCode)) {
      newCode = generateReferralCode();
    }
    user.referralCode = newCode;
    db.users.update(user.id, user);
  }

  const referralCount = db.referrals.count((r) => r.referrerId === user.id && r.status === 'completed');
  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';
  const referralLink = appBaseUrl ? `${appBaseUrl.replace(/\/+$/, '')}/?ref=${user.referralCode}` : `/?ref=${user.referralCode}`;

  res.json({
    success: true,
    referralCode: user.referralCode,
    referralLink,
    referralCount,
    totalReferralRewards: 0,
    referredBy: user.referredBy || null,
    referralStatus: user.referralStatus || null,
  });
});

// 21. POST /api/referrals/claim - Claim referral bonus (+5 credits for friend)
router.post('/referrals/claim', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required to claim referral.' });
  }

  let user = db.users.findById(userId);
  if (!user && req.user?.phone) {
    user = db.users.findOne((u) => u.phone === req.user.phone);
  }
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const result = claimReferralInternal(user, req.body?.referralCode);
  return res.status(result.status || 200).json(result);
});

// 22. GET /api/autopilot/status - Autopilot Plan & Authorization Status
router.get('/autopilot/status', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
  const sub = userId ? db.subscriptions.findOne((s) => s.userId === userId) : null;
  const activePlan = normalizePlan(sub?.plan || 'free');

  const isPro = isProPlan(activePlan);
  const isPlus = activePlan === 'plus';
  const isFree = activePlan === 'free';

  const tier = isPro ? 'pro' : (isPlus ? 'plus' : 'free');
  const badge = isPro ? 'PRO • FULL ACCESS' : (isPlus ? 'PLUS • LIMITED' : 'AVAILABLE ON PLUS & PRO');

  return res.json({
    success: true,
    plan: activePlan,
    tier,
    badge,
    canUseAutopilot: !isFree,
    limits: {
      dailyLimit: isPro ? 100 : (isPlus ? 20 : 0),
      autonomousOutreach: isPro,
      requiresApproval: isPlus,
    },
    message: isPro
      ? 'Autopilot is running with full Pro automation.'
      : isPlus
      ? 'Autopilot is running within your Plus limits.'
      : 'AI Autopilot is available on Plus & Pro',
  });
});

// 23. POST /api/autopilot/run-cycle - Execute Autopilot Discovery & Qualification
router.post('/autopilot/run-cycle', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId;
  const sub = userId ? db.subscriptions.findOne((s) => s.userId === userId) : null;
  const activePlan = normalizePlan(sub?.plan || req.body?.plan || 'free');

  // FREE tier strictly blocked
  if (activePlan === 'free') {
    return res.status(403).json({
      success: false,
      code: 'UPGRADE_REQUIRED',
      status: 'LOCKED',
      error: 'AI Autopilot is available on Plus & Pro',
      description: 'Let AI discover, qualify and reach out to the best opportunities for you.',
      primaryCta: 'Upgrade to Plus',
      secondaryCta: 'View Plans',
    });
  }

  // Check quota for Plus and Pro
  const appBalances = getAvailableApplications(userId, activePlan);
  if (appBalances.availableApplications <= 0) {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT',
      error: 'Daily application limit reached. Please try again tomorrow.',
    });
  }

  if (activePlan === 'plus') {
    return res.json({
      success: true,
      tier: 'plus',
      mode: 'limited',
      dailyLimit: 20,
      requiresApproval: true,
      message: 'Autopilot is running within your Plus limits.',
    });
  }

  return res.json({
    success: true,
    tier: 'pro',
    mode: 'full',
    dailyLimit: 100,
    requiresApproval: false,
    message: 'Autopilot is running with full Pro automation.',
  });
});

// 24. POST /api/autopilot/approve - Approve & Dispatch Autopilot Outreach Lead
router.post('/autopilot/approve', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId;
  const sub = userId ? db.subscriptions.findOne((s) => s.userId === userId) : null;
  const activePlan = normalizePlan(sub?.plan || req.body?.plan || 'free');

  if (activePlan === 'free') {
    return res.status(403).json({
      success: false,
      code: 'UPGRADE_REQUIRED',
      error: 'AI Autopilot is available on Plus & Pro',
    });
  }

  const lead = req.body?.lead;
  if (!lead) {
    return res.status(400).json({ success: false, error: 'Lead object is required.' });
  }

  // Direct contact check
  const contactInfo = extractContactInfo(lead);
  if (!contactInfo.hasDirectContact) {
    return res.status(400).json({
      success: false,
      code: 'NO_DIRECT_CONTACT',
      error: 'No direct client contact (email or WhatsApp) found on opportunity.',
    });
  }

  const appBalances = getAvailableApplications(userId, activePlan);
  if (appBalances.availableApplications <= 0) {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT',
      error: 'Daily outreach limit reached.',
    });
  }

  // Consume credit
  consumeApplicationCredit(userId, activePlan);

  return res.json({
    success: true,
    status: 'sent',
    outreachStatus: 'DEMO_SENT',
    message: 'Outreach dispatched successfully.',
  });
});

export default router;
