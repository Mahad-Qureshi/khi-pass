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
const users = [], merchants = [];
async function makeUser() {
  const email = `phase7-browser-${randomUUID()}@example.invalid`, password = randomBytes(22).toString('base64url');
  const saved = await ok(service.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(saved.user.id);
  return { id: saved.user.id, email, password };
}
function sql(query) {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_khi-pass', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', query],
    { env, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
}
async function signIn(page, user) {
  await page.goto(`${origin}/auth/login?next=%2Fadmin`);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/admin');
}
let browser;
try {
  const admin = await makeUser(), owner = await makeUser(), ordinary = await makeUser();
  sql(`insert into private.platform_admins(user_id) values('${admin.id}')`);
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${width}: ${message.text()}`); });
    await page.goto(`${origin}/admin`);
    await page.waitForURL('**/auth/login?next=%2Fadmin');
    await signIn(page, admin);
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Admin overview overflow at ${width}px`);
    await page.getByRole('link', { name: 'Merchants', exact: true }).click();
    await page.getByRole('heading', { name: /merchants/i }).waitFor();
    await page.getByLabel('Find registered user by name or ID').fill(owner.id);
    await page.getByRole('button', { name: 'Find user' }).click();
    await page.waitForURL(new RegExp(`user=${owner.id}`));
    await page.getByLabel('Registered owner').click();
    await page.getByRole('option', { name: new RegExp(owner.id) }).click();
    await page.getByLabel('Business name').fill(`Phase 7 browser ${width}`);
    const slug = `phase7-browser-${randomUUID()}`;
    await page.getByLabel('Slug', { exact: true }).fill(slug);
    await page.getByLabel('Business type').fill('fictional');
    await page.getByRole('button', { name: 'Create merchant' }).click();
    await page.getByRole('dialog', { name: 'Confirm merchant owner' }).getByText(owner.id, { exact: false }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm creation' }).click();
    await page.waitForURL(/\/admin\/merchants\/[a-f0-9-]{36}$/);
    const id = page.url().split('/').at(-1);
    merchants.push(id);
    await page.getByText('Current status: pending').waitFor();
    await page.getByRole('button', { name: 'approved' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await page.getByText('Current status: approved').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Merchant detail overflow at ${width}px`);
    await context.close();
    console.log(`Admin dashboard ${width}px passed`);
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, ordinary);
  await page.getByText('404').first().waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Overview' }).count(), 0);
  await context.close();
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  for (const id of merchants) await ok(service.from('merchants').delete().eq('id', id));
  for (const id of users) await ok(service.auth.admin.deleteUser(id));
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'), fingerprint);
}
