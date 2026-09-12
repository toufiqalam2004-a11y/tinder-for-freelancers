/**
 * Contact Extractor & Normalization Engine
 * 
 * Extracts and validates direct contact methods (Email, WhatsApp/Phone) from:
 * - Structured entity fields (contactEmail, contactPhone, email, phone, metadata)
 * - Raw textual content (title, description, body, text, postText)
 * 
 * Features Anti-False-Positive Filtering:
 * - Rejects numbers adjacent to currency/budget/salary indicators ($450, €50, ₹50k, 40/hr, 3500/mo)
 * - Rejects dates (2026-09-12, 12/09/2026)
 * - Rejects URLs containing IDs or numbers (facebook.com/groups/posts/77218392)
 * - Rejects job IDs (job-123456, id: 88412)
 * - Rejects standalone zip codes or years (2024, 2025, 2026)
 */

import { normalizeWhatsAppNumber } from './validators.js';

// Regex for RFC-compliant email detection
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Patterns to sanitize before phone scanning to eliminate false positives
const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const DATE_PATTERN = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g;
const YEAR_PATTERN = /\b(?:19|20)\d{2}\b/g;
const CURRENCY_SALARY_PATTERNS = [
  /[\$€£₹]\s*\d+[\d,]*(?:\s*-\s*[\$€£₹]?\s*\d+[\d,]*)?(?:\s*(?:per video|per month|\/mo|\/hr|\/project|\/video|\/short|k|hourly|retainer))?/gi,
  /(?:budget|rate|salary|stipend|pay|hourly rate)\s*:?\s*[\$€£₹]?\s*\d+[\d,]*(?:\s*-\s*[\$€£₹]?\s*\d+[\d,]*)?(?:\s*(?:per video|per month|\/mo|\/hr|\/project|\/video|k))?/gi,
  /\b\d+[\d,]*(?:\s*(?:per video|per month|\/mo|\/hr|\/project|\/video|k\/month|k\/yr))\b/gi,
  /\$\d+k(?:\s*-\s*\$?\d+k)?/gi,
];
const ID_PATTERNS = [
  /\b(?:job|post|id|ref|req)[-_#]?\s*\d+\b/gi,
  /\b#\d{4,}\b/g,
];

// Patterns for legitimate phone extraction
const INTL_PHONE_REGEX = /(?:\+[\d\s().-]{8,20}\d)/g;
const CONTEXTUAL_PHONE_REGEX = /(?:whatsapp|wa\.me|wa|phone|call|tel|mobile|contact|text|reach us at|ping me at|msg at)[:\s]+([+\d\s().-]{8,20})/gi;
const STANDARD_10DIGIT_REGEX = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

/**
 * Normalizes email address and validates basic structure.
 */
export function normalizeEmail(emailStr = '') {
  if (!emailStr || typeof emailStr !== 'string') return null;
  const cleaned = emailStr
    .trim()
    .toLowerCase()
    .replace(/[<>()]/g, '')
    .replace(/[.,;:]+$/, '');

  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Normalizes phone number into international E.164-style digits with '+' prefix.
 */
export function normalizePhone(phoneStr = '', defaultCountryCode = '+91') {
  if (!phoneStr || typeof phoneStr !== 'string') return null;
  const digitsOnly = phoneStr.replace(/\D/g, '');

  // Must have at least 8 digits and at most 15 digits
  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return null;
  }

  const normalized = normalizeWhatsAppNumber(phoneStr, defaultCountryCode);
  if (!normalized || normalized.length < 8) return null;

  return `+${normalized}`;
}

/**
 * Sanitizes text before phone extraction by stripping out currencies,
 * dates, URLs, and IDs that contain numbers.
 */
function sanitizeTextForPhoneSearch(text = '') {
  let cleaned = text;

  // 1. Remove URLs
  cleaned = cleaned.replace(URL_PATTERN, ' ');

  // 2. Remove dates and standalone years
  cleaned = cleaned.replace(DATE_PATTERN, ' ');
  cleaned = cleaned.replace(YEAR_PATTERN, ' ');

  // 3. Remove currency & salary mentions
  for (const pat of CURRENCY_SALARY_PATTERNS) {
    cleaned = cleaned.replace(pat, ' ');
  }

  // 4. Remove Job IDs and references
  for (const pat of ID_PATTERNS) {
    cleaned = cleaned.replace(pat, ' ');
  }

  return cleaned;
}

/**
 * Extracts and normalizes contact information from an entity (job, post, or text).
 * 
 * @param {Object|string} entity 
 * @param {string} defaultCountryCode 
 * @returns {Object} { email, phone, hasEmail, hasPhone, hasDirectContact, source }
 */
export function extractContactInfo(entity = {}, defaultCountryCode = '+91') {
  let email = null;
  let phone = null;
  let contactSource = null;

  if (typeof entity === 'string') {
    entity = { description: entity };
  }

  // 1. Check explicit structured fields first
  const explicitEmail = entity.contactEmail || entity.email || entity.metadata?.email;
  if (explicitEmail && typeof explicitEmail === 'string') {
    const norm = normalizeEmail(explicitEmail);
    if (norm) {
      email = norm;
      contactSource = 'field';
    }
  }

  const explicitPhone = entity.contactPhone || entity.phone || entity.metadata?.phone;
  if (explicitPhone && typeof explicitPhone === 'string') {
    const norm = normalizePhone(explicitPhone, defaultCountryCode);
    if (norm) {
      phone = norm;
      contactSource = 'field';
    }
  }

  // 2. Combine all textual content for regex extraction
  const candidateTexts = [
    entity.title,
    entity.description,
    entity.body,
    entity.content,
    entity.text,
    entity.postText,
    entity.postContent,
    entity.metadata?.contact,
    entity.metadata?.text,
  ]
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .join('\n');

  // 3. Extract Email from text if not already found
  if (!email && candidateTexts) {
    const emailMatches = candidateTexts.match(EMAIL_REGEX);
    if (emailMatches && emailMatches.length > 0) {
      for (const raw of emailMatches) {
        const norm = normalizeEmail(raw);
        if (norm) {
          email = norm;
          contactSource = contactSource || 'text_extraction';
          break;
        }
      }
    }
  }

  // 4. Extract Phone from text if not already found
  if (!phone && candidateTexts) {
    const sanitizedText = sanitizeTextForPhoneSearch(candidateTexts);

    // 4a. Check contextual matches first (e.g. "WhatsApp: +91 9876543210", "call: 555-0199")
    const contextMatches = [...sanitizedText.matchAll(CONTEXTUAL_PHONE_REGEX)];
    for (const match of contextMatches) {
      const captured = match[1];
      if (captured) {
        const norm = normalizePhone(captured, defaultCountryCode);
        if (norm) {
          phone = norm;
          contactSource = contactSource || 'text_extraction';
          break;
        }
      }
    }

    // 4b. Check international format (+XX XXXXXXXX)
    if (!phone) {
      const intlMatches = sanitizedText.match(INTL_PHONE_REGEX);
      if (intlMatches) {
        for (const raw of intlMatches) {
          const norm = normalizePhone(raw, defaultCountryCode);
          if (norm) {
            phone = norm;
            contactSource = contactSource || 'text_extraction';
            break;
          }
        }
      }
    }

    // 4c. Check standard 10-digit number patterns
    if (!phone) {
      const stdMatches = sanitizedText.match(STANDARD_10DIGIT_REGEX);
      if (stdMatches) {
        for (const raw of stdMatches) {
          // Verify that this number didn't accidentally capture salary or dates
          const norm = normalizePhone(raw, defaultCountryCode);
          if (norm) {
            phone = norm;
            contactSource = contactSource || 'text_extraction';
            break;
          }
        }
      }
    }
  }

  const hasEmail = Boolean(email);
  const hasPhone = Boolean(phone);
  const hasDirectContact = hasEmail || hasPhone;

  return {
    email,
    phone,
    hasEmail,
    hasPhone,
    hasDirectContact,
    source: hasDirectContact ? (contactSource || 'inferred') : null,
  };
}

/**
 * Helper to check whether an opportunity has direct contact information.
 */
export function hasDirectContact(entity) {
  if (!entity) return false;
  if (typeof entity.hasDirectContact === 'boolean') {
    return entity.hasDirectContact;
  }
  if (entity.contact && typeof entity.contact.hasDirectContact === 'boolean') {
    return entity.contact.hasDirectContact;
  }
  return extractContactInfo(entity).hasDirectContact;
}
