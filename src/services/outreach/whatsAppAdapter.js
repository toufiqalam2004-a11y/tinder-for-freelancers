/**
 * WhatsApp Outreach Adapter
 * Provides a clean interface for dispatching direct job applications via WhatsApp.
 * Uses normalized international phone numbers for delivery.
 * Real provider credentials remain strictly server-side.
 * Never claims successful delivery if unconfigured.
 */

import { normalizeWhatsAppNumber } from '../../utils/validators.js';
import { getAuth } from '../../data/storage.js';
import { getApiUrl } from '../../config/apiConfig.js';

let cachedWhatsAppStatus = false;

export class WhatsAppOutreachAdapter {
  /**
   * Checks server configuration status for WhatsApp delivery.
   */
  async checkConfiguration() {
    try {
      const res = await fetch(getApiUrl('/outreach/status'));
      if (res.ok) {
        const data = await res.json();
        cachedWhatsAppStatus = !!data.whatsAppConfigured;
      }
    } catch {
      // Network/offline fallback
    }
    return cachedWhatsAppStatus;
  }

  /**
   * Synchronous check based on cached status.
   */
  isConfigured() {
    return cachedWhatsAppStatus;
  }

  /**
   * Updates cached status manually.
   */
  setConfigured(status) {
    cachedWhatsAppStatus = !!status;
  }

  /**
   * Dispatches WhatsApp outreach via secure backend.
   * NEVER claims delivery when provider is not configured.
   */
  async send({ to, message, profile, job }) {
    if (!to || typeof to !== 'string') {
      return {
        success: false,
        configured: this.isConfigured(),
        status: 'FAILED',
        channel: 'whatsapp',
        recipient: '',
        error: 'A valid recipient phone number is required.',
      };
    }

    const normalizedPhone = normalizeWhatsAppNumber(to);
    if (!normalizedPhone || normalizedPhone.length < 8 || !/^\d+$/.test(normalizedPhone)) {
      return {
        success: false,
        configured: this.isConfigured(),
        status: 'FAILED',
        channel: 'whatsapp',
        recipient: to,
        error: 'Recipient phone number is invalid for WhatsApp delivery.',
      };
    }

    const auth = getAuth() || {};
    const headers = { 'Content-Type': 'application/json' };
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
    if (auth.phone || auth.userId) headers['x-user-id'] = auth.phone || auth.userId;

    try {
      const res = await fetch(getApiUrl('/outreach/whatsapp'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: normalizedPhone,
          message: message || '',
          applicantName: profile?.name,
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
          channel: 'whatsapp',
          recipient: normalizedPhone,
          error: data.error || (isNotConfigured ? 'Application prepared, but WhatsApp delivery is not configured yet.' : 'WhatsApp delivery failed.'),
        };
      }

      return {
        success: true,
        configured: true,
        status: 'SENT',
        channel: 'whatsapp',
        recipient: normalizedPhone,
        messageId: data.messageId || `msg-wa-${Date.now()}`,
      };
    } catch (err) {
      return {
        success: false,
        configured: this.isConfigured(),
        status: 'FAILED',
        channel: 'whatsapp',
        recipient: normalizedPhone,
        error: err.message || 'Failed to dispatch WhatsApp message.',
      };
    }
  }
}

export const whatsAppAdapter = new WhatsAppOutreachAdapter();
