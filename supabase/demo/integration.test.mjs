import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { merchants, venues, experiences, drops, slug } from './fixtures.mjs';

assert.equal(existsSync('supabase/.temp/project-ref'), false, 'Refusing linked workspace');
const dockerPath = process.platform === 'win32' && process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe') : '';
const env = { ...process.env, PATH: dockerPath && existsSync(dockerPath) ? dirname(dockerPath) + delimiter + process.env.PATH : process.env.PATH, DOCKER_CONTEXT: process.platform === 'win32' ? 'desktop-linux' : process.env.DOCKER_CONTEXT };
const output = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', env, timeout: 30000 });
assert.equal(output.status, 0, 'Start local Supabase first');
const status = JSON.parse(output.stdout.slice(output.stdout.indexOf('{')));
const api = status.API_URL ?? status.api_url;
assert.equal(new URL(api).protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(api).hostname));
const key = status.ANON_KEY ?? status.anon_key ?? status.PUBLISHABLE_KEY;
const db = createClient(api, key, { auth: { persistSession: false } });
const rows = async query => { const { data, error } = await query; assert.equal(error, null, error?.message); return data; };

test('reference data and deterministic demo counts', async () => {
  for (const [table, count] of [['areas',10],['categories',10],['vibes',8]]) assert.equal((await rows(db.from(table).select('id'))).length, count);
  for (const [table, fixture] of [['merchants',merchants],['venues',venues],['experiences',experiences],['drops',drops]]) {
    const found = await rows(db.from(table).select('slug').in('slug', fixture.map(item => slug(item[0]))));
    assert.equal(found.length, fixture.length, table);
    assert.equal(new Set(found.map(item => item.slug)).size, fixture.length);
  }
});

test('public experience, venue, category, vibe, schedule and price relationships', async () => {
  const found = await rows(db.from('experiences').select('id,slug,venue_id,category_id,min_price,max_group_size,status').in('slug', experiences.map(item => slug(item[0]))));
  const venueRows = await rows(db.from('venues').select('id,slug,merchant_id,area_id'));
  const byVenue = new Map(venueRows.map(row => [row.id,row]));
  const refs = Object.fromEntries(await Promise.all(['areas','categories','vibes'].map(async table => [table,new Map((await rows(db.from(table).select('id,slug'))).map(item => [item.slug,item.id]))])));
  for (const [key, venueIndex, categoryKey, price, group, vibe] of experiences) {
    const row = found.find(item => item.slug === slug(key));
    assert.ok(row, key); assert.equal(row.status, 'published'); assert.equal(row.min_price, price); assert.equal(row.max_group_size, group);
    assert.equal(row.category_id, refs.categories.get(categoryKey));
    assert.equal(byVenue.get(row.venue_id)?.slug, slug(venues[venueIndex][0]));
    assert.equal(byVenue.get(row.venue_id)?.area_id, refs.areas.get(venues[venueIndex][3]));
    assert.equal((await rows(db.from('experience_vibes').select('vibe_id').eq('experience_id',row.id)))[0]?.vibe_id, refs.vibes.get(vibe));
    assert.equal((await rows(db.from('experience_schedules').select('weekday').eq('experience_id',row.id))).length, 7);
  }
  assert.equal((await rows(db.from('experiences').select('id').eq('slug','invalid-demo-slug'))).length,0);
});

test('Drop links, prices, windows, invalid slug, and private table separation', async () => {
  const found = await rows(db.from('drops').select('slug,experience_id,drop_price,original_price,starts_at,ends_at,status').in('slug',drops.map(item => slug(item[0]))));
  const exp = new Map((await rows(db.from('experiences').select('id,slug'))).map(row => [row.slug,row.id]));
  for (const [key,index,original,price] of drops) {
    const row = found.find(item => item.slug === slug(key));
    assert.ok(row); assert.equal(row.status,'active'); assert.equal(row.experience_id,exp.get(slug(experiences[index][0])));
    assert.equal(row.original_price,original); assert.equal(row.drop_price,price);
    assert.ok(Date.parse(row.starts_at) < Date.now() && Date.parse(row.ends_at) > Date.now());
  }
  assert.equal((await rows(db.from('drops').select('id').eq('slug','invalid-demo-slug'))).length,0);
  for (const table of ['profiles','merchant_members','drop_claims']) assert.ok((await db.from(table).select('id').limit(1)).error);
  assert.ok((await db.schema('private').from('merchant_contacts').select('*')).error);
});

test('query enforced budget and group limits match seeded records', async () => {
  const cheap = await rows(db.from('experiences').select('slug,min_price').eq('status','published').lte('min_price',2000));
  assert.ok(cheap.some(row => row.slug === slug('watercolor-evening')));
  assert.ok(!cheap.some(row => row.slug === slug('table-for-two')));
  const large = await rows(db.from('experiences').select('slug,min_group_size,max_group_size').eq('status','published').lte('min_group_size',4).or('max_group_size.is.null,max_group_size.gte.4'));
  assert.ok(large.some(row => row.slug === slug('watercolor-evening')));
  assert.ok(!large.some(row => row.slug === slug('table-for-two')));
});

test('application filtered area, category and vibe inputs have distinct matches', async () => {
  const [area, category, vibe] = await Promise.all([
    rows(db.from('areas').select('id').eq('slug','dha').single()),
    rows(db.from('categories').select('id').eq('slug','creative').single()),
    rows(db.from('vibes').select('id').eq('slug','creative').single()),
  ]);
  const dhaVenues = await rows(db.from('venues').select('id').eq('area_id',area.id));
  const creative = await rows(db.from('experiences').select('id,slug,venue_id').eq('category_id',category.id).in('venue_id',dhaVenues.map(row => row.id)));
  const vibeLinks = await rows(db.from('experience_vibes').select('experience_id').eq('vibe_id',vibe.id));
  const ids = new Set(vibeLinks.map(row => row.experience_id));
  assert.deepEqual(creative.filter(row => ids.has(row.id)).map(row => row.slug),[slug('watercolor-evening')]);
});
