// LOCAL ONLY. Run against a local-configured next start server.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const fingerprint = createHash('sha256').update(readFileSync('.env.local')).digest('hex');
assert.equal(existsSync('supabase/.temp/project-ref'), false, 'Refusing linked workspace');
const origin = process.env.KHI_LOCAL_UI_ORIGIN;
assert.ok(origin && /^http:\/\/(localhost|127\.0\.0\.1):[1-9]\d{0,4}$/.test(origin) && Number(new URL(origin).port) <= 65535, 'Use a local UI origin with a valid port');
const dockerPath = join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe');
const env = { ...process.env, PATH: dirname(dockerPath) + delimiter + process.env.PATH, DOCKER_CONTEXT: 'desktop-linux' };
const output = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { env, encoding: 'utf8', timeout: 30000 });
assert.equal(output.status, 0, 'Start local Supabase first');
const local = JSON.parse(output.stdout.slice(output.stdout.indexOf('{')));
assert.equal(local.API_URL, 'http://127.0.0.1:54321');
assert.equal(new URL(local.DB_URL).hostname, '127.0.0.1');
const service = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const cache = join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const modulePath = readdirSync(cache).map(entry => join(cache, entry, 'node_modules', 'playwright', 'index.mjs')).find(existsSync);
assert.ok(modulePath, 'Cached Playwright is required');
const { chromium } = await import(pathToFileURL(modulePath).href);

const email = `navigation-browser-${randomUUID()}@example.invalid`;
const password = randomBytes(24).toString('base64url');
let browser;
let userId;
try {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null, created.error?.message);
  userId = created.data.user.id;
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  for (const width of [390, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(origin + '/plans');
    await page.waitForURL('**/auth/login?next=%2Fplans');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/plans');
    await page.getByLabel('Plan title').waitFor();

    const header = page.getByRole('banner');
    const mobile = page.locator('nav[aria-label="Mobile navigation"]');
    const primary = page.locator('nav[aria-label="Primary navigation"]');
    assert.equal(await header.count(), 1);
    assert.equal(await mobile.count(), 1);
    assert.equal(await primary.count(), 1);
    assert.equal(await page.locator('main#main-content').count(), 1);
    assert.equal(await mobile.isVisible(), width < 900);
    assert.equal(await primary.isVisible(), width >= 900);
    const nav = width < 900 ? mobile : primary;

    if (width < 900) {
      const spacing = await page.evaluate(() => ({
        main: parseFloat(getComputedStyle(document.querySelector('#main-content')).paddingBottom),
        bottom: document.querySelector('nav[aria-label="Mobile navigation"]').getBoundingClientRect().bottom,
      }));
      assert.ok(spacing.main >= 72, 'Content must clear the mobile navigation and safe area');
      assert.equal(spacing.bottom, 844, 'Mobile navigation must reach the viewport bottom');
    }

    const focus = async link => {
      await link.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await link.evaluate(element => element.matches(':focus-visible')), true);
      assert.notEqual(await link.evaluate(element => getComputedStyle(element).outlineStyle), 'none');
    };
    await focus(header.getByRole('link', { name: 'KHI PASS home' }));
    assert.equal(await nav.locator('a[href="/plans"][aria-current="page"]').count(), 1);
    for (const [label, path] of [['Discover', '/discover'], ['PASS Drops', '/drops'], ['Plans', '/plans']]) {
      const link = nav.getByRole('link', { name: label, exact: true });
      await link.click();
      await page.waitForURL(`**${path}`);
      await nav.locator(`a[href="${path}"][aria-current="page"]`).waitFor();
      await focus(link);
      assert.equal(await page.locator('main#main-content').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${label} overflow at ${width}px`);
    }
    const profile = width < 900 ? mobile.getByRole('link', { name: 'Profile' }) : header.getByRole('link', { name: 'Profile' });
    await profile.click();
    await page.waitForURL('**/profile');
    await page.getByRole('heading', { name: 'Your profile' }).waitFor();
    assert.equal(await page.getByRole('navigation').count(), 0, 'Profile uses AuthShell');
    assert.equal(await page.getByRole('main').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Profile overflow at ${width}px`);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Signed-in navigation ${width}px passed`);
  }
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    if (userId) {
      const removed = await service.auth.admin.deleteUser(userId);
      assert.equal(removed.error, null, removed.error?.message);
    }
    assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'), fingerprint);
  }
}
