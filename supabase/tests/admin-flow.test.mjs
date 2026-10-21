// LOCAL ONLY. Exercises real JWTs, RLS and definer RPCs against unlinked Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

assert.equal(existsSync('supabase/.temp/project-ref'), false, 'Refusing linked Supabase workspace');
const fingerprint = createHash('sha256').update(readFileSync('.env.local')).digest('hex');
const dockerBin = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe') : '';
const env = { ...process.env, PATH: dockerBin && existsSync(dockerBin) ? dirname(dockerBin) + delimiter + process.env.PATH : process.env.PATH,
  DOCKER_CONTEXT: process.platform === 'win32' ? 'desktop-linux' : process.env.DOCKER_CONTEXT };
const command = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', env, timeout: 30000 });
assert.equal(command.status, 0, 'Start local Supabase first');
const local = JSON.parse(command.stdout.slice(command.stdout.indexOf('{')));
const origin = new URL(local.API_URL);
assert.equal(origin.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname), 'Refusing remote Supabase');
const client = key => createClient(local.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const service = client(local.SERVICE_ROLE_KEY), anon = client(local.ANON_KEY);
const ok = async request => { const { data, error } = await request; assert.equal(error, null, error?.message); return data; };
const denied = async request => { const { error } = await request; assert.ok(error, 'Expected authorization denial'); };
function sql(query) {
  const run = spawnSync('docker', ['exec', '-i', 'supabase_db_khi-pass', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', query],
    { encoding: 'utf8', env, timeout: 30000 });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}
const users = [], merchants = [], content = { venues: [], experiences: [], drops: [] };
async function makeUser() {
  const email = `phase7-${randomUUID()}@example.invalid`, password = randomBytes(20).toString('base64url');
  const response = await ok(service.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(response.user.id);
  const actor = client(local.ANON_KEY);
  await ok(actor.auth.signInWithPassword({ email, password }));
  return { id: response.user.id, actor };
}

try {
  const [admin, owner, other, outsider] = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()]);
  sql(`insert into private.platform_admins(user_id) values('${admin.id}')`);
  await test('anonymous and ordinary users cannot read admin status or execute admin RPCs', async () => {
    await denied(anon.rpc('is_platform_admin'));
    assert.equal(await ok(owner.actor.rpc('is_platform_admin')), false);
    assert.equal(await ok(admin.actor.rpc('is_platform_admin')), true);
    await denied(owner.actor.rpc('admin_create_merchant', {
      p_business_name: 'Unauthorized', p_slug: `phase7-denied-${randomUUID()}`,
      p_business_type: 'fictional', p_owner_id: owner.id,
    }));
  });
  await test('admin RPC grants and fixed definer paths exclude anonymous execution', () => {
    const rights = JSON.parse(sql(`select jsonb_build_object(
      'anon_check',has_function_privilege('anon','public.is_platform_admin()','EXECUTE'),
      'auth_check',has_function_privilege('authenticated','public.is_platform_admin()','EXECUTE'),
      'anon_moderate',has_function_privilege('anon','public.admin_moderate_content(text,uuid,text,text)','EXECUTE'),
      'auth_moderate',has_function_privilege('authenticated','public.admin_moderate_content(text,uuid,text,text)','EXECUTE'),
      'private_direct',has_function_privilege('authenticated','private.change_content_status(text,uuid,text,boolean,text)','EXECUTE'),
      'paths',(select array_agg(proconfig) from pg_proc where oid in ('public.is_platform_admin()'::regprocedure,
        'public.admin_moderate_content(text,uuid,text,text)'::regprocedure)),
      'definers',(select bool_and(prosecdef) from pg_proc where oid in ('public.is_platform_admin()'::regprocedure,
        'public.admin_moderate_content(text,uuid,text,text)'::regprocedure)))`));
    assert.equal(rights.anon_check, false);
    assert.equal(rights.auth_check, true);
    assert.equal(rights.anon_moderate, false);
    assert.equal(rights.auth_moderate, true);
    assert.equal(rights.private_direct, false);
    assert.equal(rights.definers, true);
    assert.equal(rights.paths.length, 2);
    assert.ok(rights.paths.every(config => config.includes('search_path=""')));
  });
  let merchantA, merchantB;
  await test('merchant onboarding is atomic and rejects duplicate slugs and invalid owners', async () => {
    const slug = `phase7-test-${randomUUID()}`;
    merchantA = await ok(admin.actor.rpc('admin_create_merchant', {
      p_business_name: 'Phase 7 local merchant', p_slug: slug, p_business_type: 'fictional', p_owner_id: owner.id,
    }));
    merchants.push(merchantA);
    const members = await ok(admin.actor.from('merchant_members').select('user_id,role').eq('merchant_id', merchantA));
    assert.deepEqual(members, [{ user_id: owner.id, role: 'owner' }]);
    await denied(admin.actor.rpc('admin_create_merchant', {
      p_business_name: 'Duplicate', p_slug: slug, p_business_type: 'fictional', p_owner_id: owner.id,
    }));
    const missingSlug = `phase7-missing-${randomUUID()}`;
    await denied(admin.actor.rpc('admin_create_merchant', {
      p_business_name: 'Invalid owner', p_slug: missingSlug, p_business_type: 'fictional', p_owner_id: randomUUID(),
    }));
    assert.equal((await ok(admin.actor.from('merchants').select('id').eq('slug', missingSlug))).length, 0);
    merchantB = await ok(admin.actor.rpc('admin_create_merchant', {
      p_business_name: 'Phase 7 second merchant', p_slug: `phase7-second-${randomUUID()}`,
      p_business_type: 'fictional', p_owner_id: other.id,
    }));
    merchants.push(merchantB);
  });
  await test('direct moderation rejects unsupported transitions without audit writes', async () => {
    const before = Number(sql(`select count(*) from private.moderation_audit where entity_type='merchant' and entity_id='${merchantA}'`));
    await denied(admin.actor.rpc('admin_moderate_content', {
      p_kind: 'merchant', p_id: merchantA, p_status: 'suspended', p_reason: 'Invalid pending transition',
    }));
    assert.equal((await ok(admin.actor.from('merchants').select('status').eq('id', merchantA).single())).status, 'pending');
    assert.equal(Number(sql(`select count(*) from private.moderation_audit where entity_type='merchant' and entity_id='${merchantA}'`)), before);
  });
  await test('membership remains tenant scoped; unauthorized assignments are denied', async () => {
    assert.equal((await ok(owner.actor.from('merchants').select('id').eq('id', merchantB))).length, 0);
    await denied(owner.actor.rpc('admin_set_merchant_member', { p_merchant_id: merchantB, p_user_id: owner.id, p_role: 'owner' }));
    await denied(admin.actor.rpc('admin_set_merchant_member', { p_merchant_id: merchantA, p_user_id: other.id, p_role: 'invented' }));
    await denied(admin.actor.rpc('admin_set_merchant_member', { p_merchant_id: merchantA, p_user_id: randomUUID(), p_role: 'staff' }));
    await ok(admin.actor.rpc('admin_set_merchant_member', { p_merchant_id: merchantA, p_user_id: other.id, p_role: 'manager' }));
    const members = await ok(admin.actor.from('merchant_members').select('user_id,role').eq('merchant_id', merchantA));
    assert.equal(members.length, 2);
    assert.equal(members.find(x => x.user_id === other.id)?.role, 'manager');
  });
  await test('merchant, venue, experience and PASS Drop moderation is admin only and audited', async () => {
    const area = await ok(anon.from('areas').select('id').limit(1).single());
    const category = await ok(anon.from('categories').select('id').limit(1).single());
    const venue = await ok(owner.actor.from('venues').insert({ merchant_id: merchantA, name: 'Phase 7 local venue',
      slug: `phase7-venue-${randomUUID()}`, area_id: area.id, address: 'Fictional local location' }).select('id').single());
    content.venues.push(venue.id);
    assert.equal((await ok(outsider.actor.from('venues').select('id').eq('id', venue.id))).length, 0);
    const experience = await ok(owner.actor.from('experiences').insert({ merchant_id: merchantA, venue_id: venue.id,
      category_id: category.id, title: 'Phase 7 local experience', slug: `phase7-exp-${randomUUID()}`,
      description: 'Fictional local content', min_price: 100 }).select('id').single());
    content.experiences.push(experience.id);
    const drop = await ok(owner.actor.from('drops').insert({ merchant_id: merchantA, venue_id: venue.id, experience_id: experience.id,
      title: 'Phase 7 local Drop', slug: `phase7-drop-${randomUUID()}`, description: 'Fictional local content', terms: 'Local only',
      drop_price: 50, starts_at: new Date(Date.now() + 60000).toISOString(), ends_at: new Date(Date.now() + 3600000).toISOString(),
      claim_limit: 5, per_user_limit: 1 }).select('id').single());
    content.drops.push(drop.id);
    await denied(admin.actor.rpc('admin_moderate_content', {
      p_kind: 'drop', p_id: drop.id, p_status: 'sold_out', p_reason: 'Invalid inventory status',
    }));
    assert.equal((await ok(admin.actor.from('drops').select('status').eq('id', drop.id).single())).status, 'draft');
    for (const [kind, id, status] of [['merchant', merchantA, 'approved'], ['venue', venue.id, 'published'],
      ['experience', experience.id, 'published'], ['drop', drop.id, 'scheduled']]) {
      await denied(owner.actor.rpc('admin_moderate_content', { p_kind: kind, p_id: id, p_status: status, p_reason: 'Denied' }));
      await ok(admin.actor.rpc('admin_moderate_content', { p_kind: kind, p_id: id, p_status: status, p_reason: 'Local review' }));
      assert.equal(Number(sql(`select count(*) from private.moderation_audit where entity_type='${kind}' and entity_id='${id}' and action='moderate'`)), 1);
    }
  });
} finally {
  for (const id of content.drops) await ok(service.from('drops').delete().eq('id', id));
  for (const id of content.experiences) await ok(service.from('experiences').delete().eq('id', id));
  for (const id of content.venues) await ok(service.from('venues').delete().eq('id', id));
  for (const merchant of merchants) await ok(service.from('merchants').delete().eq('id', merchant));
  for (const user of users) await ok(service.auth.admin.deleteUser(user));
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'), fingerprint);
}
