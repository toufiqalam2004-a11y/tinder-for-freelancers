/**
 * Outreach Service
 * Coordinates automated application dispatch for PRO users.
 * Generates personalized AI applications and routes to Email or WhatsApp adapters.
 * Never fakes delivery when adapters lack real API configuration.
 * Fully idempotent and enforces PRO gating and quota limits.
 */

import { emailAdapter } from './emailAdapter.js';
import { whatsAppAdapter } from './whatsAppAdapter.js';
import { demoAdapter } from './demoAdapter.js';
import { aiService } from '../aiService.js';
import { featureAccess } from '../featureAccessService.js';
import { calculateProMatch } from '../proMatchEngine.js';
import { usageService } from '../usageService.js';
import { isJobAppliedByUser, getApplicationByJobId, getAuth, addApplication } from '../../data/storage.js';
import { createApplication } from '../../data/models.js';
import { extractContactInfo } from '../../utils/contactExtractor.js';
import { subscriptionService } from '../subscriptionService.js';

export class OutreachService {
  /**
   * Checks if real transactional providers or demo outreach are configured.
   */
  async getOutreachStatus() {
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/outreach/status').catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          return {
            emailConfigured: !!data.emailConfigured,
            whatsAppConfigured: !!data.whatsAppConfigured,
            demoOutreachEnabled: !!data.demoOutreachEnabled,
            hasAnyProvider: !!data.hasAnyProvider,
          };
        }
      }
    } catch {
      // ignore fetch errors and fall back to local checks
    }

    await Promise.all([
      emailAdapter.checkConfiguration().catch(() => {}),
      whatsAppAdapter.checkConfiguration().catch(() => {}),
    ]);

    const demoOutreachEnabled = typeof process !== 'undefined'
      ? (process.env?.ENABLE_DEMO_OUTREACH !== 'false')
      : true;

    return {
      emailConfigured: emailAdapter.isConfigured(),
      whatsAppConfigured: whatsAppAdapter.isConfigured(),
      demoOutreachEnabled,
      hasAnyProvider: emailAdapter.isConfigured() || whatsAppAdapter.isConfigured() || demoOutreachEnabled,
    };
  }

  /**
   * Resolves the best outreach channel given client contact info and user preference.
   * @param {Object} contactInfo - { email, phone, hasEmail, hasPhone }
   * @param {string} preference - 'both' | 'email' | 'whatsapp'
   */
  resolveOutreachChannel(contactInfo = {}, preference = 'both') {
    const hasEmail = !!(contactInfo.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.email.trim()));
    const hasPhone = !!(contactInfo.phone && String(contactInfo.phone).replace(/\D/g, '').length >= 8);

    if (hasEmail && hasPhone) {
      if (preference === 'email') return { channel: 'email', email: contactInfo.email.trim(), phone: null };
      if (preference === 'whatsapp') return { channel: 'whatsapp', email: null, phone: contactInfo.phone };
      return { channel: 'both', email: contactInfo.email.trim(), phone: contactInfo.phone };
    }

    if (hasEmail) {
      return { channel: 'email', email: contactInfo.email.trim(), phone: null };
    }

    if (hasPhone) {
      return { channel: 'whatsapp', email: null, phone: contactInfo.phone };
    }

    return { channel: 'none', email: null, phone: null };
  }

  /**
   * Executes automated outreach for a job.
   * STRICT RULES:
   * 1. PRO users only.
   * 2. Idempotent: rejects duplicates.
   * 3. Profile/Job match qualification: rejects non-matching opportunities.
   * 4. Adapters must NOT fake sending if unconfigured.
   * 5. Never marks applied or removes card if unconfigured or failed.
   */
  async executeAutoOutreach({ job, profile, preferences = {}, isAutopilot = false }) {
    // 1. PRO Membership Gating
    if (!featureAccess.isProEnabled()) {
      return {
        success: false,
        code: 'PRO_REQUIRED',
        status: 'NOT_AUTHORIZED',
        error: 'Quick Apply / Auto Outreach is available exclusively for PRO members.',
      };
    }

    // 2. Validate job exists and is active
    if (!job || !job.id) {
      return {
        success: false,
        code: 'INVALID_JOB',
        error: 'No valid job provided for auto outreach.',
      };
    }

    if (job.status === 'closed') {
      return {
        success: false,
        code: 'JOB_CLOSED',
        error: 'This opportunity is no longer active.',
      };
    }

    // 3. Idempotency Check: prevent duplicate application
    const auth = getAuth() || {};
    const currentUserId = auth.phone || auth.userId || profile?.id || 'user-default';

    if (isJobAppliedByUser(job.id, currentUserId)) {
      return {
        success: false,
        code: 'DUPLICATE',
        status: 'DUPLICATE',
        error: 'You already applied to this opportunity.',
      };
    }

    const existingApp = getApplicationByJobId(job.id);
    if (existingApp && existingApp.status && existingApp.status !== 'draft' && existingApp.status !== 'saved') {
      return {
        success: false,
        code: 'DUPLICATE',
        status: 'DUPLICATE',
        error: 'You already applied to this opportunity.',
      };
    }

    // 4. Daily quota check
    const quotaCheck = usageService.canApply();
    if (!quotaCheck.allowed) {
      return {
        success: false,
        code: 'RATE_LIMIT',
        status: 'RATE_LIMIT',
        error: quotaCheck.reason || 'Daily application limit reached.',
      };
    }

    // 5. Match Score & Qualification Check
    const matchResult = calculateProMatch(job, profile || {});
    const minScore = Number(profile?.userPreferences?.minMatchScore) || 70;
    const matchScore = matchResult?.matchScore || job.matchScore || 50;

    if (matchScore < minScore) {
      return {
        success: false,
        code: 'NOT_QUALIFIED',
        status: 'NOT_QUALIFIED',
        matchScore,
        error: "This opportunity doesn't match your profile.",
      };
    }

    // 6. Contact Information Check
    const contactInfo = job.contact || extractContactInfo(job);
    const email = contactInfo.email || job.contactEmail || job.email;
    const phone = contactInfo.phone || job.contactPhone || job.phone;

    const userPreference = preferences.contactPreference || profile?.outreachPreferences?.contactPreference || 'both';
    const resolved = this.resolveOutreachChannel({ email, phone }, userPreference);

    if (resolved.channel === 'none') {
      return {
        success: false,
        code: 'NO_DIRECT_CONTACT',
        status: 'NO_DIRECT_CONTACT',
        channel: 'none',
        matchScore,
        requiresManual: true,
        error: 'No valid client email or WhatsApp number found.',
      };
    }

    // 7. Personalized Application Message Generation
    let proposalMessage = '';
    try {
      const aiResult = await aiService.generateApplicationMessage({
        job,
        profile,
        tone: 'Professional',
        length: 'Medium',
        cvAttached: preferences.autoIncludeCv ?? true,
        portfolioIncluded: preferences.autoIncludePortfolio ?? true,
      });
      proposalMessage = aiResult?.message || '';
    } catch {
      // Deterministic fallback
    }

    if (!proposalMessage) {
      const candidateName = profile?.name || 'Candidate';
      const role = profile?.primaryRole || profile?.profession || 'Freelancer';
      const skills = (profile?.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean).slice(0, 3).join(', ');
      proposalMessage = `Hi ${job.company || 'Hiring Team'},\n\nI am writing to express my interest in the "${job.title || 'role'}". With my background as a ${role}${skills ? ` and skills in ${skills}` : ''}, I am confident in delivering high quality work for this opportunity.\n\nBest regards,\n${candidateName}`;
    }

    // 8. Dispatch via Backend API (Server-side validation & credentials)
    const headers = { 'Content-Type': 'application/json' };
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
    if (currentUserId) headers['x-user-id'] = currentUserId;

    try {
      const res = await fetch('/api/outreach/quick-apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          job: {
            ...job,
            matchScore,
          },
          profile,
          preferences: {
            ...preferences,
            quickApplyEnabled: true,
            contactPreference: userPreference,
          },
          subscription: subscriptionService.getSubscription(),
          isAutopilot,
          userId: currentUserId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          ...data,
          matchScore,
          message: data.message || proposalMessage,
          resolvedChannel: resolved.channel,
          recipient: data.recipient || resolved.email || resolved.phone,
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          code: errData.code || 'API_ERROR',
          status: errData.status || 'FAILED',
          matchScore,
          message: proposalMessage,
          resolvedChannel: resolved.channel,
          error: errData.error || `Server returned status ${res.status}`,
        };
      }
    } catch (networkErr) {
      // Offline fallback: Check adapters locally without faking delivery
      await this.getOutreachStatus();

      let localConfigured = false;
      if (resolved.channel === 'email') localConfigured = emailAdapter.isConfigured();
      else if (resolved.channel === 'whatsapp') localConfigured = whatsAppAdapter.isConfigured();
      else if (resolved.channel === 'both') localConfigured = emailAdapter.isConfigured() || whatsAppAdapter.isConfigured();

      if (!localConfigured) {
        const currentStatus = await this.getOutreachStatus();
        if (currentStatus.demoOutreachEnabled) {
          const demoResult = await demoAdapter.send({
            to: resolved.email || resolved.phone,
            channel: resolved.channel,
            message: proposalMessage,
            job,
            profile,
          });
          return {
            ...demoResult,
            matchScore,
            message: proposalMessage,
            resolvedChannel: resolved.channel,
            recipient: resolved.email || resolved.phone,
          };
        }

        return {
          success: false,
          code: 'NOT_CONFIGURED',
          status: 'NOT_CONFIGURED',
          configured: false,
          matchScore,
          message: proposalMessage,
          resolvedChannel: resolved.channel,
          recipient: resolved.email || resolved.phone,
          error: 'Application prepared, but email/WhatsApp delivery is not configured yet.',
        };
      }

      // If configured locally
      let sendResult = { success: false, channel: resolved.channel };
      if (resolved.channel === 'email') {
        sendResult = await emailAdapter.send({ to: resolved.email, subject: `Application: ${job.title}`, body: proposalMessage, profile, job });
      } else if (resolved.channel === 'whatsapp') {
        const waText = aiService.generateWhatsAppMessage(job, profile, proposalMessage);
        sendResult = await whatsAppAdapter.send({ to: resolved.phone, message: waText, profile, job });
      }

      return {
        ...sendResult,
        matchScore,
        message: proposalMessage,
        resolvedChannel: resolved.channel,
        recipient: resolved.email || resolved.phone,
      };
    }
  }
}

export const outreachService = new OutreachService();
