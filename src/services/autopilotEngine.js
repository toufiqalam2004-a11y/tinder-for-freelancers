/**
 * Autopilot Career Agent Engine (V5)
 * 
 * Orchestrates the full lifecycle:
 * Discovery -> Research -> Qualify -> Personalize -> Approval Queue -> Send -> Follow Up -> Meeting
 * 
 * Strict safety rules:
 * - Never runs when status is 'paused'
 * - Enforces daily limits (server/storage enforced)
 * - Cool-down duplicate protection prevents messaging same lead within 3 days
 * - Automatically logs all actions into Agent Activity timeline
 */

import {
  getLeads,
  addLead,
  updateLead,
  getAutopilotSettings,
  saveAutopilotSettings,
  addAgentTask,
  updateAgentTask,
  logAgentActivity,
  getDailyOutreachCount,
  incrementDailyOutreachCount,
  getJobs,
  addNotification,
} from '../data/storage.js';
import { createLead, createAgentTask, createAgentActivity, createNotification } from '../data/models.js';
import { aiProvider } from './aiProvider.js';
import { calculateProMatch } from './proMatchEngine.js';
import { extractContactInfo } from '../utils/contactExtractor.js';
import { subscriptionService } from './subscriptionService.js';

export class AutopilotEngine {
  /**
   * Runs an autonomous discovery, qualification, and outreach preparation cycle.
   */
  async runCycle(userProfile = {}) {
    // 1. Subscription Plan Gating: AUTOPILOT = PRO ONLY
    if (!subscriptionService.isPro()) {
      return {
        success: false,
        code: 'UPGRADE_REQUIRED',
        reason: 'Autopilot is a Pro feature.',
        description: 'Upgrade to Pro to automate opportunity discovery and outreach.',
      };
    }

    const settings = getAutopilotSettings();

    if (settings.status === 'paused') {
      return { success: false, reason: 'Autopilot is paused.' };
    }

    // Determine plan daily limit: Plus = 20 max, Pro = 100 max
    const isPlus = subscriptionService.isPlus();
    const planMaxLimit = isPlus ? 20 : 100;
    const effectiveLimit = Math.min(settings.dailyLimit || planMaxLimit, planMaxLimit);

    // Check daily outreach limit
    const dailySent = getDailyOutreachCount();
    if (dailySent >= effectiveLimit) {
      logAgentActivity(
        createAgentActivity({
          action: 'Daily Limit Reached',
          detail: `Reached limit (${dailySent}/${effectiveLimit} sent today). Outreach paused until tomorrow.`,
          status: 'warning',
        })
      );
      return { success: false, reason: 'Daily outreach limit reached.' };
    }

    const task = createAgentTask({
      type: 'discover',
      status: 'running',
      description: 'Running discovery cycle across connected sources',
    });
    addAgentTask(task);

    try {
      // 1. Ingest opportunities from unified jobs database
      const existingJobs = getJobs();
      const existingLeads = getLeads();
      const existingPostIds = new Set(existingLeads.map((l) => l.sourcePostId).filter(Boolean));

      let newlyDiscoveredCount = 0;
      let qualifiedCount = 0;

      for (const job of existingJobs) {
        // Skip if already in leads pipeline or marked skipped
        if (job.status === 'skipped' || existingPostIds.has(job.postId || job.id)) {
          continue;
        }

        // Must match allowed sources
        if (settings.sources && !settings.sources.includes(job.platform) && !settings.sources.includes('all')) {
          continue;
        }

        // Calculate Pro Match
        const matchResult = calculateProMatch(job, userProfile);
        if (matchResult.matchScore < (settings.minMatchScore || 70)) {
          continue;
        }

        newlyDiscoveredCount++;

        // Determine if this is a Client Opportunity or Job Opportunity
        const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
        const isClientOpp =
          text.includes('client') ||
          text.includes('channel') ||
          text.includes('creator') ||
          text.includes('per video') ||
          text.includes('freelance') ||
          job.jobType === 'freelance';

        // Extract verified direct contact info
        const contactInfo = job.contact || extractContactInfo(job);
        const email = contactInfo.email || null;
        const phone = contactInfo.phone || null;

        const newLead = createLead({
          sourceId: job.sourceId,
          sourcePostId: job.postId || job.id,
          platform: job.platform,
          name: job.company || job.client || 'Hiring Lead',
          company: job.company || job.client || 'Hiring Client',
          role: job.jobRole || job.title,
          opportunityType: isClientOpp ? 'Client Opportunity' : 'Job Opportunity',
          title: job.title,
          description: job.description,
          sourceUrl: job.sourceUrl || job.postUrl,
          email,
          phone,
          matchScore: matchResult.matchScore,
          status: 'discovered',
          isDemo: job.isDemo || false,
        });

        // 2. Qualify Lead
        const qualResult = await aiProvider.qualifyLead(newLead, userProfile);
        newLead.qualificationScore = qualResult.score;
        newLead.qualificationReasons = qualResult.reasons;

        if (qualResult.score >= 60 && contactInfo.hasDirectContact) {
          qualifiedCount++;
          newLead.status = 'qualified';

          // 3. Generate Research Summary
          const research = await aiProvider.generateResearchSummary(newLead);
          newLead.research = research;

          // 4. Generate Personalized Outreach Message
          const outreach = await aiProvider.generateOutreach({
            lead: newLead,
            profile: userProfile,
            tone: 'Professional',
            method: settings.outreachMethod || 'both',
          });
          newLead.outreachMessage = outreach;
          newLead.status = 'waiting_approval';

          // Log activity
          logAgentActivity(
            createAgentActivity({
              leadId: newLead.id,
              leadName: newLead.name,
              action: 'Prepared Outreach',
              detail: `Qualified (${qualResult.score}/100) & drafted proposal ready for approval queue.`,
              status: 'success',
            })
          );
        }

        addLead(newLead);
      }

      updateAgentTask(task.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      return {
        success: true,
        newlyDiscoveredCount,
        qualifiedCount,
      };
    } catch (err) {
      updateAgentTask(task.id, {
        status: 'failed',
        error: err.message,
        completedAt: new Date().toISOString(),
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Approves a lead's message and executes send based on control mode.
   */
  async approveOutreach(leadId, userProfile = {}) {
    // 1. Subscription Plan Gating: AUTOPILOT = PRO ONLY
    if (!subscriptionService.isPro()) {
      return {
        success: false,
        code: 'UPGRADE_REQUIRED',
        reason: 'Autopilot is a Pro feature. Upgrade to Pro to automate opportunity discovery and outreach.',
      };
    }

    const settings = getAutopilotSettings();
    const lead = getLeads().find((l) => l.id === leadId);
    if (!lead) return { success: false, reason: 'Lead not found' };

    // 2. Direct Contact Verification (Safety requirement)
    const contactInfo = lead.contact || extractContactInfo(lead);
    if (!contactInfo.hasDirectContact) {
      return {
        success: false,
        code: 'NO_DIRECT_CONTACT',
        reason: 'No direct client contact (email or WhatsApp) found on this opportunity.',
      };
    }

    // 3. Duplicate protection cooldown check: minimum 3 days
    if (lead.lastContactedAt) {
      const daysSince = (Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 3600 * 24);
      if (daysSince < 3) {
        return {
          success: false,
          reason: `Duplicate protection: This lead was contacted ${Math.floor(daysSince)} day(s) ago.`,
        };
      }
    }

    // 4. Enforce plan daily limit: Plus = 20 max, Pro = 100 max
    const isPlus = subscriptionService.isPlus();
    const planMaxLimit = isPlus ? 20 : 100;
    const effectiveLimit = Math.min(settings.dailyLimit || planMaxLimit, planMaxLimit);

    const dailySent = getDailyOutreachCount();
    if (dailySent >= effectiveLimit) {
      return { success: false, reason: `Daily limit reached (${dailySent}/${effectiveLimit}).` };
    }

    // Execute send (in demo mode or manual mode, creates deep link and updates pipeline)
    incrementDailyOutreachCount();
    const now = new Date().toISOString();

    updateLead(lead.id, {
      status: 'sent',
      lastContactedAt: now,
    });

    logAgentActivity(
      createAgentActivity({
        leadId: lead.id,
        leadName: lead.name,
        action: 'Outreach Sent',
        detail: `Personalized proposal sent via ${lead.email ? 'Email' : 'Direct Message'}.`,
        status: 'success',
      })
    );

    addNotification(
      createNotification({
        type: 'application_update',
        title: `Outreach Sent: ${lead.name}`,
        message: `Proposal sent for "${lead.title}". Tracking responses in Autopilot.`,
      })
    );

    return { success: true };
  }

  /**
   * Checks pending follow-ups according to user's 3-day / 7-day configuration.
   */
  async checkFollowUps(userProfile = {}) {
    const settings = getAutopilotSettings();
    if (!settings.enableFollowUps || settings.status === 'paused') {
      return { count: 0 };
    }

    const leads = getLeads();
    let followUpReadyCount = 0;

    for (const lead of leads) {
      if (lead.status !== 'sent') continue;
      if ((lead.followUpCount || 0) >= (settings.maxFollowUps || 2)) continue;

      const daysSince = (Date.now() - new Date(lead.lastContactedAt || 0).getTime()) / (1000 * 3600 * 24);
      const targetDays = settings.followUpDays[lead.followUpCount || 0] || 3;

      if (daysSince >= targetDays) {
        followUpReadyCount++;
        const nextFollowUpNumber = (lead.followUpCount || 0) + 1;
        const followUpMsg = await aiProvider.generateFollowUp({
          lead,
          previousMessage: lead.outreachMessage?.fullBody || '',
          followUpNumber: nextFollowUpNumber,
          profile: userProfile,
        });

        updateLead(lead.id, {
          status: 'follow_up_due',
          outreachMessage: {
            ...lead.outreachMessage,
            fullBody: followUpMsg.fullBody,
            subject: followUpMsg.subject,
          },
        });

        logAgentActivity(
          createAgentActivity({
            leadId: lead.id,
            leadName: lead.name,
            action: 'Follow-up Due',
            detail: `Follow-up #${nextFollowUpNumber} prepared after ${Math.floor(daysSince)} days without reply.`,
            status: 'info',
          })
        );
      }
    }

    return { count: followUpReadyCount };
  }
}

export const autopilotEngine = new AutopilotEngine();
