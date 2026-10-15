import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { merchants, venues, experiences, drops, slug } from './fixtures.mjs';

const dockerPath = process.platform === 'win32' && process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe') : '';
const env = { ...process.env, PATH: dockerPath && existsSync(dockerPath) ? dirname(dockerPath) + delimiter + process.env.PATH : process.env.PATH, DOCKER_CONTEXT: process.platform === 'win32' ? 'desktop-linux' : process.env.DOCKER_CONTEXT };
assert.equal(existsSync('supabase/.temp/project-ref'), false, 'Refusing a linked workspace');
const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', env, timeout: 30000 });
assert.equal(result.status, 0, 'Start local Supabase first');
const status = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
const api = status.API_URL ?? status.api_url;
const url = new URL(api);
assert.equal(url.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Refusing a non-local API');
const anonKey = status.ANON_KEY ?? status.anon_key ?? status.PUBLISHABLE_KEY;
const serviceKey = status.SERVICE_ROLE_KEY ?? status.service_role_key ?? status.SECRET_KEY;
assert.ok(anonKey && serviceKey);
const client = key => createClient(api, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const service = client(serviceKey);
const check = async request => { const { data, error } = await request; if (error) throw new Error(`${error.code}: ${error.message}`); return data; };
const docker = dockerPath && existsSync(dockerPath) ? dockerPath : 'docker';
const project = 'khi-pass';
const psql = text => {
  const run = spawnSync(docker, [...(process.platform === 'win32' ? ['--context', 'desktop-linux'] : []), 'exec', '-i', `supabase_db_${project}`, 'psql', '-X', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8', env, timeout: 30000 });
  assert.equal(run.status, 0, run.stderr?.slice(0, 500));
};
const title = value => value.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
const email = 'khi-pass-demo-admin@example.invalid';
let user;
for (let page = 1; !user; page++) {
  const list = await check(service.auth.admin.listUsers({ page, perPage: 1000 }));
  user = list.users.find(item => item.email === email);
  if (user || list.users.length < 1000) break;
}
const password = randomBytes(24).toString('base64url');
if (user) await check(service.auth.admin.updateUserById(user.id, { password }));
else user = (await check(service.auth.admin.createUser({ email, password, email_confirm: true }))).user;
assert.match(user.id, /^[0-9a-f-]{36}$/);
psql(`insert into private.platform_admins(user_id) values('${user.id}') on conflict do nothing;`);
const actor = client(anonKey);
await check(actor.auth.signInWithPassword({ email, password }));
const moderate = (kind, id, state) => check(actor.rpc('admin_moderate_content', { p_kind: kind, p_id: id, p_status: state, p_reason: 'LOCAL FICTIONAL DEMO' }));
const reference = async table => new Map((await check(actor.from(table).select('id,slug'))).map(row => [row.slug, row.id]));
const areas = await reference('areas'), categories = await reference('categories'), vibes = await reference('vibes');
const find = async (table, key) => check(actor.from(table).select('id,status').eq('slug', slug(key)).maybeSingle());
const merchantIds = [];
for (const [key, name, type] of merchants) {
  let row = await find('merchants', key);
  if (!row) {
    const id = await check(actor.rpc('admin_create_merchant', { p_business_name: `LOCAL FICTIONAL DEMO — ${name}`, p_slug: slug(key), p_business_type: type, p_owner_id: user.id }));
    row = { id, status: 'pending' };
    psql(`update public.merchants set is_demo=true where id='${id}';`);
  }
  if (row.status !== 'approved') await moderate('merchant', row.id, 'approved');
  merchantIds.push(row.id);
}
const venueIds = [];
for (const [key, merchantIndex, areaName, areaKey] of venues) {
  let row = await find('venues', key);
  if (!row) row = await check(actor.from('venues').insert({ merchant_id: merchantIds[merchantIndex], name: `LOCAL FICTIONAL DEMO — ${title(key)}`, slug: slug(key), area_id: areas.get(areaKey), address: `Fictional demo location, ${areaName}, Karachi` }).select('id,status').single());
  if (row.status !== 'published') await moderate('venue', row.id, 'published');
  venueIds.push(row.id);
}
const experienceIds = [];
for (const [key, venueIndex, categoryKey, price, maxGroup, vibeKey] of experiences) {
  let row = await find('experiences', key);
  if (!row) {
    const merchantId = merchantIds[venues[venueIndex][1]];
    row = await check(actor.from('experiences').insert({ merchant_id: merchantId, venue_id: venueIds[venueIndex], category_id: categories.get(categoryKey), title: `LOCAL FICTIONAL DEMO — ${title(key)}`, slug: slug(key), description: 'Fictional demonstration experience. No real business or booking is represented.', min_price: price, max_price: price, min_group_size: 1, max_group_size: maxGroup, duration_minutes: 90, setting: 'indoor' }).select('id,status').single());
    await check(actor.from('experience_vibes').insert({ experience_id: row.id, vibe_id: vibes.get(vibeKey) }));
    for (let weekday = 0; weekday < 7; weekday++) await check(actor.from('experience_schedules').insert({ experience_id: row.id, weekday, opens_at: '10:00', closes_at: '23:00' }));
  }
  if (row.status !== 'published') await moderate('experience', row.id, 'published');
  experienceIds.push(row.id);
}
for (const [key, experienceIndex, original, price, limit] of drops) {
  let row = await find('drops', key);
  if (!row) {
    const venueIndex = experiences[experienceIndex][1];
    row = await check(actor.from('drops').insert({ merchant_id: merchantIds[venues[venueIndex][1]], venue_id: venueIds[venueIndex], experience_id: experienceIds[experienceIndex], title: `LOCAL FICTIONAL DEMO — ${title(key)}`, slug: slug(key), description: 'Fictional demonstration offer. Cannot be redeemed at a real venue.', original_price: original, drop_price: price, starts_at: '2026-01-01T00:00:00Z', ends_at: '2028-01-01T00:00:00Z', claim_limit: limit, per_user_limit: 1, terms: 'LOCAL FICTIONAL DEMO ONLY. No real-world value.' }).select('id,status').single());
  }
  if (row.status !== 'active') await moderate('drop', row.id, 'active');
}
console.log('Local fictional demo ready: 5 merchants, 8 venues, 15 experiences, 8 Drops.');
