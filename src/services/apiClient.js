/**
 * Backend API Client & Bridge
 * Provides secure interaction with the backend API layer.
 * Automatically falls back to Demo Mode if backend is unreachable.
 */

import { getApiBaseUrl } from '../config/apiConfig.js';

// Dynamically configurable production/development API base
const API_BASE = getApiBaseUrl();

export const apiClient = {
  /**
   * Health Check
   */
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error(`Health check failed (${res.status})`);
      return await res.json();
    } catch (err) {
      return {
        status: 'demo_fallback',
        backend: 'disconnected',
        database: 'localStorage_fallback',
        services: {
          reddit: 'not_configured',
          youtube: 'not_configured',
          x: 'not_configured',
          ai: 'not_configured',
        },
        demoFallback: true,
      };
    }
  },

  /**
   * Request OTP
   */
  async sendOtp(phone, details = {}) {
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          countryCode: details.countryCode,
          localNumber: details.localNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${res.status}: Failed to send OTP`,
          remainingSeconds: data.remainingSeconds,
          status: res.status,
        };
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message || 'Network error sending OTP' };
    }
  },

  /**
   * Verify OTP
   */
  async verifyOtp(phone, code, details = {}) {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          code,
          countryCode: details.countryCode,
          localNumber: details.localNumber,
          referralCode: details.referralCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${res.status}: Failed to verify OTP`,
          remainingAttempts: data.remainingAttempts,
          status: res.status,
        };
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message || 'Network error verifying OTP' };
    }
  },

  /**
   * Invalidate session token on server
   */
  async logout(token) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers,
      });
      return await res.json().catch(() => ({ success: true }));
    } catch {
      return { success: true };
    }
  },

  /**
   * Sync a Source through the backend pipeline
   */
  async syncSource(source) {
    try {
      const res = await fetch(`${API_BASE}/sources/${source.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      return {
        success: false,
        isDemo: true,
        error: err.message,
        addedJobs: [],
      };
    }
  },

  /**
   * Request AI application generation via server
   */
  async generateApplication({ job, profile, mode, tone, length, userId }) {
    try {
      const currentUid = userId || profile?.userId || profile?.id || localStorage.getItem('tf_current_user_id');
      const headers = { 'Content-Type': 'application/json' };
      if (currentUid) headers['x-user-id'] = currentUid;

      const res = await fetch(`${API_BASE}/ai/generate-application`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ job, profile, mode: tone || mode, tone: tone || mode, length, userId: currentUid }),
      });
      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        const err = new Error(errorData.message || 'Upgrade required for this tone or length.');
        err.status = 403;
        err.code = errorData.code || errorData.error || 'UPGRADE_REQUIRED';
        throw err;
      }
      if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (err.status === 403 || err.code === 'UPGRADE_REQUIRED' || err.code === 'PRO_REQUIRED') {
        throw err;
      }
      return { isDemo: true, message: null };
    }
  },

  /**
   * Google Translate Application Message Endpoint
   */
  async translateApplication({ text, targetLanguage = 'es', job, profile, userId }) {
    const currentUid = userId || profile?.userId || profile?.id || localStorage.getItem('tf_current_user_id');
    const headers = { 'Content-Type': 'application/json' };
    if (currentUid) headers['x-user-id'] = currentUid;

    const res = await fetch(`${API_BASE}/ai/translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, targetLanguage, job, profile, userId: currentUid }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 403) {
      const err = new Error(data.message || 'Google Translate is available on the Pro plan.');
      err.status = 403;
      err.code = data.code || data.error || 'PRO_REQUIRED';
      throw err;
    }
    if (!res.ok) {
      throw new Error(data.error || `Translation request failed with status ${res.status}`);
    }
    return data;
  },

  /**
   * Safe Data Migration: Sync local data into backend database
   */
  async migrateData(payload) {
    try {
      const res = await fetch(`${API_BASE}/data/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch user reward status & credits
   */
  async getRewardsStatus(date) {
    try {
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      const res = await fetch(`${API_BASE}/rewards/status${q}`);
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Claim daily login reward (+1 application credit)
   */
  async claimDailyLogin(date) {
    try {
      const res = await fetch(`${API_BASE}/rewards/daily-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch referral status & unique code
   */
  async getReferralsStatus() {
    try {
      const res = await fetch(`${API_BASE}/referrals/status`);
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Claim referral code (+5 credits for new user)
   */
  async claimReferral(referralCode) {
    try {
      const res = await fetch(`${API_BASE}/referrals/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch rolling 8-hour quota status & balances
   */
  async getQuotaStatus(userId = null) {
    try {
      const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`${API_BASE}/quota/status${q}`);
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Process & check Free 3-day consecutive login streak
   */
  async checkLoginStreak(timezone = null) {
    try {
      const res = await fetch(`${API_BASE}/rewards/streak-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
