import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/database.js';
import { validatePhoneNumber } from '../src/utils/validators.js';
import { formatBaseName, generateUniqueDisplayName } from '../src/utils/nameUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:5000';

test('NAME NUMBERING & PHONE UI VERIFICATION SUITE', async (t) => {
  // =========================================================================
  // SCENARIO 1: Valid +91 10-digit phone number passes validation
  // =========================================================================
  await t.test('Scenario 1: Valid +91 10-digit phone number passes validation', () => {
    const res1 = validatePhoneNumber('+91', '9876543210');
    assert.strictEqual(res1.isValid, true);
    assert.strictEqual(res1.normalizedNumber, '+919876543210');

    const res2 = validatePhoneNumber('+91', '7758757575');
    assert.strictEqual(res2.isValid, true);
    assert.strictEqual(res2.normalizedNumber, '+917758757575');
  });

  // =========================================================================
  // SCENARIO 2: Invalid phone number fails (too short, too long, non-numeric, spaces)
  // =========================================================================
  await t.test('Scenario 2: Invalid phone number fails validation', () => {
    // Fewer than 10 digits
    const resShort = validatePhoneNumber('+91', '987654321');
    assert.strictEqual(resShort.isValid, false);

    // More than 10 digits (e.g. 11 digits)
    const resLong = validatePhoneNumber('+91', '98765432101');
    assert.strictEqual(resLong.isValid, false);

    // Non-numeric / letters
    const resAlpha = validatePhoneNumber('+91', '987654321a');
    assert.strictEqual(resAlpha.isValid, false);

    // Contains spaces
    const resSpace = validatePhoneNumber('+91', '9876 54321');
    assert.strictEqual(resSpace.isValid, false);

    // Empty
    const resEmpty = validatePhoneNumber('+91', '');
    assert.strictEqual(resEmpty.isValid, false);
  });

  // =========================================================================
  // SCENARIO 3: "10/10 digits" is NOT visible anywhere in User App
  // =========================================================================
  await t.test('Scenario 3: "10/10 digits" is NOT visible in User App (Login.jsx & Welcome.jsx)', () => {
    const loginFile = fs.readFileSync(path.join(__dirname, '../src/pages/Login.jsx'), 'utf-8');
    const welcomeFile = fs.readFileSync(path.join(__dirname, '../src/pages/Welcome.jsx'), 'utf-8');

    // Must NOT contain digit counters
    assert.strictEqual(loginFile.includes('/10 digits'), false, 'Login.jsx must not contain /10 digits');
    assert.strictEqual(loginFile.includes('10/10 digits'), false, 'Login.jsx must not contain 10/10 digits');
    assert.strictEqual(welcomeFile.includes('/10 digits'), false, 'Welcome.jsx must not contain /10 digits');
    assert.strictEqual(welcomeFile.includes('10/10 digits'), false, 'Welcome.jsx must not contain 10/10 digits');

    // Must still retain dialing code display
    assert.ok(loginFile.includes('Dialing:'), 'Login.jsx must preserve dialing info');
    assert.ok(welcomeFile.includes('Country:'), 'Welcome.jsx must preserve country info');
  });

  // =========================================================================
  // SCENARIO 4: First user Toufiq Alam -> Toufiq Alam
  // =========================================================================
  await t.test('Scenario 4: First user "Toufiq Alam" -> "Toufiq Alam" (no suffix)', () => {
    const existing = [];
    const name = generateUniqueDisplayName('Toufiq Alam', 'user-1', existing);
    assert.strictEqual(name, 'Toufiq Alam');
  });

  // =========================================================================
  // SCENARIO 5: Second user Toufiq Alam -> Toufiq Alam 2
  // =========================================================================
  await t.test('Scenario 5: Second user "Toufiq Alam" -> "Toufiq Alam 2"', () => {
    const existing = [{ id: 'user-1', name: 'Toufiq Alam' }];
    const name = generateUniqueDisplayName('Toufiq Alam', 'user-2', existing);
    assert.strictEqual(name, 'Toufiq Alam 2');
  });

  // =========================================================================
  // SCENARIO 6: Third duplicate Toufiq Alam -> Toufiq Alam 3
  // =========================================================================
  await t.test('Scenario 6: Third duplicate "Toufiq Alam" -> "Toufiq Alam 3"', () => {
    const existing = [
      { id: 'user-1', name: 'Toufiq Alam' },
      { id: 'user-2', name: 'Toufiq Alam 2' },
    ];
    const name = generateUniqueDisplayName('Toufiq Alam', 'user-3', existing);
    assert.strictEqual(name, 'Toufiq Alam 3');
  });

  // =========================================================================
  // SCENARIO 7: Case-insensitive "toufiq alam" -> Toufiq Alam 4
  // =========================================================================
  await t.test('Scenario 7: Case-insensitive "toufiq alam" -> "Toufiq Alam 4"', () => {
    const existing = [
      { id: 'user-1', name: 'Toufiq Alam' },
      { id: 'user-2', name: 'Toufiq Alam 2' },
      { id: 'user-3', name: 'Toufiq Alam 3' },
    ];
    const name = generateUniqueDisplayName('toufiq alam', 'user-4', existing);
    assert.strictEqual(name, 'Toufiq Alam 4');
  });

  // =========================================================================
  // SCENARIO 8: Whitespace duplicate "  Toufiq   Alam  " -> next available suffix
  // =========================================================================
  await t.test('Scenario 8: Whitespace duplicate "  Toufiq   Alam  " -> next available suffix', () => {
    const existing = [
      { id: 'user-1', name: 'Toufiq Alam' },
      { id: 'user-2', name: 'Toufiq Alam 2' },
      { id: 'user-3', name: 'Toufiq Alam 3' },
      { id: 'user-4', name: 'Toufiq Alam 4' },
    ];
    const name = generateUniqueDisplayName('  Toufiq   Alam  ', 'user-5', existing);
    assert.strictEqual(name, 'Toufiq Alam 5');
  });

  // =========================================================================
  // SCENARIO 9: Gap handling (Toufiq Alam, Toufiq Alam 2, Toufiq Alam 4) -> Toufiq Alam 3
  // =========================================================================
  await t.test('Scenario 9: Gap handling ("Toufiq Alam", "Toufiq Alam 2", "Toufiq Alam 4") -> "Toufiq Alam 3"', () => {
    const existing = [
      { id: 'user-1', name: 'Toufiq Alam' },
      { id: 'user-2', name: 'Toufiq Alam 2' },
      { id: 'user-4', name: 'Toufiq Alam 4' }, // Note: 3 is missing!
    ];
    const name = generateUniqueDisplayName('Toufiq Alam', 'user-gap', existing);
    assert.strictEqual(name, 'Toufiq Alam 3', 'Must fill the lowest available suffix 3');
  });

  // =========================================================================
  // SCENARIO 10: Existing user edits own profile keeping name -> unchanged
  // =========================================================================
  await t.test('Scenario 10: Existing user edits own profile keeping name -> unchanged', () => {
    const existing = [
      { id: 'user-1', name: 'Toufiq Alam' },
      { id: 'user-2', name: 'Toufiq Alam 2' },
      { id: 'user-3', name: 'Toufiq Alam 3' },
    ];

    // User 2 edits their profile, submitting "Toufiq Alam 2"
    const nameSelf = generateUniqueDisplayName('Toufiq Alam 2', 'user-2', existing);
    assert.strictEqual(nameSelf, 'Toufiq Alam 2', 'User 2 must keep their name unchanged');

    // User 1 edits their profile, submitting "toufiq alam" (case variation)
    const nameUser1 = generateUniqueDisplayName('toufiq alam', 'user-1', existing);
    assert.strictEqual(nameUser1, 'Toufiq Alam', 'User 1 must keep their name without suffix');
  });

  // =========================================================================
  // SCENARIO 11: Live API Integration with POST /api/profile
  // =========================================================================
  await t.test('Scenario 11: Live API POST /api/profile deduplication and silent assignment', async () => {
    // 1. Create Profile for test user A
    const resA = await fetch(`${BASE_URL}/api/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-a',
      },
      body: JSON.stringify({
        userId: 'test-user-a',
        name: 'Sarah Designer',
        email: 'sarah@example.com',
        profession: 'UI/UX Designer',
      }),
    });
    const dataA = await resA.json();
    assert.strictEqual(dataA.success, true);
    assert.strictEqual(dataA.profile.name, 'Sarah Designer');

    // 2. Create Profile for test user B with same name
    const resB = await fetch(`${BASE_URL}/api/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-b',
      },
      body: JSON.stringify({
        userId: 'test-user-b',
        name: '  sarah   designer  ',
        email: 'sarah.b@example.com',
        profession: 'Product Designer',
      }),
    });
    const dataB = await resB.json();
    assert.strictEqual(dataB.success, true);
    assert.strictEqual(dataB.profile.name, 'Sarah Designer 2');

    // 3. User A edits their own profile -> keeps "Sarah Designer" without adding a number
    const resAEdit = await fetch(`${BASE_URL}/api/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-a',
      },
      body: JSON.stringify({
        userId: 'test-user-a',
        name: 'Sarah Designer',
        bio: 'Updated bio by Sarah',
      }),
    });
    const dataAEdit = await resAEdit.json();
    assert.strictEqual(dataAEdit.success, true);
    assert.strictEqual(dataAEdit.profile.name, 'Sarah Designer');

    // 4. Create Profile for test user C with same name -> gets "Sarah Designer 3"
    const resC = await fetch(`${BASE_URL}/api/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-c',
      },
      body: JSON.stringify({
        userId: 'test-user-c',
        name: 'SARAH DESIGNER',
        email: 'sarah.c@example.com',
      }),
    });
    const dataC = await resC.json();
    assert.strictEqual(dataC.success, true);
    assert.strictEqual(dataC.profile.name, 'Sarah Designer 3');

    // Clean up test users from DB
    db.users.data = db.users.data.filter((u) => !['test-user-a', 'test-user-b', 'test-user-c'].includes(u.id));
    db.users.save();
    db.profiles.data = db.profiles.data.filter((p) => !['test-user-a', 'test-user-b', 'test-user-c'].includes(p.userId));
    db.profiles.save();
  });
});
