export function isValidFacebookGroupUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  // Match patterns like:
  // https://www.facebook.com/groups/groupname
  // https://facebook.com/groups/groupname
  // http://www.facebook.com/groups/groupname
  // https://m.facebook.com/groups/groupname
  // https://www.facebook.com/share/g/1DVJb9aLTp/
  // https://facebook.com/share/g/1DVJb9aLTp/
  const pattern = /^https?:\/\/(www\.|m\.)?facebook\.com\/(groups\/[a-zA-Z0-9._-]+|share\/g\/[a-zA-Z0-9._-]+)\/?$/;
  return pattern.test(trimmed);
}

export function extractGroupName(url) {
  if (!url) return '';
  try {
    const parts = url.replace(/\/$/, '').split('/');

    // Handle /groups/groupname
    const groupIndex = parts.indexOf('groups');
    if (groupIndex !== -1 && parts[groupIndex + 1]) {
      return parts[groupIndex + 1]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Handle /share/g/identifier
    const shareIndex = parts.indexOf('share');
    if (shareIndex !== -1 && parts[shareIndex + 1] === 'g' && parts[shareIndex + 2]) {
      return 'Shared Group ' + parts[shareIndex + 2];
    }
  } catch (e) {
    // fallback
  }
  return 'Facebook Group';
}

export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const DEFAULT_COUNTRY_CODES = [
  // ASIA
  { code: '+91', country: 'IN', name: 'India', flag: '🇮🇳', region: 'Asia' },
  { code: '+880', country: 'BD', name: 'Bangladesh', flag: '🇧🇩', region: 'Asia' },
  { code: '+92', country: 'PK', name: 'Pakistan', flag: '🇵🇰', region: 'Asia' },
  { code: '+977', country: 'NP', name: 'Nepal', flag: '🇳🇵', region: 'Asia' },
  { code: '+94', country: 'LK', name: 'Sri Lanka', flag: '🇱🇰', region: 'Asia' },
  { code: '+975', country: 'BT', name: 'Bhutan', flag: '🇧🇹', region: 'Asia' },
  { code: '+960', country: 'MV', name: 'Maldives', flag: '🇲🇻', region: 'Asia' },
  { code: '+93', country: 'AF', name: 'Afghanistan', flag: '🇦🇫', region: 'Asia' },
  { code: '+86', country: 'CN', name: 'China', flag: '🇨🇳', region: 'Asia' },
  { code: '+81', country: 'JP', name: 'Japan', flag: '🇯🇵', region: 'Asia' },
  { code: '+82', country: 'KR', name: 'South Korea', flag: '🇰🇷', region: 'Asia' },
  { code: '+62', country: 'ID', name: 'Indonesia', flag: '🇮🇩', region: 'Asia' },
  { code: '+60', country: 'MY', name: 'Malaysia', flag: '🇲🇾', region: 'Asia' },
  { code: '+65', country: 'SG', name: 'Singapore', flag: '🇸🇬', region: 'Asia' },
  { code: '+66', country: 'TH', name: 'Thailand', flag: '🇹🇭', region: 'Asia' },
  { code: '+84', country: 'VN', name: 'Vietnam', flag: '🇻🇳', region: 'Asia' },
  { code: '+63', country: 'PH', name: 'Philippines', flag: '🇵🇭', region: 'Asia' },
  { code: '+852', country: 'HK', name: 'Hong Kong', flag: '🇭🇰', region: 'Asia' },
  { code: '+886', country: 'TW', name: 'Taiwan', flag: '🇹🇼', region: 'Asia' },
  { code: '+971', country: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', region: 'Asia' },
  { code: '+966', country: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', region: 'Asia' },
  { code: '+974', country: 'QA', name: 'Qatar', flag: '🇶🇦', region: 'Asia' },
  { code: '+965', country: 'KW', name: 'Kuwait', flag: '🇰🇼', region: 'Asia' },
  { code: '+968', country: 'OM', name: 'Oman', flag: '🇴🇲', region: 'Asia' },
  { code: '+973', country: 'BH', name: 'Bahrain', flag: '🇧🇭', region: 'Asia' },
  { code: '+972', country: 'IL', name: 'Israel', flag: '🇮🇱', region: 'Asia' },
  { code: '+90', country: 'TR', name: 'Turkey', flag: '🇹🇷', region: 'Asia' },

  // NORTH AMERICA
  { code: '+1', country: 'US', name: 'United States', flag: '🇺🇸', region: 'North America' },
  { code: '+1', country: 'CA', name: 'Canada', flag: '🇨🇦', region: 'North America' },

  // EUROPE
  { code: '+44', country: 'GB', name: 'United Kingdom', flag: '🇬🇧', region: 'Europe' },
  { code: '+49', country: 'DE', name: 'Germany', flag: '🇩🇪', region: 'Europe' },
  { code: '+33', country: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' },
  { code: '+39', country: 'IT', name: 'Italy', flag: '🇮🇹', region: 'Europe' },
  { code: '+34', country: 'ES', name: 'Spain', flag: '🇪🇸', region: 'Europe' },
  { code: '+31', country: 'NL', name: 'Netherlands', flag: '🇳🇱', region: 'Europe' },
  { code: '+41', country: 'CH', name: 'Switzerland', flag: '🇨🇭', region: 'Europe' },
  { code: '+46', country: 'SE', name: 'Sweden', flag: '🇸🇪', region: 'Europe' },
  { code: '+47', country: 'NO', name: 'Norway', flag: '🇳🇴', region: 'Europe' },
  { code: '+45', country: 'DK', name: 'Denmark', flag: '🇩🇰', region: 'Europe' },
  { code: '+358', country: 'FI', name: 'Finland', flag: '🇫🇮', region: 'Europe' },
  { code: '+353', country: 'IE', name: 'Ireland', flag: '🇮🇪', region: 'Europe' },
  { code: '+351', country: 'PT', name: 'Portugal', flag: '🇵🇹', region: 'Europe' },
  { code: '+32', country: 'BE', name: 'Belgium', flag: '🇧🇪', region: 'Europe' },
  { code: '+43', country: 'AT', name: 'Austria', flag: '🇦🇹', region: 'Europe' },
  { code: '+48', country: 'PL', name: 'Poland', flag: '🇵🇱', region: 'Europe' },
  { code: '+30', country: 'GR', name: 'Greece', flag: '🇬🇷', region: 'Europe' },

  // OCEANIA
  { code: '+61', country: 'AU', name: 'Australia', flag: '🇦🇺', region: 'Oceania' },
  { code: '+64', country: 'NZ', name: 'New Zealand', flag: '🇳🇿', region: 'Oceania' },

  // OTHER COMMON COUNTRIES
  { code: '+27', country: 'ZA', name: 'South Africa', flag: '🇿🇦', region: 'Other' },
  { code: '+55', country: 'BR', name: 'Brazil', flag: '🇧🇷', region: 'Other' },
  { code: '+52', country: 'MX', name: 'Mexico', flag: '🇲🇽', region: 'Other' },
  { code: '+54', country: 'AR', name: 'Argentina', flag: '🇦🇷', region: 'Other' },
];

/**
 * Validates a local phone number and country calling code according to strict rules:
 * - Country code is separate from the 10-digit local number.
 * - Local phone number must be exactly 10 digits.
 * - Reject fewer than 10 digits.
 * - Reject more than 10 digits.
 * - Reject non-numeric characters.
 */
export function validatePhoneNumber(countryCode = '+91', localNumber = '') {
  if (localNumber === undefined || localNumber === null || typeof localNumber !== 'string') {
    return {
      isValid: false,
      error: 'Phone number must be exactly 10 digits.',
    };
  }

  // Strip only harmless formatting spaces
  const cleaned = localNumber.replace(/\s+/g, '');

  if (!cleaned) {
    return {
      isValid: false,
      error: 'Phone number must be exactly 10 digits.',
    };
  }

  // Reject non-numeric characters, fewer than 10 digits, or more than 10 digits
  if (!/^[0-9]{10}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Phone number must be exactly 10 digits.',
    };
  }

  const cleanCountryCode = (countryCode || '+91').trim().replace(/[^\d+]/g, '') || '+91';
  const prefix = cleanCountryCode.startsWith('+') ? cleanCountryCode : `+${cleanCountryCode}`;
  const normalizedNumber = `${prefix}${cleaned}`;
  const whatsappNumber = normalizedNumber.replace(/\D/g, '');

  return {
    isValid: true,
    localNumber: cleaned,
    countryCode: prefix,
    normalizedNumber,
    whatsappNumber,
  };
}

/**
 * Normalizes any phone string to international digits suitable for WhatsApp (wa.me)
 */
export function normalizeWhatsAppNumber(phoneStr = '', defaultCountryCode = '+91') {
  if (!phoneStr || typeof phoneStr !== 'string') return '';
  let clean = phoneStr.trim();
  
  // If it already has international prefix (+)
  if (clean.startsWith('+')) {
    return clean.replace(/\D/g, '');
  }

  const digits = clean.replace(/\D/g, '');
  // If exactly 10 digits, prepend default country code digits
  if (digits.length === 10) {
    const ccDigits = defaultCountryCode.replace(/\D/g, '');
    return `${ccDigits}${digits}`;
  }

  return digits;
}

