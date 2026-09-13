/**
 * Rewards & Referral Service
 * Manages daily login rewards, application reward credits, and friend referral attribution.
 */

import { STORAGE_KEYS } from '../utils/constants.js';
import { normalizeReferralCode, isValidReferralCode } from '../utils/referralUtils.js';

const PENDING_REFERRAL_KEY = 'tf_pending_referral_code';
const REWARDS_CACHE_KEY = 'tf_rewards_cache';

const memoryStore = new Map();

function safeGetItem(key) {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {}
  return memoryStore.get(key) || null;
}

function safeSetItem(key, val) {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, val);
      return;
    }
  } catch {}
  memoryStore.set(key, val);
}

function safeRemoveItem(key) {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(key);
    }
  } catch {}
  memoryStore.delete(key);
}

function safeDispatchEvent(name, detail) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  } catch {}
}

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : '/api';

function getStoredToken() {
  try {
    const raw = safeGetItem(STORAGE_KEYS.AUTH);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.token || null;
  } catch {
    return null;
  }
}

function getStoredUserId() {
  try {
    const raw = safeGetItem(STORAGE_KEYS.AUTH);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.userId || parsed.phone || null;
  } catch {
    return null;
  }
}

export class RewardService {
  /**
   * Pending Referral Code Management (?ref=TF-ABC123)
   */
  setPendingReferralCode(code) {
    const clean = normalizeReferralCode(code);
    if (isValidReferralCode(clean)) {
      safeSetItem(PENDING_REFERRAL_KEY, clean);
    }
  }

  getPendingReferralCode() {
    return safeGetItem(PENDING_REFERRAL_KEY);
  }

  clearPendingReferralCode() {
    safeRemoveItem(PENDING_REFERRAL_KEY);
  }

  /**
   * Local Reward Cache Helpers
   */
  getRewardCacheKey() {
    const uid = getStoredUserId() || 'default';
    return `tf_rewards_cache_${uid}`;
  }

  getRewardCache() {
    try {
      const key = this.getRewardCacheKey();
      const raw = safeGetItem(key);
      if (raw) return JSON.parse(raw);
      if (key === 'tf_rewards_cache_default') {
        const legacy = safeGetItem(REWARDS_CACHE_KEY);
        if (legacy) return JSON.parse(legacy);
      }
      return { rewardCredits: 0, lastDailyLoginRewardDate: null, claimedToday: false };
    } catch {
      return { rewardCredits: 0, lastDailyLoginRewardDate: null, claimedToday: false };
    }
  }

  setRewardCache(data) {
    try {
      const key = this.getRewardCacheKey();
      const current = this.getRewardCache();
      const updated = { ...current, ...data };
      safeSetItem(key, JSON.stringify(updated));
      safeSetItem(REWARDS_CACHE_KEY, JSON.stringify(updated));
      safeDispatchEvent('tf_rewards_changed', updated);
      return updated;
    } catch {
      return data;
    }
  }

  getRewardCredits() {
    return Math.max(0, this.getRewardCache().rewardCredits || 0);
  }

  consumeRewardCredit() {
    const current = this.getRewardCache();
    const credits = Math.max(0, (current.rewardCredits || 0) - 1);
    this.setRewardCache({ ...current, rewardCredits: credits });
    return credits;
  }

  /**
   * API: Fetch Reward Status
   */
  async getRewardStatus() {
    const token = getStoredToken();
    const userId = getStoredUserId();
    const today = new Date().toISOString().slice(0, 10);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`${API_BASE}/rewards/status?date=${today}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.setRewardCache({
            rewardCredits: data.rewardCredits,
            lastDailyLoginRewardDate: data.lastDailyLoginRewardDate,
            claimedToday: data.claimedToday,
            dailyLoginRewardsClaimed: data.dailyLoginRewardsClaimed,
          });
          return data;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch rewards status from server:', e);
    }

    return this.getRewardCache();
  }

  /**
   * API: Claim Daily Login Reward (+1 application credit once per calendar day)
   */
  async claimDailyLoginReward() {
    const token = getStoredToken();
    const userId = getStoredUserId();
    const today = new Date().toISOString().slice(0, 10);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`${API_BASE}/rewards/daily-login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ date: today }),
      });

      const data = await res.json();
      if (data.success) {
        this.setRewardCache({
          rewardCredits: data.rewardCredits,
          lastDailyLoginRewardDate: today,
          claimedToday: true,
        });
      }
      return data;
    } catch (e) {
      console.warn('Failed to claim daily login reward on server:', e);
      return { success: false, granted: false, error: e.message };
    }
  }

  /**
   * API: Fetch Referral Status
   */
  async getReferralStatus() {
    const token = getStoredToken();
    const userId = getStoredUserId();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`${API_BASE}/referrals/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('Failed to fetch referral status from server:', e);
    }

    return {
      success: false,
      referralCode: null,
      referralLink: '',
      referralCount: 0,
      totalReferralRewards: 0,
    };
  }

  /**
   * API: Claim Referral Code
   */
  async claimReferral(code) {
    const clean = normalizeReferralCode(code);
    if (!clean) return { success: false, error: 'Referral code is required.' };

    const token = getStoredToken();
    const userId = getStoredUserId();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`${API_BASE}/referrals/claim`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ referralCode: clean }),
      });

      const data = await res.json();
      if (data.success && data.granted) {
        this.setRewardCache({ rewardCredits: data.rewardCredits });
        this.clearPendingReferralCode();
      } else if (data.alreadyClaimed) {
        this.clearPendingReferralCode();
      }
      return data;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

export const rewardService = new RewardService();
