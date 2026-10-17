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
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(local.API_URL).hostname));
const client = key => createClient(local.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const service = client(local.SERVICE_ROLE_KEY), anon = client(local.ANON_KEY);
const ok = async promise => { const { data, error } = await promise; assert.equal(error, null, error?.message); return data; };
const denied = async promise => { const { error } = await promise; assert.ok(error, 'Expected RLS or RPC denial'); };
const users = [];
async function user() {
  const email = `phase5-${randomUUID()}@example.invalid`, password = randomBytes(24).toString('base64url');
  const created = await ok(service.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(created.user.id);
  const c = client(local.ANON_KEY); await ok(c.auth.signInWithPassword({ email, password }));
  return { id: created.user.id, c };
}

try {
  const a = await user(), b = await user();
  const experience = await ok(anon.from('experiences').select('id').eq('slug', 'demo-khi-watercolor-evening').single());
  let plan, item;
  await test('favorites reject duplicates, other-user writes, and unpublished experiences', async () => {
    await ok(a.c.from('favorites').insert({ experience_id: experience.id }));
    await denied(a.c.from('favorites').insert({ experience_id: experience.id }));
    assert.equal((await ok(b.c.from('favorites').select('experience_id'))).length, 0);
    assert.equal((await ok(b.c.from('favorites').delete().eq('user_id', a.id).eq('experience_id', experience.id).select())).length, 0);
    const privateExperience = await ok(service.from('experiences').select('id').neq('status', 'published').limit(1));
    if (privateExperience.length) await denied(a.c.from('favorites').insert({ experience_id: privateExperience[0].id }));
  });
  await test('owner-only plans and items; shared plan hides private content', async () => {
    plan = await ok(a.c.from('plans').insert({ title: 'Local phase 5 plan', starts_at: new Date(Date.now() + 86400000).toISOString() }).select('id,share_id').single());
    assert.equal(plan.share_id.length, 64);
    assert.equal((await ok(b.c.from('plans').select('id').eq('id', plan.id))).length, 0);
    assert.equal((await ok(b.c.from('plans').update({ title: 'Intrusion' }).eq('id', plan.id).select())).length, 0);
    await denied(b.c.from('plan_items').insert({ plan_id: plan.id, experience_id: experience.id }));
    item = await ok(a.c.from('plan_items').insert({ plan_id: plan.id, experience_id: experience.id }).select('id').single());
    await denied(a.c.from('plan_items').insert({ plan_id: plan.id, experience_id: experience.id }));
    assert.equal(await ok(anon.rpc('get_shared_plan', { p_share_id: plan.share_id })), null);
    await ok(a.c.from('plans').update({ status: 'shared' }).eq('id', plan.id));
    const shared = await ok(anon.rpc('get_shared_plan', { p_share_id: plan.share_id }));
    assert.equal(shared.items.length, 1);
    assert.equal(shared.owner_id, undefined);
    const privateExperience = await ok(service.from('experiences').select('id').neq('status', 'published').limit(1));
    if (privateExperience.length) {
      await ok(service.from('plan_items').insert({ plan_id: plan.id, experience_id: privateExperience[0].id }));
      assert.equal((await ok(anon.rpc('get_shared_plan', { p_share_id: plan.share_id }))).items.length, 1);
    }
  });
  await test('token-bound voting changes rather than duplicates; wrong owner and private plans denied', async () => {
    const joined = await ok(anon.rpc('join_shared_plan', { p_share_id: plan.share_id, p_nickname: 'Guest' }));
    await ok(anon.rpc('cast_plan_vote', { p_share_id: plan.share_id, p_participant_token: joined.participant_token, p_item_id: item.id, p_vote: 'yes' }));
    await ok(anon.rpc('cast_plan_vote', { p_share_id: plan.share_id, p_participant_token: joined.participant_token, p_item_id: item.id, p_vote: 'no' }));
    const shared = await ok(anon.rpc('get_shared_plan', { p_share_id: plan.share_id }));
    assert.equal(shared.items[0].yes, 0); assert.equal(shared.items[0].no, 1);
    await denied(b.c.rpc('cast_plan_vote', { p_share_id: plan.share_id, p_participant_token: '0'.repeat(64), p_item_id: item.id, p_vote: 'yes' }));
    await denied(b.c.rpc('rotate_plan_share_id', { p_plan_id: plan.id }));
    const replacement = await ok(a.c.rpc('rotate_plan_share_id', { p_plan_id: plan.id }));
    assert.notEqual(replacement, plan.share_id);
    assert.equal(await ok(anon.rpc('get_shared_plan', { p_share_id: plan.share_id })), null);
    await denied(anon.rpc('join_shared_plan', { p_share_id: plan.share_id, p_nickname: 'Late guest' }));
    await denied(anon.rpc('cast_plan_vote', { p_share_id: plan.share_id, p_participant_token: joined.participant_token, p_item_id: item.id, p_vote: 'yes' }));
    assert.equal((await ok(anon.rpc('get_shared_plan', { p_share_id: replacement }))).items.length, 1);
    await ok(a.c.from('plans').update({ status: 'draft' }).eq('id', plan.id));
    assert.equal(await ok(anon.rpc('get_shared_plan', { p_share_id: replacement })), null);
    await denied(anon.rpc('cast_plan_vote', { p_share_id: replacement, p_participant_token: joined.participant_token, p_item_id: item.id, p_vote: 'yes' }));
    const edited = await ok(a.c.from('plans').update({ title: 'Edited local plan' }).eq('id', plan.id).select('title').single());
    assert.equal(edited.title, 'Edited local plan');
    await ok(a.c.from('plans').delete().eq('id', plan.id));
    assert.equal((await ok(a.c.from('plans').select('id').eq('id', plan.id))).length, 0);
  });
} finally {
  for (const id of users) await service.auth.admin.deleteUser(id);
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'), fingerprint);
}
