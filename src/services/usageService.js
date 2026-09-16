/**
 * Application Quota & Usage Tracking Service (Rolling 8-Hour Window)
 *
 * Tracks included subscription quota (Free: 5, Plus: 15, Pro: 25) with automatic
 * rolling 8-hour refill windows, separate Bonus Application Tokens, and purchased top-up credits.
 */

import { SUBSCRIPTION_PLANS, CREDIT_PACKAGES } from '../utils/constants.js';
import { subscriptionService } from './subscriptionService.js';
import { createDailyUsage, createCreditItem } from '../data/models.js';
import {
  getStoredDailyUsage,
  setStoredDailyUsage,
  getStoredSubscription,
  setStoredSubscription,
  getStoredQuotaWindow,
  setStoredQuotaWindow,
  getCurrentUserId,
} from '../data/storage.js';
import { rewardService } from './rewardService.js';
import {
  APPLICATION_QUOTA_WINDOW_HOURS,
  APPLICATION_QUOTA_WINDOW_MS,
  FREE_APPLICATION_QUOTA,
  PLUS_APPLICATION_QUOTA,
  PRO_APPLICATION_QUOTA,
  PLAN_QUOTA_CONFIG,
  getPlanQuotaConfig,
  getApplicationsPerWindow,
  formatWindowCountdown,
} from '../utils/quotaConfig.js';
import { normalizePlan } from '../utils/planUtils.js';
import { apiClient } from './apiClient.js';

export class UsageService {
  /**
   * Returns current day string 'YYYY-MM-DD'.
   */
  getTodayDateString() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Retrieves or initializes the user's rolling 8-hour quota window.
   * Refills automatically every 8 hours with zero rollover.
   */
  getQuotaWindow() {
    const now = Date.now();
    let window = getStoredQuotaWindow();
    const currentPlan = normalizePlan(subscriptionService.getSubscription().plan);

    if (!window) {
      window = {
        plan: currentPlan,
        applicationsUsed: 0,
        windowStart: now,
        windowEnd: now + APPLICATION_QUOTA_WINDOW_MS,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      };
      setStoredQuotaWindow(window);
    } else {
      let changed = false;
      if (window.plan !== currentPlan) {
        window.plan = currentPlan;
        changed = true;
      }
      // Check if 8-hour window has expired -> automatic refill, no rollover
      if (now >= window.windowEnd) {
        window.applicationsUsed = 0;
        window.windowStart = now;
        window.windowEnd = now + APPLICATION_QUOTA_WINDOW_MS;
        changed = true;
      }
      if (changed) {
        window.updatedAt = new Date(now).toISOString();
        setStoredQuotaWindow(window);
      }
    }
    return window;
  }

  /**
   * Comprehensive quota status for active plan and rolling 8-hour window.
   */
  getQuotaStatus() {
    const sub = subscriptionService.getSubscription();
    const plan = normalizePlan(sub.plan);
    const planConfig = getPlanQuotaConfig(plan);
    const limit = planConfig.applicationsPerWindow;

    const window = this.getQuotaWindow();
    const used = window.applicationsUsed || 0;
    const remainingQuota = Math.max(0, limit - used);

    const now = Date.now();
    const refillInMs = Math.max(0, window.windowEnd - now);
    const refillFormatted = formatWindowCountdown(refillInMs);

    const bonusTokens = rewardService.getRewardCredits();
    const { activeCredits: purchasedCredits } = this.getCreditsSummary();
    const availableApplications = remainingQuota + bonusTokens + purchasedCredits;
    const isExhausted = remainingQuota === 0;

    return {
      plan,
      planConfig,
      limit,
      applicationsPerWindow: limit,
      dailyLimit: limit, // backward compatibility
      applicationsUsed: used,
      used,
      remainingQuota,
      remainingSubscriptionQuota: remainingQuota,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      refillInMs,
      refillAt: new Date(window.windowEnd).toISOString(),
      refillFormatted,
      windowHours: APPLICATION_QUOTA_WINDOW_HOURS,
      bonusTokens,
      rewardCredits: bonusTokens, // backward compatibility
      purchasedCredits,
      availableApplications,
      isExhausted,
      canApply: availableApplications > 0,
    };
  }

  /**
   * Retrieves today's usage tracker, automatically resetting counters on date rollover.
   */
  getTodayUsage() {
    const today = this.getTodayDateString();
    let usage = getStoredDailyUsage();

    if (!usage || usage.date !== today) {
      usage = createDailyUsage({
        date: today,
        applicationsUsed: 0,
        aiApplyUsed: 0,
        savedSearchesCreated: 0,
      });
      setStoredDailyUsage(usage);
    }

    return usage;
  }

  /**
   * Updates today's usage tracker.
   */
  saveTodayUsage(usage) {
    const updated = {
      ...usage,
      updatedAt: new Date().toISOString(),
    };
    setStoredDailyUsage(updated);
    return updated;
  }

