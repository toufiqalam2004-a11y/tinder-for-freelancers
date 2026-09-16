/**
 * Centralized Custom Source Limits Configuration
 *
 * Single Source of Truth for custom source limits across Free, Plus, and Pro tiers.
 * Built-in developer sources do NOT count against these limits.
 */

export const FREE_CUSTOM_SOURCE_LIMIT = 1;
export const PLUS_CUSTOM_SOURCE_LIMIT = 3;
export const PRO_CUSTOM_SOURCE_LIMIT = 5;

export const CUSTOM_SOURCE_LIMITS = Object.freeze({
  free: FREE_CUSTOM_SOURCE_LIMIT,
  plus: PLUS_CUSTOM_SOURCE_LIMIT,
  pro: PRO_CUSTOM_SOURCE_LIMIT,
});

/**
 * Returns the maximum allowed custom sources for a given plan.
 * @param {string} plan - 'free' | 'plus' | 'pro'
 * @returns {number}
 */
export function getCustomSourceLimit(plan) {
  const cleanPlan = (plan || 'free').toLowerCase();
  return CUSTOM_SOURCE_LIMITS[cleanPlan] ?? FREE_CUSTOM_SOURCE_LIMIT;
}
