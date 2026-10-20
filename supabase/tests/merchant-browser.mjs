// LOCAL ONLY. Run with KHI_LOCAL_UI_ORIGIN=http://127.0.0.1:3101.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const fingerprint = createHash('sha256').update(readFileSync('.env.local')).digest('hex');
assert.equal(existsSync('supabase/.temp/project-ref'), false, 'Refusing linked workspace');
const origin = process.env.KHI_LOCAL_UI_ORIGIN;
assert.ok(origin && /^http:\/\/(localhost|127\.0\.0\.1):3101$/.test(origin), 'Only local app on port 3101 is allowed');
assert.ok(process.env.LOCALAPPDATA, 'Windows local browser verification only');
const dockerPath = join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe');
const env = { ...process.env, PATH: dirname(dockerPath) + delimiter + process.env.PATH, DOCKER_CONTEXT: 'desktop-linux' };
const command = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { env, encoding: 'utf8', timeout: 30000 });
assert.equal(command.status, 0, 'Start local Supabase first');
const local = JSON.parse(command.stdout.slice(command.stdout.indexOf('{')));
assert.equal(local.API_URL, 'http://127.0.0.1:54321');
const service = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = async promise => { const { data, error } = await promise; assert.equal(error, null, error?.message); return data; };
const cache = join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const modulePath = readdirSync(cache).map(entry => join(cache, entry, 'node_modules', 'playwright', 'index.mjs')).find(existsSync);
assert.ok(modulePath, 'Cached Playwright required');
const { chromium } = await import(pathToFileURL(modulePath).href);
const accounts = [], createdVenues = [];
async function makeUser() {
  const email = `phase6-browser-${randomUUID()}@example.invalid`, password = randomBytes(22).toString('base64url');
  const saved = await ok(service.auth.admin.createUser({ email, password, email_confirm: true }));
  accounts.push(saved.user.id);
  return { id: saved.user.id, email, password };
}
async function signIn(page, user) {
  await page.goto(origin + '/merchant');
  await page.waitForURL('**/auth/login?next=%2Fmerchant');
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/merchant');
}
let browser;
try {
  const merchant = await ok(service.from('merchants').select('id').eq('slug', 'demo-khi-moonpaper-studio').single());
  const other = await ok(service.from('merchants').select('id').eq('slug', 'demo-khi-pixel-cove').single());
  const owner = await makeUser(), staff = await makeUser();
  await ok(service.from('merchant_members').insert([
    { merchant_id: merchant.id, user_id: owner.id, role: 'owner' },
    { merchant_id: merchant.id, user_id: staff.id, role: 'staff' },
  ]));
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${width}: ${message.text()}`); });
    await signIn(page, owner);
    await page.getByRole('link', { name: /Moonpaper Studio/i }).click();
    await page.waitForURL(`**/merchant/${merchant.id}`);
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    const overviewOverflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll('*')].filter(element => element.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 5).map(element => `${element.tagName}.${String(element.className).slice(0, 80)}`),
    }));
    assert.equal(overviewOverflow.width <= width, true, `Overview overflow ${width}px: ${JSON.stringify(overviewOverflow)}`);
    await page.getByRole('link', { name: 'Venues', exact: true }).click();
    await page.getByRole('link', { name: 'Create venue' }).click();
    await page.getByRole('button', { name: 'Save venue' }).click();
    await page.getByText('String must contain at least 1 character').first().waitFor();
    const slug = `phase6-browser-${randomUUID()}`;
    await page.getByLabel('Venue name').fill(`Local browser venue ${width}`);
    await page.getByLabel('URL slug').fill(slug);
    await page.getByLabel('Address').fill('LOCAL TEST ONLY, fictional address, Karachi');
    await page.getByRole('button', { name: 'Save venue' }).click();
    await page.waitForURL(new RegExp(`/merchant/${merchant.id}/venues/[a-f0-9-]{36}$`));
    const id = page.url().split('/').at(-1);
    createdVenues.push(id);
    await page.getByRole('button', { name: 'Submit for approval' }).click();
    await page.getByText('Current status: pending approval').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Editor overflow ${width}px`);
    await page.goto(`${origin}/merchant/${other.id}`);
    await page.getByText('404').first().waitFor();
    assert.equal(await page.getByRole('heading', { name: /Pixel Cove/i }).count(), 0, 'Other merchant data must stay hidden');
    await context.close();
    console.log(`Merchant dashboard ${width}px passed`);
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staffPage = await context.newPage();
  await signIn(staffPage, staff);
  await staffPage.goto(`${origin}/merchant/${merchant.id}/venues`);
  await staffPage.getByRole('heading', { name: /Venues/ }).waitFor();
  assert.equal(await staffPage.getByRole('link', { name: 'Create venue' }).count(), 0);
  await staffPage.goto(`${origin}/merchant/${merchant.id}/venues/new`);
  await staffPage.getByText('404').first().waitFor();
  await context.close();
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  for (const id of createdVenues) await ok(service.from('venues').delete().eq('id', id));
  for (const id of accounts) await ok(service.auth.admin.deleteUser(id));
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'), fingerprint);
}
