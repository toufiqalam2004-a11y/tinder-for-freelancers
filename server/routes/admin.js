import express from 'express';
import { db } from '../database.js';
import { activeSessions } from '../sessions.js';
import { redditService } from '../services/redditService.js';
import { youtubeService } from '../services/youtubeService.js';
import { xService } from '../services/xService.js';
import { aiService } from '../services/aiService.js';
import { SERVER_BUILTIN_SOURCES, getAvailableApplications } from './api.js';
import { PLAN_QUOTA_CONFIG } from '../../src/utils/quotaConfig.js';

const router = express.Router();

const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || (!IS_PROD ? 'tf-admin-secret-2026' : undefined);

// =================================================================
// 1. ADMIN AUTHORIZATION MIDDLEWARE
// =================================================================
export function requireAdmin(req, res, next) {
  // Check 1: Admin secret key header
  const adminKeyHeader = req.headers['x-admin-key'];
  if (adminKeyHeader && ADMIN_SECRET_KEY && adminKeyHeader === ADMIN_SECRET_KEY) {
    req.admin = {
      id: 'admin-master',
      role: 'admin',
      name: 'System Administrator (Master Key)',
    };
    return next();
  }

  // Check 2: Bearer session token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Administrator credentials or token required.',
    });
  }

  const session = activeSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) activeSessions.delete(token);
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Invalid or expired admin session token.',
    });
  }

  // Verify explicit admin role in session or user record
  const isSessionAdmin = session.role === 'admin' || session.isAdmin === true;
  let isUserAdmin = false;
  if (session.userId) {
    const user = db.users.findById(session.userId);
    if (user && (user.role === 'admin' || user.isAdmin === true)) {
      isUserAdmin = true;
    }
  }

  if (!isSessionAdmin && !isUserAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Insufficient privileges. Administrator access required.',
    });
  }

  req.admin = {
    id: session.userId || 'admin-user',
    role: 'admin',
    name: session.name || 'System Administrator',
  };
  next();
}

// =================================================================
// 2. ADMIN AUTHENTICATION ENDPOINTS
// =================================================================

