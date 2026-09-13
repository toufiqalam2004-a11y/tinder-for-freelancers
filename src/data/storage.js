import { STORAGE_KEYS, SESSION_KEYS } from '../utils/constants.js';

// Clean up any legacy persistent photos from localStorage
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('tf_user_photos');
  }
} catch {}

function getItem(key) {
  try {
    let data = localStorage.getItem(key);
    // Backward compatibility fallback to migrate from applyai_ prefix
    if (!data && key.startsWith('tf_')) {
      const legacyKey = key.replace('tf_', 'applyai_');
      data = localStorage.getItem(legacyKey);
      if (data) {
        localStorage.setItem(key, data);
      }
    }
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

// Auth
export function getAuth() {
  return getItem(STORAGE_KEYS.AUTH) || { isAuthenticated: false };
}

export function setAuth(auth) {
  setItem(STORAGE_KEYS.AUTH, auth);
  // Every fresh login or logout resets the session photo state
  clearAllSessionPhotos();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('tf_auth_changed', { detail: auth }));
  }
}

// User Profile Data (Persistent except profile photo which is session-only)
export function getUser(userId = null) {
  const uid = userId || getCurrentUserId();
  let user = null;
  if (uid && uid !== 'user-default') {
    user = getItem(`tf_user_${uid}`);
  }
  if (!user) {
    user = getItem(STORAGE_KEYS.USER);
  }
  if (user) {
    // Ensure avatarUrl/photoUrl are NEVER permanently restored from localStorage
    delete user.avatarUrl;
    delete user.photoUrl;
  }
  return user;
}

export function saveUser(user) {
  if (user) {
    const uid = user.phone || user.id || getCurrentUserId();
    // Do NOT persist avatarUrl or photoUrl to localStorage
    const { avatarUrl, photoUrl, ...persistentData } = user;
    if (uid && uid !== 'user-default') {
      setItem(`tf_user_${uid}`, persistentData);
    }
    setItem(STORAGE_KEYS.USER, persistentData);
  }
}

// ====================================================
// SESSION-LEVEL PROFILE PHOTO STORE
// ====================================================
const inMemorySessionPhotos = new Map();

function getSafeSessionStorage() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
    if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) return globalThis.sessionStorage;
  } catch {}
  return null;
}

export function getSessionPhoto(userId) {
  try {
    const auth = getAuth();
    const effectiveId = userId || auth?.userId || auth?.phone || 'current';
    const storage = getSafeSessionStorage();
    if (storage) {
      const val = storage.getItem(`tf_session_photo_${effectiveId}`);
      if (val) return JSON.parse(val);
    }
    return inMemorySessionPhotos.get(effectiveId) || null;
  } catch {
    return inMemorySessionPhotos.get(userId || 'current') || null;
  }
}

export function saveSessionPhoto(userId, photoDataUrl) {
  try {
    const auth = getAuth();
    const effectiveId = userId || auth?.userId || auth?.phone || 'current';
    const storage = getSafeSessionStorage();

    if (photoDataUrl) {
      inMemorySessionPhotos.set(effectiveId, photoDataUrl);
      if (storage) {
        storage.setItem(`tf_session_photo_${effectiveId}`, JSON.stringify(photoDataUrl));
      }
    } else {
      inMemorySessionPhotos.delete(effectiveId);
      if (storage) {
        storage.removeItem(`tf_session_photo_${effectiveId}`);
      }
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('tf_profile_photo_changed', {
          detail: { userId: effectiveId, photo: photoDataUrl || null },
        })
      );
    }
  } catch {}
}

export function removeSessionPhoto(userId) {
  saveSessionPhoto(userId, null);
}

export function clearAllSessionPhotos() {
  inMemorySessionPhotos.clear();
  try {
    const storage = getSafeSessionStorage();
    if (storage) {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith('tf_session_photo')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k));
    }
  } catch {}

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('tf_profile_photo_changed', {
        detail: { photo: null },
      })
    );
  }
}

// Aliases for compatibility
export function getUserPhoto(userId) {
  return getSessionPhoto(userId);
}

export function saveUserPhoto(userId, photoDataUrl) {
  saveSessionPhoto(userId, photoDataUrl);
}

export function removeUserPhoto(userId) {
  removeSessionPhoto(userId);
}

export function getOutreachPreferences() {
  const user = getUser();
  return (
    user?.outreachPreferences || {
      quickApplyEnabled: false,
      contactPreference: 'both', // 'both' | 'email' | 'whatsapp'
      autoIncludePortfolio: true,
      autoIncludeCv: true,
    }
  );
}

