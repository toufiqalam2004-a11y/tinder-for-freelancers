/**
 * Shared Server-Side Persistent Session Store
 * Backed by `db.sessions` (Supabase PostgreSQL / JSON)
 *
 * Sessions survive:
 * - Render restarts
 * - Render deploys
 * - Local server restarts
 *
 * Expired sessions are strictly rejected and automatically pruned.
 */

import { db } from './database.js';

class PersistentSessionStore {
  constructor() {
    this.memoryCache = new Map();
    this.hasHydrated = false;
  }

  hydrate(force = false) {
    if (this.hasHydrated && !force) return;
    if (force) {
      this.memoryCache.clear();
    }
    try {
      const allSessions = db.sessions.findAll();
      const now = Date.now();
      for (const s of allSessions) {
        const token = s.token || s.id;
        const expiresAt = s.expiresAt ? new Date(s.expiresAt).getTime() : 0;
        if (token && expiresAt > now) {
          this.memoryCache.set(token, {
            userId: s.userId || s.user_id,
            phone: s.phone,
            countryCode: s.countryCode || s.country_code || '+91',
            localNumber: s.localNumber || s.local_number || '',
            role: s.role || 'user',
            isAdmin: Boolean(s.isAdmin || s.is_admin),
            expiresAt,
          });
        } else if (token) {
          db.sessions.delete(token);
        }
      }
      this.hasHydrated = true;
    } catch (e) {
      this.hasHydrated = true;
    }
  }

  get(token) {
    if (!token) return undefined;
    this.hydrate();

    let session = this.memoryCache.get(token);
    const now = Date.now();

    if (!session) {
      // Look up in persistent store (e.g. after a restart)
      const record = db.sessions.findById(token) || db.sessions.findOne((s) => s.token === token);
      if (record) {
        const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : 0;
        if (expiresAt > now) {
          session = {
            userId: record.userId || record.user_id,
            phone: record.phone,
            countryCode: record.countryCode || record.country_code || '+91',
            localNumber: record.localNumber || record.local_number || '',
            role: record.role || 'user',
            isAdmin: Boolean(record.isAdmin || record.is_admin),
            expiresAt,
          };
          this.memoryCache.set(token, session);
        } else {
          // Expired session -> prune from persistent store
          db.sessions.delete(token);
          return undefined;
        }
      }
    }

    if (session && now > session.expiresAt) {
      this.delete(token);
      return undefined;
    }

    return session;
  }

  set(token, sessionData) {
    if (!token) return this;
    const now = Date.now();
    const expiresAt = sessionData.expiresAt || (now + 7 * 24 * 60 * 60 * 1000); // 7-day default

    const cleanSession = {
      ...sessionData,
      token,
      expiresAt,
    };

    this.memoryCache.set(token, cleanSession);

    // Persist to database
    db.sessions.insert({
      id: token,
      token,
      userId: cleanSession.userId,
      user_id: cleanSession.userId,
      phone: cleanSession.phone,
      countryCode: cleanSession.countryCode || '+91',
      country_code: cleanSession.countryCode || '+91',
      localNumber: cleanSession.localNumber || '',
      local_number: cleanSession.localNumber || '',
      role: cleanSession.role || 'user',
      isAdmin: Boolean(cleanSession.isAdmin || cleanSession.role === 'admin'),
      is_admin: Boolean(cleanSession.isAdmin || cleanSession.role === 'admin'),
      expiresAt: new Date(expiresAt).toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    return this;
  }

  delete(token) {
    if (!token) return false;
    this.memoryCache.delete(token);
    try {
      db.sessions.delete(token);
      return true;
    } catch {
      return false;
    }
  }

  has(token) {
    return Boolean(this.get(token));
  }

  entries() {
    this.hydrate();
    const now = Date.now();
    // Filter out expired entries
    for (const [token, session] of this.memoryCache.entries()) {
      if (now > session.expiresAt) {
        this.delete(token);
      }
    }
    return this.memoryCache.entries();
  }

  values() {
    return Array.from(this.entries()).map(([, val]) => val);
  }

  keys() {
    return Array.from(this.entries()).map(([key]) => key);
  }

  clear() {
    this.memoryCache.clear();
    const all = db.sessions.findAll();
    for (const s of all) {
      db.sessions.delete(s.id || s.token);
    }
  }

  get size() {
    return Array.from(this.entries()).length;
  }
}

export const activeSessions = new PersistentSessionStore();
