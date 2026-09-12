/**
 * Subscription & Membership Service (V6.1 Demo Mode)
 *
 * Manages plan tiers (FREE, PLUS, PRO), gating checks, 30-day simulated renewals,
 * expiration handling, and currency conversions.
 */

import { SUBSCRIPTION_PLANS, STORAGE_KEYS } from '../utils/constants.js';
import { createSubscription } from '../data/models.js';
import {
  getStoredSubscription,
  setStoredSubscription,
  getStoredCurrency,
  setStoredCurrency,
  getAuth,
} from '../data/storage.js';
import {
  normalizePlan,
  toCanonicalPlan,
  isProPlan,
  isPlusPlan,
  isFreePlan,
} from '../utils/planUtils.js';

export class SubscriptionService {
  /**
   * Retrieves the active subscription object.
   * Auto-initializes to FREE if not found, and checks for plan expiration.
   */
  getSubscription() {
    let sub = getStoredSubscription();

    if (!sub) {
      const currency = getStoredCurrency();
      sub = createSubscription({
        plan: 'free',
        currency,
        price: 0,
      });
      setStoredSubscription(sub);
      return sub;
    }

    // Always normalize plan property
    const normalizedPlan = normalizePlan(sub.plan);
    if (sub.plan !== normalizedPlan) {
      sub.plan = normalizedPlan;
    }

    // Check expiration if on a paid plan
    if (sub.plan !== 'free' && sub.endDate) {
      const now = new Date().getTime();
      const end = new Date(sub.endDate).getTime();

      if (now > end) {
        // Expired -> auto downgrade to FREE while preserving unexpired purchased credits
        sub = {
          ...sub,
          plan: 'free',
          status: 'expired',
          previousPlan: sub.plan,
          updatedAt: new Date().toISOString(),
        };
        setStoredSubscription(sub);
      }
    }

    return sub;
  }

