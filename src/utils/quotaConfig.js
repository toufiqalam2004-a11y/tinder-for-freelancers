/**
 * Centralized Application Quota & Window Configuration
 *
 * Single Source of Truth for application quotas and rolling window intervals.
 * Configurable so quotas (5/15/25) can be scaled in the future without code rewrites.
 */

import { toCanonicalPlan } from './planUtils.js';

export const APPLICATION_QUOTA_WINDOW_HOURS = 8;
export const APPLICATION_QUOTA_WINDOW_MS = APPLICATION_QUOTA_WINDOW_HOURS * 60 * 60 * 1000;

export const FREE_APPLICATION_QUOTA = 5;
export const PLUS_APPLICATION_QUOTA = 15;
export const PRO_APPLICATION_QUOTA = 25;

export const STREAK_BONUS_TOKENS = 2;
export const STREAK_DAYS_REQUIRED = 3;

export const PLAN_QUOTA_CONFIG = Object.freeze({
  FREE: Object.freeze({
    planId: 'free',
    name: 'Free',
    applicationsPerWindow: FREE_APPLICATION_QUOTA,
    windowHours: APPLICATION_QUOTA_WINDOW_HOURS,
    windowMs: APPLICATION_QUOTA_WINDOW_MS,
    streakRewardTokens: STREAK_BONUS_TOKENS,
    streakRequiredDays: STREAK_DAYS_REQUIRED,
    allowsAutopilot: false,
    allowsApproval: false,
  }),
  PLUS: Object.freeze({
    planId: 'plus',
    name: 'Plus',
    applicationsPerWindow: PLUS_APPLICATION_QUOTA,
    windowHours: APPLICATION_QUOTA_WINDOW_HOURS,
    windowMs: APPLICATION_QUOTA_WINDOW_MS,
    streakRewardTokens: 0,
    streakRequiredDays: 0,
    allowsAutopilot: false,
    allowsApproval: true,
  }),
  PRO: Object.freeze({
    planId: 'pro',
    name: 'Pro',
    applicationsPerWindow: PRO_APPLICATION_QUOTA,
    windowHours: APPLICATION_QUOTA_WINDOW_HOURS,
    windowMs: APPLICATION_QUOTA_WINDOW_MS,
    streakRewardTokens: 0,
    streakRequiredDays: 0,
    allowsAutopilot: true,
    allowsApproval: true,
  }),
});

/**
 * Returns plan quota configuration.
 * @param {string|object} planInput - 'free' | 'plus' | 'pro'
 */
export function getPlanQuotaConfig(planInput) {
  const canonical = toCanonicalPlan(planInput);
  return PLAN_QUOTA_CONFIG[canonical] || PLAN_QUOTA_CONFIG.FREE;
}

/**
 * Returns allowed applications per 8-hour window for the plan.
 */
export function getApplicationsPerWindow(planInput) {
  return getPlanQuotaConfig(planInput).applicationsPerWindow;
}

/**
 * Returns window duration in hours (8).
 */
export function getQuotaWindowHours(planInput) {
  return getPlanQuotaConfig(planInput).windowHours;
}

/**
 * Formats milliseconds remaining into human-readable countdown string e.g. "6h 12m" or "45m"
 * @param {number} msRemaining
 */
export function formatWindowCountdown(msRemaining) {
  if (!msRemaining || msRemaining <= 0) return '0m';
  const totalMinutes = Math.ceil(msRemaining / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    const paddedMin = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}h ${paddedMin}m`;
  }
  return `${minutes}m`;
}