export function updateOutreachPreferences(preferences) {
  const user = getUser() || {};
  const current = user.outreachPreferences || {
    quickApplyEnabled: false,
    contactPreference: 'both',
    autoIncludePortfolio: true,
    autoIncludeCv: true,
  };
  const updated = {
    ...current,
    ...preferences,
  };
  user.outreachPreferences = updated;
  saveUser(user);
  return updated;
}

// Sources
export function getSources() {
  return getItem(STORAGE_KEYS.SOURCES) || [];
}

export function saveSources(sources) {
  setItem(STORAGE_KEYS.SOURCES, sources);
}

export function addSource(source) {
  const sources = getSources();
  const existingIdx = sources.findIndex(
    (s) => s.id === source.id || (s.platform === source.platform && s.name === source.name && s.url === source.url)
  );
  if (existingIdx !== -1) {
    sources[existingIdx] = { ...sources[existingIdx], ...source };
  } else {
    sources.push(source);
  }
  saveSources(sources);
  return sources;
}

export function removeSource(id) {
  const sources = getSources().filter((s) => s.id !== id);
  saveSources(sources);
  return sources;
}

export function updateSource(id, updates) {
  const sources = getSources();
  const index = sources.findIndex((s) => s.id === id);
  if (index !== -1) {
    sources[index] = { ...sources[index], ...updates };
    saveSources(sources);
  }
  return sources;
}

export function toggleSourceEnabled(id) {
  const sources = getSources();
  const index = sources.findIndex((s) => s.id === id);
  if (index !== -1) {
    sources[index].enabled = !sources[index].enabled;
    saveSources(sources);
  }
  return sources;
}

// Demo mode configuration
export function isDemoMode() {
  const val = getItem(STORAGE_KEYS.DEMO_MODE);
  return val !== null ? val : true;
}

export function setDemoMode(enabled) {
  setItem(STORAGE_KEYS.DEMO_MODE, enabled);
}

// Jobs
export function getJobs(sourceId = null) {
  const jobs = getItem(STORAGE_KEYS.JOBS) || [];
  if (sourceId) {
    return jobs.filter((j) => j.sourceId === sourceId);
  }
  return jobs;
}

export function saveJobs(jobs) {
  setItem(STORAGE_KEYS.JOBS, jobs);
}

export function addJob(job) {
  const jobs = getJobs();
  const existingIndex = jobs.findIndex(
    (j) => (j.postId && j.postId === job.postId) || j.id === job.id || (j.sourceUrl && j.sourceUrl === job.sourceUrl)
  );
  if (existingIndex !== -1) {
    const existingStatus = jobs[existingIndex].status;
    const preserveStatus = ['saved', 'applied', 'skipped'].includes(existingStatus);
    jobs[existingIndex] = { ...jobs[existingIndex], ...job, ...(preserveStatus ? { status: existingStatus } : {}) };
  } else {
    jobs.unshift(job);
  }
  saveJobs(jobs);
  return jobs;
}

export function getJobById(jobId) {
  const jobs = getJobs();
  return jobs.find((j) => j.id === jobId) || null;
}

export function getSavedJobs() {
  return getJobs().filter((j) => j.status === 'saved');
}

export function updateJobStatus(jobId, status) {
  const jobs = getJobs();
  const index = jobs.findIndex((j) => j.id === jobId);
  if (index !== -1) {
    jobs[index].status = status;
    saveJobs(jobs);
  }
  return jobs;
}

// Posts
export function getPosts(sourceId = null) {
  const posts = getItem(STORAGE_KEYS.POSTS) || [];
  if (sourceId) {
    return posts.filter((p) => p.sourceId === sourceId);
  }
  return posts;
}

export function savePosts(posts) {
  setItem(STORAGE_KEYS.POSTS, posts);
}

export function addPost(post) {
  const posts = getPosts();
  const existingIndex = posts.findIndex((p) => p.postId === post.postId);
  if (existingIndex !== -1) {
    posts[existingIndex] = { ...posts[existingIndex], ...post };
  } else {
    posts.unshift(post);
  }
  savePosts(posts);
  return posts;
}

// Monitoring State
export function getMonitoringState(sourceId) {
  const map = getItem(STORAGE_KEYS.MONITORING) || {};
  return map[sourceId] || null;
}

export function saveMonitoringState(sourceId, data) {
  const map = getItem(STORAGE_KEYS.MONITORING) || {};
  map[sourceId] = {
    ...(map[sourceId] || {}),
    ...data,
    updatedAt: new Date().toISOString(),
  };
  setItem(STORAGE_KEYS.MONITORING, map);
  return map[sourceId];
}

// Applications (V3 Enhanced)
export function getApplications(userId = null) {
  const all = getItem(STORAGE_KEYS.APPLICATIONS) || [];
  const uid = userId || getCurrentUserId();
  if (uid && uid !== 'user-default') {
    return all.filter((a) => !a.userId || a.userId === uid || a.userId === 'user-default');
  }
  return all;
}

