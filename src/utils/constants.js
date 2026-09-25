import {
  APPLICATION_QUOTA_WINDOW_HOURS,
  APPLICATION_QUOTA_WINDOW_MS,
  FREE_APPLICATION_QUOTA,
  PLUS_APPLICATION_QUOTA,
  PRO_APPLICATION_QUOTA,
  STREAK_BONUS_TOKENS,
  STREAK_DAYS_REQUIRED,
  PLAN_QUOTA_CONFIG,
  getPlanQuotaConfig,
  getApplicationsPerWindow,
  getQuotaWindowHours,
  formatWindowCountdown,
} from './quotaConfig.js';

import {
  FREE_CUSTOM_SOURCE_LIMIT,
  PLUS_CUSTOM_SOURCE_LIMIT,
  PRO_CUSTOM_SOURCE_LIMIT,
  CUSTOM_SOURCE_LIMITS,
  getCustomSourceLimit,
} from './sourceConfig.js';

export {
  APPLICATION_QUOTA_WINDOW_HOURS,
  APPLICATION_QUOTA_WINDOW_MS,
  FREE_APPLICATION_QUOTA,
  PLUS_APPLICATION_QUOTA,
  PRO_APPLICATION_QUOTA,
  STREAK_BONUS_TOKENS,
  STREAK_DAYS_REQUIRED,
  PLAN_QUOTA_CONFIG,
  getPlanQuotaConfig,
  getApplicationsPerWindow,
  getQuotaWindowHours,
  formatWindowCountdown,
  FREE_CUSTOM_SOURCE_LIMIT,
  PLUS_CUSTOM_SOURCE_LIMIT,
  PRO_CUSTOM_SOURCE_LIMIT,
  CUSTOM_SOURCE_LIMITS,
  getCustomSourceLimit,
};

export const PLATFORMS = {
  FACEBOOK_GROUP: 'facebook_group',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube',
  X: 'x',
  LINKEDIN: 'linkedin',
  INSTAGRAM: 'instagram',
  THREADS: 'threads',
  JOB_BOARD: 'job_board',
  WEBSITE: 'website',
  MANUAL_IMPORT: 'manual_import',
};

export const PLATFORM_LABELS = {
  [PLATFORMS.FACEBOOK_GROUP]: 'Facebook Groups',
  [PLATFORMS.REDDIT]: 'Reddit',
  [PLATFORMS.YOUTUBE]: 'YouTube',
  [PLATFORMS.X]: 'X (Twitter)',
  [PLATFORMS.LINKEDIN]: 'LinkedIn',
  [PLATFORMS.INSTAGRAM]: 'Instagram',
  [PLATFORMS.THREADS]: 'Threads',
  [PLATFORMS.JOB_BOARD]: 'Job Board',
  [PLATFORMS.WEBSITE]: 'Website',
  [PLATFORMS.MANUAL_IMPORT]: 'Manual Import',
};

export const SOURCE_TYPES = {
  REDDIT_SUBREDDIT: 'reddit_subreddit',
  REDDIT_SEARCH: 'reddit_search',
  YOUTUBE_SEARCH: 'youtube_search',
  X_SEARCH: 'x_search',
  FACEBOOK_MANUAL: 'facebook_manual',
  MANUAL_IMPORT: 'manual_import',
};

export const SOURCE_STATUS = {
  CONNECTED: 'connected',
  ACTIVE: 'active',
  API_REQUIRED: 'api_required',
  DEMO_MODE: 'demo_mode',
  DISABLED: 'disabled',
  ERROR: 'error',
  ADDED: 'added',
  MONITORING: 'monitoring',
  PAUSED: 'paused',
};

export const APPLICATION_STATUS = {
  SAVED: 'saved',
  DRAFT: 'draft',
  APPLIED: 'applied',
  VIEWED: 'viewed',
  INTERVIEW: 'interview',
  SHORTLISTED: 'shortlisted',
  REJECTED: 'rejected',
  HIRED: 'hired',
};

