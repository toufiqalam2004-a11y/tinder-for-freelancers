import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { APK_CONFIG } from '../src/config/apkConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:5000';

async function fetchRes(url, options = {}) {
  const res = await fetch(url, options);
  return res;
}

test('LANDING PAGE CTA FLOW & APK DOWNLOAD SUITE', async (t) => {
  // Test 1: Verify APK Config export and configurable URL
  await t.test('Test 1: APK_CONFIG is centralized and properly configured', () => {
    assert.ok(APK_CONFIG, 'APK_CONFIG must be exported');
    assert.strictEqual(APK_CONFIG.fileName, 'app-release.apk');
    assert.strictEqual(APK_CONFIG.url, '/app-release.apk');
    assert.ok(APK_CONFIG.version, 'Version must be defined');
  });

  // Test 2: Physical APK File exists in public/ directory
  await t.test('Test 2: Physical APK file exists in public/ directory', () => {
    const publicApkPath = path.join(__dirname, '../public/app-release.apk');
    assert.ok(fs.existsSync(publicApkPath), 'public/app-release.apk must exist on disk');
    const stats = fs.statSync(publicApkPath);
    assert.ok(stats.size > 0, 'APK file size must be greater than 0 bytes');
  });

  // Test 3: Backend /app-release.apk download endpoint works with Android MIME headers
  await t.test('Test 3: /app-release.apk returns 200 with Android package MIME and attachment disposition', async () => {
    const res = await fetchRes(`${BASE_URL}/app-release.apk`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(
      contentType && contentType.includes('application/vnd.android.package-archive'),
      'Content-Type must be application/vnd.android.package-archive'
    );
    const contentDisposition = res.headers.get('content-disposition');
    assert.ok(
      contentDisposition && contentDisposition.includes('filename="app-release.apk"'),
      'Content-Disposition must specify filename="app-release.apk"'
    );
  });

  // Test 4: Dedicated /api/download/apk alias also works
  await t.test('Test 4: /api/download/apk alias works identically', async () => {
    const res = await fetchRes(`${BASE_URL}/api/download/apk`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(
      contentType && contentType.includes('application/vnd.android.package-archive'),
      'Content-Type must be application/vnd.android.package-archive'
    );
  });

  // Test 5: Landing.jsx contains both buttons and visual download states
  await t.test('Test 5: Landing.jsx contains Start Demo, Download Android App, Downloading…, Download Started ✓', () => {
    const landingCode = fs.readFileSync(path.join(__dirname, '../src/pages/Landing.jsx'), 'utf-8');
    
    // 1. Buttons exist
    assert.ok(landingCode.includes('Start Demo'), 'Landing page must contain "Start Demo" button');
    assert.ok(landingCode.includes('Download Android App'), 'Landing page must contain "Download Android App" button');

    // 2. Visual states exist
    assert.ok(landingCode.includes('Downloading…'), 'Landing page must contain "Downloading…" visual state');
    assert.ok(landingCode.includes('Download Started ✓'), 'Landing page must contain "Download Started ✓" visual state');

    // 3. Error handling exists
    assert.ok(landingCode.includes('errorMessage'), 'Landing page must handle download error message');
    assert.ok(landingCode.includes('handleDownloadApk'), 'Landing page must have handleDownloadApk function');

    // 4. Config is referenced
    assert.ok(landingCode.includes('APK_CONFIG'), 'Landing page must reference APK_CONFIG');
  });

  // Test 6: Start Demo does NOT trigger handleDownloadApk and calls handleStartDemo
  await t.test('Test 6: Start Demo button connects to handleStartDemo and does NOT call handleDownloadApk', () => {
    const landingCode = fs.readFileSync(path.join(__dirname, '../src/pages/Landing.jsx'), 'utf-8');

    // Start Demo must NOT trigger handleDownloadApk
    assert.ok(
      !landingCode.includes("handleDownloadApk('demo')"),
      'Start Demo must NOT call handleDownloadApk'
    );
    assert.ok(
      !landingCode.includes("handleDownloadApk('demo-bottom')"),
      'Bottom Start Demo must NOT call handleDownloadApk'
    );

    // Start Demo title tooltip must NOT mention APK
    assert.ok(
      !landingCode.includes('title="Start Demo (Download Android APK)"'),
      'Start Demo tooltip must NOT mention APK download'
    );

    // Start Demo buttons connect to handleStartDemo
    assert.ok(
      landingCode.includes('onClick={handleStartDemo}'),
      'Start Demo buttons must call handleStartDemo'
    );
  });

  // Test 7: Download Android App is the ONLY button responsible for APK downloading
  await t.test('Test 7: Download Android App is the ONLY button responsible for APK downloading', () => {
    const landingCode = fs.readFileSync(path.join(__dirname, '../src/pages/Landing.jsx'), 'utf-8');

    // Verify Download Android App calls handleDownloadApk
    assert.ok(
      landingCode.includes("handleDownloadApk('android')"),
      'Hero Download Android App must call handleDownloadApk'
    );
    assert.ok(
      landingCode.includes("handleDownloadApk('android-bottom')"),
      'Bottom Download Android App must call handleDownloadApk'
    );
  });

  // Test 8: Start Demo opens /login in a new tab and does not create random phone numbers or user accounts
  await t.test('Test 8: handleStartDemo opens /login in a new tab without generating accounts or mutating state', () => {
    const landingCode = fs.readFileSync(path.join(__dirname, '../src/pages/Landing.jsx'), 'utf-8');
    
    // Ensure handleStartDemo opens /login in a new tab (_blank)
    const startDemoMatch = landingCode.match(/const handleStartDemo = \([\s\S]*?\) => \{([\s\S]*?)\};/);
    assert.ok(startDemoMatch, 'handleStartDemo must be defined');
    const body = startDemoMatch[1];
    assert.ok(
      body.includes("window.open('/login', '_blank'") || body.includes('window.open("/login", "_blank"'),
      'handleStartDemo must open /login in _blank new tab'
    );
    assert.ok(!body.includes('Math.random()'), 'handleStartDemo must not generate random accounts');
    assert.ok(!body.includes('phone'), 'handleStartDemo must not assign phone numbers');
  });

  // Test 9: Unconfigured APK fallback message is safe and informative
  await t.test('Test 9: handleDownloadApk has coming soon fallback when APK is unavailable', () => {
    const landingCode = fs.readFileSync(path.join(__dirname, '../src/pages/Landing.jsx'), 'utf-8');
    assert.ok(
      landingCode.includes('Android APK coming soon / download currently unavailable.'),
      'Must contain fallback message when APK is unconfigured or unavailable'
    );
  });
});