// Admin Login
router.post('/auth/login', (req, res) => {
  const { passkey, phone } = req.body || {};

  if (!passkey || typeof passkey !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Admin passkey is required.',
    });
  }

  const cleanKey = passkey.trim();
  const isMasterKey = Boolean(ADMIN_SECRET_KEY && cleanKey === ADMIN_SECRET_KEY);

  let isPhoneAdmin = false;
  let adminUser = null;

  if (phone) {
    const cleanPhone = String(phone).trim();
    const user = db.users.findOne((u) => u.phone === cleanPhone);
    if (user && (user.role === 'admin' || user.isAdmin === true)) {
      isPhoneAdmin = true;
      adminUser = user;
    }
  }

  if (!isMasterKey && !isPhoneAdmin) {
    return res.status(401).json({
      success: false,
      error: 'Invalid administrator credentials. Access denied.',
    });
  }

  // Create admin session token (24-hour expiration)
  const token = `tf-adm-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const adminIdentity = {
    userId: adminUser?.id || 'admin-super',
    role: 'admin',
    isAdmin: true,
    name: adminUser?.name || 'Administrator',
    phone: adminUser?.phone || 'System',
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  activeSessions.set(token, adminIdentity);

  return res.json({
    success: true,
    token,
    admin: {
      id: adminIdentity.userId,
      role: 'admin',
      name: adminIdentity.name,
      phone: adminIdentity.phone,
    },
  });
});

// Admin Session Verification
router.get('/auth/me', requireAdmin, (req, res) => {
  res.json({
    success: true,
    admin: req.admin,
  });
});

// Admin Logout
router.post('/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true, message: 'Admin session terminated.' });
});

// =================================================================
// 3. ADMIN STATS & OVERVIEW
// =================================================================
router.get('/stats', requireAdmin, (req, res) => {
  try {
    const allUsers = db.users.findAll();
    const allSubscriptions = db.subscriptions.findAll();
    const allApplications = db.applications.findAll();
    const allSources = db.sources.findAll();

    // User counts
    const totalUsers = allUsers.length;

    // Plans mapping
    let freeUsers = 0;
    let plusUsers = 0;
    let proUsers = 0;

    const subMap = new Map();
    allSubscriptions.forEach((sub) => {
      if (sub.userId) subMap.set(sub.userId, sub.plan?.toLowerCase());
    });

    allUsers.forEach((u) => {
      const plan = subMap.get(u.id) || 'free';
      if (plan === 'pro') proUsers++;
      else if (plan === 'plus') plusUsers++;
      else freeUsers++;
    });

    // Applications counts
    const totalApplications = allApplications.length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const applicationsToday = allApplications.filter((app) => {
      if (!app.createdAt) return false;
      const appDate = new Date(app.createdAt);
      return appDate >= todayStart;
    }).length;

    // Sources: Distinct active sources across built-in and user custom sources
    const builtinIds = new Set(SERVER_BUILTIN_SOURCES.map((s) => s.id));
    const activeBuiltin = SERVER_BUILTIN_SOURCES.filter((s) => s.enabled !== false).length;
    const customSources = allSources.filter((s) => !builtinIds.has(s.id) && s.type !== 'builtin');
    const activeCustom = customSources.filter((s) => s.enabled !== false).length;
    const activeSources = activeBuiltin + activeCustom;

    // Active Users (registered users who signed up, applied, or had activity within 7 days)
    // CRITICAL: activeUserIds must strictly belong to existing registered users (allUsers)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const existingUserMap = new Set(allUsers.map((u) => u.id));
    const activeUserIds = new Set();

    allApplications.forEach((a) => {
      if (a.userId && existingUserMap.has(a.userId) && a.createdAt && new Date(a.createdAt) >= sevenDaysAgo) {
        activeUserIds.add(a.userId);
      }
    });

    allUsers.forEach((u) => {
      const isRecentCreation = u.createdAt && new Date(u.createdAt) >= sevenDaysAgo;
      const isRecentUpdate = u.updatedAt && new Date(u.updatedAt) >= sevenDaysAgo;
      if (isRecentCreation || isRecentUpdate) {
        activeUserIds.add(u.id);
      }
    });

    const allDailyUsage = db.dailyUsage.findAll();
    allDailyUsage.forEach((du) => {
      if (du.userId && existingUserMap.has(du.userId)) {
        const duDate = du.date ? new Date(du.date) : (du.updatedAt ? new Date(du.updatedAt) : null);
        if (duDate && duDate >= sevenDaysAgo) {
          activeUserIds.add(du.userId);
        }
      }
    });

    // Strictly bounded by totalUsers: 0 <= activeUsers <= totalUsers
    const activeUsers = Math.min(activeUserIds.size, totalUsers);

    res.json({
      success: true,
      stats: {
        totalUsers,
        freeUsers,
        plusUsers,
        proUsers,
        totalApplications,
        applicationsToday,
        activeSources,
        activeUsers,
      },
    });
  } catch (error) {
    console.error('Failed to compute admin stats:', error);
    res.status(500).json({ success: false, error: 'Failed to compute admin platform statistics.' });
  }
});

// =================================================================
// 4. USER MANAGEMENT ENDPOINTS
// =================================================================
router.get('/users', requireAdmin, (req, res) => {
  try {
    const { search, plan, status } = req.query;
    const allUsers = db.users.findAll();
    const allProfiles = db.profiles.findAll();
    const allSubscriptions = db.subscriptions.findAll();
    const allApplications = db.applications.findAll();
    const allSources = db.sources.findAll();

    const profileMap = new Map();
    allProfiles.forEach((p) => {
      if (p.userId) profileMap.set(p.userId, p);
      if (p.id && p.id.startsWith('prof-')) profileMap.set(p.id.replace('prof-', ''), p);
    });

    const subMap = new Map();
    allSubscriptions.forEach((s) => {
      if (s.userId) subMap.set(s.userId, s);
      if (s.phone) subMap.set(s.phone, s);
    });

    // Group application counts per user
    const appCountMap = new Map();
    allApplications.forEach((a) => {
      if (a.userId) {
        appCountMap.set(a.userId, (appCountMap.get(a.userId) || 0) + 1);
      }
    });

    // Group custom source counts per user
    const sourceCountMap = new Map();
    allSources.forEach((s) => {
      const ownerId = s.userId || s.ownerUserId;
      if (ownerId) {
        sourceCountMap.set(ownerId, (sourceCountMap.get(ownerId) || 0) + 1);
      }
    });

    let users = allUsers.map((u) => {
      const profile = profileMap.get(u.id) || (u.phone && profileMap.get(u.phone));
      const sub = subMap.get(u.id) || (u.phone && subMap.get(u.phone));
      const userPlan = (sub?.plan || 'free').toLowerCase();

      return {
        id: u.id,
        phone: u.phone,
        name: profile?.name || u.name || 'Unnamed Candidate',
        profession: profile?.profession || profile?.primaryRole || '—',
        plan: userPlan,
        role: u.role || 'user',
        applicationsCount: appCountMap.get(u.id) || (u.phone && appCountMap.get(u.phone)) || 0,
        sourcesCount: sourceCountMap.get(u.id) || (u.phone && sourceCountMap.get(u.phone)) || 0,
        device: u.deviceInfo?.platform || 'Web Browser',
        status: sub?.status === 'active' || !sub ? 'active' : sub.status,
        createdAt: u.createdAt,
        lastActive: u.updatedAt || u.createdAt,
      };
    });

    // Apply Search
    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.profession.toLowerCase().includes(q)
      );
    }

    // Apply Plan filter
    if (plan && typeof plan === 'string' && plan !== 'all') {
      users = users.filter((u) => u.plan === plan.toLowerCase());
    }

    // Apply Status filter
    if (status && typeof status === 'string' && status !== 'all') {
      users = users.filter((u) => u.status === status.toLowerCase());
    }

    res.json({
      success: true,
      total: users.length,
      users,
    });
  } catch (error) {
    console.error('Failed to list admin users:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve users.' });
  }
});

// Single User Detail
router.get('/users/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const user = db.users.findById(id) || db.users.findOne((u) => u.phone === id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const profile = db.profiles.findOne(
      (p) =>
        p.userId === id ||
        p.userId === user.id ||
        (user.phone && p.userId === user.phone) ||
        p.id === `prof-${id}` ||
        p.id === `prof-${user.id}` ||
        (user.phone && p.id === `prof-${user.phone}`)
    );

    const subscription = db.subscriptions.findOne(
      (s) =>
        s.userId === id ||
        s.userId === user.id ||
        (user.phone && (s.phone === user.phone || s.userId === user.phone))
    ) || {
      plan: 'free',
      status: 'active',
      price: 0,
      currency: 'USD',
      isDemo: true,
    };

    const sources = db.sources.findAll(
      (s) =>
        s.userId === id ||
        s.userId === user.id ||
        s.ownerUserId === id ||
        s.ownerUserId === user.id ||
        (user.phone && (s.userId === user.phone || s.ownerUserId === user.phone))
    );

    const applications = db.applications.findAll(
      (a) =>
        a.userId === id ||
        a.userId === user.id ||
        (user.phone && a.userId === user.phone)
    );

    const dailyUsage = db.dailyUsage.findOne(
      (d) =>
        d.userId === id ||
        d.userId === user.id ||
        (user.phone && d.userId === user.phone)
    );

    // Application counts by status
    const appliedCount = applications.filter((a) => a.status === 'applied').length;
    const savedCount = applications.filter((a) => a.status === 'saved').length;
    const draftCount = applications.filter((a) => a.status === 'draft').length;

    const planConfig = PLAN_QUOTA_CONFIG[subscription.plan?.toUpperCase()] || PLAN_QUOTA_CONFIG.FREE;

    let quotaBalances = null;
    try {
      quotaBalances = getAvailableApplications(user.id, subscription.plan || 'free');
    } catch {}

    const rewardRecord = db.rewards.findOne(
      (r) => r.userId === user.id || (user.phone && r.userId === user.phone)
    );

    const applicationsUsed = quotaBalances ? quotaBalances.applicationsUsed : (dailyUsage?.count || dailyUsage?.applicationsUsed || appliedCount);
    const remainingQuota = quotaBalances ? quotaBalances.remainingQuota : Math.max(0, planConfig.applicationsPerWindow - applicationsUsed);
    const availableApplications = quotaBalances ? quotaBalances.availableApplications : remainingQuota;

    res.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: profile?.name || user.name || 'Unnamed Candidate',
        username: user.username || profile?.username || null,
        role: user.role || 'user',
        status: user.status || 'active',
        banType: user.banType || null,
        banUntil: user.banUntil || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt || user.createdAt,
        profile: profile
          ? {
              name: profile.name,
              profession: profile.profession || profile.primaryRole,
              category: profile.category || 'General',
              skills: profile.skills || [],
              experience: profile.experience,
              portfolioUrl: profile.portfolioUrl,
              cvUrl: profile.cvUrl || null,
              availability: profile.availability || 'Immediate',
              targetRates: profile.targetRates || profile.rates || 'Not specified',
              remotePreference: profile.remotePreference || 'Remote',
            }
          : null,
        subscription: {
          plan: subscription.plan || 'free',
          status: subscription.status || 'active',
          price: subscription.price || 0,
          currency: subscription.currency || 'USD',
          startDate: subscription.startDate || subscription.createdAt,
          endDate: subscription.endDate || null,
          isDemo: subscription.isDemo !== false,
        },
        sourcesUsage: {
          customSourceCount: sources.length,
          maxLimit: subscription.plan === 'pro' ? 5 : subscription.plan === 'plus' ? 3 : 1,
          sources: sources.map((s) => ({
            id: s.id,
            name: s.name,
            platform: s.platform,
            url: s.url,
            enabled: s.enabled,
            createdAt: s.createdAt,
          })),
        },
        applicationUsage: {
          quotaLimit: quotaBalances ? quotaBalances.limit : planConfig.applicationsPerWindow,
          windowHours: planConfig.quotaWindowHours,
          applicationsUsed,
          remainingQuota,
          availableApplications,
          bonusTokens: quotaBalances?.bonusTokens || rewardRecord?.bonusTokens || rewardRecord?.rewardCredits || 0,
          currentStreak: rewardRecord?.loginStreak?.currentStreak || 0,
          applied: appliedCount,
          saved: savedCount,
          draft: draftCount,
          total: applications.length,
        },
        device: {
          platform: user.deviceInfo?.platform || 'Web Browser',
          lastIp: user.deviceInfo?.ip || 'Not recorded',
          lastLogin: user.updatedAt || user.createdAt,
        },
        recentApplications: applications.slice(-5).reverse(),
      },
    });
  } catch (error) {
    console.error('Failed to get user details:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve user details.' });
  }
});

// Ban User
router.post('/users/:id/ban', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { banType } = req.body; // 'temporary' or 'permanent'
    
    if (banType !== 'temporary' && banType !== 'permanent') {
      return res.status(400).json({ success: false, error: 'Invalid ban type.' });
    }

    const user = db.users.findById(id) || db.users.findOne((u) => u.phone === id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    user.status = 'banned';
    user.banType = banType;
    if (banType === 'temporary') {
      user.banUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      user.banUntil = null;
    }
    
    db.users.update(user.id, user);

    // Invalidate active sessions for this user
    for (const [token, session] of activeSessions.entries()) {
      if (session.userId === user.id) {
        activeSessions.delete(token);
      }
    }

    res.json({ success: true, message: `User banned successfully.`, user: { id: user.id, status: user.status, banType: user.banType, banUntil: user.banUntil } });
  } catch (error) {
    console.error('Failed to ban user:', error);
    res.status(500).json({ success: false, error: 'Failed to ban user.' });
  }
});

// Unban User
router.post('/users/:id/unban', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const user = db.users.findById(id) || db.users.findOne((u) => u.phone === id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    user.status = 'active';
    user.banType = null;
    user.banUntil = null;
    db.users.update(user.id, user);

    res.json({ success: true, message: 'User unbanned successfully.', user: { id: user.id, status: user.status } });
  } catch (error) {
    console.error('Failed to unban user:', error);
    res.status(500).json({ success: false, error: 'Failed to unban user.' });
  }
});

// =================================================================
// 5. APPLICATION MANAGEMENT
// =================================================================
router.get('/applications', requireAdmin, (req, res) => {
  try {
    const { status, plan, userId, search, date } = req.query;
    const allApps = db.applications.findAll();
    const allUsers = db.users.findAll();
    const allSubs = db.subscriptions.findAll();
    const allJobs = db.jobs.findAll();

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const subMap = new Map(allSubs.map((s) => [s.userId, s.plan]));
    const jobMap = new Map(allJobs.map((j) => [j.id, j]));

    // Statistics
    let applied = 0;
    let saved = 0;
    let draft = 0;
    let other = 0;

    allApps.forEach((a) => {
      const s = (a.status || '').toLowerCase();
      if (s === 'applied') applied++;
      else if (s === 'saved') saved++;
      else if (s === 'draft') draft++;
      else other++;
    });

    let filtered = allApps.map((a) => {
      const user = userMap.get(a.userId);
      const userPlan = subMap.get(a.userId) || 'free';
      const job = jobMap.get(a.jobId);

      return {
        id: a.id,
        userId: a.userId,
        userName: user?.name || user?.phone || 'Unknown User',
        userPlan,
        jobId: a.jobId,
        title: a.title || job?.title || 'Application Opportunity',
        company: a.company || job?.company || 'Direct Client',
        status: a.status || 'applied',
        platform: a.platform || job?.source || 'Manual',
        channel: a.channel || 'web',
        matchScore: a.matchScore || job?.matchScore || null,
        createdAt: a.createdAt,
      };
    });

    if (status && status !== 'all') {
      filtered = filtered.filter((a) => a.status.toLowerCase() === status.toLowerCase());
    }

    if (plan && plan !== 'all') {
      filtered = filtered.filter((a) => a.userPlan.toLowerCase() === plan.toLowerCase());
    }

    if (userId) {
      filtered = filtered.filter((a) => a.userId === userId);
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter((a) =>
        (a.userName && a.userName.toLowerCase().includes(q)) ||
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.company && a.company.toLowerCase().includes(q)) ||
        (a.userId && a.userId.toLowerCase().includes(q))
      );
    }

    if (date && typeof date === 'string' && date !== 'all') {
      const now = Date.now();
      if (date === 'today') {
        const todayStr = new Date().toISOString().slice(0, 10);
        filtered = filtered.filter((a) => a.createdAt && a.createdAt.slice(0, 10) === todayStr);
      } else if (date === '7d') {
        const cutoff = now - 7 * 24 * 60 * 60 * 1000;
        filtered = filtered.filter((a) => new Date(a.createdAt).getTime() >= cutoff);
      } else if (date === '30d') {
        const cutoff = now - 30 * 24 * 60 * 60 * 1000;
        filtered = filtered.filter((a) => new Date(a.createdAt).getTime() >= cutoff);
      }
    }

    res.json({
      success: true,
      stats: {
        total: allApps.length,
        applied,
        saved,
        draft,
        other,
      },
      applications: filtered,
    });
  } catch (error) {
    console.error('Failed to list admin applications:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve applications.' });
  }
});

// =================================================================
// 6. OPPORTUNITIES / JOBS MANAGEMENT
// =================================================================
router.get('/opportunities', requireAdmin, (req, res) => {
  try {
    const { search, source, status } = req.query;
    const allJobs = db.jobs.findAll();

    let opportunities = allJobs.map((j) => ({
      id: j.id,
      title: j.title || 'Untitled Opportunity',
      company: j.company || 'Client',
      sourceId: j.sourceId || 'direct',
      sourceUrl: j.sourceUrl || '',
      category: j.category || 'General',
      skills: j.skills || [],
      budget: j.budget || 'Open / Negotiable',
      matchScore: j.matchScore || null,
      qualificationReason: j.qualificationReason || j.reason || null,
      contact: j.contact || j.recipient || 'Public Listing',
      status: j.status || 'new',
      createdAt: j.createdAt,
    }));

    if (search) {
      const q = search.toLowerCase().trim();
      opportunities = opportunities.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.company.toLowerCase().includes(q) ||
          (o.category && o.category.toLowerCase().includes(q))
      );
    }

    if (source && source !== 'all') {
      opportunities = opportunities.filter((o) =>
        o.sourceId.toLowerCase().includes(source.toLowerCase())
      );
    }

    if (status && status !== 'all') {
      opportunities = opportunities.filter((o) => o.status.toLowerCase() === status.toLowerCase());
    }

    // Sort newest first
    opportunities.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      total: opportunities.length,
      opportunities,
    });
  } catch (error) {
    console.error('Failed to list admin opportunities:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve opportunities.' });
  }
});

// =================================================================
// 7. SOURCES MANAGEMENT
// =================================================================
router.get('/sources', requireAdmin, (req, res) => {
  try {
    const allDbSources = db.sources.findAll();
    const allUsers = db.users.findAll();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const builtinSources = SERVER_BUILTIN_SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      platform: s.platform,
      url: s.url,
      type: 'builtin',
      category: s.category,
      fetchInterval: s.fetchInterval || 15,
      enabled: s.enabled !== false,
      status: s.enabled !== false ? 'Active' : 'Disabled',
      owner: 'Platform Default (Built-in)',
      createdAt: s.createdAt || 'Platform Default',
      lastRefresh: s.lastFetchedAt || s.lastCheckedAt || null,
    }));

    const builtinIds = new Set(SERVER_BUILTIN_SOURCES.map((s) => s.id));
    const customSources = allDbSources
      .filter((s) => !builtinIds.has(s.id) && s.type !== 'builtin')
      .map((s) => {
        const ownerId = s.userId || s.ownerUserId;
        let owner = userMap.get(ownerId);
        if (!owner && ownerId) {
          owner = allUsers.find((u) => u.phone === ownerId);
        }
        return {
          id: s.id,
          name: s.name || s.sourceName || 'Custom Source',
          platform: s.platform || 'feed',
          url: s.url || s.sourceUrl || '',
          type: 'custom',
          category: s.category || 'Custom',
          enabled: s.enabled !== false,
          status: s.enabled !== false ? 'Active' : 'Disabled',
          ownerId,
          ownerName: owner?.name || (owner?.phone ? `User (${owner.phone})` : ownerId || 'Unknown User'),
          ownerPhone: owner?.phone || (ownerId && ownerId.startsWith('+') ? ownerId : null),
          createdAt: s.createdAt || null,
          updatedAt: s.updatedAt || null,
          lastRefresh: s.lastFetchedAt || s.lastCheckedAt || s.lastRefresh || null,
        };
      });

    res.json({
      success: true,
      totalBuiltin: builtinSources.length,
      totalCustom: customSources.length,
      activeCustom: customSources.filter((s) => s.enabled).length,
      disabledCustom: customSources.filter((s) => !s.enabled).length,
      builtinSources,
      customSources,
    });
  } catch (error) {
    console.error('Failed to list admin sources:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve sources.' });
  }
});

// =================================================================
// 8. AI AGENT / DISCOVERY ENGINE STATUS
// =================================================================
router.get('/ai-agent/status', requireAdmin, (req, res) => {
  try {
    const redditConfigured = redditService.isConfigured();
    const youtubeConfigured = youtubeService.isConfigured();
    const xConfigured = xService.isConfigured();
    const aiConfigured = aiService.isConfigured();

    const isAnyDiscoveryConfigured = redditConfigured || youtubeConfigured || xConfigured;

    const allJobs = db.jobs.findAll();
    const totalDiscovered = allJobs.length;
    const qualified = allJobs.filter(
      (j) => j.status === 'qualified' || (j.matchScore && j.matchScore >= 70)
    ).length;
    const rejected = allJobs.filter(
      (j) => j.status === 'unqualified' || j.status === 'rejected'
    ).length;
    const duplicates = allJobs.filter((j) => j.isDuplicate).length;

    let lastRun = null;
    if (allJobs.length > 0) {
      const sorted = [...allJobs].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      lastRun = sorted[0].createdAt;
    }

    res.json({
      success: true,
      aiAgent: {
        status: isAnyDiscoveryConfigured ? 'idle' : 'not_configured',
        statusLabel: isAnyDiscoveryConfigured ? 'AI Agent Ready' : 'AI Agent discovery is not configured',
        isConfigured: isAnyDiscoveryConfigured,
        lastRun: lastRun || 'No runs recorded',
        services: {
          reddit: redditConfigured ? 'connected' : 'not_configured',
          youtube: youtubeConfigured ? 'connected' : 'not_configured',
          x: xConfigured ? 'connected' : 'not_configured',
          aiModel: aiConfigured ? 'connected' : 'not_configured',
        },
        metrics: {
          totalDiscovered,
          qualified,
          rejected,
          duplicates,
        },
      },
    });
  } catch (error) {
    console.error('Failed to retrieve AI Agent status:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve AI Agent status.' });
  }
});

// Helper to compute Top-Up & Purchased Credit transactions from real database records
function getTopUpData() {
  const allUsers = db.users.findAll();
  const allProfiles = db.profiles.findAll();
  const allSubs = db.subscriptions.findAll();
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const profileMap = new Map();
  allProfiles.forEach((p) => {
    if (p.userId) profileMap.set(p.userId, p);
    if (p.id) profileMap.set(p.id, p);
  });

  const topUpTransactions = [];
  const seenTxIds = new Set();

  // 1. Extract from subscriptions credits
  allSubs.forEach((sub) => {
    const user = userMap.get(sub.userId) || (sub.phone && allUsers.find((u) => u.phone === sub.phone));
    const profile = profileMap.get(sub.userId) || (user?.phone && profileMap.get(user.phone));
    const candidateName = profile?.name || user?.name || user?.phone || 'Candidate';
    const candidatePhone = user?.phone || sub.phone || '—';

    if (Array.isArray(sub.credits)) {
      sub.credits.forEach((cred) => {
        if (!cred || !cred.id || seenTxIds.has(cred.id)) return;
        seenTxIds.add(cred.id);
        const amt = Number(cred.price || 0);
        const curr = cred.currency || 'INR';
        topUpTransactions.push({
          id: cred.id,
          userId: sub.userId,
          userName: candidateName,
          userPhone: candidatePhone,
          amount: amt,
          formattedAmount: curr === 'INR' ? `₹${amt}` : `$${amt}`,
          currency: curr,
          creditsAdded: Number(cred.amount || cred.credits || 0),
          status: cred.status || 'Successful',
          paymentNature: cred.isDemo !== false ? 'Demo / Test' : 'Real / Live',
          date: cred.purchasedAt || cred.createdAt || sub.updatedAt || sub.createdAt,
          transactionId: cred.id,
        });
      });
    }
  });

  // 2. Extract from db.transactions
  if (db.transactions) {
    const allTx = db.transactions.findAll();
    allTx.forEach((tx) => {
      if (!tx || !tx.id || seenTxIds.has(tx.id)) return;
      seenTxIds.add(tx.id);
      const user = userMap.get(tx.userId) || (tx.phone && allUsers.find((u) => u.phone === tx.phone));
      const profile = profileMap.get(tx.userId) || (user?.phone && profileMap.get(user.phone));
      const candidateName = profile?.name || user?.name || user?.phone || 'Candidate';
      const candidatePhone = user?.phone || tx.phone || '—';
      const amt = Number(tx.amount || tx.price || 0);
      const curr = tx.currency || 'INR';
      topUpTransactions.push({
        id: tx.id,
        userId: tx.userId,
        userName: candidateName,
        userPhone: candidatePhone,
        amount: amt,
        formattedAmount: curr === 'INR' ? `₹${amt}` : `$${amt}`,
        currency: curr,
        creditsAdded: Number(tx.creditsAdded || tx.amount || 0),
        status: tx.status || 'Successful',
        paymentNature: tx.isDemo !== false ? 'Demo / Test' : 'Real / Live',
        date: tx.createdAt || tx.date,
        transactionId: tx.id,
      });
    });
  }

  // 3. Extract from db.paymentTransactions (V1 Supabase & PostgreSQL Payments)
  if (db.paymentTransactions) {
    const allPaymentTx = db.paymentTransactions.findAll();
    allPaymentTx.forEach((ptx) => {
      if (!ptx || !ptx.id || seenTxIds.has(ptx.id)) return;
      seenTxIds.add(ptx.id);
      const user = userMap.get(ptx.userId) || (ptx.phone && allUsers.find((u) => u.phone === ptx.phone));
      const profile = profileMap.get(ptx.userId) || (user?.phone && profileMap.get(user.phone));
      const candidateName = profile?.name || user?.name || user?.phone || 'Candidate';
      const candidatePhone = user?.phone || ptx.phone || '—';
      const amt = Number(ptx.amountMajor !== undefined ? ptx.amountMajor : (ptx.amount || 0));
      const curr = ptx.currency || 'INR';
      const isSuccess = ptx.status === 'success' || ptx.status === 'completed' || ptx.status === 'captured';
      topUpTransactions.push({
        id: ptx.id,
        userId: ptx.userId,
        userName: candidateName,
        userPhone: candidatePhone,
        amount: amt,
        formattedAmount: curr === 'INR' ? `₹${amt}` : `$${amt}`,
        currency: curr,
        creditsAdded: Number(ptx.creditsAdded || 0),
        status: isSuccess ? 'Successful' : (ptx.status || 'Pending'),
        paymentNature: ptx.isDemo === false ? 'Real / Live' : (ptx.provider === 'razorpay' ? 'Real / Live' : 'Demo / Test'),
        date: ptx.createdAt || ptx.date,
        transactionId: ptx.providerPaymentId || ptx.transactionId || ptx.id,
        plan: ptx.planId || 'subscription',
        billingCycle: ptx.billingCycle,
      });
    });
  }

  // Sort newest first
  topUpTransactions.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  let totalCreditsPurchased = 0;
  let successfulTransactions = 0;
  let revenueINR = 0;
  let revenueUSD = 0;

  topUpTransactions.forEach((tx) => {
    totalCreditsPurchased += Number(tx.creditsAdded || 0);
    if (tx.status === 'Successful' || tx.status === 'completed' || tx.status === 'active') {
      successfulTransactions++;
      if (tx.currency === 'INR') {
        revenueINR += Number(tx.amount || 0);
      } else if (tx.currency === 'USD') {
        revenueUSD += Number(tx.amount || 0);
      }
    }
  });

  const formattedRevenue =
    revenueINR > 0 && revenueUSD > 0
      ? `₹${revenueINR.toLocaleString()} / $${revenueUSD.toLocaleString()}`
      : revenueUSD > 0
      ? `$${revenueUSD.toLocaleString()}`
      : `₹${revenueINR.toLocaleString()}`;

  return {
    stats: {
      totalTopUps: topUpTransactions.length,
      totalCreditsPurchased,
      successfulTransactions,
      topUpRevenue: {
        INR: revenueINR,
        USD: revenueUSD,
        formatted: formattedRevenue,
      },
    },
    transactions: topUpTransactions,
  };
}

// =================================================================
// 9. SUBSCRIPTION / PLAN MANAGEMENT
// =================================================================
router.get('/subscriptions', requireAdmin, (req, res) => {
  try {
    const allUsers = db.users.findAll();
    const allSubs = db.subscriptions.findAll();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    let free = 0;
    let plus = 0;
    let pro = 0;
    let active = 0;

    const subMap = new Map();
    allSubs.forEach((s) => {
      if (s.userId) subMap.set(s.userId, s);
    });

    const userSubscriptions = allUsers.map((u) => {
      const sub = subMap.get(u.id);
      const plan = (sub?.plan || 'free').toLowerCase();
      const status = sub?.status || 'active';

      if (plan === 'pro') pro++;
      else if (plan === 'plus') plus++;
      else free++;

      if (status === 'active') active++;

      return {
        id: sub?.id || `sub-${u.id}`,
        userId: u.id,
        userName: u.name || u.phone || 'Anonymous',
        phone: u.phone,
        plan,
        status,
        currency: sub?.currency || 'USD',
        price: sub?.price || 0,
        startDate: sub?.startDate || u.createdAt,
        isDemo: sub?.isDemo !== false, // Label demo subscriptions
      };
    });

    const topUpsData = getTopUpData();

    res.json({
      success: true,
      pricingReference: {
        monthly: { free: 0, plus: 7, pro: 19 },
        annual: { free: 0, plus: 70, pro: 190 },
      },
      stats: {
        total: allUsers.length,
        free,
        plus,
        pro,
        active,
      },
      subscriptions: userSubscriptions,
      topUps: topUpsData,
    });
  } catch (error) {
    console.error('Failed to list subscriptions:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve subscriptions.' });
  }
});

// Dedicated Top-Up & Purchased Credits Monitoring Endpoint
router.get('/top-ups', requireAdmin, (req, res) => {
  try {
    const topUpsData = getTopUpData();
    res.json({
      success: true,
      ...topUpsData,
    });
  } catch (error) {
    console.error('Failed to retrieve top-ups:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve top-ups.' });
  }
});

// =================================================================
// 10. ANALYTICS
// =================================================================
router.get('/analytics', requireAdmin, (req, res) => {
  try {
    const allUsers = db.users.findAll();
    const allSubs = db.subscriptions.findAll();
    const allApps = db.applications.findAll();
    const allJobs = db.jobs.findAll();

    // Plan distribution
    const subMap = new Map(allSubs.map((s) => [s.userId, s.plan?.toLowerCase()]));
    let freeCount = 0,
      plusCount = 0,
      proCount = 0;
    allUsers.forEach((u) => {
      const p = subMap.get(u.id) || 'free';
      if (p === 'pro') proCount++;
      else if (p === 'plus') plusCount++;
      else freeCount++;
    });

    // Application status distribution
    let appliedCount = 0,
      savedCount = 0,
      draftCount = 0;
    allApps.forEach((a) => {
      const s = (a.status || '').toLowerCase();
      if (s === 'applied') appliedCount++;
      else if (s === 'saved') savedCount++;
      else if (s === 'draft') draftCount++;
    });

    // Source opportunity distribution
    const sourceCountMap = {};
    allJobs.forEach((j) => {
      const src = j.sourceId || 'unknown';
      sourceCountMap[src] = (sourceCountMap[src] || 0) + 1;
    });

    res.json({
      success: true,
      analytics: {
        totalUsers: allUsers.length,
        totalApplications: allApps.length,
        totalOpportunities: allJobs.length,
        planDistribution: {
          free: freeCount,
          plus: plusCount,
          pro: proCount,
        },
        applicationStatusDistribution: {
          applied: appliedCount,
          saved: savedCount,
          draft: draftCount,
        },
        sourceDistribution: sourceCountMap,
      },
    });
  } catch (error) {
    console.error('Failed to retrieve analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve analytics.' });
  }
});

// =================================================================
// 11. ADMIN SETTINGS (SAFE CONFIGURATION HEALTH - NO SECRETS LEAKED)
// =================================================================
router.get('/settings', requireAdmin, (req, res) => {
  try {
    const safeSettings = {
      platform: {
        name: 'Tinder for Freelancers Admin Console',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: 'JSON File Storage (Operational)',
      },
      services: {
        redditDiscovery: redditService.isConfigured() ? 'Configured' : 'Not Configured',
        youtubeDiscovery: youtubeService.isConfigured() ? 'Configured' : 'Not Configured',
        xDiscovery: xService.isConfigured() ? 'Configured' : 'Not Configured',
        aiProposalEngine: aiService.isConfigured() ? 'Configured' : 'Not Configured',
        emailOutreach: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST)
          ? 'Configured'
          : 'Not Configured',
        whatsappOutreach: Boolean(process.env.TWILIO_AUTH_TOKEN || process.env.WHATSAPP_TOKEN)
          ? 'Configured'
          : 'Not Configured',
      },
      quotas: {
        freeLimit: '5 applications / 8h',
        plusLimit: '15 applications / 8h',
        proLimit: '25 applications / 8h',
      },
    };

    res.json({
      success: true,
      settings: safeSettings,
    });
  } catch (error) {
    console.error('Failed to get admin settings:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve administrative settings.' });
  }
});

// =================================================================
// 12. ADMIN RESET APP DATA (SAFE TEST/DEMO FIXTURE PURGE)
// =================================================================
export const handleResetAppData = (req, res) => {
  // 1. Strict Administrator Authentication
  const adminKeyHeader = req.headers['x-admin-key'];
  const isMasterKey = Boolean(adminKeyHeader && ADMIN_SECRET_KEY && adminKeyHeader === ADMIN_SECRET_KEY);

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!isMasterKey && !token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Administrator credentials required.',
    });
  }

  let adminOperator = null;

  if (isMasterKey) {
    adminOperator = {
      id: 'admin-master',
      role: 'admin',
      name: 'System Administrator (Master Key)',
    };
  } else if (token) {
    const session = activeSessions.get(token);
    if (!session || Date.now() > session.expiresAt) {
      if (session) activeSessions.delete(token);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or expired admin session token.',
      });
    }

    const isSessionAdmin = session.role === 'admin' || session.isAdmin === true;
    let isUserAdmin = false;
    if (session.userId) {
      const user = db.users.findById(session.userId);
      if (user && (user.role === 'admin' || user.isAdmin === true)) {
        isUserAdmin = true;
      }
    }

    if (!isSessionAdmin && !isUserAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Insufficient privileges. Administrator access required.',
      });
    }

    adminOperator = {
      id: session.userId || 'admin-user',
      role: 'admin',
      name: session.name || 'System Administrator',
    };
  }

  try {
    const initialCounts = {
      users: db.users.count(),
      profiles: db.profiles.count(),
      applications: db.applications.count(),
      jobs: db.jobs.count(),
      sources: db.sources.count(),
      subscriptions: db.subscriptions.count(),
      activities: db.activities ? db.activities.count() : 0,
    };

    // Helper: Identify test/demo user record
    const isTestUser = (u) => {
      if (!u) return false;
      // Protected: Explicit canonical users and admin users
      if (u.id === 'user-1789502668516' || u.phone === '+917758757575') return false;
      if (u.id === 'user-1789503692368' || u.phone === '+919874950646') return false;
      if (u.role === 'admin' || u.isAdmin === true) return false;
      // Explicit test/demo markers only
      return Boolean(
        u.isDemo === true ||
        u.isTest === true ||
        u.testUser === true ||
        u.demoUser === true ||
        u.fixture === true ||
        (u.id && (u.id.startsWith('test-') || u.id.startsWith('user-test') || u.id.startsWith('test_user_'))) ||
        (u.phone && (u.phone.startsWith('+9199999') || u.phone.startsWith('+1000000000')))
      );
    };

    // A. Clean Users (preserve unmarked & real users)
    const allUsers = db.users.findAll();
    const testUserIds = new Set(allUsers.filter(isTestUser).map((u) => u.id));
    db.users.data = allUsers.filter((u) => !isTestUser(u));
    db.users.save();

    // B. Clean Profiles (preserve profiles of non-test users and canonical IDs)
    const allProfiles = db.profiles.findAll();
    const isTestProfile = (p) => {
      if (!p) return false;
      if (p.id === '1788986432657-kr3wijqx8' || p.id === 'user-1789502668516' || p.id === 'user-1789503692368') return false;
      if (p.userId && (p.userId === 'user-1789502668516' || p.userId === 'user-1789503692368')) return false;
      return Boolean(
        p.isDemo === true ||
        p.isTest === true ||
        p.fixture === true ||
        (p.id && (p.id.startsWith('test-') || p.id.startsWith('prof-test-'))) ||
        (p.userId && testUserIds.has(p.userId))
      );
    };
    db.profiles.data = allProfiles.filter((p) => !isTestProfile(p));
    db.profiles.save();

    // C. Clean Applications (protect real user applications)
    const allApps = db.applications.findAll();
    const isTestApp = (a) => {
      if (!a) return false;
      // Explicitly protect real users' applications
      if (a.userId && (a.userId === 'user-1789502668516' || a.userId === 'user-1789503692368' || !testUserIds.has(a.userId))) {
        if (!a.id?.startsWith('test-') && a.isTest !== true) {
          return false;
        }
      }
      return Boolean(
        a.isTest === true ||
        a.fixture === true ||
        (a.id && (a.id.startsWith('test-') || a.id.startsWith('app-test-'))) ||
        (a.userId && testUserIds.has(a.userId))
      );
    };
    db.applications.data = allApps.filter((a) => !isTestApp(a));
    db.applications.save();

    // D. Clean Jobs (protect canonical jobs and built-in opportunities)
    const allJobs = db.jobs.findAll();
    const isTestJob = (j) => {
      if (!j || !j.id) return false;
      if (j.isTest === true) return true;
      if (/^job-builtin-\d+$/.test(j.id)) return true;
      if (j.id.startsWith('job-custom-') || j.id.startsWith('job-test-')) return true;
      if (j.sourceId && (j.sourceId.startsWith('custom-src-') || j.sourceId.startsWith('src-test-'))) return true;
      return false;
    };
    db.jobs.data = allJobs.filter((j) => !isTestJob(j));
    db.jobs.save();

    // E. Clean Sources (protect built-in sources and real user sources)
    const allSources = db.sources.findAll();
    const isTestCustomSource = (s) => {
      if (!s) return false;
      if (s.type === 'builtin' || (s.id && s.id.startsWith('demo-src-'))) return false;
      return Boolean(
        s.isTest === true ||
        (s.id && (s.id.startsWith('custom-src-sync') || s.id.startsWith('custom-src-') || s.id.startsWith('src-test-'))) ||
        (s.userId && testUserIds.has(s.userId)) ||
        (s.ownerUserId && testUserIds.has(s.ownerUserId))
      );
    };
    db.sources.data = allSources.filter((s) => !isTestCustomSource(s));
    db.sources.save();

    // F. Clean Subscriptions & Transactions
    const allSubs = db.subscriptions.findAll();
    db.subscriptions.data = allSubs.filter((s) => {
      if (s.isTest === true) return false;
      if (s.userId && testUserIds.has(s.userId)) return false;
      return true;
    });
    db.subscriptions.save();

    if (db.transactions) {
      const allTx = db.transactions.findAll();
      db.transactions.data = allTx.filter((t) => {
        if (t.isTest === true) return false;
        if (t.userId && testUserIds.has(t.userId)) return false;
        return true;
      });
      db.transactions.save();
    }

    // G. Clean other auxiliary tables if present
    if (db.quotas) {
      db.quotas.data = db.quotas.findAll().filter((q) => q.isTest !== true && (!q.userId || !testUserIds.has(q.userId)));
      db.quotas.save();
    }
    if (db.rewards) {
      db.rewards.data = db.rewards.findAll().filter((r) => r.isTest !== true && (!r.userId || !testUserIds.has(r.userId)));
      db.rewards.save();
    }
    if (db.referrals) {
      db.referrals.data = db.referrals.findAll().filter((r) => r.isTest !== true && (!r.userId || !testUserIds.has(r.userId)) && (!r.referrerId || !testUserIds.has(r.referrerId)));
      db.referrals.save();
    }
    if (db.dailyUsage) {
      db.dailyUsage.data = db.dailyUsage.findAll().filter((d) => d.isTest !== true && (!d.userId || !testUserIds.has(d.userId)));
      db.dailyUsage.save();
    }

    // H. Activities telemetry & Audit Log
    let resetActivitiesCount = 0;
    if (db.activities) {
      const allAct = db.activities.findAll();
      const nonTestAct = allAct.filter((a) => {
        if (a.isTest === true || a.type?.startsWith('test_') || (a.userId && testUserIds.has(a.userId))) {
          return false;
        }
        return true;
      });
      resetActivitiesCount = allAct.length - nonTestAct.length;
      db.activities.data = nonTestAct;

      // Log the reset operation audit record
      db.activities.insert({
        id: `act-reset-${Date.now()}`,
        type: 'admin_reset_app_data',
        actor: adminOperator.name,
        adminId: adminOperator.id,
        timestamp: new Date().toISOString(),
        details: {
          resetCounts: {
            users: Math.max(0, initialCounts.users - db.users.count()),
            profiles: Math.max(0, initialCounts.profiles - db.profiles.count()),
            applications: Math.max(0, initialCounts.applications - db.applications.count()),
            jobs: Math.max(0, initialCounts.jobs - db.jobs.count()),
            sources: Math.max(0, initialCounts.sources - db.sources.count()),
            subscriptions: Math.max(0, initialCounts.subscriptions - db.subscriptions.count()),
            activities: resetActivitiesCount,
          },
        },
        message: `Admin Reset App Data executed by ${adminOperator.name}`,
      });
      db.activities.save();
    }

    const resetSummary = {
      users: Math.max(0, initialCounts.users - db.users.count()),
      profiles: Math.max(0, initialCounts.profiles - db.profiles.count()),
      applications: Math.max(0, initialCounts.applications - db.applications.count()),
      jobs: Math.max(0, initialCounts.jobs - db.jobs.count()),
      sources: Math.max(0, initialCounts.sources - db.sources.count()),
      subscriptions: Math.max(0, initialCounts.subscriptions - db.subscriptions.count()),
      activities: resetActivitiesCount,
    };

    return res.json({
      success: true,
      message: 'Test and demo data reset successfully.',
      reset: resetSummary,
      preserved: {
        users: db.users.count(),
        profiles: db.profiles.count(),
        applications: db.applications.count(),
        sources: db.sources.count(),
        jobs: db.jobs.count(),
      },
    });
  } catch (err) {
    console.error('Failed to reset app data:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset app data safely. Existing records were preserved.',
    });
  }
};

router.post('/reset-app-data', handleResetAppData);
router.post('/reset-data', handleResetAppData);

export default router;

