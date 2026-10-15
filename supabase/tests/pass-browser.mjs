// LOCAL ONLY. Browser verification requires a local-configured app on port 3101.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

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
const adminClient = createClient(local.API_URL, local.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = async promise => { const { data, error } = await promise; assert.equal(error, null, error?.message); return data; };
const sql = statement => {
  const run = spawnSync(dockerPath, ['--context','desktop-linux','exec','-i','supabase_db_khi-pass','psql','-X','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], { input: statement, encoding: 'utf8', env, timeout: 30000 });
  assert.equal(run.status, 0, run.stderr?.slice(0, 500));
};
const cache = join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const modulePath = readdirSync(cache).map(entry => join(cache, entry, 'node_modules','playwright','index.mjs')).find(existsSync);
assert.ok(modulePath, 'Cached Playwright is required');
const { chromium } = await import(pathToFileURL(modulePath).href);
const users = [];
async function makeUser(label) {
  const email = `phase4-browser-${randomUUID()}-${label}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const created = await ok(service.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(created.user.id);
  return { id: created.user.id, email, password };
}
let browser;
const errors = [];
try {
  const [admin, customer, other, staff] = await Promise.all([makeUser('admin'),makeUser('customer'),makeUser('other'),makeUser('staff')]);
  sql(`insert into private.platform_admins(user_id) values('${admin.id}');`);
  await ok(adminClient.auth.signInWithPassword({ email: admin.email, password: admin.password }));
  const demo = await ok(adminClient.from('drops').select('id,merchant_id').eq('slug','demo-khi-watercolor-pass').single());
  await ok(adminClient.rpc('admin_set_merchant_member', { p_merchant_id: demo.merchant_id, p_user_id: staff.id, p_role: 'staff' }));
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await customerContext.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(origin + '/drops/demo-khi-watercolor-pass');
  await page.getByRole('link', { name: 'Sign in to claim' }).click();
  await page.waitForURL('**/auth/login?next=%2Fdrops%2Fdemo-khi-watercolor-pass');
  await page.getByLabel('Email address').fill(customer.email);
  await page.getByLabel('Password').fill(customer.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/drops/demo-khi-watercolor-pass');
  await page.getByRole('button', { name: 'Claim PASS', exact: true }).click();
  await page.waitForURL(/\/passes\/[0-9a-f-]{36}$/);
  const passUrl = page.url();
  const code = await page.locator('code').textContent();
  assert.match(code, /^KHI-[A-F0-9]{32}$/);
  const qr = await page.getByRole('img', { name: 'QR code containing only the redemption code' }).getAttribute('src');
  assert.equal(qr, await QRCode.toDataURL(code, { margin: 1, width: 220, errorCorrectionLevel: 'M' }));
  await page.goto(origin + '/passes');
  await page.getByRole('link', { name: 'View PASS' }).first().waitFor();
  console.log('PASS browser: login destination, claim, code-only QR, own PASS list');

  const otherPage = await (await browser.newContext()).newPage();
  await otherPage.goto(origin + '/auth/login');
  await otherPage.getByLabel('Email address').fill(other.email);
  await otherPage.getByLabel('Password').fill(other.password);
  await otherPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await otherPage.waitForURL('**/profile');
  await otherPage.goto(passUrl);
  await otherPage.getByText('404').first().waitFor();
  await otherPage.goto(origin + '/merchant/redeem');
  await otherPage.getByText('Merchant membership is required').waitFor();
  console.log('PASS browser: another customer cannot view PASS or redeem');

  const staffPage = await (await browser.newContext()).newPage();
  await staffPage.goto(origin + '/auth/login?next=%2Fmerchant%2Fredeem');
  await staffPage.getByLabel('Email address').fill(staff.email);
  await staffPage.getByLabel('Password').fill(staff.password);
  await staffPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await staffPage.waitForURL('**/merchant/redeem');
  await staffPage.getByLabel('Redemption code').fill(code);
  await staffPage.getByRole('button', { name: 'Redeem PASS' }).click();
  await staffPage.getByText('PASS redeemed successfully.').waitFor();
  await staffPage.getByLabel('Redemption code').fill(code);
  await staffPage.getByRole('button', { name: 'Redeem PASS' }).click();
  await staffPage.getByText('This code cannot be redeemed.').waitFor();
  await page.goto(passUrl);
  await page.getByText('This PASS has been redeemed.').waitFor();
  assert.equal(await page.locator('code').count(), 0);
  console.log('PASS browser: merchant redemption once; redeemed customer view hides code');
  assert.deepEqual(errors, []);
  console.log('PASS browser: no runtime or hydration errors');
} finally {
  if (browser) await browser.close();
  for (const id of users) await service.auth.admin.deleteUser(id);
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'), fingerprint);
}
