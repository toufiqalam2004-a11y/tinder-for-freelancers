import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/database.js';
import { activeSessions } from '../server/sessions.js';
import { cleanAllTestFixtures } from './cleanFixtures.js';

const BASE_URL = 'http://localhost:5000';
const ADMIN_PASSKEY = process.env.ADMIN_SECRET_KEY || 'tf-admin-secret-2026';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('FINAL ADMIN DATA CLEANUP & TOP-UP MONITORING TEST SUITE', async (t) => {
  let adminToken = null;

  // Clean all fixtures prior to verification
  cleanAllTestFixtures();

  // 1. Admin Authentication
  await t.test('Step 1: Admin logs in successfully', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
    adminToken = data.token;
  });

  // 2. Database User Verification: ONLY Toufiq and messi exist
  await t.test('Step 2: Database contains strictly the 2 legitimate users (Toufiq and messi)', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.total, 2, 'Total users in database must be strictly 2');

    const names = data.users.map((u) => u.name).sort();
    assert.deepStrictEqual(names, ['Toufiq', 'messi']);

    const toufiq = data.users.find((u) => u.name === 'Toufiq');
    assert.ok(toufiq);
    assert.strictEqual(toufiq.phone, '+917758757575');
    assert.strictEqual(toufiq.plan, 'free');

    const messi = data.users.find((u) => u.name === 'messi');
    assert.ok(messi);
    assert.strictEqual(messi.phone, '+919874950646');
    assert.strictEqual(messi.plan, 'pro');

    const dbUsers = db.users.findAll();
    assert.strictEqual(dbUsers.length, 2);
  });

  // 3. Subscription Tiers Verification: Free = 1, Plus = 0, Pro = 1
  await t.test('Step 3: Subscriptions summary matches actual users (Free: 1, Plus: 0, Pro: 1)', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/subscriptions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.stats.total, 2);
    assert.strictEqual(data.stats.free, 1);
    assert.strictEqual(data.stats.plus, 0);
    assert.strictEqual(data.stats.pro, 1);
  });

  // 4. Initial Top-Up Monitoring State: 0 top-ups, 0 revenue, empty transactions list
  await t.test('Step 4: Top-Up monitoring starts in clean state (0 top-ups, zero fabricated revenue)', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/admin/top-ups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.stats.totalTopUps, 0);
    assert.strictEqual(data.stats.totalCreditsPurchased, 0);
    assert.strictEqual(data.stats.successfulTransactions, 0);
    assert.strictEqual(data.stats.topUpRevenue.INR, 0);
    assert.strictEqual(data.stats.topUpRevenue.USD, 0);
    assert.strictEqual(data.transactions.length, 0);
  });

  // 5. Candidate Credit Top-Up Lifecycle: Real Purchase -> Admin Monitoring Reflection
  let testCreditId = null;
  let userToken = null;
  await t.test('Step 5: User tops up credits -> Admin dashboard reflects transaction and updated metrics', async () => {
    userToken = `tf-sess-test-${Date.now()}`;
    activeSessions.set(userToken, {
      userId: 'user-1789502668516',
      phone: '+917758757575',
      role: 'user',
      expiresAt: Date.now() + 3600000,
    });

    const buyRes = await fetchJson(`${BASE_URL}/api/credits/demo-buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        userId: 'user-1789502668516',
        packageId: 'credits_20',
        amount: 20,
        price: 49,
        currency: 'INR',
      }),
    });
    assert.strictEqual(buyRes.status, 200);
    assert.strictEqual(buyRes.data.success, true);
    assert.strictEqual(buyRes.data.credit.amount, 20);
    testCreditId = buyRes.data.credit.id;

    const adminSubsRes = await fetchJson(`${BASE_URL}/api/admin/subscriptions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminSubsRes.status, 200);
    assert.ok(adminSubsRes.data.topUps);
    assert.strictEqual(adminSubsRes.data.topUps.stats.totalTopUps, 1);
    assert.strictEqual(adminSubsRes.data.topUps.stats.totalCreditsPurchased, 20);
    assert.strictEqual(adminSubsRes.data.topUps.stats.successfulTransactions, 1);
    assert.strictEqual(adminSubsRes.data.topUps.stats.topUpRevenue.INR, 49);

    const tx = adminSubsRes.data.topUps.transactions.find((t) => t.id === testCreditId);
    assert.ok(tx, 'Transaction must appear in Admin top-up ledger');
    assert.strictEqual(tx.userName, 'Toufiq');
    assert.strictEqual(tx.userPhone, '+917758757575');
    assert.strictEqual(tx.amount, 49);
    assert.strictEqual(tx.formattedAmount, '₹49');
    assert.strictEqual(tx.currency, 'INR');
    assert.strictEqual(tx.creditsAdded, 20);
    assert.strictEqual(tx.status, 'Successful');
    assert.strictEqual(tx.paymentNature, 'Demo / Test');
    assert.strictEqual(tx.transactionId, testCreditId);

    const adminTopUpsRes = await fetchJson(`${BASE_URL}/api/admin/top-ups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminTopUpsRes.status, 200);
    assert.strictEqual(adminTopUpsRes.data.stats.totalTopUps, 1);
    assert.strictEqual(adminTopUpsRes.data.stats.totalCreditsPurchased, 20);
    assert.strictEqual(adminTopUpsRes.data.stats.topUpRevenue.INR, 49);
  });

  t.after(async () => {
    if (userToken) activeSessions.delete(userToken);
    const toufiqSub = db.subscriptions.findOne((s) => s.userId === 'user-1789502668516');
    if (toufiqSub) {
      toufiqSub.credits = [];
      db.subscriptions.insert(toufiqSub);
    }
    if (testCreditId && db.transactions) {
      db.transactions.delete(testCreditId);
    }
    cleanAllTestFixtures();
  });
});
