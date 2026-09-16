/**
 * Name Normalization & Unique Display Name Utility
 *
 * Implements deterministic deduplication and automatic numbered suffix assignment:
 * - Suffix 1 is the unadorned title-cased base name (e.g. "Toufiq Alam").
 * - Subsequent duplicate names receive the first available integer suffix (e.g. "Toufiq Alam 2", "Toufiq Alam 3").
 * - Supports gap filling (if "Toufiq Alam", "Toufiq Alam 2", and "Toufiq Alam 4" exist, assigns "Toufiq Alam 3").
 * - Preserves existing user identity on profile edit without accidental suffix incrementing.
 */

export function formatBaseName(input) {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  return trimmed
    .split(' ')
    .map((word) => {
      if (!word) return '';
      // If the word is entirely lowercase or uppercase, title-case it
      if (word === word.toLowerCase() || word === word.toUpperCase()) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      // Otherwise preserve internal mixed casing while capitalizing the first character
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function generateUniqueDisplayName(rawName, currentUserId = null, existingRecords = []) {
  if (!rawName || typeof rawName !== 'string') return '';
  const baseName = formatBaseName(rawName);
  if (!baseName) return '';

  const otherNames = [];
  let currentUserOwnName = null;

  for (const item of existingRecords) {
    if (!item) continue;
    if (typeof item === 'string') {
      otherNames.push(item);
      continue;
    }

    const recUserId = item.userId || item.id || item.phone;
    const isCurrentUser = Boolean(
      currentUserId &&
      (recUserId === currentUserId ||
        item.id === currentUserId ||
        item.userId === currentUserId ||
        item.phone === currentUserId ||
        item.id === `prof-${currentUserId}`)
    );

    if (isCurrentUser) {
      if (item.name) currentUserOwnName = item.name;
    } else {
      if (item.name) otherNames.push(item.name);
    }
  }

  // If the current user already possesses this name (case-insensitively, normalized), preserve it
  if (currentUserOwnName) {
    const cleanOwn = currentUserOwnName.trim().replace(/\s+/g, ' ');
    const cleanRaw = rawName.trim().replace(/\s+/g, ' ');
    if (cleanOwn.toLowerCase() === cleanRaw.toLowerCase()) {
      return formatBaseName(cleanRaw) || cleanOwn;
    }
  }

  const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedBase}(?:\\s+(\\d+))?$`, 'i');

  const occupied = new Set();
  for (const name of otherNames) {
    if (!name || typeof name !== 'string') continue;
    const clean = name.trim().replace(/\s+/g, ' ');
    const m = clean.match(regex);
    if (m) {
      if (!m[1]) {
        // Base name with no suffix counts as suffix 1
        occupied.add(1);
      } else {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num >= 2) {
          occupied.add(num);
        }
      }
    }
  }

  // If base name (suffix 1) is not occupied, assign baseName directly
  if (!occupied.has(1)) {
    return baseName;
  }

  // Find the first available integer suffix starting at 2 (gap-handling)
  let suffix = 2;
  while (occupied.has(suffix)) {
    suffix++;
  }

  return `${baseName} ${suffix}`;
}

/**
 * Generates verified available username suggestions that are not already present in existingRecords.
 */
export function getAvailableUsernameSuggestions(requestedUsername, existingRecords = []) {
  if (!requestedUsername || typeof requestedUsername !== 'string') return [];
  const clean = requestedUsername.trim().toLowerCase();
  if (!clean) return [];

  const taken = new Set();
  for (const rec of existingRecords) {
    if (!rec) continue;
    if (typeof rec === 'string') {
      taken.add(rec.trim().toLowerCase());
    } else if (rec.username) {
      taken.add(String(rec.username).trim().toLowerCase());
    }
  }

  const candidateTemplates = [
    `${clean}1`,
    `${clean}2`,
    `${clean}_edit`,
    `${clean}official`,
    `${clean}_dev`,
    `${clean}_pro`,
    `${clean}10`,
  ];

  const available = [];
  for (const cand of candidateTemplates) {
    if (!taken.has(cand.toLowerCase()) && cand.length >= 3 && cand.length <= 30) {
      available.push(cand);
      if (available.length >= 4) break;
    }
  }

  return available;
}
