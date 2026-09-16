/**
 * Subscription & Membership Service (V6.1 Demo Mode)
 *
 * Manages plan tiers (FREE, PLUS, PRO), gating checks, 30-day simulated renewals,
 * expiration handling, and currency conversions.
 */

import { SUBSCRIPTION_PLANS, STORAGE_KEYS } from '../utils/constants.js';
import { createSubscription } from '../data/models.js';
import { getApiUrl } from '../config/apiConfig.js';
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
import { getCustomSourceLimit } from '../utils/sourceConfig.js';

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

    // Check expiration or scheduled period end if on a paid plan
    if (sub.plan !== 'free' && (sub.endDate || sub.currentPeriodEnd)) {
      const now = new Date().getTime();
      const periodEnd = sub.currentPeriodEnd || sub.endDate;
      const end = new Date(periodEnd).getTime();

      if (now >= end) {
        // Period ended -> transition to scheduledPlan (or 'free')
        const targetPlan = sub.scheduledPlan ? normalizePlan(sub.scheduledPlan) : 'free';
        sub = {
          ...sub,
          plan: targetPlan,
          status: 'active',
          cancelAtPeriodEnd: false,
          scheduledPlan: null,
          previousPlan: sub.plan,
          endDate: targetPlan === 'free' ? null : sub.endDate,
          currentPeriodEnd: targetPlan === 'free' ? null : sub.currentPeriodEnd,
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
   * Gating check: Can user add another custom job source?
   * Built-in developer sources do NOT count against these limits.
   * Limits: Free = 1, Plus = 3, Pro = 5.
   */
  canAddSource(currentCustomSourceCount = 0) {
    const plan = this.getCurrentPlanDetails();
    const planKey = toCanonicalPlan(plan.id);
    const limit = getCustomSourceLimit(planKey);
    const allowed = currentCustomSourceCount < limit;
    
    let reason = null;
    let requiredPlan = null;
    if (!allowed) {
      if (planKey === 'free') {
        reason = `Your Free plan is limited to ${limit} custom source. Upgrade to Plus (3) or Pro (5) to connect more.`;
        requiredPlan = 'plus';
      } else if (planKey === 'plus') {
        reason = `Your Plus plan is limited to ${limit} custom sources. Upgrade to Pro (5) to connect more.`;
        requiredPlan = 'pro';
      } else {
        reason = `You have reached the maximum limit of ${limit} custom sources for Pro.`;
        requiredPlan = null;
      }
    }

    return {
      allowed,
      limit,
      current: currentCustomSourceCount,
      reason,
      requiredPlan,
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
  canUseAutopilot(requestedMode = null) {
    const plan = this.getCurrentPlanDetails();
    const isFree = isFreePlan(plan.id);
    const isPlus = normalizePlan(plan.id) === 'plus';
    const isPro = isProPlan(plan.id);

    // Manual mode is always allowed across all plans
    if (requestedMode === 'manual') {
      return { allowed: true, tier: 'manual' };
    }

    // Approval mode is unlocked on Plus and Pro (locked on Free)
    if (requestedMode === 'approval') {
      if (isFree) {
        return {
          allowed: false,
          tier: 'none',
          requiredPlan: 'plus',
          badge: 'AVAILABLE ON PLUS & PRO',
          reason: 'Approval Mode requires a Plus or Pro subscription.',
        };
      }
      return {
        allowed: true,
        tier: isPro ? 'full' : 'approval',
        badge: isPro ? 'PRO • FULL ACCESS' : 'PLUS • UNLOCKED',
      };
    }

    // AUTOPILOT = PRO ONLY
    if (!isPro) {
      return {
        allowed: false,
        tier: 'none',
        requiredPlan: 'pro',
        badge: 'PRO FEATURE',
        reason: 'Autopilot is a Pro feature. Upgrade to Pro to automate opportunity discovery and outreach.',
      };
    }

    // Pro tier: full access
    return {
      allowed: true,
      tier: 'full',
      badge: 'PRO • FULL ACCESS',
      dailyLimit: 100,
    };
  }

  /**
   * Schedules a downgrade to free (or lower plan) at currentPeriodEnd.
   * Keeps current plan active with all entitlements.
   */
  scheduleDowngrade(targetPlan = 'free') {
    const currentSub = this.getSubscription();
    if (normalizePlan(currentSub.plan) === 'free') {
      return currentSub;
    }
    const now = new Date();
    const periodEnd = currentSub.currentPeriodEnd || currentSub.endDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const updatedSub = {
      ...currentSub,
      cancelAtPeriodEnd: true,
      scheduledPlan: normalizePlan(targetPlan),
      endDate: periodEnd,
      currentPeriodEnd: periodEnd,
      updatedAt: now.toISOString(),
    };

    const saved = this.saveSubscription(updatedSub);
    this.syncWithServer(saved).catch((err) => {
      console.warn('Subscription server sync warning:', err);
    });
    return saved;
  }

  /**
   * Cancels a scheduled downgrade, retaining active paid tier.
   */
  cancelDowngrade() {
    const currentSub = this.getSubscription();
    const now = new Date();
    const updatedSub = {
      ...currentSub,
      cancelAtPeriodEnd: false,
      scheduledPlan: null,
      updatedAt: now.toISOString(),
    };

    const saved = this.saveSubscription(updatedSub);
    this.syncWithServer(saved).catch((err) => {
      console.warn('Subscription server sync warning:', err);
    });
    return saved;
  }

  /**
   * Simulates reaching the end of the billing period for testing / demo.
   */
  simulatePeriodEnd() {
    const currentSub = this.getSubscription();
    const now = new Date();
    const pastDate = new Date(now.getTime() - 1000).toISOString();
    const updatedSub = {
      ...currentSub,
      endDate: pastDate,
      currentPeriodEnd: pastDate,
      updatedAt: now.toISOString(),
    };
    this.saveSubscription(updatedSub);
    return this.getSubscription();
  }

  /**
   * Changes current plan (Simulated upgrade/downgrade).
   * If user is on a paid plan and requests 'free', schedules downgrade unless immediate=true.
   */
  changePlan(planId, currency = null, durationDays = 30, { immediate = false } = {}) {
    const cleanPlan = normalizePlan(planId);
    const currentSub = this.getSubscription();

    // If user is currently paid and downgrades to free, schedule downgrade unless immediate
    if (cleanPlan === 'free' && normalizePlan(currentSub.plan) !== 'free' && !immediate) {
      return this.scheduleDowngrade('free');
    }

    const targetPlanKey = toCanonicalPlan(cleanPlan);
    const planConfig = SUBSCRIPTION_PLANS[targetPlanKey];
    if (!planConfig) throw new Error('Invalid plan: ' + planId);

    const curr = currency || this.getCurrency();
    const price = planConfig.prices[curr] || 0;
    const now = new Date();
    const endDate = cleanPlan === 'free' ? null : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const updatedSub = {
      ...currentSub,
      plan: cleanPlan,
      status: 'active',
      cancelAtPeriodEnd: false,
      scheduledPlan: null,
      currency: curr,
      price,
      startDate: now.toISOString(),
      endDate,
      currentPeriodEnd: endDate,
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
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return sub;
    try {
      const auth = getAuth() || {};
      const token = auth.token;
      const userId = auth.userId || auth.phone || 'user-default';
      const phone = auth.phone || null;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;
      if (phone) headers['x-phone'] = phone;

      const res = await fetch(getApiUrl('/subscription'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subscription: sub,
          userId,
          phone,
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
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return this.getSubscription();
    try {
      const auth = getAuth() || {};
      const token = auth.token;
      const userId = auth.userId || auth.phone || 'user-default';
      const phone = auth.phone || '';
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;
      if (phone) headers['x-phone'] = phone;

      const queryUrl = getApiUrl(`/subscription?userId=${encodeURIComponent(userId)}${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`);
      const res = await fetch(queryUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.subscription && data.subscription.plan) {
          const current = this.getSubscription();
          const serverPlan = normalizePlan(data.subscription.plan);
          const currentPlan = normalizePlan(current.plan);
          const subBelongsToCurrentUser =
            !current.userId ||
            current.userId === userId ||
            (phone && current.phone === phone) ||
            current.userId === 'user-default';

          if (serverPlan !== currentPlan || !subBelongsToCurrentUser) {
            const updated = {
              ...current,
              ...data.subscription,
              plan: serverPlan,
              userId,
              phone: phone || data.subscription.phone || null,
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