export function saveApplications(apps) {
  setItem(STORAGE_KEYS.APPLICATIONS, apps);
}

export function getCurrentUserId() {
  const auth = getAuth();
  if (auth && auth.isAuthenticated && (auth.phone || auth.userId)) {
    return auth.userId || auth.phone;
  }
  const user = getItem(STORAGE_KEYS.USER);
  if (user && (user.id || user.phone)) {
    return user.id || user.phone;
  }
  return 'user-default';
}

export function getUserAppliedJobIds(userId = null) {
  const uid = userId || getCurrentUserId();
  const appliedSet = new Set();

  const apps = getApplications();
  apps.forEach((a) => {
    const appUid = a.userId || 'user-default';
    if (appUid === uid && a.status && a.status !== 'draft' && a.status !== 'saved') {
      if (a.jobId) appliedSet.add(String(a.jobId));
    }
  });

  const userStoreKey = `tf_user_applied_${uid}`;
  const storedList = getItem(userStoreKey) || [];
  storedList.forEach((id) => appliedSet.add(String(id)));

  return Array.from(appliedSet);
}

export function setUserJobApplied(jobId, userId = null) {
  if (!jobId) return;
  const uid = userId || getCurrentUserId();
  const userStoreKey = `tf_user_applied_${uid}`;
  const storedList = getItem(userStoreKey) || [];
  const strId = String(jobId);
  if (!storedList.includes(strId)) {
    storedList.push(strId);
    setItem(userStoreKey, storedList);
  }
}

export function isJobAppliedByUser(jobId, userId = null) {
  if (!jobId) return false;
  const uid = userId || getCurrentUserId();
  const appliedIds = getUserAppliedJobIds(uid);
  return appliedIds.includes(String(jobId));
}

export function addApplication(app) {
  const currentUid = app.userId || getCurrentUserId();
  const appWithUser = {
    ...app,
    userId: currentUid,
  };
  const apps = getApplications();
  const existingIndex = apps.findIndex(
    (a) => a.id === appWithUser.id || (a.jobId && a.jobId === appWithUser.jobId && (!a.userId || a.userId === currentUid))
  );
  if (existingIndex !== -1) {
    // Preserve history when updating
    const existing = apps[existingIndex];
    const statusHistory = existing.statusHistory || [];
    if (appWithUser.status && appWithUser.status !== existing.status) {
      statusHistory.unshift({
        status: appWithUser.status,
        timestamp: new Date().toISOString(),
        note: `Status changed to ${appWithUser.status}`,
      });
    }
    apps[existingIndex] = { ...existing, ...appWithUser, statusHistory };
  } else {
    apps.unshift(appWithUser);
  }
  saveApplications(apps);

  if (appWithUser.status && appWithUser.status !== 'draft' && appWithUser.status !== 'saved') {
    setUserJobApplied(appWithUser.jobId, currentUid);
  }

  return apps;
}

export function updateApplication(id, updates) {
  const apps = getApplications();
  const index = apps.findIndex((a) => a.id === id);
  if (index !== -1) {
    const existing = apps[index];
    let statusHistory = [...(existing.statusHistory || [])];

    if (updates.status && updates.status !== existing.status) {
      statusHistory.unshift({
        status: updates.status,
        timestamp: new Date().toISOString(),
        note: updates.statusNote || `Status updated to ${updates.status}`,
      });
    }

    apps[index] = {
      ...existing,
      ...updates,
      statusHistory,
      updatedAt: new Date().toISOString(),
    };
    saveApplications(apps);
  }
  return apps;
}

export function deleteApplication(id) {
  const apps = getApplications();
  const target = apps.find((a) => a.id === id);
  if (!target) return false;

  const filtered = apps.filter((a) => a.id !== id);
  saveApplications(filtered);

  // Archive safety: preserve in trash
  const trash = getItem(STORAGE_KEYS.APPLICATIONS_TRASH) || [];
  setItem(STORAGE_KEYS.APPLICATIONS_TRASH, [{ ...target, deletedAt: new Date().toISOString() }, ...trash].slice(0, 100));
  return true;
}

export const PROTECTED_APPLICATION_STATUSES = ['interview', 'shortlisted', 'negotiation', 'hired'];

/**
 * Automatically cleans up application records older than 7 days based on updatedAt,
 * provided userPreferences.autoDeleteApplicationsAfter7Days is enabled.
 * 
 * IMPORTANT:
 * - Calculation uses application.updatedAt (falling back to appliedAt or createdAt).
 * - Protected statuses ('interview', 'shortlisted', 'negotiation', 'hired') are ALWAYS retained.
 * - Eligible statuses ('saved', 'draft', 'applied', 'viewed', 'replied', 'rejected', 'closed')
 *   are safely archived to trash and removed from active list.
 * - Never deletes the original Job, User profile, CV, Portfolio, Lead, or Source.
 */
