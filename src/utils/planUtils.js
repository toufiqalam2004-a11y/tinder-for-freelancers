/**
 * Canonical Plan Normalization & Verification Utility
 * Single Source of Truth for Free / Plus / Pro subscription tier logic.
 */

export const CANONICAL_PLANS = Object.freeze({
  FREE: 'FREE',
  PLUS: 'PLUS',
  PRO: 'PRO',
});

/**
 * Normalizes any plan representation (string, object, mixed-case) to standard lowercase:
 * 'free' | 'plus' | 'pro'
 */
export function normalizePlan(planInput) {
  if (!planInput) return 'free';
  let planStr = planInput;
  if (typeof planInput === 'object') {
    planStr = planInput.id || planInput.plan || 'free';
  }
  if (typeof planStr !== 'string') return 'free';

  const clean = planStr.trim().toLowerCase();
  if (clean === 'pro') return 'pro';
  if (clean === 'plus') return 'plus';
  return 'free';
}

/**
 * Returns the uppercase canonical plan name: 'FREE' | 'PLUS' | 'PRO'
 */
export function toCanonicalPlan(planInput) {
  return normalizePlan(planInput).toUpperCase();
}

/**
 * Case-insensitive check if plan is PRO
 */
export function isProPlan(planInput) {
  return normalizePlan(planInput) === 'pro';
}

/**
 * Case-insensitive check if plan is PLUS or PRO (paid tiers)
 */
export function isPlusPlan(planInput) {
  const p = normalizePlan(planInput);
  return p === 'plus' || p === 'pro';
}

/**
 * Case-insensitive check if plan is strictly FREE
 */
export function isFreePlan(planInput) {
  return normalizePlan(planInput) === 'free';
}
