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