export function cleanupOldApplications(force = false) {
  const prefs = getUserPreferences();
  if (!prefs.autoDeleteApplicationsAfter7Days && !force) {
    return { deletedCount: 0, removedApps: [] };
  }

  const apps = getApplications();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  const remaining = [];
  const removed = [];

  apps.forEach((app) => {
    const status = (app.status || '').toLowerCase();
    const isProtected = PROTECTED_APPLICATION_STATUSES.includes(status);

    if (isProtected) {
      remaining.push(app);
      return;
    }

    // Must calculate from application.updatedAt (NOT only createdAt)
    const lastActiveTime = new Date(app.updatedAt || app.appliedAt || app.createdAt).getTime();
    const isOlderThan7Days = !isNaN(lastActiveTime) && lastActiveTime < cutoff;

    if (isOlderThan7Days) {
      removed.push({ ...app, deletedAt: new Date().toISOString() });
    } else {
      remaining.push(app);
    }
  });

  if (removed.length > 0) {
    saveApplications(remaining);

    // Archive safety: move to trash storage
    const existingTrash = getItem(STORAGE_KEYS.APPLICATIONS_TRASH) || [];
    setItem(STORAGE_KEYS.APPLICATIONS_TRASH, [...removed, ...existingTrash].slice(0, 100));
  }

  return {
    deletedCount: removed.length,
    removedApps: removed,
  };
}

export function getTrashedApplications() {
  return getItem(STORAGE_KEYS.APPLICATIONS_TRASH) || [];
}

export function getApplicationById(id, userId = null) {
  const uid = userId || getCurrentUserId();
  const apps = getItem(STORAGE_KEYS.APPLICATIONS) || [];
  const app = apps.find((a) => a.id === id) || null;
  if (!app) return null;
  if (uid && uid !== 'user-default' && app.userId && app.userId !== uid && app.userId !== 'user-default') {
    return null;
  }
  return app;
}

export function getApplicationByJobId(jobId, userId = null) {
  const uid = userId || getCurrentUserId();
  const apps = getApplications();
  return apps.find((a) => a.jobId === jobId && (!a.userId || a.userId === uid)) || null;
}

/**
 * Calculates lightweight application analytics from actual records.
 * Never fabricates numbers.
 */
export function getApplicationAnalytics() {
  const apps = getApplications();
  const savedJobs = getSavedJobs();
  
  const total = apps.length;
  const appliedOnly = apps.filter((a) => a.status !== 'draft' && a.status !== 'saved');
  const appliedCount = appliedOnly.length;
  
  // Applications this week (past 7 days)
  const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeekCount = appliedOnly.filter(
    (a) => new Date(a.appliedAt || a.createdAt).getTime() >= oneWeekAgo
  ).length;

  // Positive responses: replied, interview, shortlisted, hired
  const positiveStatuses = ['replied', 'interview', 'shortlisted', 'hired'];
  const respondedCount = appliedOnly.filter((a) => positiveStatuses.includes(a.status?.toLowerCase())).length;
  const interviewCount = appliedOnly.filter((a) =>
    ['interview', 'shortlisted', 'hired'].includes(a.status?.toLowerCase())
  ).length;

  const responseRate = appliedCount > 0 ? Math.round((respondedCount / appliedCount) * 100) : 0;
  const interviewRate = appliedCount > 0 ? Math.round((interviewCount / appliedCount) * 100) : 0;

  return {
    totalApplications: appliedCount,
    draftsCount: apps.filter((a) => a.status === 'draft').length,
    applicationsThisWeek: thisWeekCount,
    interviewsCount: interviewCount,
    responseRate,
    interviewRate,
    savedJobsCount: savedJobs.length,
  };
}

// -------------------------------------------------------------
// V4 Saved Searches & Notifications
// -------------------------------------------------------------
export function getSavedSearches() {
  return getItem(STORAGE_KEYS.SAVED_SEARCHES) || [];
}

export function saveSavedSearches(searches) {
  setItem(STORAGE_KEYS.SAVED_SEARCHES, searches);
}

export function addSavedSearch(search) {
  const searches = getSavedSearches();
  searches.unshift(search);
  saveSavedSearches(searches);
  return searches;
}

export function removeSavedSearch(id) {
  const searches = getSavedSearches().filter((s) => s.id !== id);
  saveSavedSearches(searches);
  return searches;
}

export function getNotifications() {
  return getItem(STORAGE_KEYS.NOTIFICATIONS) || [];
}

export function saveNotifications(notifs) {
  setItem(STORAGE_KEYS.NOTIFICATIONS, notifs);
}

