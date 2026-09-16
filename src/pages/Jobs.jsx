import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Layers,
  ListFilter,
  X,
  Bookmark,
  Check,
  RotateCcw,
  Facebook,
  CheckCircle2,
  FilePlus2,
  Globe,
  Radio,
  Youtube,
  MessageSquare,
  SlidersHorizontal,
  ArrowUpDown,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import JobCard from '../components/JobCard';
import UpgradeModal from '../components/UpgradeModal';
import { subscriptionService } from '../services/subscriptionService';
import { getApiUrl } from '../config/apiConfig.js';

import { useProfile } from '../contexts/ProfileContext';
import { useSources } from '../contexts/SourcesContext';
import {
  getJobs,
  saveJobs,
  updateJobStatus,
  addJob,
  isDemoMode,
  getSavedSearches,
  addSavedSearch,
  removeSavedSearch,
  logUserEvent,
  getUserEvents,
  addNotification,
  addApplication,
  getOutreachPreferences,
  getPosts,
  getUserAppliedJobIds,
  setUserJobApplied,
  getCurrentUserId,
  isJobAppliedByUser,
  getUserJobState,
  setUserJobState,
  getUserSavedJobIds,
} from '../data/storage.js';
import { DEMO_SAMPLE_POSTS, processPostToJob } from '../services/jobClassifier.js';
import { createPost, createSavedSearch, createNotification, createApplication } from '../data/models.js';
import { featureAccess } from '../services/featureAccessService.js';
import { outreachService } from '../services/outreach/outreachService.js';
import { deduplicationService } from '../services/deduplicationService.js';
import { usageService } from '../services/usageService.js';
import { hasDirectContact, extractContactInfo } from '../utils/contactExtractor.js';
import { isProPlan } from '../utils/planUtils.js';
import {
  REMOTE_OPTIONS,
  MATCH_THRESHOLDS,
  SORT_OPTIONS,
  JOB_TYPES,
  CATEGORIES,
} from '../utils/constants';