  /**
   * Computes available purchased credits (excluding expired packages).
   */
  getCreditsSummary() {
    const sub = subscriptionService.getSubscription();
    const now = new Date().getTime();
    let activeCredits = 0;
    let expiredCredits = 0;

    const validPackages = [];
    const creditsList = sub.credits || [];

    for (const pkg of creditsList) {
      const isExpired = pkg.expiresAt && new Date(pkg.expiresAt).getTime() < now;
      if (isExpired) {
        expiredCredits += pkg.remaining || 0;
      } else {
        activeCredits += Math.max(0, pkg.remaining || 0);
        validPackages.push(pkg);
      }
    }

    return {
      activeCredits,
      expiredCredits,
      packages: creditsList,
      validPackages,
    };
  }

  /**
   * Computes available application balances across subscription quota, bonus tokens, and purchased credits.
   */
  getApplicationBalances() {
    const status = this.getQuotaStatus();
    return {
      dailyLimit: status.limit,
      limit: status.limit,
      applicationsPerWindow: status.limit,
      usedToday: status.used,
      applicationsUsed: status.used,
      remainingSubscriptionQuota: status.remainingQuota,
      remainingQuota: status.remainingQuota,
      bonusTokens: status.bonusTokens,
      rewardCredits: status.bonusTokens,
      purchasedCredits: status.purchasedCredits,
      availableApplications: status.availableApplications,
      refillInMs: status.refillInMs,
      refillAt: status.refillAt,
      refillFormatted: status.refillFormatted,
      windowHours: status.windowHours,
      isExhausted: status.isExhausted,
    };
  }

  /**
   * Checks if user can submit another job application.
   * Priority:
   * 1. 8-Hour Rolling Quota (Free=5, Plus=15, Pro=25)
   * 2. Bonus Application Tokens (streak rewards & referral bonuses)
   * 3. Purchased top-up credits stack
   */
  canApply() {
    const status = this.getQuotaStatus();

    // 1. Under included 8-hour quota
    if (status.remainingQuota > 0) {
      return {
        allowed: true,
        source: 'included_quota',
        used: status.used,
        limit: status.limit,
        remainingToday: status.remainingQuota,
        remainingQuota: status.remainingQuota,
        dailyLimit: status.limit,
        usedToday: status.used,
        rewardCredits: status.bonusTokens,
        bonusTokens: status.bonusTokens,
        creditsAvailable: status.purchasedCredits,
        availableApplications: status.availableApplications,
        refillFormatted: status.refillFormatted,
      };
    }

    // 2. Bonus Application Tokens available
    if (status.bonusTokens > 0) {
      return {
        allowed: true,
        source: 'bonus_tokens',
        used: status.used,
        limit: status.limit,
        remainingToday: 0,
        remainingQuota: 0,
        dailyLimit: status.limit,
        usedToday: status.used,
        rewardCredits: status.bonusTokens,
        bonusTokens: status.bonusTokens,
        creditsAvailable: status.purchasedCredits,
        availableApplications: status.availableApplications,
        refillFormatted: status.refillFormatted,
      };
    }

    // 3. Purchased credits available
    if (status.purchasedCredits > 0) {
      return {
        allowed: true,
        source: 'purchased_credits',
        used: status.used,
        limit: status.limit,
        remainingToday: 0,
        remainingQuota: 0,
        dailyLimit: status.limit,
        usedToday: status.used,
        rewardCredits: 0,
        bonusTokens: 0,
        creditsAvailable: status.purchasedCredits,
        availableApplications: status.availableApplications,
        refillFormatted: status.refillFormatted,
      };
    }

    // Completely exhausted
    const bonusMsg = status.bonusTokens > 0 ? ` Bonus tokens available: ${status.bonusTokens}.` : '';
    return {
      allowed: false,
      source: 'exhausted',
      used: status.used,
      limit: status.limit,
      remainingToday: 0,
      remainingQuota: 0,
      dailyLimit: status.limit,
      usedToday: status.used,
      rewardCredits: status.bonusTokens,
      bonusTokens: status.bonusTokens,
      creditsAvailable: 0,
      availableApplications: 0,
      refillFormatted: status.refillFormatted,
      reason: `Application quota exhausted. Next refill in ${status.refillFormatted}.${bonusMsg}`,
    };
  }

