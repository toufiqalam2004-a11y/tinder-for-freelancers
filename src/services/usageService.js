/**
 * Daily Usage & Credits Tracking Service (V6.1 Demo Mode)
 *
 * Tracks daily applications & AI generation quotas with automatic midnight rollover,
 * and maintains purchased credit balance stacking.
 */

import { SUBSCRIPTION_PLANS, CREDIT_PACKAGES } from '../utils/constants.js';
import { subscriptionService } from './subscriptionService.js';
import { createDailyUsage, createCreditItem } from '../data/models.js';
import {
  getStoredDailyUsage,
  setStoredDailyUsage,
  getStoredSubscription,
  setStoredSubscription,
} from '../data/storage.js';
import { rewardService } from './rewardService.js';

export class UsageService {
  /**
   * Returns current day string 'YYYY-MM-DD'.
   */
  getTodayDateString() {
    return new Date().toISOString().slice(0, 10);
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
   * Computes available application balances across subscription quota, reward credits, and purchased credits.
   */
  getApplicationBalances() {
    const plan = subscriptionService.getCurrentPlanDetails();
    const dailyLimit = plan.limits.applicationsPerDay;
    const usage = this.getTodayUsage();
    const usedToday = usage.applicationsUsed || 0;
    const remainingQuota = Math.max(0, dailyLimit - usedToday);
    const rewardCredits = rewardService.getRewardCredits();
    const { activeCredits: purchasedCredits } = this.getCreditsSummary();

    return {
      dailyLimit,
      usedToday,
      remainingSubscriptionQuota: remainingQuota,
      rewardCredits,
      purchasedCredits,
      availableApplications: remainingQuota + rewardCredits + purchasedCredits,
    };
  }

  /**
   * Checks if user can submit another job application today.
   * Priority:
   * 1. Daily plan quota (Free=5, Plus=20, Pro=100)
   * 2. Reward credits (from daily login & referral bonus)
   * 3. Purchased top-up credits stack
   */
  canApply() {
    const plan = subscriptionService.getCurrentPlanDetails();
    const balances = this.getApplicationBalances();

    // 1. Under daily subscription quota
    if (balances.remainingSubscriptionQuota > 0) {
      return {
        allowed: true,
        source: 'daily_quota',
        usedToday: balances.usedToday,
        dailyLimit: balances.dailyLimit,
        remainingToday: balances.remainingSubscriptionQuota,
        rewardCredits: balances.rewardCredits,
        creditsAvailable: balances.purchasedCredits,
        availableApplications: balances.availableApplications,
      };
    }

    // 2. Reward credits available
    if (balances.rewardCredits > 0) {
      return {
        allowed: true,
        source: 'reward_credits',
        usedToday: balances.usedToday,
        dailyLimit: balances.dailyLimit,
        remainingToday: 0,
        rewardCredits: balances.rewardCredits,
        creditsAvailable: balances.purchasedCredits,
        availableApplications: balances.availableApplications,
      };
    }

    // 3. Purchased credits available
    if (balances.purchasedCredits > 0) {
      return {
        allowed: true,
        source: 'purchased_credits',
        usedToday: balances.usedToday,
        dailyLimit: balances.dailyLimit,
        remainingToday: 0,
        rewardCredits: 0,
        creditsAvailable: balances.purchasedCredits,
        availableApplications: balances.availableApplications,
      };
    }

    // Completely exhausted
    return {
      allowed: false,
      source: 'exhausted',
      usedToday: balances.usedToday,
      dailyLimit: balances.dailyLimit,
      remainingToday: 0,
      rewardCredits: 0,
      creditsAvailable: 0,
      availableApplications: 0,
      reason: 'You have reached your daily limit of ' + balances.dailyLimit + ' applications on the ' + plan.name + ' plan. Upgrade to Plus/Pro, earn daily/referral rewards, or buy a top-up credit pack to keep applying.',
    };
  }

  /**
   * Consumes 1 application quota.
   * Consumption order:
   * 1. Normal subscription quota first
   * 2. Reward credits second
   * 3. Purchased top-up credits third
   */
  consumeApplication() {
    const check = this.canApply();
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const usage = this.getTodayUsage();

    if (check.source === 'daily_quota') {
      usage.applicationsUsed = (usage.applicationsUsed || 0) + 1;
      this.saveTodayUsage(usage);
      return {
        consumedFrom: 'daily_quota',
        usedToday: usage.applicationsUsed,
        remainingDaily: check.dailyLimit - usage.applicationsUsed,
        rewardCredits: check.rewardCredits,
        creditsRemaining: check.creditsAvailable,
        availableApplications: Math.max(0, check.availableApplications - 1),
      };
    }

    if (check.source === 'reward_credits') {
      const remainingRewardCredits = rewardService.consumeRewardCredit();
      return {
        consumedFrom: 'reward_credits',
        usedToday: usage.applicationsUsed,
        remainingDaily: 0,
        rewardCredits: remainingRewardCredits,
        creditsRemaining: check.creditsAvailable,
        availableApplications: Math.max(0, check.availableApplications - 1),
      };
    }

    // Consumed from purchased credits
    const sub = subscriptionService.getSubscription();
    const now = new Date().getTime();
    let deducted = false;

    // Deduct from the earliest expiring valid package
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

    return {
      consumedFrom: 'purchased_credits',
      usedToday: usage.applicationsUsed,
      remainingDaily: 0,
      rewardCredits: check.rewardCredits,
      creditsRemaining: newSummary.activeCredits,
      availableApplications: Math.max(0, check.availableApplications - 1),
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
}

export const usageService = new UsageService();
