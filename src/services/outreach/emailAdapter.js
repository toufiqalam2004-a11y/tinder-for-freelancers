/**
 * Email Outreach Adapter
 * Provides a clean interface for dispatching direct job applications via email.
 * Built with adapter pattern: real provider credentials remain strictly server-side.
 * Never claims successful delivery if unconfigured.
 */

import { getAuth } from '../../data/storage.js';

let cachedEmailStatus = false;

export class EmailOutreachAdapter {
  /**
   * Validates an email address format.
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /**
   * Checks server configuration status for transactional email.
   */
  async checkConfiguration() {
    try {
      const res = await fetch('/api/outreach/status');
      if (res.ok) {
        const data = await res.json();
        cachedEmailStatus = !!data.emailConfigured;
      }
    } catch {
      // Network/offline fallback
    }
    return cachedEmailStatus;
  }

  /**
   * Synchronous check based on cached status.
   */
  isConfigured() {
    return cachedEmailStatus;
  }

  /**
   * Updates cached status manually.
   */
  setConfigured(status) {
    cachedEmailStatus = !!status;
  }

  /**
   * Dispatches email outreach via secure backend.
   * NEVER claims delivery when provider is not configured.
   */
  async send({ to, subject, body, profile, job }) {
    if (!to || !this.isValidEmail(to)) {
      return {
        success: false,
        configured: this.isConfigured(),
        status: 'FAILED',
        channel: 'email',
        recipient: to || '',
        error: 'A valid recipient email address is required.',
      };
    }

    const auth = getAuth() || {};
    const headers = { 'Content-Type': 'application/json' };
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
    if (auth.phone || auth.userId) headers['x-user-id'] = auth.phone || auth.userId;

    try {
      const res = await fetch('/api/outreach/email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: to.trim(),
          subject: subject || `Application: ${job?.title || 'Freelance Role'}`,
          body: body || '',
          applicantName: profile?.name,
          applicantEmail: profile?.email,
          jobId: job?.id,
          jobTitle: job?.title,
          userId: auth.phone || auth.userId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const isNotConfigured = data.code === 'NOT_CONFIGURED' || data.status === 'NOT_CONFIGURED' || !data.configured;
        return {
          success: false,
          configured: !isNotConfigured,
          status: isNotConfigured ? 'NOT_CONFIGURED' : (data.status || 'FAILED'),
          channel: 'email',
          recipient: to.trim(),
          error: data.error || (isNotConfigured ? 'Application prepared, but email delivery is not configured yet.' : 'Email delivery failed.'),
        };
      }

      return {
        success: true,
        configured: true,
        status: 'SENT',
        channel: 'email',
        recipient: to.trim(),
        messageId: data.messageId || `msg-em-${Date.now()}`,
      };
    } catch (err) {
      return {
        success: false,
        configured: this.isConfigured(),
        status: 'FAILED',
        channel: 'email',
        recipient: to.trim(),
        error: err.message || 'Failed to dispatch email.',
      };
    }
  }
}

export const emailAdapter = new EmailOutreachAdapter();
