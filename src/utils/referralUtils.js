/**
 * Referral Utility Functions
 * Generates collision-safe, unambiguous referral codes and validation helpers.
 */

const REFERRAL_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * REFERRAL_CHARS.length);
    code += REFERRAL_CHARS.charAt(idx);
  }
  return `TF-${code}`;
}

export function normalizeReferralCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

export function isValidReferralCode(code) {
  if (!code || typeof code !== 'string') return false;
  const normalized = normalizeReferralCode(code);
  return /^TF-[A-Z0-9]{4,12}$/.test(normalized);
}
