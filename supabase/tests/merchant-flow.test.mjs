// LOCAL ONLY. Requires running local Supabase and fictional demo seed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

assert.equal(existsSync('supabase/.temp/project-ref'), false, 'Refusing linked Supabase workspace');
const envFingerprint = createHash('sha256').update(readFileSync('.env.local')).digest('hex');
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
const service = client(local.SERVICE_ROLE_KEY);
const anon = client(local.ANON_KEY);
const ok = async request => { const { data, error } = await request; assert.equal(error, null, error?.message); return data; };
const denied = async request => { const { error } = await request; assert.ok(error, 'Expected DB authorization denial'); };
const users = [], created = { venues: [], experiences: [], drops: [] };
async function makeUser() {
  const email = `phase6-${randomUUID()}@example.invalid`, password = randomBytes(20).toString('base64url');
  const response = await ok(service.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(response.user.id);
  const actor = client(local.ANON_KEY);
  await ok(actor.auth.signInWithPassword({ email, password }));
  return { id: response.user.id, actor };
}

try {
  const [ownerA, managerA, staffA, ownerB] = await Promise.all(Array.from({ length: 4 }, makeUser));
  const businessA = await ok(anon.from('merchants').select('id').eq('slug', 'demo-khi-moonpaper-studio').single());
  const businessB = await ok(anon.from('merchants').select('id').eq('slug', 'demo-khi-pixel-cove').single());
  const area = await ok(anon.from('areas').select('id').eq('slug', 'dha').single());
  const category = await ok(anon.from('categories').select('id').eq('slug', 'creative').single());
  for (const [business, person, role] of [
    [businessA, ownerA, 'owner'], [businessA, managerA, 'manager'], [businessA, staffA, 'staff'], [businessB, ownerB, 'owner'],
  ]) await ok(service.from('merchant_members').insert({ merchant_id: business.id, user_id: person.id, role }));

  let venue, experience, drop;
  await test('owner/manager create content; staff and other businesses cannot write', async () => {
    const slug = `phase6-venue-${randomUUID()}`;
    venue = await ok(ownerA.actor.from('venues').insert({
      merchant_id: businessA.id, name: 'Phase 6 local venue', slug, area_id: area.id,
      address: 'Fictional location Karachi',
    }).select('id,status').single());
    created.venues.push(venue.id);
    assert.equal(venue.status, 'draft');
    await denied(staffA.actor.from('venues').insert({ merchant_id: businessA.id,
      name: 'Forbidden', slug: `phase6-no-${randomUUID()}`, area_id: area.id, address: 'Fake' }));
    await denied(ownerB.actor.from('venues').insert({ merchant_id: businessA.id,
      name: 'Forbidden', slug: `phase6-no-${randomUUID()}`, area_id: area.id, address: 'Fake' }));
    assert.equal((await ok(ownerB.actor.from('venues').select('id').eq('id', venue.id))).length, 0);
    const changed = await ok(managerA.actor.from('venues').update({ name: 'Phase 6 manager edit' }).eq('id', venue.id).select('id,name'));
    assert.equal(changed.length, 1);
    const attempted = await ok(ownerB.actor.from('venues').update({ name: 'Wrong tenant' }).eq('id', venue.id).select('id'));
    assert.equal(attempted.length, 0);
  });

  await test('content FK prevents cross-business experience association', async () => {
    const otherVenue = await ok(anon.from('venues').select('id').eq('slug', 'demo-khi-pixel-gulshan').single());
    await denied(ownerA.actor.from('experiences').insert({ merchant_id: businessA.id, venue_id: otherVenue.id,
      category_id: category.id, title: 'Invalid association', slug: `phase6-no-${randomUUID()}`, description: 'Cross-business venue', min_price: 100 }));
    experience = await ok(managerA.actor.from('experiences').insert({ merchant_id: businessA.id, venue_id: venue.id,
      category_id: category.id, title: 'Phase 6 experience', slug: `phase6-exp-${randomUUID()}`,
      description: 'Fictional local verification.', min_price: 250 }).select('id,status').single());
    created.experiences.push(experience.id);
    assert.equal(experience.status, 'draft');
    await denied(staffA.actor.from('experiences').update({ title: 'Staff intrusion' }).eq('id', experience.id).select('id').single());
  });

  await test('drop inventory protected; submission audited by existing RPC', async () => {
    const startsAt = new Date(Date.now() + 86400000).toISOString();
    const endsAt = new Date(Date.now() + 172800000).toISOString();
    drop = await ok(ownerA.actor.from('drops').insert({ merchant_id: businessA.id, venue_id: venue.id,
      experience_id: experience.id, title: 'Phase 6 PASS Drop', slug: `phase6-drop-${randomUUID()}`,
      description: 'Local only', terms: 'Local test fixture', original_price: 450, drop_price: 250,
      starts_at: startsAt, ends_at: endsAt, claim_limit: 10, per_user_limit: 1,
    }).select('id,status').single());
    created.drops.push(drop.id);
    assert.equal(drop.status, 'draft');
    await denied(ownerA.actor.from('drops').update({ claim_limit: 1 }).eq('id', drop.id));
    await denied(ownerA.actor.from('drops').update({ per_user_limit: 2 }).eq('id', drop.id));
    await denied(staffA.actor.rpc('merchant_set_content_status', { p_kind: 'drop', p_id: drop.id, p_status: 'pending_approval' }));
    await ok(ownerA.actor.rpc('merchant_set_content_status', { p_kind: 'drop', p_id: drop.id, p_status: 'pending_approval' }));
    const updated = await ok(ownerA.actor.from('drops').select('status').eq('id', drop.id).single());
    assert.equal(updated.status, 'pending_approval');
    await denied(ownerA.actor.rpc('merchant_set_content_status', { p_kind: 'drop', p_id: drop.id, p_status: 'active' }));
  });

  await test('analytics tenant-scoped; staff read only; cross-merchant access denied', async () => {
    const range = { p_from: new Date(Date.now() - 30 * 86400000).toISOString(), p_until: new Date().toISOString() };
    const stats = await ok(staffA.actor.rpc('merchant_claim_stats', { p_merchant_id: businessA.id, ...range }));
    assert.equal(typeof stats.issued, 'number');
    await denied(ownerB.actor.rpc('merchant_claim_stats', { p_merchant_id: businessA.id, ...range }));
    const visible = await ok(staffA.actor.from('drops').select('id').eq('id', drop.id));
    assert.equal(visible.length, 1);
    const hidden = await ok(ownerB.actor.from('drops').select('id').eq('id', drop.id));
    assert.equal(hidden.length, 0);
  });
} finally {
  // Service role used only by local test harness, never application code.
  for (const id of created.drops) await ok(service.from('drops').delete().eq('id', id));
  for (const id of created.experiences) await ok(service.from('experiences').delete().eq('id', id));
  for (const id of created.venues) await ok(service.from('venues').delete().eq('id', id));
  for (const id of users) await ok(service.auth.admin.deleteUser(id));
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'), envFingerprint);
}
