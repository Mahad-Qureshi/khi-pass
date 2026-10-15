import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const fingerprint = createHash('sha256').update(readFileSync('.env.local')).digest('hex');
assert.equal(existsSync('supabase/.temp/project-ref'), false, 'Refusing linked workspace');
const dockerPath = process.platform === 'win32' && process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe') : '';
const env = { ...process.env, PATH: dockerPath && existsSync(dockerPath) ? dirname(dockerPath) + delimiter + process.env.PATH : process.env.PATH, DOCKER_CONTEXT: process.platform === 'win32' ? 'desktop-linux' : process.env.DOCKER_CONTEXT };
const status = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', env, timeout: 30000 });
assert.equal(status.status, 0, 'Start local Supabase first');
const local = JSON.parse(status.stdout.slice(status.stdout.indexOf('{')));
assert.equal(new URL(local.API_URL).protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(local.API_URL).hostname));
const client = key => createClient(local.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const service = client(local.SERVICE_ROLE_KEY);
const anon = client(local.ANON_KEY);
const ok = async promise => { const { data, error } = await promise; assert.equal(error, null, error?.message); return data; };
const denied = async (promise, message) => { const { error } = await promise; assert.ok(error); if (message) assert.match(error.message, message); };
const users = [];
async function user(name) {
  const email = `phase4-${randomUUID()}-${name}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const created = await ok(service.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(created.user.id);
  const c = client(local.ANON_KEY);
  await ok(c.auth.signInWithPassword({ email, password }));
  return { id: created.user.id, c };
}
const docker = dockerPath && existsSync(dockerPath) ? dockerPath : 'docker';
function sql(statement) {
  const run = spawnSync(docker, [...(process.platform === 'win32' ? ['--context', 'desktop-linux'] : []), 'exec', '-i', 'supabase_db_khi-pass', 'psql', '-X', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: statement, env, encoding: 'utf8', timeout: 30000 });
  assert.equal(run.status, 0, run.stderr?.slice(0, 500));
}

try {
  const admin = await user('admin'), a = await user('customer-a'), b = await user('customer-b'), staff = await user('staff'), otherStaff = await user('other-staff');
  sql(`insert into private.platform_admins(user_id) values('${admin.id}');`);
  const drop = await ok(anon.from('drops').select('id,merchant_id,venue_id,experience_id').eq('slug','demo-khi-watercolor-pass').single());
  const otherMerchant = await ok(anon.from('merchants').select('id').eq('slug','demo-khi-pixel-cove').single());
  await ok(admin.c.rpc('admin_set_merchant_member', { p_merchant_id: drop.merchant_id, p_user_id: staff.id, p_role: 'staff' }));
  await ok(admin.c.rpc('admin_set_merchant_member', { p_merchant_id: otherMerchant.id, p_user_id: otherStaff.id, p_role: 'staff' }));
  let claimedPass;

  await test('owner-only PASS list and detail, idempotent claim, per-user limit', async () => {
    await denied(anon.rpc('list_my_passes'));
    const request = randomUUID();
    const claimed = await ok(a.c.rpc('claim_drop', { p_drop_id: drop.id, p_request_id: request }));
    const retried = await ok(a.c.rpc('claim_drop', { p_drop_id: drop.id, p_request_id: request }));
    assert.equal(retried.id, claimed.id);
    assert.match(claimed.redemption_code, /^KHI-[A-F0-9]{32}$/);
    const own = await ok(a.c.rpc('get_my_pass_details', { p_claim_id: claimed.id }));
    assert.match(own.title, /Watercolor Pass/); assert.ok(own.merchant_name); assert.ok(own.venue_name);
    const listed = await ok(a.c.rpc('list_my_passes', { p_limit: 20, p_offset: 0 }));
    assert.ok(listed.items.some(item => item.id === claimed.id));
    assert.equal((await ok(b.c.rpc('list_my_passes'))).total, 0);
    await denied(b.c.rpc('get_my_pass_details', { p_claim_id: claimed.id }), /PASS_NOT_AVAILABLE/);
    await denied(staff.c.rpc('get_my_pass_details', { p_claim_id: claimed.id }), /PASS_NOT_AVAILABLE/);
    await denied(a.c.rpc('claim_drop', { p_drop_id: drop.id, p_request_id: randomUUID() }), /USER_CLAIM_LIMIT_REACHED/);
    claimedPass = claimed;
  });

  await test('merchant tenant isolation and atomic single redemption', async () => {
    await denied(otherStaff.c.rpc('redeem_drop_code', { p_code: claimedPass.redemption_code }), /PASS_NOT_REDEEMABLE/);
    const redeemed = await ok(staff.c.rpc('redeem_drop_code', { p_code: claimedPass.redemption_code }));
    assert.equal(redeemed.status, 'redeemed');
    await denied(staff.c.rpc('redeem_drop_code', { p_code: claimedPass.redemption_code }), /PASS_NOT_REDEEMABLE/);
    const own = await ok(a.c.rpc('get_my_pass_details', { p_claim_id: claimedPass.id }));
    assert.equal(own.status, 'redeemed'); assert.equal(own.redemption_code, null);
  });

  await test('sold-out and expired Drop claims are denied', async () => {
    const now = Date.now();
    async function makeDrop(label, start, end) {
      const row = await ok(admin.c.from('drops').insert({
        merchant_id: drop.merchant_id, venue_id: drop.venue_id, experience_id: drop.experience_id,
        title: `LOCAL TEST ONLY ${label}`, slug: `phase4-${randomUUID()}`,
        description: 'Disposable local verification fixture.', original_price: 100, drop_price: 50,
        starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(),
        claim_limit: 1, per_user_limit: 1, terms: 'LOCAL TEST ONLY',
      }).select('id').single());
      await ok(admin.c.rpc('admin_moderate_content', { p_kind: 'drop', p_id: row.id, p_status: 'active', p_reason: 'LOCAL TEST ONLY' }));
      return row;
    }
    const one = await makeDrop('one-stock', now - 60000, now + 3600000);
    await ok(a.c.rpc('claim_drop', { p_drop_id: one.id, p_request_id: randomUUID() }));
    await denied(b.c.rpc('claim_drop', { p_drop_id: one.id, p_request_id: randomUUID() }), /DROP_SOLD_OUT/);
    const expired = await makeDrop('expired', now - 3600000, now - 60000);
    await denied(b.c.rpc('claim_drop', { p_drop_id: expired.id, p_request_id: randomUUID() }), /DROP_NOT_CLAIMABLE/);
    for (const id of [one.id, expired.id]) await ok(admin.c.rpc('admin_moderate_content', { p_kind: 'drop', p_id: id, p_status: 'paused', p_reason: 'LOCAL TEST CLEANUP' }));
  });
} finally {
  for (const id of users) await service.auth.admin.deleteUser(id);
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'), fingerprint);
}
