// Shared server-side active sessions store
// Map<token, { userId, phone, countryCode, localNumber, role, expiresAt }>
export const activeSessions = new Map();
