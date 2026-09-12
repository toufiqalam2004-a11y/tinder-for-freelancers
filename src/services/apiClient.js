/**
 * Backend API Client & Bridge
 * Provides secure interaction with the backend API layer.
 * Automatically falls back to Demo Mode if backend is unreachable.
 */

// Dynamically configurable production/development API base
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : '/api';

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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${res.status}: Failed to verify OTP`,
          status: res.status,
        };
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message || 'Network error verifying OTP' };
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
  async generateApplication({ job, profile, mode }) {
    try {
      const res = await fetch(`${API_BASE}/ai/generate-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, profile, mode }),
      });
      if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
      return await res.json();
    } catch {
      return { isDemo: true, message: null };
    }
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
};
