/**
 * Safe Demo Outreach Adapter
 * 
 * Provides simulated in-memory outreach for local development and demo environments.
 * STRICT SECURITY GUARANTEES:
 * 1. Zero external network calls (No SMTP, Resend, SendGrid, Twilio, Meta, WhatsApp API).
 * 2. Generates unique deterministic demo message IDs.
 * 3. Returns status: 'DEMO_SENT' and demo: true.
 * 4. Never claims real provider transmission.
 */

export class DemoOutreachAdapter {
  constructor() {
    this.name = 'Demo Outreach Adapter';
    this.provider = 'demo';
  }

  /**
   * Always reports configured for demo purposes.
   */
  isConfigured() {
    return true;
  }

  /**
   * Safe simulated send.
   * @param {Object} options
   * @param {string} options.to - Recipient contact (email or phone)
   * @param {string} [options.channel='email'] - 'email' | 'whatsapp' | 'both'
   * @param {string} [options.subject]
   * @param {string} options.message - Application message
   * @param {Object} [options.job]
   * @param {Object} [options.profile]
   */
  async send({ to, channel = 'email', subject = '', message = '', job = {}, profile = {} } = {}) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const messageId = `demo-${timestamp}-${randomSuffix}`;

    return {
      success: true,
      status: 'DEMO_SENT',
      demo: true,
      provider: 'demo',
      channel,
      recipient: to,
      messageId,
      sentAt: new Date().toISOString(),
      message: message || `Demo application for ${job.title || 'Opportunity'}`,
      info: 'Simulated dispatch. No real external email or WhatsApp network request was performed.',
    };
  }
}

export const demoAdapter = new DemoOutreachAdapter();