const PLATFORM_FILTERS = [
  { id: 'all', label: 'All', icon: Globe },
  { id: 'reddit', label: 'Reddit', icon: Radio, color: 'text-[#FF4500]' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-[#FF0000]' },
  { id: 'x', label: 'X (Twitter)', icon: MessageSquare, color: 'text-text-primary' },
  { id: 'facebook_group', label: 'Facebook', icon: Facebook, color: 'text-[#1877F2]' },
  { id: 'manual_import', label: 'Manual', icon: FilePlus2, color: 'text-primary' },
  { id: 'saved', label: 'Saved', icon: Bookmark, color: 'text-amber-500' },
];

const Jobs = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { sources } = useSources();

  const [jobs, setJobs] = useState(() => getJobs());
  const [activePlatformFilter, setActivePlatformFilter] = useState('all');
  const [viewMode, setViewMode] = useState('swipe'); // 'swipe' | 'list'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]); // for Undo

  // Advanced Filters & Sorting
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [remoteFilter, setRemoteFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [matchScoreFilter, setMatchScoreFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('best_match');

  // Saved Searches Drawer & Modal
  const [savedSearches, setSavedSearches] = useState(() => getSavedSearches());
  const [showSavedSearchModal, setShowSavedSearchModal] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTitle, setUpgradeTitle] = useState('Upgrade Membership');
  const [upgradeReason, setUpgradeReason] = useState('');

  const demoActive = isDemoMode();


  // Auto-seed demo jobs if needed and demo mode is active
  useEffect(() => {
    const existing = getJobs();
    if (demoActive) {
      const existingPostIds = new Set(existing.map((j) => String(j.postId || '')).filter(Boolean));
      const existingUrls = new Set(existing.map((j) => j.sourceUrl || j.postUrl).filter(Boolean));
      let added = false;

      DEMO_SAMPLE_POSTS.forEach((sample) => {
        if (!existingPostIds.has(String(sample.id)) && (!sample.postUrl || !existingUrls.has(sample.postUrl))) {
          const post = createPost({
            postId: sample.id,
            postText: sample.text,
            postUrl: sample.postUrl,
            author: sample.author,
            platform: sample.platform,
            isDemo: true,
          });
          const job = processPostToJob(post, profile, { platform: sample.platform, name: 'Sample Source' });
          if (job) {
            addJob(job);
            existingPostIds.add(String(sample.id));
            added = true;
          }
        }
      });

      if (added || existing.length === 0) {
        setJobs(getJobs());
      }
    }
  }, [demoActive, profile]);

  // Sync jobs from server API on mount
  useEffect(() => {
    let isMounted = true;
    async function syncBackendJobs() {
      try {
        const token = localStorage.getItem('tf_auth_token');
        const res = await fetch(getApiUrl('/jobs'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.jobs) && data.jobs.length > 0) {
            const current = getJobs();
            const existingIds = new Set(current.map((j) => String(j.id)));
            let modified = false;
            for (const j of data.jobs) {
              if (!existingIds.has(String(j.id))) {
                current.push(j);
                existingIds.add(String(j.id));
                modified = true;
              }
            }
            if (modified) {
              saveJobs(current);
              if (isMounted) {
                setJobs([...current]);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to sync backend jobs', err);
      }
    }
    syncBackendJobs();
    return () => {
      isMounted = false;
    };
  }, []);

  const [isApplying, setIsApplying] = useState(false);
  const applyingJobIdsRef = useRef(new Set());
  const [isRefilling, setIsRefilling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshTimeRef = useRef(0);

  const handleManualRefresh = async () => {
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 1500 || isRefreshing) return;
    lastRefreshTimeRef.current = now;
    setIsRefreshing(true);
    try {
      await refillFeed();
      refreshJobs();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };
  const [isPro, setIsPro] = useState(() => subscriptionService.isPro() || featureAccess.isProEnabled());

  useEffect(() => {
    const handleSubChanged = (e) => {
      const newPlan = e.detail?.plan;
      setIsPro(isProPlan(newPlan));
    };
    window.addEventListener('tf_subscription_changed', handleSubChanged);
    return () => window.removeEventListener('tf_subscription_changed', handleSubChanged);
  }, []);

  const outreachPrefs = profile?.outreachPreferences || getOutreachPreferences();
  const quickApplyActive = isPro && Boolean(outreachPrefs?.quickApplyEnabled);

  const refreshJobs = useCallback(() => {
    setJobs(getJobs());
  }, []);

  const refillFeed = useCallback(async () => {
    setIsRefilling(true);
    try {
      const currentJobs = getJobs();
      const existingIds = new Set(currentJobs.map((j) => j.id));
      const existingPostIds = new Set(currentJobs.map((j) => String(j.postId || '')).filter(Boolean));
      const existingUrls = new Set(currentJobs.map((j) => j.sourceUrl || j.postUrl).filter(Boolean));

      let addedCount = 0;

      // 1. Check stored posts that are not yet jobs
      const storedPosts = getPosts();
      for (const post of storedPosts) {
        if (existingPostIds.has(String(post.postId || post.id)) || (post.postUrl && existingUrls.has(post.postUrl))) {
          continue;
        }

        const candidateJob = processPostToJob(post, profile, {
          platform: post.platform || 'source',
          name: post.sourceName || 'Stored Opportunity',
        });

        if (candidateJob) {
          const dupCheck = deduplicationService.isDuplicate(candidateJob, currentJobs);
          if (!dupCheck.isDuplicate && !existingIds.has(candidateJob.id)) {
            addJob(candidateJob);
            currentJobs.push(candidateJob);
            existingIds.add(candidateJob.id);
            if (candidateJob.postId) existingPostIds.add(String(candidateJob.postId));
            addedCount++;
          }
        }
      }

      // 2. Check DEMO_SAMPLE_POSTS if demo mode or more opportunities needed
      if (addedCount === 0 || currentJobs.length < 5) {
        for (const sample of DEMO_SAMPLE_POSTS) {
          if (existingPostIds.has(String(sample.id)) || existingUrls.has(sample.postUrl)) {
            continue;
          }

          const post = createPost({
            postId: sample.id,
            postText: sample.text,
            postUrl: sample.postUrl,
            author: sample.author,
            platform: sample.platform,
            isDemo: true,
          });

          const candidateJob = processPostToJob(post, profile, {
            platform: sample.platform,
            name: 'Sample Source',
          });

          if (candidateJob) {
            const dupCheck = deduplicationService.isDuplicate(candidateJob, currentJobs);
            if (!dupCheck.isDuplicate && !existingIds.has(candidateJob.id)) {
              addJob(candidateJob);
              currentJobs.push(candidateJob);
              existingIds.add(candidateJob.id);
              existingPostIds.add(String(sample.id));
              addedCount++;
            }
          }
        }
      }

      if (addedCount > 0) {
        setJobs([...getJobs()]);
        toast.success(`Refilled feed with ${addedCount} new opportunities!`, { icon: '✨' });
      } else {
        toast('All available opportunities are already in your feed.', { icon: 'ℹ️' });
      }
    } catch (e) {
      console.warn('Refill feed error:', e);
    } finally {
      setIsRefilling(false);
    }
  }, [profile]);

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    const handleStateUpdate = () => {
      refreshJobs();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('tf_job_state_changed', handleStateUpdate);
      window.addEventListener('tf_applications_changed', handleStateUpdate);
      return () => {
        window.removeEventListener('tf_job_state_changed', handleStateUpdate);
        window.removeEventListener('tf_applications_changed', handleStateUpdate);
      };
    }
  }, [refreshJobs]);

  const currentUserId = profile?.id || getCurrentUserId();
  const userAppliedIds = useMemo(() => new Set(getUserAppliedJobIds(currentUserId)), [currentUserId, jobs]);
  const userSavedIds = useMemo(() => new Set(getUserSavedJobIds(currentUserId)), [currentUserId, jobs]);

  // Comprehensive Multi-Filter & Sort Pipeline
  const filteredJobs = useMemo(() => {
    let result = jobs.filter((j) => {
      const userJobState = getUserJobState(j.id, currentUserId);

      // Platform filter
      if (activePlatformFilter === 'saved') {
        if (userJobState !== 'saved' && !userSavedIds.has(String(j.id))) return false;
      } else {
        // Active feed: MUST EXCLUDE any job that is saved, draft, applied, or skipped for this user
        if (
          userJobState === 'saved' ||
          userJobState === 'draft' ||
          userJobState === 'applied' ||
          userJobState === 'skipped'
        ) {
          return false;
        }
        // User-scoped applied filter: applied jobs are excluded only for this user
        if (userAppliedIds.has(String(j.id)) || isJobAppliedByUser(j.id, currentUserId)) return false;
        if (activePlatformFilter !== 'all' && j.platform !== activePlatformFilter) return false;
      }

      // In Quick Apply mode: STRICTLY require direct contact and minimum match qualification
      if (quickApplyActive && activePlatformFilter !== 'saved') {
        const contactValid = hasDirectContact(j);
        if (!contactValid) return false;
        const minThreshold = Number(profile?.userPreferences?.minMatchScore) || 70;
        if ((j.matchScore || 0) < minThreshold) return false;
      }

      // Remote filter
      if (remoteFilter === 'remote' && !j.remote) return false;
      if (remoteFilter === 'onsite' && j.remote) return false;

      // Job Type filter
      if (jobTypeFilter !== 'all' && j.jobType !== jobTypeFilter) return false;

      // Match Score filter
      if (matchScoreFilter !== 'all') {
        const threshold = parseInt(matchScoreFilter, 10);
        if ((j.matchScore || 0) < threshold) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && j.jobCategory !== categoryFilter) return false;

      return true;
    });

    // Advanced V4 Sorting
    const userEvents = getUserEvents();
    // Identify preferred roles/skills from user's positive interactions (saved, applied)
    const positiveRoles = userEvents
      .filter((e) => e.type === 'job_saved' || e.type === 'job_applied')
      .map((e) => (e.jobRole || '').toLowerCase())
      .filter(Boolean);

    result.sort((a, b) => {
      if (sortBy === 'for_you') {
        // Learn from user interaction behavior + freshness decay
        let scoreA = a.matchScore || 0;
        let scoreB = b.matchScore || 0;

        const roleA = (a.jobRole || '').toLowerCase();
        const roleB = (b.jobRole || '').toLowerCase();
        if (positiveRoles.includes(roleA)) scoreA += 12;
        if (positiveRoles.includes(roleB)) scoreB += 12;

        // Freshness boost: jobs within last 2 days get +5 pts
        const ageHoursA = (Date.now() - new Date(a.createdAt || 0).getTime()) / 3600000;
        const ageHoursB = (Date.now() - new Date(b.createdAt || 0).getTime()) / 3600000;
        if (ageHoursA < 48) scoreA += 5;
        if (ageHoursB < 48) scoreB += 5;

        return scoreB - scoreA;
      }
      if (sortBy === 'highest_salary') {
        const parseSal = (str) => {
          if (!str) return 0;
          const match = str.replace(/,/g, '').match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        return parseSal(b.salary) - parseSal(a.salary);
      }
      if (sortBy === 'job_quality') {
        const qualityWeight = { 'High Quality': 3, 'Standard Quality': 2, 'Limited Info': 1 };
        return (qualityWeight[b.jobQuality] || 1) - (qualityWeight[a.jobQuality] || 1);
      }
      if (sortBy === 'best_match') {
        return (b.matchScore || 0) - (a.matchScore || 0);
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return 0;
    });

    return result;
  }, [jobs, activePlatformFilter, remoteFilter, jobTypeFilter, matchScoreFilter, categoryFilter, sortBy, quickApplyActive, profile?.userPreferences?.minMatchScore, userAppliedIds, userSavedIds, currentUserId]);


  // Bound index safely
  const safeIndex = Math.min(currentIndex, Math.max(0, filteredJobs.length - 1));
  const currentCard = filteredJobs[safeIndex] || null;
  const nextCard = filteredJobs[safeIndex + 1] || null;

  // Actions with Personalization Event Logging
  const handleSkip = (job) => {
    if (!job || !job.id) return;
    const currentUid = profile?.id || getCurrentUserId();
    setUserJobState(job.id, 'skipped', currentUid);
    updateJobStatus(job.id, 'skipped', currentUid);
    logUserEvent('job_skipped', {
      jobId: job.id,
      jobTitle: job.title,
      platform: job.platform,
      jobRole: job.jobRole,
      jobType: job.jobType,
      remote: job.remote,
      requiredSkills: job.requiredSkills,
    });
    setHistory((prev) => [...prev, { job, previousStatus: 'feed', action: 'skipped' }]);
    toast('Skipped', { icon: '⏭️', duration: 1500 });
    refreshJobs();
  };

  const handleSave = (job) => {
    if (!job || !job.id) return;
    const currentUid = profile?.id || getCurrentUserId();

    // 1. Set user-scoped state to 'saved'
    setUserJobState(job.id, 'saved', currentUid);
    updateJobStatus(job.id, 'saved', currentUid);

    // 2. Add or update application record with status 'saved'
    const app = createApplication({
      jobId: job.id,
      userId: currentUid,
      title: job.title,
      company: job.company || job.author,
      platform: job.platform,
      sourceUrl: job.sourceUrl || job.postUrl,
      status: 'saved',
      matchScore: job.matchScore,
      matchReasons: job.matchReasons,
    });
    addApplication(app);

    logUserEvent('job_saved', {
      jobId: job.id,
      jobTitle: job.title,
      platform: job.platform,
      jobRole: job.jobRole,
      jobType: job.jobType,
      remote: job.remote,
      requiredSkills: job.requiredSkills,
    });
    setHistory((prev) => [...prev, { job, previousStatus: 'feed', action: 'saved' }]);
    toast.success('Job saved to your collection!');
    if (viewMode === 'swipe') {
      setCurrentIndex((prev) => prev + 1);
    }
    refreshJobs();
  };

  const handleApply = async (job) => {
    if (!job || !job.id) return;
    if (applyingJobIdsRef.current.has(job.id)) return;

    const currentUid = profile?.id || getCurrentUserId();
    if (isJobAppliedByUser(job.id, currentUid)) {
      toast('You already applied to this opportunity.', { icon: 'ℹ️' });
      return;
    }

    applyingJobIdsRef.current.add(job.id);
    setIsApplying(true);

    try {
      const liveIsPro = subscriptionService.isPro() || featureAccess.isProEnabled() || isPro;
      if (liveIsPro && !isPro) setIsPro(true);

      logUserEvent('job_applied', {
        jobId: job.id,
        jobTitle: job.title,
        platform: job.platform,
        jobRole: job.jobRole,
        jobType: job.jobType,
        remote: job.remote,
        requiredSkills: job.requiredSkills,
      });

      // 1. Quota Pre-Check
      const quotaCheck = usageService.canApply();
      if (!quotaCheck.allowed) {
        if (liveIsPro) {
          // PRO user: DO NOT show "Upgrade to Pro" or upgrade modal!
          // Show quota exhausted message with refill countdown
          toast.error(quotaCheck.reason || 'Application quota exhausted. Next refill in 8 hours.', { duration: 4500 });
        } else {
          // Free or Plus user: Suggest upgrading to increase quota
          setUpgradeTitle('Application Limit Reached');
          setUpgradeReason(quotaCheck.reason || 'Application limit reached. Upgrade to Plus or Pro for more applications.');
          setShowUpgradeModal(true);
          toast.error(quotaCheck.reason || 'Daily application limit reached.');
        }
        return;
      }

      const outreachPrefs = profile?.outreachPreferences || getOutreachPreferences();
      const quickApplyActive = liveIsPro && Boolean(outreachPrefs?.quickApplyEnabled);

      if (!quickApplyActive) {
        // Normal flow / Approval mode: navigate to manual application screen
        navigate(`/apply/${job.id}`);
        return;
      }

      // Pro Quick Apply / Auto Outreach Flow
      const loadingToast = toast.loading('Personalizing & dispatching AI application...');

      const result = await outreachService.executeAutoOutreach({
        job,
        profile,
        preferences: outreachPrefs,
      });

      toast.dismiss(loadingToast);

      if (result.code === 'PRO_REQUIRED' || result.status === 'NOT_AUTHORIZED') {
        if (subscriptionService.isPro()) {
          await subscriptionService.syncWithServer(subscriptionService.getSubscription()).catch(() => {});
        } else {
          setIsPro(false);
          setUpgradeTitle('Pro Membership Required');
          setUpgradeReason(result.error || 'Quick Apply and Auto Outreach are available exclusively for PRO members.');
          setShowUpgradeModal(true);
          toast.error('Quick Apply requires PRO membership.');
        }
        return;
      }

      if (result.code === 'NOT_QUALIFIED' || result.status === 'NOT_QUALIFIED') {
        // Not qualified: Do NOT send outreach, mark skipped, remove immediately from active feed
        updateJobStatus(job.id, 'skipped');
        setHistory((prev) => [...prev, { job, previousStatus: job.status, action: 'skipped' }]);
        toast.error("This opportunity doesn't match your profile.", { icon: '🎯' });
        refreshJobs();
        return;
      }

      if (result.code === 'DUPLICATE' || result.status === 'DUPLICATE') {
        toast("You already applied to this opportunity.", { icon: 'ℹ️' });
        refreshJobs();
        return;
      }

      if (result.code === 'RATE_LIMIT' || result.status === 'RATE_LIMIT') {
        if (liveIsPro) {
          // PRO user: DO NOT show upgrade modal!
          toast.error(result.error || 'Application quota exhausted.', { duration: 4500 });
        } else {
          setUpgradeTitle('Application Limit Reached');
          setUpgradeReason(result.error || 'Daily application limit reached.');
          setShowUpgradeModal(true);
          toast.error('Daily application limit reached.');
        }
        return;
      }

      if (result.code === 'NO_CONTACT' || result.status === 'NO_CONTACT' || result.code === 'NO_DIRECT_CONTACT' || result.status === 'NO_DIRECT_CONTACT') {
        toast.error('No client contact information available.', { icon: 'ℹ️', duration: 4000 });
        return;
      }

      if (
        (result.code === 'NOT_CONFIGURED' || result.status === 'NOT_CONFIGURED' || !result.configured) &&
        result.status !== 'DEMO_SENT' &&
        result.code !== 'DEMO_SENT' &&
        !result.demo
      ) {
        // Provider unconfigured: NEVER claim sent, notify user accurately
        toast(result.error || 'Application prepared, but email/WhatsApp delivery is not configured yet.', {
          icon: '⚠️',
          duration: 4000,
        });
        return;
      }

      if (
        result.success &&
        (result.status === 'DEMO_SENT' || result.code === 'DEMO_SENT' || result.status === 'SENT' || result.code === 'SENT')
      ) {
        const isDemo = result.status === 'DEMO_SENT' || result.code === 'DEMO_SENT' || !!result.demo;

        // Consume exactly 1 application entitlement
        try {
          usageService.consumeApplication();
        } catch (e) {
          console.warn('Quota consumption note:', e);
        }

        const app = createApplication({
          jobId: job.id,
          userId: currentUid,
          title: job.title,
          company: job.company || job.author,
          platform: job.platform,
          sourceUrl: job.sourceUrl || job.postUrl,
          message: result.message || '',
          originalGeneratedMessage: result.message || '',
          tone: 'Professional',
          length: 'Medium',
          cvAttached: outreachPrefs.autoIncludeCv ?? true,
          portfolioIncluded: outreachPrefs.autoIncludePortfolio ?? true,
          applicationMethod: isDemo ? `Demo Quick Apply (${result.channel || 'Direct'})` : `Auto Quick Apply (${result.channel || 'Direct'})`,
          recipient: result.recipient || '',
          status: 'applied',
          outreachStatus: isDemo ? 'DEMO_SENT' : 'SENT',
          demo: isDemo,
          matchScore: result.matchScore || job.matchScore,
          matchReasons: job.matchReasons,
        });

        addApplication(app);
        setUserJobApplied(job.id, currentUid);
        setUserJobState(job.id, 'applied', currentUid);
        setHistory((prev) => [...prev, { job, previousStatus: 'feed', action: 'applied' }]);

        if (isDemo) {
          toast.custom(
            (t) => (
              <div
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-sm w-full bg-surface shadow-lg rounded-2xl pointer-events-auto flex flex-col p-3.5 border border-primary/40 text-left`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🧪</span>
                  <span className="text-xs font-bold text-text-primary">
                    Demo application sent successfully.
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-text-secondary leading-snug">
                  Demo Mode — no real email or WhatsApp message was sent.
                </p>
              </div>
            ),
            { duration: 4500 }
          );
        } else {
          toast.success('Application sent successfully.', {
            icon: '🚀',
            duration: 3500,
          });
        }

        // Immediately refresh state to remove applied job from active swipe feed
        refreshJobs();

        // If active feed is running low, automatically attempt to refill
        const remaining = getJobs().filter(
          (j) => j.status !== 'skipped' && !userAppliedIds.has(String(j.id)) && j.status !== 'saved'
        );
        if (remaining.length <= 2) {
          refillFeed();
        }
      } else {
        toast.error(result.error || 'Application could not be sent. Please try again.');
      }
    } catch (err) {
      toast.error(err.message || 'Application could not be sent. Please try again.');
    } finally {
      setIsApplying(false);
      applyingJobIdsRef.current.delete(job.id);
    }
  };


  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const currentUid = profile?.id || getCurrentUserId();
    setUserJobState(last.job.id, 'feed', currentUid);
    updateJobStatus(last.job.id, last.previousStatus || 'discovered', currentUid);
    setHistory((prev) => prev.slice(0, -1));
    if (viewMode === 'swipe' && currentIndex > 0) {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    }
    toast('Action undone', { icon: '↺', duration: 1500 });
    refreshJobs();
  };

  const handleDirectUndo = (job) => {
    if (!job || !job.id) return;
    const currentUid = profile?.id || getCurrentUserId();
    setUserJobState(job.id, 'feed', currentUid);
    updateJobStatus(job.id, 'discovered', currentUid);
    toast.success('Job restored to feed');
    refreshJobs();
  };

  const activeFiltersCount =
    (remoteFilter !== 'all' ? 1 : 0) +
    (jobTypeFilter !== 'all' ? 1 : 0) +
    (matchScoreFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0);

  return (
    <PageTransition>
      <div className="px-5 py-6 pb-28 max-w-md mx-auto min-h-screen flex flex-col">
        {/* Header Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-xs">Good to see you 👋</p>
            <h1 className="text-2xl font-bold mt-0.5 text-text-primary">{profile?.name || 'Toufiq'}</h1>
          </div>

          {/* Mode Switcher: Swipe Deck vs List & Refresh */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || isRefilling}
              className="p-2 rounded-xl border border-border bg-surface-hover text-text-secondary hover:text-text-primary transition-all disabled:opacity-50"
              title="Refresh jobs"
              aria-label="Refresh jobs"
            >
              <RefreshCw size={17} className={isRefreshing || isRefilling ? "animate-spin text-primary" : ""} />
            </button>

            <button
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className={`p-2 rounded-xl border transition-all relative ${
                activeFiltersCount > 0
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-hover text-text-secondary hover:text-text-primary border-border'
              }`}
              title="Filter & Sort"
            >
              <SlidersHorizontal size={17} />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-primary text-[10px] font-bold flex items-center justify-center shadow">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <div className="flex items-center bg-surface-hover p-1 rounded-xl border border-border">
              <button
                onClick={() => setViewMode('swipe')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'swipe'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Tinder Swipe Deck"
              >
                <Layers size={17} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="List Feed View"
              >
                <ListFilter size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Drawer / Expanded Controls */}
        <AnimatePresence>
          {showFilterDrawer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 bg-surface border border-border rounded-2xl p-4 shadow-card text-xs space-y-3 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="font-bold text-text-primary flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-primary" />
                  Refine Feed
                </span>
                {(activeFiltersCount > 0 || sortBy !== 'best_match') && (
                  <button
                    onClick={() => {
                      setRemoteFilter('all');
                      setJobTypeFilter('all');
                      setMatchScoreFilter('all');
                      setCategoryFilter('all');
                      setSortBy('best_match');
                    }}
                    className="text-primary font-medium hover:underline text-[11px]"
                  >
                    Reset all
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-medium">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-surface-hover border border-border rounded-lg px-2.5 py-1 text-text-primary focus:outline-none focus:border-primary"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remote Filter Chips */}
              <div>
                <span className="text-text-muted font-medium block mb-1.5">Location:</span>
                <div className="flex flex-wrap gap-1.5">
                  {REMOTE_OPTIONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRemoteFilter(r.id)}
                      className={`px-2.5 py-1 rounded-lg border transition-all ${
                        remoteFilter === r.id
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface-hover border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Match Score Threshold Chips */}
              <div>
                <span className="text-text-muted font-medium block mb-1.5">Match Quality:</span>
                <div className="flex flex-wrap gap-1.5">
                  {MATCH_THRESHOLDS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMatchScoreFilter(m.id)}
                      className={`px-2.5 py-1 rounded-lg border transition-all ${
                        matchScoreFilter === m.id
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface-hover border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Saved Searches Management */}
              <div className="pt-2 border-t border-border">

                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-text-muted font-medium flex items-center gap-1">
                    <Bookmark size={12} className="text-primary" /> Saved Search Alerts
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const check = subscriptionService.canSaveSearch(savedSearches.length);
                      if (!check.allowed) {
                        setUpgradeTitle('Saved Search Limit');
                        setUpgradeReason(check.reason);
                        setShowUpgradeModal(true);
                        return;
                      }
                      setShowSavedSearchModal(true);
                    }}
                    className="text-primary font-bold hover:underline text-[11px]"
                  >
                    + Save Current Filter
                  </button>
                </div>

                {savedSearches.length > 0 ? (
                  <div className="space-y-1">
                    {savedSearches.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-surface-hover border border-border"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (s.platform) setActivePlatformFilter(s.platform);
                            if (s.remote) setRemoteFilter(s.remote);
                            if (s.jobType) setJobTypeFilter(s.jobType);
                            if (s.minScore) setMatchScoreFilter(String(s.minScore));
                            toast.success(`Applied search "${s.name}"`);
                          }}
                          className="text-left font-medium text-text-primary hover:text-primary truncate flex-1"
                        >
                          {s.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = removeSavedSearch(s.id);
                            setSavedSearches(updated);
                            toast.success('Removed saved search');
                          }}
                          className="text-text-muted hover:text-rose-500 text-xs px-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-text-muted italic">No saved search alerts yet.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Today's Matching Summary Card (V4) */}
        {(() => {
          const highMatchCount = jobs.filter((j) => (j.matchScore || 0) >= 80).length;
          const remoteCount = jobs.filter((j) => j.remote).length;
          return (
            <div className="mt-4 p-3.5 rounded-2xl gradient-primary text-white shadow-card flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-90 block">
                  Today's Intelligence Summary
                </span>
                <h4 className="text-sm font-extrabold mt-0.5">
                  {highMatchCount} Excellent Matches • {remoteCount} Remote
                </h4>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Based on your {profile?.primaryRole || profile?.profession || 'creative'} profile & preferences
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSortBy('for_you');
                  toast.success('Personalized "For You" Feed Activated!');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1"
              >
                <Sparkles size={12} />
                For You
              </button>
            </div>
          );
        })()}

        {/* Source Filter Chips */}
        <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-hide">
          {PLATFORM_FILTERS.map((pf) => {
            const isSelected = activePlatformFilter === pf.id;
            const Icon = pf.icon;
            return (
              <button
                key={pf.id}
                onClick={() => {
                  setActivePlatformFilter(pf.id);
                  setCurrentIndex(0);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary border border-border'
                }`}
              >
                {Icon && <Icon size={12} className={pf.color} />}
                <span>{pf.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Feed Content Area */}
        <div className="mt-5 flex-1 flex flex-col">
          {filteredJobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-surface-hover border border-border flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">
                {activePlatformFilter === 'saved' ? 'No Saved Jobs Yet' : 'No Opportunities Found'}
              </h3>
              <p className="text-xs text-text-secondary max-w-[260px] mt-1 mb-6">
                {activePlatformFilter === 'saved'
                  ? 'Jobs you save with swipe up or the Save button will appear here.'
                  : 'Try relaxing your filter criteria or connect more sources to discover opportunities.'}
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={refillFeed}
                  disabled={isRefilling}
                  icon={<RefreshCw size={14} className={isRefilling ? 'animate-spin' : ''} />}
                >
                  {isRefilling ? 'Refilling Opportunities...' : 'Refill Feed from Sources'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate('/import-jobs')}>
                  + Connect More Sources
                </Button>
                {(activePlatformFilter !== 'all' || activeFiltersCount > 0) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActivePlatformFilter('all');
                      setRemoteFilter('all');
                      setJobTypeFilter('all');
                      setMatchScoreFilter('all');
                      setCategoryFilter('all');
                      setCurrentIndex(0);
                      refreshJobs();
                    }}
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            </div>
          ) : viewMode === 'swipe' ? (
            /* TINDER-STYLE SWIPE DECK */
            <div className="flex-1 flex flex-col justify-between max-w-sm mx-auto w-full">
              {/* Deck Header: Progress */}
              <div className="flex items-center justify-between text-xs text-text-muted mb-2 px-1">
                <span className="flex items-center gap-1 font-medium text-text-secondary">
                  <Sparkles size={13} className="text-primary" />
                  Swipe Cards (Tap to View Details)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refillFeed}
                    disabled={isRefilling}
                    title="Refill feed with new opportunities"
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={isRefilling ? 'animate-spin' : ''} />
                    <span>Refill</span>
                  </button>
                  <span className="font-mono text-[11px] font-semibold text-text-primary">
                    Card {Math.min(safeIndex + 1, filteredJobs.length)} of {filteredJobs.length}
                  </span>
                </div>
              </div>

              {/* Quick Apply Indicator banner if active */}
              {isPro && (profile?.outreachPreferences?.quickApplyEnabled || getOutreachPreferences().quickApplyEnabled) && (
                <div className="mb-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1 font-bold">
                    <Zap size={12} /> PRO Quick Apply Active
                  </span>
                  <span className="text-[10px] text-text-muted">
                    Right swipe dispatches AI outreach
                  </span>
                </div>
              )}

              {/* Card Stack Container */}
              <div className="relative w-full h-[450px] flex items-center justify-center">
                {/* Background Next Card Preview */}
                {nextCard && (
                  <div className="absolute inset-0 scale-[0.95] translate-y-3 opacity-60 pointer-events-none z-0">
                    <JobCard job={nextCard} showActions={false} isSwipeable={false} />
                  </div>
                )}

                {/* Foreground Active Swipeable Card */}
                {currentCard && (
                  <AnimatePresence mode="wait">
                    <div
                      key={currentCard.id}
                      onClick={() => navigate(`/job/${currentCard.id}`)}
                      className="absolute inset-0 z-10 cursor-pointer"
                    >
                      <JobCard
                        job={currentCard}
                        isSwipeable={true}
                        showActions={false}
                        quickApplyActive={isPro && !!(profile?.outreachPreferences?.quickApplyEnabled || getOutreachPreferences()?.quickApplyEnabled)}
                        onSkip={() => handleSkip(currentCard)}
                        onSave={() => handleSave(currentCard)}
                        onApply={() => handleApply(currentCard)}
                      />
                    </div>
                  </AnimatePresence>
                )}
              </div>

              {/* Tinder-Style Floating Controls */}
              <div className="flex items-center justify-center gap-4 mt-6 pt-2">
                {/* Undo Button */}
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="w-11 h-11 rounded-full bg-surface border border-border text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-card active:scale-95"
                  title="Undo last swipe"
                >
                  <RotateCcw size={18} />
                </button>

                {/* SKIP (Left swipe) */}
                <button
                  type="button"
                  onClick={() => handleSkip(currentCard)}
                  className="w-14 h-14 rounded-full bg-surface border-2 border-rose-500/40 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500 flex items-center justify-center transition-all shadow-card active:scale-95"
                  title="Skip opportunity (Swipe Left)"
                >
                  <X size={26} strokeWidth={2.5} />
                </button>

                {/* SAVE (Up swipe) */}
                <button
                  type="button"
                  onClick={() => handleSave(currentCard)}
                  className="w-12 h-12 rounded-full bg-surface border-2 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary flex items-center justify-center transition-all shadow-card active:scale-95"
                  title="Save job (Swipe Up)"
                >
                  <Bookmark size={20} strokeWidth={2.2} />
                </button>

                {/* APPLY (Right swipe) */}
                <button
                  type="button"
                  onClick={() => handleApply(currentCard)}
                  className="w-14 h-14 rounded-full bg-surface border-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 flex items-center justify-center transition-all shadow-card active:scale-95"
                  title="Apply for job (Swipe Right)"
                >
                  <Check size={26} strokeWidth={2.8} />
                </button>
              </div>
            </div>
          ) : (
            /* LIST FEED VIEW */
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs text-text-muted px-1">
                <span>Unified Discovered Opportunities</span>
                <span>{filteredJobs.length} results</span>
              </div>

              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onSkip={handleSkip}
                  onSave={handleSave}
                  onApply={handleApply}
                  onUndo={handleDirectUndo}
                  showActions={true}
                  isSwipeable={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save Search Alert Modal */}
      <Modal
        isOpen={showSavedSearchModal}
        onClose={() => setShowSavedSearchModal(false)}
        title="Create Search Alert"
      >
        <div className="space-y-3.5 text-xs">
          <p className="text-text-secondary">
            Save current filters as an alert. Tinder for Freelancers will notify you when new high-match opportunities arrive.
          </p>

          <Input
            label="Search Alert Name"
            placeholder="e.g. Remote YouTube Editors 80%+"
            value={newSearchName}
            onChange={(e) => setNewSearchName(e.target.value)}
          />

          <div className="p-3 rounded-xl bg-surface-hover border border-border space-y-1 text-text-muted">
            <p className="font-semibold text-text-primary mb-1">Filter summary:</p>
            <p>• Platform: <span className="text-text-primary capitalize">{activePlatformFilter}</span></p>
            <p>• Location: <span className="text-text-primary capitalize">{remoteFilter}</span></p>
            <p>• Job Type: <span className="text-text-primary capitalize">{jobTypeFilter}</span></p>
            <p>• Min Match Score: <span className="text-text-primary">{matchScoreFilter === 'all' ? 'Any' : `${matchScoreFilter}%`}</span></p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowSavedSearchModal(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              size="sm"
              onClick={() => {
                if (!newSearchName.trim()) {
                  toast.error('Please name your search alert');
                  return;
                }
                const newSearch = createSavedSearch({
                  name: newSearchName.trim(),
                  platform: activePlatformFilter,
                  remote: remoteFilter,
                  jobType: jobTypeFilter,
                  minScore: matchScoreFilter === 'all' ? 60 : parseInt(matchScoreFilter, 10),
                });
                const updated = addSavedSearch(newSearch);
                setSavedSearches(updated);

                // Add an initial notification for demonstration
                addNotification(
                  createNotification({
                    type: 'saved_search_alert',
                    title: `Search Alert Created: ${newSearch.name}`,
                    message: `Monitoring ${filteredJobs.length} active matching jobs. You'll be alerted as new posts arrive.`,
                  })
                );

                toast.success(`Search alert "${newSearch.name}" saved!`, { icon: '🔔' });
                setNewSearchName('');
                setShowSavedSearchModal(false);
              }}
            >
              Save Alert
            </Button>
          </div>
        </div>
      </Modal>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title={upgradeTitle || "Upgrade Membership"}
        message={upgradeReason}
      />
    </PageTransition>
  );
};

export default Jobs;