export function addNotification(notif) {
  const notifs = getNotifications();
  // Prevent duplicate notifications for same job or query within last hour
  const isDuplicate = notifs.some(
    (n) => n.jobId && n.jobId === notif.jobId && Date.now() - new Date(n.createdAt).getTime() < 3600000
  );
  if (!isDuplicate) {
    notifs.unshift(notif);
    saveNotifications(notifs);
  }
  return notifs;
}

export function markNotificationAsRead(id) {
  const notifs = getNotifications();
  const index = notifs.findIndex((n) => n.id === id);
  if (index !== -1) {
    notifs[index].read = true;
    saveNotifications(notifs);
  }
  return notifs;
}

export function markAllNotificationsRead() {
  const notifs = getNotifications().map((n) => ({ ...n, read: true }));
  saveNotifications(notifs);
  return notifs;
}

export function clearNotifications() {
  saveNotifications([]);
  return [];
}

// -------------------------------------------------------------
// V4 User Event Tracking & Personalization Engine Logging
// -------------------------------------------------------------
export function getUserEvents() {
  return getItem(STORAGE_KEYS.USER_EVENTS) || [];
}

export function logUserEvent(eventType, details = {}) {
  const events = getUserEvents();
  const newEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    type: eventType, // 'job_saved' | 'job_skipped' | 'job_applied' | 'job_viewed'
    jobId: details.jobId || null,
    jobTitle: details.jobTitle || '',
    platform: details.platform || '',
    jobRole: details.jobRole || '',
    requiredSkills: details.requiredSkills || [],
    jobType: details.jobType || '',
    remote: details.remote !== undefined ? details.remote : null,
    timestamp: new Date().toISOString(),
  };
  events.push(newEvent);
  // Keep last 200 events
  if (events.length > 200) events.shift();
  setItem(STORAGE_KEYS.USER_EVENTS, events);
}

// -------------------------------------------------------------
// V4 Full Conversion Funnel & Advanced Intelligence Analytics
// -------------------------------------------------------------
export function getFunnelAnalytics() {
  const allJobs = getJobs();
  const apps = getApplications();
  
  // Total discovered jobs
  const discoveredCount = allJobs.length;
  
  // Saved count (jobs marked saved in feed + apps with status saved/draft)
  const savedJobIds = new Set(allJobs.filter((j) => j.status === 'saved').map((j) => j.id));
  apps.filter((a) => a.status === 'saved' || a.status === 'draft').forEach((a) => {
    if (a.jobId) savedJobIds.add(a.jobId);
  });
  const savedCount = savedJobIds.size;

  // Real applied submissions
  const appliedOnly = apps.filter((a) => a.status !== 'draft' && a.status !== 'saved');
  const appliedCount = appliedOnly.length;

  // Responses (replied, interview, shortlisted, hired, rejected)
  const respondedStatuses = ['replied', 'interview', 'shortlisted', 'hired', 'rejected'];
  const respondedCount = appliedOnly.filter((a) => respondedStatuses.includes(a.status?.toLowerCase())).length;

  // Interviews (interview, shortlisted, hired)
  const interviewStatuses = ['interview', 'shortlisted', 'hired'];
  const interviewCount = appliedOnly.filter((a) => interviewStatuses.includes(a.status?.toLowerCase())).length;

  // Hired
  const hiredCount = appliedOnly.filter((a) => a.status?.toLowerCase() === 'hired').length;

  // Rates
  const applicationRate = discoveredCount > 0 ? Math.round((appliedCount / discoveredCount) * 100) : 0;
  const responseRate = appliedCount > 0 ? Math.round((respondedCount / appliedCount) * 100) : 0;
  const interviewRate = appliedCount > 0 ? Math.round((interviewCount / appliedCount) * 100) : 0;
  const hireRate = interviewCount > 0 ? Math.round((hiredCount / interviewCount) * 100) : 0;

  // Breakdown by platform
  const platformBreakdown = {};
  appliedOnly.forEach((a) => {
    const plat = a.platform || 'other';
    if (!platformBreakdown[plat]) {
      platformBreakdown[plat] = { applied: 0, responses: 0, interviews: 0, hired: 0 };
    }
    platformBreakdown[plat].applied += 1;
    if (respondedStatuses.includes(a.status?.toLowerCase())) platformBreakdown[plat].responses += 1;
    if (interviewStatuses.includes(a.status?.toLowerCase())) platformBreakdown[plat].interviews += 1;
    if (a.status?.toLowerCase() === 'hired') platformBreakdown[plat].hired += 1;
  });

  return {
    discoveredCount,
    savedCount,
    appliedCount,
    respondedCount,
    interviewCount,
    hiredCount,
    rates: {
      applicationRate,
      responseRate,
      interviewRate,
      hireRate,
    },
    platformBreakdown,
  };
}