export const APPLICATION_STATUS_CONFIG = {
  saved: { label: 'Saved', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  draft: { label: 'Draft', color: 'text-text-muted', bg: 'bg-surface-hover', border: 'border-border' },
  applied: { label: 'Applied', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  viewed: { label: 'Viewed', color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  interview: { label: 'Interview', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  shortlisted: { label: 'Shortlisted', color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  rejected: { label: 'Rejected', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  hired: { label: 'Hired', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
};

export const APPLICATION_TONES = [
  { id: 'Professional', label: 'Professional', desc: 'Polished, structured, and business-ready' },
  { id: 'Friendly', label: 'Friendly', desc: 'Warm, approachable, and enthusiastic' },
  { id: 'Confident', label: 'Confident', desc: 'Direct, impact-oriented, and bold' },
  { id: 'Short & Direct', label: 'Short & Direct', desc: 'Concise, high-signal, zero fluff' },
];

export const APPLICATION_LENGTHS = [
  { id: 'Short', label: 'Short', desc: 'Under 80 words' },
  { id: 'Medium', label: 'Medium', desc: '120-160 words' },
  { id: 'Detailed', label: 'Detailed', desc: '200+ words' },
];

export const CATEGORIES = [
  'Creative',
  'Development',
  'Marketing',
  'Design',
  'Writing',
  'Data & Analytics',
  'Sales',
  'Operations',
  'Other',
];

export const EXPERIENCE_LEVELS = [
  'Entry Level',
  'Junior (1-2 years)',
  'Mid-Level (3-5 years)',
  'Senior (5+ years)',
  'Lead / Principal',
];

export const JOB_TYPES = [
  'freelance',
  'contract',
  'full-time',
  'part-time',
  'internship',
];

export const JOB_TYPE_LABELS = {
  freelance: 'Freelance',
  contract: 'Contract',
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  internship: 'Internship',
};

export const REMOTE_OPTIONS = [
  { id: 'all', label: 'All Locations' },
  { id: 'remote', label: 'Remote Only' },
  { id: 'onsite', label: 'On-site' },
  { id: 'hybrid', label: 'Hybrid' },
];

export const MATCH_THRESHOLDS = [
  { id: 'all', label: 'All Matches' },
  { id: '80', label: '80%+ Match', minScore: 80 },
  { id: '60', label: '60%+ Match', minScore: 60 },
  { id: '40', label: '40%+ Match', minScore: 40 },
];

export const SORT_OPTIONS = [
  { id: 'best_match', label: 'Best Match' },
  { id: 'for_you', label: 'For You (Learned)' },
  { id: 'newest', label: 'Newest' },
  { id: 'highest_salary', label: 'Highest Rate/Salary' },
  { id: 'job_quality', label: 'High Quality Posts' },
];


export const JOB_STATUS = {
  DISCOVERED: 'discovered',
  SAVED: 'saved',
  SKIPPED: 'skipped',
  APPLIED: 'applied',
};

export const MONITORING_STATUS = {
  ACTIVE: 'active',
  API_REQUIRED: 'api_required',
  NOT_AVAILABLE: 'not_available',
  CHECKING: 'checking',
};

export const SKILL_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
];

export const NOTIFICATION_TYPES = {
  HIGH_MATCH: 'high_match',
  APPLICATION_UPDATE: 'application_update',
  SAVED_SEARCH_ALERT: 'saved_search_alert',
  SOURCE_SYNC: 'source_sync',
  SYSTEM: 'system',
};

export const JOB_QUALITY_LEVELS = {
  HIGH: 'High Quality',
  MEDIUM: 'Standard Quality',
  LIMITED: 'Limited Info',
};

export const AUTOPILOT_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
};

export const AUTOPILOT_MODES = {
  MANUAL: 'manual',
  APPROVAL: 'approval',
  AUTOPILOT: 'autopilot',
};

export const LEAD_STATUS = {
  DISCOVERED: 'discovered',
  QUALIFIED: 'qualified',
  READY_TO_CONTACT: 'ready_to_contact',
  WAITING_APPROVAL: 'waiting_approval',
  APPROVED: 'approved',
  SENT: 'sent',
  REPLIED: 'replied',
  INTERESTED: 'interested',
  NOT_INTERESTED: 'not_interested',
  FOLLOW_UP_DUE: 'follow_up_due',
  FOLLOW_UP_SENT: 'follow_up_sent',
  MEETING: 'meeting',
  CLOSED: 'closed',
  REJECTED: 'rejected',
};

export const TASK_TYPES = {
  DISCOVER: 'discover',
  RESEARCH: 'research',
  QUALIFY: 'qualify',
  GENERATE_MESSAGE: 'generate_message',
  WAITING_APPROVAL: 'waiting_approval',
  SEND: 'send',
  FOLLOW_UP: 'follow_up',
  PROCESS_REPLY: 'process_reply',
};

export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export const OUTREACH_METHODS = {
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  BOTH: 'both',
};

export const APP_CONFIG = {
  NAME: 'Tinder for Freelancers',
  SHORT_NAME: 'TF',
  TAGLINE: 'Swipe. Match. Get Hired.',
  DESCRIPTION: 'Discover freelance jobs and client opportunities that match your skills.',
  VERSION: '6.0.0',
};

export const APPLICATION_STAGES = [
  { id: 'saved', label: 'Saved' },
  { id: 'draft', label: 'Draft' },
  { id: 'applied', label: 'Applied' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'replied', label: 'Replied' },
  { id: 'interview', label: 'Interview' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'hired', label: 'Hired' },
  { id: 'closed', label: 'Closed' },
];

export const MATCH_TIERS = {
  EXCELLENT: { label: 'Excellent Match', min: 90, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  STRONG: { label: 'Strong Match', min: 80, color: 'text-primary bg-primary-soft' },
  POSSIBLE: { label: 'Possible Match', min: 60, color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  LOW: { label: 'Low Match', min: 0, color: 'text-text-muted bg-surface-hover' },
};

export const STORAGE_KEYS = {
  USER: 'tf_user',
  SOURCES: 'tf_sources',
  JOBS: 'tf_jobs',
  AUTH: 'tf_auth',
  POSTS: 'tf_posts',
  MONITORING: 'tf_monitoring',
  APPLICATIONS: 'tf_applications',
  DEMO_MODE: 'tf_demo_mode',
  SAVED_SEARCHES: 'tf_saved_searches',
  NOTIFICATIONS: 'tf_notifications',
  USER_EVENTS: 'tf_user_events',
  LEADS: 'tf_leads',
  AUTOPILOT_SETTINGS: 'tf_autopilot_settings',
  AGENT_TASKS: 'tf_agent_tasks',
  AGENT_ACTIVITIES: 'tf_agent_activities',
  OUTREACH_MESSAGES: 'tf_outreach_messages',
  DAILY_OUTREACH_TRACKER: 'tf_daily_outreach_tracker',
  WORKSPACES: 'tf_workspaces',
  USER_PREFERENCES: 'tf_user_preferences',
  SOURCE_HEALTH: 'tf_source_health',
  FEATURE_FLAGS: 'tf_feature_flags',
  APPLICATIONS_TRASH: 'tf_applications_trash',
  SUBSCRIPTION: 'tf_subscription',
  DAILY_USAGE: 'tf_daily_usage',
  CURRENCY: 'tf_currency',
};

export const SESSION_KEYS = {
  SESSION_PHOTO: 'tf_session_photo',
};

export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    badge: null,
    tagline: 'Basic discovery & starter limits',
    prices: {
      monthly: {
        INR: 0,
        USD: 0,
      },
      annual: {
        INR: 0,
        USD: 0,
      },
      INR: 0,
      USD: 0,
    },
    limits: {
      applicationsPerWindow: FREE_APPLICATION_QUOTA,
      applicationsPerDay: FREE_APPLICATION_QUOTA,
      quotaWindowHours: APPLICATION_QUOTA_WINDOW_HOURS,
      sources: FREE_CUSTOM_SOURCE_LIMIT,
      customSources: FREE_CUSTOM_SOURCE_LIMIT,
      aiApplyPerDay: 2,
      savedSearches: 2,
      themePresets: 3,
      customThemes: false,
      autopilotMode: 'none', // 'none' | 'approval_only' | 'full'
      analyticsTier: 'basic', // 'basic' | 'advanced' | 'full'
      matchQuality: 'basic',
      leadFinding: false,
      aiReplies: false,
      followUps: false,
    },
    features: [
      `${FREE_APPLICATION_QUOTA} Applications per ${APPLICATION_QUOTA_WINDOW_HOURS}-hour window`,
      `${FREE_CUSTOM_SOURCE_LIMIT} Custom Job Source`,
      '2 AI Apply generations / day',
      'Basic match intelligence',
      '2 Saved search alerts',
      '3 Theme presets (Light & Dark)',
      'Basic application analytics',
      'Community job feed',
    ],
  },
  PLUS: {
    id: 'plus',
    name: 'Plus',
    badge: '⭐ Most Popular',
    tagline: 'For active freelance job hunters',
    prices: {
      monthly: {
        INR: 499,
        USD: 7,
      },
      annual: {
        INR: 4990,
        USD: 70,
      },
      INR: 499,
      USD: 7,
    },
    limits: {
      applicationsPerWindow: PLUS_APPLICATION_QUOTA,
      applicationsPerDay: PLUS_APPLICATION_QUOTA,
      quotaWindowHours: APPLICATION_QUOTA_WINDOW_HOURS,
      sources: PLUS_CUSTOM_SOURCE_LIMIT,
      customSources: PLUS_CUSTOM_SOURCE_LIMIT,
      aiApplyPerDay: 10,
      savedSearches: 10,
      themePresets: 6,
      customThemes: false,
      autopilotMode: 'approval_only',
      analyticsTier: 'advanced',
      matchQuality: 'advanced',
      leadFinding: true,
      aiReplies: true,
      followUps: true,
    },
    features: [
      `${PLUS_APPLICATION_QUOTA} Applications per ${APPLICATION_QUOTA_WINDOW_HOURS}-hour window`,
      `${PLUS_CUSTOM_SOURCE_LIMIT} Custom Job Sources`,
      '10 AI Apply generations / day',
      'Advanced match scoring',
      '10 Saved search alerts',
      'All 6 Curated theme presets',
      'AI Proposal Writer',
      'Smart follow-up reminders',
      'Advanced funnel analytics',
    ],
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    badge: '🚀 Pro',
    tagline: 'High-volume career pipeline & VIP perks',
    prices: {
      monthly: {
        INR: 1499,
        USD: 19,
      },
      annual: {
        INR: 14990,
        USD: 190,
      },
      INR: 1499,
      USD: 19,
    },
    limits: {
      applicationsPerWindow: PRO_APPLICATION_QUOTA,
      applicationsPerDay: PRO_APPLICATION_QUOTA,
      quotaWindowHours: APPLICATION_QUOTA_WINDOW_HOURS,
      sources: PRO_CUSTOM_SOURCE_LIMIT,
      customSources: PRO_CUSTOM_SOURCE_LIMIT,
      aiApplyPerDay: 50,
      savedSearches: 999, // Unlimited
      themePresets: 6,
      customThemes: true,
      autopilotMode: 'full',
      analyticsTier: 'full',
      matchQuality: 'priority',
      leadFinding: true,
      aiReplies: true,
      followUps: true,
    },
    features: [
      `${PRO_APPLICATION_QUOTA} Applications per ${APPLICATION_QUOTA_WINDOW_HOURS}-hour window`,
      `${PRO_CUSTOM_SOURCE_LIMIT} Custom Job Sources`,
      '50 AI Apply generations / day',
      'Priority + Top-Tier Match Score',
      'Unlimited Saved search alerts',
      'Custom Color Theme Builder',
      'Instant AI Match Fit & Tailored Pitches',
      'AI Instant replies & lead finding',
      'VIP Priority job pipeline & analytics',
    ],
  },
};

export const CREDIT_PACKAGES = [
  {
    id: 'credits_20',
    amount: 20,
    label: '+20 Applications',
    subtext: 'Ideal for quick project surges',
    prices: {
      INR: 49,
      USD: 0.99,
    },
    validityDays: 30,
  },
  {
    id: 'credits_50',
    amount: 50,
    label: '+50 Applications',
    badge: 'Popular',
    subtext: 'Great for weekly application sprints',
    prices: {
      INR: 99,
      USD: 1.99,
    },
    validityDays: 30,
  },
  {
    id: 'credits_100',
    amount: 100,
    label: '+100 Applications',
    badge: 'Max Savings',
    subtext: 'Best value for agency & power freelancers',
    prices: {
      INR: 179,
      USD: 3.49,
    },
    validityDays: 30,
  },
];




