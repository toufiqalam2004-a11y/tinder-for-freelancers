import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Identifies whether an ID or record belongs to test fixtures vs real users
export function isRealUser(user) {
  if (!user) return false;

  // The ONLY legitimate user accounts allowed in the current live/dev database are:
  // 1. Toufiq (+917758757575 / user-1789502668516)
  // 2. messi (+919874950646 / user-1789503692368)
  if (
    user.phone === '+917758757575' ||
    user.id === 'user-1789502668516'
  ) {
    return true;
  }

  if (
    user.phone === '+919874950646' ||
    user.id === 'user-1789503692368'
  ) {
    return true;
  }

  // All other users (test fixtures, unnamed candidates, automated test accounts) are rejected
  return false;
}

export function cleanAllTestFixtures() {
  console.log('--- Cleaning test fixtures from database ---');

  // 1. Clean Users: Keep only legitimate users
  const allUsers = db.users.findAll();
  const legitimateUsers = allUsers.filter(isRealUser).map((u) => {
    if (u.id === 'user-1789503692368' || u.phone === '+919874950646') {
      return { ...u, name: 'messi', plan: 'pro' };
    }
    if (u.id === 'user-1789502668516' || u.phone === '+917758757575') {
      return { ...u, name: 'Toufiq', plan: 'free' };
    }
    return u;
  });

  if (!legitimateUsers.some((u) => u.phone === '+917758757575' || u.id === 'user-1789502668516')) {
    legitimateUsers.push({
      id: 'user-1789502668516',
      phone: '+917758757575',
      name: 'Toufiq',
      plan: 'free',
      createdAt: '2026-03-01T00:00:00.000Z',
    });
  }
  if (!legitimateUsers.some((u) => u.phone === '+919874950646' || u.id === 'user-1789503692368')) {
    legitimateUsers.push({
      id: 'user-1789503692368',
      phone: '+919874950646',
      name: 'messi',
      plan: 'pro',
      createdAt: '2026-03-01T00:00:00.000Z',
    });
  }

  const realUserIds = new Set(legitimateUsers.map((u) => u.id));

  db.users.data = legitimateUsers;
  db.users.save();

  // 2. Clean Profiles: Keep only profiles of legitimate users
  const profiles = db.profiles.findAll();
  db.profiles.data = profiles.filter((p) => {
    return (
      realUserIds.has(p.id) ||
      realUserIds.has(p.userId) ||
      p.id === '1788986432657-kr3wijqx8'
    );
  }).map((p) => {
    if (p.id === 'user-1789503692368' || p.userId === 'user-1789503692368') {
      return { ...p, name: 'messi', userId: 'user-1789503692368' };
    }
    if (p.id === '1788986432657-kr3wijqx8' || p.userId === 'user-1789502668516') {
      return { ...p, name: 'Toufiq', userId: 'user-1789502668516' };
    }
    return p;
  });

  if (!db.profiles.data.some((p) => p.userId === 'user-1789502668516' || p.id === '1788986432657-kr3wijqx8')) {
    db.profiles.data.push({
      id: '1788986432657-kr3wijqx8',
      userId: 'user-1789502668516',
      name: 'Toufiq',
      phone: '+917758757575',
      email: 'toufiq@example.com',
      role: 'Full Stack Developer',
      skills: ['React', 'Node.js'],
    });
  }
  if (!db.profiles.data.some((p) => p.userId === 'user-1789503692368' || p.id === 'user-1789503692368')) {
    db.profiles.data.push({
      id: 'user-1789503692368',
      userId: 'user-1789503692368',
      name: 'messi',
      phone: '+919874950646',
      role: 'Frontend Engineer',
      skills: ['Vue', 'React'],
    });
  }
  db.profiles.save();

  // 3. Clean Subscriptions: Keep only subscriptions belonging to legitimate users
  const subscriptions = db.subscriptions.findAll();
  db.subscriptions.data = subscriptions.filter((s) => {
    return (s.userId && realUserIds.has(s.userId)) || s.userId === 'user-1789502668516';
  }).map((s) => {
    if (s.userId === 'user-1789503692368' || s.phone === '+919874950646') {
      return { ...s, plan: 'pro', price: 799, status: 'active' };
    }
    if (s.userId === 'user-1789502668516' || s.phone === '+917758757575') {
      return { ...s, plan: 'free', price: 0, status: 'active' };
    }
    return s;
  });

  if (!db.subscriptions.data.some((s) => s.userId === 'user-1789502668516' || s.phone === '+917758757575')) {
    db.subscriptions.data.push({
      id: 'sub-toufiq',
      userId: 'user-1789502668516',
      phone: '+917758757575',
      plan: 'free',
      price: 0,
      status: 'active',
      credits: [],
    });
  }
  if (!db.subscriptions.data.some((s) => s.userId === 'user-1789503692368' || s.phone === '+919874950646')) {
    db.subscriptions.data.push({
      id: 'sub-messi',
      userId: 'user-1789503692368',
      phone: '+919874950646',
      plan: 'pro',
      price: 799,
      status: 'active',
      credits: [],
    });
  }
  db.subscriptions.save();

  // 4. Clean Quotas
  const quotas = db.quotas.findAll();
  db.quotas.data = quotas.filter((q) => {
    return (q.userId && realUserIds.has(q.userId)) || q.userId === 'user-1789502668516';
  });
  db.quotas.save();

  // 5. Clean Rewards
  const rewards = db.rewards.findAll();
  db.rewards.data = rewards.filter((r) => {
    return (r.userId && realUserIds.has(r.userId)) || r.userId === 'user-1789502668516';
  });
  db.rewards.save();

  // 6. Clean Referrals
  const referrals = db.referrals.findAll();
  db.referrals.data = referrals.filter((ref) => {
    return realUserIds.has(ref.userId) && realUserIds.has(ref.referrerId);
  });
  db.referrals.save();

  // 7. Clean Daily Usage
  const dailyUsage = db.dailyUsage.findAll();
  db.dailyUsage.data = dailyUsage.filter((du) => {
    return du.userId && realUserIds.has(du.userId);
  });
  db.dailyUsage.save();

  // 8. Clean Applications
  const applications = db.applications.findAll();
  db.applications.data = applications.filter((app) => {
    return app.userId && realUserIds.has(app.userId);
  });
  if (!db.applications.data.some((a) => realUserIds.has(a.userId))) {
    db.applications.data.push({
      id: 'app-toufiq-canonical-1',
      userId: 'user-1789502668516',
      jobId: 'job-builtin-1',
      status: 'applied',
      appliedAt: '2026-03-01T00:00:00.000Z',
    });
  }
  db.applications.save();

  // 9. Clean Sources: Preserve 3 platform builtin sources, keep custom only if belonging to real user
  const sources = db.sources.findAll();
  db.sources.data = sources.filter((s) => {
    if (s.type === 'builtin' || s.id.startsWith('demo-src-')) return true;
    if (s.id && (s.id.startsWith('custom-src-sync') || s.id.startsWith('custom-src-') || s.id.startsWith('src-test-'))) return false;
    const ownerId = s.userId || s.ownerUserId;
    return ownerId && realUserIds.has(ownerId);
  });
  db.sources.save();

  // 10. Clean Jobs: Preserve platform feed opportunities, remove test-generated jobs
  const jobs = db.jobs.findAll();
  db.jobs.data = jobs.filter((j) => {
    if (!j.id) return false;
    // Remove numeric-suffixed 'job-builtin-NNN' test-generated jobs
    if (/^job-builtin-\d+$/.test(j.id)) return false;
    // Remove any job seeded from a custom/test source
    if (j.id.startsWith('job-custom-') || j.id.startsWith('job-test-')) return false;
    if (j.sourceId && (j.sourceId.startsWith('custom-src-') || j.sourceId.startsWith('src-test-'))) return false;
    // Keep canonical builtin and demo seed jobs
    if (j.id.startsWith('job-builtin-') || j.id.startsWith('demo-job-')) return true;
    return false;
  });
  db.jobs.save();

  // 11. Clean Transactions: Keep only transactions belonging to legitimate users
  if (db.transactions) {
    const transactions = db.transactions.findAll();
    db.transactions.data = transactions.filter((t) => {
      return t.userId && realUserIds.has(t.userId);
    });
    db.transactions.save();
  }

  console.log(`Database scrubbed successfully.
- Remaining Users: ${db.users.count()}
- Remaining Profiles: ${db.profiles.count()}
- Remaining Subscriptions: ${db.subscriptions.count()}
- Remaining Applications: ${db.applications.count()}
- Remaining Sources: ${db.sources.count()}
- Remaining Jobs: ${db.jobs.count()}`);
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('cleanFixtures.js')) {
  cleanAllTestFixtures();
}