// -------------------------------------------------------------
// V5 Autopilot Leads, Settings, Tasks, and Live Stats
// -------------------------------------------------------------
export function getLeads() {
  return getItem(STORAGE_KEYS.LEADS) || [];
}

export function saveLeads(leads) {
  setItem(STORAGE_KEYS.LEADS, leads);
}

export function addLead(lead) {
  const leads = getLeads();
  const existingIdx = leads.findIndex((l) => l.id === lead.id || (l.sourcePostId && l.sourcePostId === lead.sourcePostId));
  if (existingIdx !== -1) {
    leads[existingIdx] = { ...leads[existingIdx], ...lead, updatedAt: new Date().toISOString() };
  } else {
    leads.unshift(lead);
  }
  saveLeads(leads);
  return leads;
}

export function updateLead(id, updates) {
  const leads = getLeads();
  const index = leads.findIndex((l) => l.id === id);
  if (index !== -1) {
    leads[index] = { ...leads[index], ...updates, updatedAt: new Date().toISOString() };
    saveLeads(leads);
  }
  return leads;
}

export function getLeadById(id) {
  return getLeads().find((l) => l.id === id) || null;
}

export function getAutopilotSettings() {
  const settings = getItem(STORAGE_KEYS.AUTOPILOT_SETTINGS);
  if (!settings) {
    return {
      status: 'paused',
      mode: 'approval', // 'manual' | 'approval' | 'autopilot'
      services: ['Video Editing', 'Motion Design', 'Content Repurposing'],
      opportunityTypes: ['Freelance', 'Contract', 'Client Work'],
      sources: ['reddit', 'youtube', 'x', 'manual_import'],
      minMatchScore: 80,
      targetAudience: ['Creators', 'YouTubers', 'Startups', 'Founders'],
      outreachMethod: 'both',
      dailyLimit: 5,
      requireApprovalFirstContact: true,
      requireApprovalNewRecipient: true,
      enableFollowUps: true,
      followUpDays: [3, 7],
      maxFollowUps: 2,
      autoPauseOnError: true,
      isConfigured: false,
      autopilotSetupCompleted: false,
    };
  }

  // Backward compatibility: If user previously configured or has leads/tasks, infer setup completed
  if (settings.autopilotSetupCompleted === undefined) {
    const leads = getLeads();
    const isCompleted = !!settings.isConfigured || leads.length > 0;
    return {
      ...settings,
      autopilotSetupCompleted: isCompleted,
    };
  }

  return settings;
}

export function saveAutopilotSettings(settings) {
  setItem(STORAGE_KEYS.AUTOPILOT_SETTINGS, settings);
}

export function resetAutopilotSetup() {
  const current = getAutopilotSettings();
  const reset = {
    ...current,
    isConfigured: false,
    autopilotSetupCompleted: false,
    status: 'paused',
    updatedAt: new Date().toISOString(),
  };
  saveAutopilotSettings(reset);
  return reset;
}

export function hasSeenAutopilotIntro(userId = null) {
  const currentUserId = userId || getUser()?.id || 'default_user';
  const introSeenMap = getItem('tf_autopilot_intro_seen') || {};
  if (introSeenMap[currentUserId] !== undefined) {
    return !!introSeenMap[currentUserId];
  }
  // If user has already completed setup or configured autopilot, do not show intro again
  const settings = getAutopilotSettings();
  if (settings?.autopilotSetupCompleted || settings?.isConfigured) {
    return true;
  }
  return false;
}

export function setSeenAutopilotIntro(userId = null) {
  const currentUserId = userId || getUser()?.id || 'default_user';
  const introSeenMap = getItem('tf_autopilot_intro_seen') || {};
  introSeenMap[currentUserId] = true;
  setItem('tf_autopilot_intro_seen', introSeenMap);
}

export function getAgentTasks() {
  return getItem(STORAGE_KEYS.AGENT_TASKS) || [];
}

export function saveAgentTasks(tasks) {
  setItem(STORAGE_KEYS.AGENT_TASKS, tasks);
}

export function addAgentTask(task) {
  const tasks = getAgentTasks();
  tasks.unshift(task);
  if (tasks.length > 100) tasks.pop();
  saveAgentTasks(tasks);
  return tasks;
}

export function updateAgentTask(id, updates) {
  const tasks = getAgentTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...updates };
    saveAgentTasks(tasks);
  }
  return tasks;
}

export function getAgentActivities() {
  return getItem(STORAGE_KEYS.AGENT_ACTIVITIES) || [];
}

export function logAgentActivity(activity) {
  const activities = getAgentActivities();
  activities.unshift(activity);
  if (activities.length > 150) activities.pop();
  setItem(STORAGE_KEYS.AGENT_ACTIVITIES, activities);
  return activities;
}

