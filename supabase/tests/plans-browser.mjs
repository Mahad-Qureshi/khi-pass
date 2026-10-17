// LOCAL ONLY. Run against a local-configured app on port 3101.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const fingerprint = createHash('sha256').update(readFileSync('.env.local')).digest('hex');
assert.equal(existsSync('supabase/.temp/project-ref'), false, 'Refusing linked workspace');
const origin = process.env.KHI_LOCAL_UI_ORIGIN;
assert.ok(origin && /^http:\/\/(localhost|127\.0\.0\.1):3101$/.test(origin), 'Use local UI port 3101');
const dockerPath = join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe');
const env = { ...process.env, PATH: dirname(dockerPath) + delimiter + process.env.PATH, DOCKER_CONTEXT: 'desktop-linux' };
const output = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { env, encoding: 'utf8', timeout: 30000 });
assert.equal(output.status, 0, 'Start local Supabase first');
const local = JSON.parse(output.stdout.slice(output.stdout.indexOf('{')));
assert.equal(local.API_URL, 'http://127.0.0.1:54321');
const service = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = async promise => { const { data, error } = await promise; assert.equal(error, null, error?.message); return data; };
const cache = join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const modulePath = readdirSync(cache).map(entry => join(cache, entry, 'node_modules', 'playwright', 'index.mjs')).find(existsSync);
assert.ok(modulePath, 'Cached Playwright is required');
const { chromium } = await import(pathToFileURL(modulePath).href);
const users = [];
async function makeUser() {
  const email = `phase5-browser-${randomUUID()}@example.invalid`, password = randomBytes(24).toString('base64url');
  const created = await ok(service.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(created.user.id); return { email, password };
}
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  for (const width of [390, 1280]) {
    console.log(`Checking ${width}px viewport`);
    const owner = await makeUser();
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${width}: ${message.text()}`); });
    await page.goto(origin + '/favorites');
    await page.waitForURL('**/auth/login?next=%2Ffavorites');
    await page.getByLabel('Email address').fill(owner.email);
    await page.getByLabel('Password').fill(owner.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/favorites');
    await page.getByText('No published saved experiences yet').waitFor();
    await page.goto(origin + '/discover/demo-khi-watercolor-evening');
    await page.getByRole('button', { name: 'Save experience' }).click();
    await page.getByRole('button', { name: 'Remove saved experience' }).waitFor();
    await page.goto(origin + '/favorites');
    await page.getByRole('link', { name: /Watercolor Evening/ }).waitFor();
    await page.goto(origin + '/plans');
    await page.getByLabel('Plan title').fill(`Browser outing ${width}`);
    await page.getByLabel('Outing date in Karachi').fill('2027-01-15');
    await page.getByRole('button', { name: 'Create plan' }).click();
    await page.waitForURL(/\/plans\/[0-9a-f-]{36}$/);
    await page.getByText('No published experiences in this plan yet').waitFor();
    await page.getByLabel('Add a published experience').click();
    await page.getByRole('option', { name: /Watercolor Evening/ }).click({ force: true });
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('link', { name: /Watercolor Evening/ }).waitFor();
    await page.getByRole('button', { name: 'Share plan' }).click();
    const shareHref = await page.locator('a[href^="/plans/share/"]').getAttribute('href');
    assert.match(shareHref, /^\/plans\/share\/[a-f0-9]{64}$/);
    const guest = await (await browser.newContext({ viewport: { width, height: 844 } })).newPage();
    let failedJoinRequest = false, expectedTransportConsoleErrors = 1;
    guest.on('pageerror', error => errors.push(`${width} guest: ${error.message}`));
    guest.on('console', message => {
      if (message.type() !== 'error') return;
      if (failedJoinRequest && expectedTransportConsoleErrors > 0 && message.text() === 'Failed to load resource: net::ERR_FAILED') { expectedTransportConsoleErrors--; return; }
      errors.push(`${width} guest: ${message.text()}`);
    });
    const sharedResponse = await guest.goto(origin + shareHref);
    assert.equal(sharedResponse.headers()['referrer-policy'], 'no-referrer');
    await guest.getByLabel('Your nickname').fill(`Guest\u202e`);
    await guest.getByRole('button', { name: 'Join to vote' }).click();
    await guest.getByText('Remove control characters from the nickname.').waitFor();
    assert.equal((await guest.context().cookies(origin + shareHref)).some(cookie => cookie.name === `khi_plan_${shareHref.split('/').at(-1)}`), false);
    await guest.route('**/plans/share/**', async route => {
      if (!failedJoinRequest && route.request().method() === 'POST' && route.request().headers()['next-action']) {
        failedJoinRequest = true;
        await route.abort('failed');
      } else await route.continue();
    });
    await guest.getByLabel('Your nickname').fill('Guest');
    await guest.getByRole('button', { name: 'Join to vote' }).click();
    await guest.getByText('Unable to join plan. Try again.').waitFor();
    assert.equal(failedJoinRequest, true);
    assert.equal(expectedTransportConsoleErrors, 0);
    await guest.unrouteAll();
    await guest.getByRole('button', { name: 'Join to vote' }).click();
    await guest.getByRole('button', { name: 'Yes', exact: true }).waitFor();
    const participantCookie = (await guest.context().cookies(origin + shareHref)).find(cookie => cookie.name === `khi_plan_${shareHref.split('/').at(-1)}`);
    assert.ok(participantCookie);
    assert.equal(participantCookie.httpOnly, true);
    assert.equal(participantCookie.secure, true);
    assert.equal(participantCookie.sameSite, 'Lax');
    assert.equal(participantCookie.path, shareHref);
    assert.ok(participantCookie.expires > Date.now() / 1000 + 29 * 86400);
    await guest.getByRole('button', { name: 'Yes', exact: true }).click();
    await guest.getByText('Yes 1').waitFor();
    await guest.getByRole('button', { name: 'Maybe', exact: true }).click();
    await guest.getByText('Maybe 1').waitFor();
    assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `guest ${width}px overflow`);
    await page.getByRole('button', { name: 'Replace share link' }).click();
    await page.waitForFunction(oldHref => document.querySelector('a[href^="/plans/share/"]')?.getAttribute('href') !== oldHref, shareHref);
    const newShareHref = await page.locator('a[href^="/plans/share/"]').getAttribute('href');
    assert.match(newShareHref, /^\/plans\/share\/[a-f0-9]{64}$/);
    await guest.goto(origin + shareHref);
    await guest.getByText('404').first().waitFor();
    await guest.goto(origin + newShareHref);
    await guest.getByRole('button', { name: 'Join to vote' }).waitFor();
    await page.getByRole('button', { name: 'Make private' }).click();
    await page.getByRole('button', { name: 'Share plan' }).waitFor();
    await guest.goto(origin + newShareHref);
    await guest.getByText('404').first().waitFor();
    for (const p of [page, guest]) assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px overflow`);
    await context.close(); await guest.context().close();
    console.log(`${width}px: favorite, plan, share, vote change, private link, no overflow`);
  }
  assert.deepEqual(errors, []);
  console.log('No browser runtime or hydration errors');
} finally {
  if (browser) await browser.close();
  for (const id of users) await service.auth.admin.deleteUser(id);
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'), fingerprint);
}