  /**
   * Updates and saves the current subscription.
   */
  saveSubscription(sub) {
    const updated = {
      ...sub,
      plan: normalizePlan(sub?.plan),
      updatedAt: new Date().toISOString(),
    };
    setStoredSubscription(updated);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tf_subscription_changed', { detail: updated }));
    }
    return updated;
  }

  /**
   * Returns plan metadata for any given plan tier or current active plan.
   * @param {string} [planInput] - 'free' | 'plus' | 'pro'
   */
  getPlanDetails(planInput) {
    const planKey = toCanonicalPlan(planInput || this.getSubscription().plan);
    return SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.FREE;
  }

  /**
   * Returns current active plan metadata from SUBSCRIPTION_PLANS.
   */
  getCurrentPlanDetails() {
    return this.getPlanDetails();
  }

  isPro() {
    return isProPlan(this.getSubscription().plan);
  }

  isPlus() {
    return isPlusPlan(this.getSubscription().plan);
  }

  isFree() {
    return isFreePlan(this.getSubscription().plan);
  }

  /**
   * Returns active currency ('INR' | 'USD').
   */
  getCurrency() {
    return getStoredCurrency() || 'INR';
  }

  /**
   * Sets active currency globally.
   */
  setCurrency(curr) {
    const valid = curr === 'USD' ? 'USD' : 'INR';
    setStoredCurrency(valid);
    const sub = this.getSubscription();
    if (sub.currency !== valid) {
      sub.currency = valid;
      this.saveSubscription(sub);
    }
    return valid;
  }

  /**
   * Format price with appropriate currency symbol.
   */
  formatPrice(amount, currency = null) {
    const curr = currency || this.getCurrency();
    if (amount === 0) return curr === 'INR' ? '₹0' : '$0';
    if (curr === 'INR') {
      return '₹' + amount.toLocaleString('en-IN');
    }
    return '$' + Number(amount).toFixed(2);
  }

  /**
   * Gating check: Can user add another job source?
   */
  canAddSource(currentSourceCount = 0) {
    const plan = this.getCurrentPlanDetails();
    const limit = plan.limits.sources;
    const allowed = currentSourceCount < limit;
    return {
      allowed,
      limit,
      current: currentSourceCount,
      reason: allowed
        ? null
        : 'Your ' + plan.name + ' plan is limited to ' + limit + ' active job sources. Upgrade to Plus (5) or Pro (Unlimited) to connect more.',
      requiredPlan: plan.id === 'free' ? 'plus' : 'pro',
    };
  }

  /**
   * Gating check: Can user save another search alert?
   */
  canSaveSearch(currentSearchCount = 0) {
    const plan = this.getCurrentPlanDetails();
    const limit = plan.limits.savedSearches;
    const allowed = currentSearchCount < limit;
    return {
      allowed,
      limit,
      current: currentSearchCount,
      reason: allowed
        ? null
        : 'Your ' + plan.name + ' plan allows up to ' + limit + ' saved search alerts. Upgrade for more.',
      requiredPlan: plan.id === 'free' ? 'plus' : 'pro',
    };
  }

  /**
   * Gating check: Allowed preset theme IDs.
   * Free = 3 presets ('pink-beige', 'blue-white', 'purple-lavender')
   * Plus & Pro = all 6 presets
   */
  getAllowedThemePresetIds() {
    const plan = this.getCurrentPlanDetails();
    if (plan.id === 'free') {
      return ['pink-beige', 'blue-white', 'purple-lavender'];
    }
    return [
      'pink-beige',
      'blue-white',
      'purple-lavender',
      'green-cream',
      'warm-sunset',
      'black-gold',
    ];
  }

  /**
   * Gating check: Can user build/apply a Custom Theme?
   * Only PRO plan can build custom themes.
   */
  canUseCustomTheme() {
    const plan = this.getCurrentPlanDetails();
    return {
      allowed: !!plan.limits.customThemes,
      requiredPlan: 'pro',
      reason: plan.limits.customThemes
        ? null
        : 'Custom Color Theme Builder is a PRO exclusive. Upgrade to unlock full brand customization.',
    };
  }

  /**
   * Gating check: Can user access Autopilot & specific modes?
   * Manual = ALWAYS FREE / UNLOCKED across all plans (Free, Plus, Pro)
   * Approval = Requires Plus or Pro
   * Autopilot (Autonomous) = Requires Pro
   */
  canUseAutopilot(requestedMode = 'manual') {
    // Manual Mode is a core free feature - always unlocked!
    if (requestedMode === 'manual') {
      return { allowed: true, tier: 'manual' };
    }

    const plan = this.getCurrentPlanDetails();
    const tier = plan.limits.autopilotMode;

    if (tier === 'none') {
      return {
        allowed: false,
        tier: 'none',
        requiredPlan: 'plus',
        reason: 'Approval Mode requires Plus or Pro membership. Upgrade to automate proposal drafting.',
      };
    }

    if (tier === 'approval_only') {
      if (requestedMode === 'autopilot') {
        return {
          allowed: false,
          tier: 'approval_only',
          requiredPlan: 'pro',
          reason: 'Full Autonomous Mode requires a PRO membership. On PLUS, Autopilot operates safely in Approval Mode.',
        };
      }
      return { allowed: true, tier: 'approval_only' };
    }

    // Pro tier: full access
    return { allowed: true, tier: 'full' };
  }

  /**
   * Changes current plan (Simulated upgrade/downgrade).
   */
  changePlan(planId, currency = null, durationDays = 30) {
    const cleanPlan = normalizePlan(planId);
    const targetPlanKey = toCanonicalPlan(cleanPlan);
    const planConfig = SUBSCRIPTION_PLANS[targetPlanKey];
    if (!planConfig) throw new Error('Invalid plan: ' + planId);

    const curr = currency || this.getCurrency();
    const price = planConfig.prices[curr] || 0;
    const now = new Date();
    const endDate = cleanPlan === 'free' ? null : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const currentSub = this.getSubscription();
    const updatedSub = {
      ...currentSub,
      plan: cleanPlan,
      status: 'active',
      currency: curr,
      price,
      startDate: now.toISOString(),
      endDate,
      updatedAt: now.toISOString(),
    };

    const saved = this.saveSubscription(updatedSub);
    this.syncWithServer(saved).catch((err) => {
      console.warn('Subscription server sync warning:', err);
    });
    return saved;
  }

  /**
   * Synchronizes active subscription with the backend server.
   */
  async syncWithServer(sub) {
    if (typeof fetch === 'undefined') return sub;
    try {
      const auth = getAuth() || {};
      const token = auth.token;
      const userId = auth.userId || auth.phone || 'user-default';
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subscription: sub,
          userId,
          plan: sub.plan,
          currency: sub.currency,
          status: sub.status,
          price: sub.price,
          endDate: sub.endDate,
          isDemo: sub.isDemo ?? true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.subscription || sub;
      }
    } catch (e) {
      console.warn('Failed to sync subscription to backend:', e);
    }
    return sub;
  }

  /**
   * Fetches latest subscription state from backend if available.
   */
  async fetchServerSubscription() {
    if (typeof fetch === 'undefined') return this.getSubscription();
    try {
      const auth = getAuth() || {};
      const token = auth.token;
      const userId = auth.userId || auth.phone || 'user-default';
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/subscription?userId=${encodeURIComponent(userId)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.subscription && data.subscription.plan) {
          const current = this.getSubscription();
          if (normalizePlan(data.subscription.plan) !== current.plan) {
            const updated = {
              ...current,
              ...data.subscription,
              plan: normalizePlan(data.subscription.plan),
            };
            return this.saveSubscription(updated);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch subscription from backend:', e);
    }
    return this.getSubscription();
  }
}

export const subscriptionService = new SubscriptionService();