export function getOutreachMessages() {
  return getItem(STORAGE_KEYS.OUTREACH_MESSAGES) || [];
}

export function saveOutreachMessages(messages) {
  setItem(STORAGE_KEYS.OUTREACH_MESSAGES, messages);
}

export function addOutreachMessage(msg) {
  const messages = getOutreachMessages();
  const existingIdx = messages.findIndex((m) => m.id === msg.id || m.leadId === msg.leadId);
  if (existingIdx !== -1) {
    messages[existingIdx] = { ...messages[existingIdx], ...msg };
  } else {
    messages.unshift(msg);
  }
  saveOutreachMessages(messages);
  return messages;
}

export function getDailyOutreachCount() {
  const tracker = getItem(STORAGE_KEYS.DAILY_OUTREACH_TRACKER) || { date: '', count: 0 };
  const today = new Date().toISOString().slice(0, 10);
  if (tracker.date !== today) {
    return 0;
  }
  return tracker.count || 0;
}

export function incrementDailyOutreachCount() {
  const today = new Date().toISOString().slice(0, 10);
  const current = getDailyOutreachCount();
  const newCount = current + 1;
  setItem(STORAGE_KEYS.DAILY_OUTREACH_TRACKER, { date: today, count: newCount });
  return newCount;
}

/**
 * Calculates real-time live Autopilot Statistics.
 * Never fabricates numbers.
 */
export function getAutopilotStats() {
  const leads = getLeads();
  const messages = getOutreachMessages();
  const dailyCount = getDailyOutreachCount();

  const opportunitiesFound = leads.length;
  const qualifiedLeads = leads.filter((l) => (l.qualificationScore || 0) >= 60).length;
  const messagesReady = leads.filter(
    (l) => l.status === 'ready_to_contact' || l.status === 'waiting_approval' || l.status === 'qualified'
  ).length;
  const sentCount = leads.filter((l) => ['sent', 'replied', 'interested', 'meeting', 'closed'].includes(l.status)).length;
  const repliesCount = leads.filter((l) => ['replied', 'interested', 'meeting'].includes(l.status)).length;
  const followUpsCount = leads.filter((l) => l.followUpCount > 0 || l.status === 'follow_up_due').length;
  const meetingsCount = leads.filter((l) => l.status === 'meeting').length;

  return {
    opportunitiesFound,
    qualifiedLeads,
    messagesReady,
    sentCount,
    sentToday: dailyCount,
    repliesCount,
    followUpsCount,
    meetingsCount,
  };
}

