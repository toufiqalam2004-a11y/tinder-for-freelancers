/**
 * Feature Access & Premium Control Service (V5)
 * Controls access to Autopilot, Automated Follow-Ups, Advanced Research, and AI Reply Assistant.
 * Designed so Autopilot can later become a monetized premium tier.
 * For local development and demo testing, all features are enabled.
 */

import { subscriptionService } from './subscriptionService.js';
import { isProPlan, isPlusPlan } from '../utils/planUtils.js';

export class FeatureAccessService {
  isProEnabled() {
    const sub = subscriptionService.getSubscription();
    return isProPlan(sub?.plan);
  }

  isPlusEnabled() {
    const sub = subscriptionService.getSubscription();
    return isPlusPlan(sub?.plan);
  }

  canUseAutopilot(mode = 'manual') {
    return subscriptionService.canUseAutopilot(mode).allowed;
  }

  canUseControlMode(mode = 'manual') {
    return subscriptionService.canUseAutopilot(mode);
  }

  canUseAutoFollowUps() {
    const plan = subscriptionService.getCurrentPlanDetails();
    return !!plan.limits.followUps;
  }

  canUseAdvancedResearch() {
    const plan = subscriptionService.getCurrentPlanDetails();
    return !!plan.limits.leadFinding;
  }

  canUseReplyAssistant() {
    const plan = subscriptionService.getCurrentPlanDetails();
    return !!plan.limits.aiReplies;
  }
}

export const featureAccess = new FeatureAccessService();