  /**
   * Consumes 1 application entitlement following strict priority:
   * 1. Normal 8-hour subscription quota first
   * 2. Bonus Application Tokens second
   * 3. Purchased top-up credits third
   */
  consumeApplication() {
    const check = this.canApply();
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const window = this.getQuotaWindow();
    const todayUsage = this.getTodayUsage();

    if (check.source === 'included_quota' || check.source === 'daily_quota') {
      window.applicationsUsed = (window.applicationsUsed || 0) + 1;
      window.updatedAt = new Date().toISOString();
      setStoredQuotaWindow(window);

      todayUsage.applicationsUsed = (todayUsage.applicationsUsed || 0) + 1;
      this.saveTodayUsage(todayUsage);

      const status = this.getQuotaStatus();
      return {
        consumedFrom: 'included_quota',
        used: window.applicationsUsed,
        remainingDaily: status.remainingQuota,
        remainingQuota: status.remainingQuota,
        bonusTokens: status.bonusTokens,
        rewardCredits: status.bonusTokens,
        creditsRemaining: status.purchasedCredits,
        availableApplications: status.availableApplications,
        refillFormatted: status.refillFormatted,
      };
    }

    if (check.source === 'bonus_tokens' || check.source === 'reward_credits') {
      const remainingBonus = rewardService.consumeRewardCredit();
      const status = this.getQuotaStatus();
      return {
        consumedFrom: 'bonus_tokens',
        used: window.applicationsUsed,
        remainingDaily: 0,
        remainingQuota: 0,
        bonusTokens: remainingBonus,
        rewardCredits: remainingBonus,
        creditsRemaining: status.purchasedCredits,
        availableApplications: status.availableApplications,
        refillFormatted: status.refillFormatted,
      };
    }

    // Consumed from purchased credits
    const sub = subscriptionService.getSubscription();
    const now = new Date().getTime();
    let deducted = false;

    // Deduct from earliest expiring valid package
    for (const pkg of sub.credits || []) {
      const isExpired = pkg.expiresAt && new Date(pkg.expiresAt).getTime() < now;
      if (!isExpired && (pkg.remaining || 0) > 0) {
        pkg.remaining -= 1;
        deducted = true;
        break;
      }
    }

    if (!deducted) {
      throw new Error('No active credits available to deduct.');
    }

    subscriptionService.saveSubscription(sub);
    const newSummary = this.getCreditsSummary();
    const status = this.getQuotaStatus();

    return {
      consumedFrom: 'purchased_credits',
      used: window.applicationsUsed,
      remainingDaily: 0,
      remainingQuota: 0,
      bonusTokens: status.bonusTokens,
      rewardCredits: status.bonusTokens,
      creditsRemaining: newSummary.activeCredits,
      availableApplications: status.availableApplications,
      refillFormatted: status.refillFormatted,
    };
  }

  /**
   * Checks if user can generate an AI application message today.
   */
  canUseAIApply() {
    const plan = subscriptionService.getCurrentPlanDetails();
    const dailyLimit = plan.limits.aiApplyPerDay;
    const usage = this.getTodayUsage();
    const usedToday = usage.aiApplyUsed || 0;

    const allowed = usedToday < dailyLimit;
    return {
      allowed,
      usedToday,
      dailyLimit,
      remainingToday: Math.max(0, dailyLimit - usedToday),
      reason: allowed
        ? null
        : 'Daily AI Apply limit of ' + dailyLimit + ' reached on your ' + plan.name + ' plan. Upgrade to Plus (10/day) or Pro (50/day) for more AI generations.',
    };
  }

  /**
   * Consumes 1 AI generation quota.
   */
  consumeAIApply() {
    const check = this.canUseAIApply();
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const usage = this.getTodayUsage();
    usage.aiApplyUsed = (usage.aiApplyUsed || 0) + 1;
    this.saveTodayUsage(usage);

    return {
      usedToday: usage.aiApplyUsed,
      remainingToday: check.dailyLimit - usage.aiApplyUsed,
    };
  }

  /**
   * Adds purchased credits to the user's stack.
   */
  addCredits(packageId) {
    const pkgConfig = CREDIT_PACKAGES.find((p) => p.id === packageId) || CREDIT_PACKAGES[0];
    const currency = subscriptionService.getCurrency();
    const price = pkgConfig.prices[currency] || 0;

    const newCreditItem = createCreditItem({
      packageId: pkgConfig.id,
      amount: pkgConfig.amount,
      remaining: pkgConfig.amount,
      price,
      currency,
      validityDays: pkgConfig.validityDays || 30,
    });

    const sub = subscriptionService.getSubscription();
    sub.credits = [...(sub.credits || []), newCreditItem];
    subscriptionService.saveSubscription(sub);

    return {
      package: pkgConfig,
      creditItem: newCreditItem,
      totalCredits: this.getCreditsSummary().activeCredits,
    };
  }

  /**
   * Synchronize quota and balances from backend server.
   */
  async syncQuotaWithServer() {
    try {
      const serverData = await apiClient.getQuotaStatus();
      if (serverData && serverData.success) {
        const window = this.getQuotaWindow();
        if (serverData.applicationsUsed !== undefined) {
          window.applicationsUsed = serverData.applicationsUsed;
        }
        if (serverData.refillInMs !== undefined) {
          window.windowEnd = Date.now() + serverData.refillInMs;
        }
        setStoredQuotaWindow(window);
        return serverData;
      }
    } catch {}
    return null;
  }
}

export const usageService = new UsageService();