// Clear all
export function clearAll() {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

// -------------------------------------------------------------
// V6 Scalable Workspaces, Preferences, Health & Data Management
// -------------------------------------------------------------

export function getWorkspaces() {
  return getItem(STORAGE_KEYS.WORKSPACES) || [
    {
      id: 'ws-personal',
      name: 'Personal Workspace',
      type: 'personal',
      role: 'owner',
      createdAt: new Date().toISOString(),
    },
  ];
}

export function saveWorkspaces(workspaces) {
  setItem(STORAGE_KEYS.WORKSPACES, workspaces);
}

export function getUserPreferences() {
  const defaultPrefs = {
    preferredRoles: ['Video Editor', 'Motion Designer'],
    preferredSkills: ['Premiere Pro', 'After Effects'],
    preferredIndustries: ['YouTube Creators', 'Tech Startups', 'E-commerce'],
    preferredJobTypes: ['freelance', 'contract'],
    remotePreference: 'remote',
    minSalary: 500,
    minMatchScore: 70,
    excludedRoles: [],
    excludedSources: [],
    negativeFeedback: [],
    autoDeleteApplicationsAfter7Days: false,
    emailNotifications: {
      newHighMatch: true,
      applicationStatusChange: true,
      leadReply: true,
      followUpDue: true,
    },
  };

  const uid = userId || getCurrentUserId();
  const key = `tf_user_preferences_${uid}`;
  const stored = getItem(key) || (uid === 'user-default' ? getItem(STORAGE_KEYS.USER_PREFERENCES) : null);
  return stored ? { ...defaultPrefs, ...stored } : defaultPrefs;
}

export function saveUserPreferences(prefs, userId = null) {
  const uid = userId || getCurrentUserId();
  const key = `tf_user_preferences_${uid}`;
  setItem(key, prefs);
  setItem(STORAGE_KEYS.USER_PREFERENCES, prefs);
}

export function getAutoDeletePreference() {
  const prefs = getUserPreferences();
  return Boolean(prefs.autoDeleteApplicationsAfter7Days);
}

export function setAutoDeletePreference(enabled) {
  const prefs = getUserPreferences();
  prefs.autoDeleteApplicationsAfter7Days = Boolean(enabled);
  saveUserPreferences(prefs);
  return prefs.autoDeleteApplicationsAfter7Days;
}

export function logNegativeFeedback(jobId, reason) {
  const prefs = getUserPreferences();
  const feedbackList = prefs.negativeFeedback || [];
  feedbackList.push({
    jobId,
    reason,
    timestamp: new Date().toISOString(),
  });
  prefs.negativeFeedback = feedbackList;
  saveUserPreferences(prefs);
}

export function getSourceHealthList() {
  const stored = getItem(STORAGE_KEYS.SOURCE_HEALTH);
  if (stored && stored.length > 0) return stored;

  const defaultHealth = [
    {
      sourceId: 'reddit-1',
      platform: 'reddit',
      name: 'Reddit (r/forhire, r/freelance)',
      status: 'healthy',
      lastSyncAt: new Date(Date.now() - 4 * 60000).toISOString(),
      latencyMs: 38,
      message: 'Connected to public feeds',
    },
    {
      sourceId: 'youtube-1',
      platform: 'youtube',
      name: 'YouTube Hiring Threads',
      status: 'healthy',
      lastSyncAt: new Date(Date.now() - 8 * 60000).toISOString(),
      latencyMs: 52,
      message: 'Community channels active',
    },
    {
      sourceId: 'x-1',
      platform: 'x',
      name: 'X (Twitter) Job Search',
      status: 'healthy',
      lastSyncAt: new Date(Date.now() - 2 * 60000).toISOString(),
      latencyMs: 29,
      message: 'Public search stream active',
    },
    {
      sourceId: 'fb-1',
      platform: 'facebook_group',
      name: 'Facebook Community Groups',
      status: 'healthy',
      lastSyncAt: new Date(Date.now() - 15 * 60000).toISOString(),
      latencyMs: 64,
      message: 'Manual group import ready',
    },
  ];
  setItem(STORAGE_KEYS.SOURCE_HEALTH, defaultHealth);
  return defaultHealth;
}

export function updateSourceHealth(sourceId, updates) {
  const healthList = getSourceHealthList();
  const index = healthList.findIndex((h) => h.sourceId === sourceId || h.platform === sourceId);
  if (index !== -1) {
    healthList[index] = { ...healthList[index], ...updates, lastSyncAt: new Date().toISOString() };
    setItem(STORAGE_KEYS.SOURCE_HEALTH, healthList);
  }
  return healthList;
}

/**
 * Exports complete user data as a sanitized JSON backup.
 */
export function exportUserData() {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '6.0.0',
    app: 'Tinder for Freelancers',
    user: getUser(),
    preferences: getUserPreferences(),
    workspaces: getWorkspaces(),
    applications: getApplications(),
    savedJobs: getSavedJobs(),
    leads: getLeads(),
    autopilotSettings: getAutopilotSettings(),
    activities: getAgentActivities(),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Clears application and outreach history while keeping profile.
 */
export function clearUserHistory() {
  setItem(STORAGE_KEYS.APPLICATIONS, []);
  setItem(STORAGE_KEYS.LEADS, []);
  setItem(STORAGE_KEYS.AGENT_ACTIVITIES, []);
  setItem(STORAGE_KEYS.OUTREACH_MESSAGES, []);
}

/**
 * Fully deletes the account and all local session data.
 */
export function deleteAccount() {
  clearAll();
  localStorage.removeItem('applyai_theme_mode');
  localStorage.removeItem('tf_theme_mode');
}

/**
 * Subscription & Usage Storage Helpers
 */
export function getStoredSubscription(userId = null) {
  const uid = userId || getCurrentUserId();
  const key = `tf_sub_${uid}`;
  const sub = getItem(key);
  if (sub) return sub;
  return getItem(STORAGE_KEYS.SUBSCRIPTION);
}

export function setStoredSubscription(sub, userId = null) {
  const uid = userId || getCurrentUserId();
  const key = `tf_sub_${uid}`;
  setItem(key, sub);
  setItem(STORAGE_KEYS.SUBSCRIPTION, sub);
}

export function getStoredDailyUsage(userId = null) {
  const uid = userId || getCurrentUserId();
  const key = `tf_daily_usage_${uid}`;
  const usage = getItem(key);
  if (usage) return usage;
  return getItem(STORAGE_KEYS.DAILY_USAGE);
}

export function setStoredDailyUsage(usage, userId = null) {
  const uid = userId || getCurrentUserId();
  const key = `tf_daily_usage_${uid}`;
  setItem(key, usage);
  setItem(STORAGE_KEYS.DAILY_USAGE, usage);
}

export function getStoredCurrency() {
  return getItem(STORAGE_KEYS.CURRENCY) || 'INR';
}

export function setStoredCurrency(curr) {
  setItem(STORAGE_KEYS.CURRENCY, curr);
}




