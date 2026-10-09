import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// LOCAL ONLY. Never load .env.local, accept remote URL overrides, or use supabase link.
const envFingerprint = createHash('sha256').update(readFileSync('.env.local')).digest('hex');
const dockerFallback = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe') : '';
const docker = dockerFallback && existsSync(dockerFallback) ? dockerFallback : 'docker';
const dockerArgs = process.platform === 'win32' ? ['--context', 'desktop-linux'] : [];
const commandEnv = { ...process.env, PATH: dockerFallback && existsSync(dockerFallback) ? dirname(dockerFallback) + delimiter + process.env.PATH : process.env.PATH, DOCKER_CONTEXT: process.platform === 'win32' ? 'desktop-linux' : process.env.DOCKER_CONTEXT };
const project = readFileSync('supabase/config.toml', 'utf8').match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
assert.ok(project, 'Missing local project_id');
assert.equal(existsSync('supabase/.temp/project-ref'), false, 'Refusing to test a linked workspace; unlink locally first');
const container = `supabase_db_${project}`;
const psqlArgs = [...dockerArgs, 'exec', '-i', container, 'psql', '-X', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
function sqlResult(sql) {
  return spawnSync(docker, psqlArgs, { input: sql, encoding: 'utf8', env: commandEnv, timeout: 30_000, maxBuffer: 2_000_000 });
}
function sql(sqlText) {
  const result = sqlResult(sqlText);
  assert.equal(result.status, 0, `Local PostgreSQL operation failed: ${result.stderr?.slice(0, 1200)}`);
  return result.stdout.trim();
}
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
function forbiddenSql(user, statement, pattern = /permission denied/i) {
  const claims = JSON.parse(Buffer.from(user.token.split('.')[1], 'base64url').toString('utf8'));
  const result = sqlResult(`begin; set local role authenticated; select set_config('request.jwt.claims',${quote(JSON.stringify(claims))},true); ${statement}; rollback;`);
  assert.notEqual(result.status, 0, 'Protected SQL unexpectedly succeeded');
  assert.match(result.stderr, pattern);
}
async function ok(promise) {
  const result = await promise;
  assert.equal(result.error, null, result.error ? `${result.error.code}: ${result.error.message}` : undefined);
  return result.data;
}
async function denied(promise, pattern) {
  const result = await promise;
  assert.ok(result.error, 'Protected request unexpectedly succeeded');
  if (pattern) assert.match(`${result.error.code} ${result.error.message}`, pattern);
  return result.error;
}
let anon, authAdmin, platformAdmin, ownerA, managerA, staffA, ownerB, customers, merchantA, merchantB;
let venueA, venueB, experienceA, experienceB, draftExperience, category, area;
const run = randomUUID().replaceAll('-', '');
let apiUrl, anonKey;
function client(key) {
  return createClient(apiUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function localUser(name, metadata = {}) {
  const email = `khi-pass-local-${run}-${name}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const created = await ok(authAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata }));
  const c = client(anonKey);
  const signed = await ok(c.auth.signInWithPassword({ email, password }));
  return { id: created.user.id, c, token: signed.session.access_token };
}
async function moderate(kind, id, status) {
  await ok(platformAdmin.c.rpc('admin_moderate_content', { p_kind: kind, p_id: id, p_status: status, p_reason: 'LOCAL TEST ONLY' }));
}
async function makeDrop(overrides = {}, merchant = merchantA, actor = ownerA) {
  const drop = await ok(actor.c.from('drops').insert({
    merchant_id: merchant, title: 'LOCAL TEST ONLY Drop', slug: `local-test-drop-${randomUUID()}`,
    description: 'Disposable local verification fixture. No real partnership.', original_price: 100, drop_price: 50,
    starts_at: new Date(Date.now() - 60_000).toISOString(), ends_at: new Date(Date.now() + 3_600_000).toISOString(),
    claim_limit: 20, per_user_limit: 1, terms: 'LOCAL TEST ONLY, no real-world offer.', ...overrides,
  }).select().single());
  await moderate('drop', drop.id, 'active');
  return drop;
}
async function claim(user, drop, request = randomUUID()) {
  return ok(user.c.rpc('claim_drop', { p_drop_id: drop.id, p_request_id: request }));
}
function holdRow(table, id, seconds = 1.2) {
  assert.ok(['drops', 'drop_claims'].includes(table));
  const child = spawn(docker, psqlArgs, { env: commandEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', error = '';
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  child.stdout.on('data', chunk => { output += chunk; if (output.includes('LOCKED')) readyResolve(); });
  child.stderr.on('data', chunk => { error += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => { if (code === 0) resolve(); else { const e = new Error(`Local lock failed: ${error}`); readyReject(e); reject(e); } });
  });
  child.stdin.end(`begin; select id from public.${table} where id=${quote(id)} for update; select 'LOCKED'; select pg_sleep(${seconds}); commit;`);
  return { ready, done };
}

before(async () => {
  const status = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], {
    encoding: 'utf8', env: commandEnv, timeout: 30_000, maxBuffer: 2_000_000,
  });
  assert.equal(status.status, 0, 'Local Supabase status unavailable; start the local stack first');
  const local = JSON.parse(status.stdout.slice(status.stdout.indexOf('{')));
  apiUrl = local.API_URL ?? local.api_url;
  const url = new URL(apiUrl);
  assert.equal(url.protocol, 'http:');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Refusing non-loopback Supabase endpoint');
  anonKey = local.ANON_KEY ?? local.anon_key ?? local.PUBLISHABLE_KEY;
  const serviceKey = local.SERVICE_ROLE_KEY ?? local.service_role_key ?? local.SECRET_KEY;
  assert.ok(anonKey && serviceKey, 'Local stack keys unavailable');
  anon = client(anonKey); authAdmin = client(serviceKey);
  platformAdmin = await localUser('admin');
  ownerA = await localUser('owner-a'); managerA = await localUser('manager-a'); staffA = await localUser('staff-a'); ownerB = await localUser('owner-b');
  customers = [];
  for (let i = 0; i < 6; i++) customers.push(await localUser(`customer-${i}`, i === 0 ? { is_admin: true, role: 'admin' } : {}));
  sql(`insert into private.platform_admins(user_id) values(${quote(platformAdmin.id)});`);
  merchantA = await ok(platformAdmin.c.rpc('admin_create_merchant', { p_business_name: 'LOCAL TEST ONLY Merchant A', p_slug: `local-test-a-${run}`, p_business_type: 'fictional-demo', p_owner_id: ownerA.id }));
  merchantB = await ok(platformAdmin.c.rpc('admin_create_merchant', { p_business_name: 'LOCAL TEST ONLY Merchant B', p_slug: `local-test-b-${run}`, p_business_type: 'fictional-demo', p_owner_id: ownerB.id }));
  sql(`update public.merchants set is_demo=true where id in (${quote(merchantA)},${quote(merchantB)});`);
  await ok(platformAdmin.c.rpc('admin_set_merchant_member', { p_merchant_id: merchantA, p_user_id: managerA.id, p_role: 'manager' }));
  await ok(platformAdmin.c.rpc('admin_set_merchant_member', { p_merchant_id: merchantA, p_user_id: staffA.id, p_role: 'staff' }));
  await moderate('merchant', merchantA, 'approved'); await moderate('merchant', merchantB, 'approved');
  area = (await ok(anon.from('areas').select('id').eq('slug', 'dha').single())).id;
  category = (await ok(anon.from('categories').select('id').eq('slug', 'gaming').single())).id;
  const createVenue = (actor, merchant, suffix) => ok(actor.c.from('venues').insert({ merchant_id: merchant, name: 'LOCAL TEST ONLY Venue', slug: `local-test-venue-${suffix}-${run}`, area_id: area, address: 'Fictional local test address' }).select().single());
  venueA = await createVenue(ownerA, merchantA, 'a'); venueB = await createVenue(ownerB, merchantB, 'b');
  await moderate('venue', venueA.id, 'published'); await moderate('venue', venueB.id, 'published');
  const createExperience = (actor, merchant, venue, suffix) => ok(actor.c.from('experiences').insert({ merchant_id: merchant, venue_id: venue.id, category_id: category, title: 'LOCAL TEST ONLY Experience', slug: `local-test-exp-${suffix}-${run}`, description: 'Fictional local test experience', min_price: 100, max_price: 200 }).select().single());
  experienceA = await createExperience(ownerA, merchantA, venueA, 'a'); experienceB = await createExperience(ownerB, merchantB, venueB, 'b');
  draftExperience = await createExperience(ownerA, merchantA, venueA, 'draft');
  await moderate('experience', experienceA.id, 'published'); await moderate('experience', experienceB.id, 'published');
});

await test('local schema, seed, defaults, generated columns, RLS and private ACLs', async () => {
  const schema = JSON.parse(sql(`select jsonb_build_object('tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and ((n.nspname='private' and c.relname in ('platform_admins','moderation_audit','merchant_contacts','claim_secrets')) or (n.nspname='public' and c.relname in ('profiles','areas','categories','vibes','merchants','merchant_members','venues','experiences','experience_vibes','experience_schedules','drops','drop_claims','favorites','plans','plan_participants','plan_items','plan_votes')))), 'areas',(select count(*) from public.areas),'categories',(select count(*) from public.categories),'vibes',(select count(*) from public.vibes));`));
  assert.equal(schema.tables, 21); assert.equal(schema.areas, 10); assert.equal(schema.categories, 10); assert.equal(schema.vibes, 8);
  assert.equal(sql(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity;`), '0');
  assert.equal(sql(`select count(*) from public.profiles where id in (${customers.map(u => quote(u.id)).join(',')});`), '6');
  assert.equal(sql(`select search_document is not null from public.experiences where id=${quote(experienceA.id)};`), 't');
  assert.match(experienceA.id, /^[0-9a-f-]{36}$/); assert.ok(new Date(experienceA.updated_at).getTime() > 0);
  for (const table of ['platform_admins', 'merchant_contacts', 'claim_secrets', 'moderation_audit']) {
    for (const role of ['anon', 'authenticated']) assert.equal(sql(`select has_table_privilege(${quote(role)},${quote(`private.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f');
  }
  assert.ok(Number(sql(`select count(*) from pg_indexes where schemaname='public' and tablename in ('venues','experiences','drops','drop_claims','plans','plan_votes');`)) >= 20);
});

await test('real constraints reject cross-tenant references, duplicate slugs, invalid prices/windows/groups', async () => {
  await denied(ownerA.c.from('experiences').insert({ merchant_id: merchantA, venue_id: venueB.id, category_id: category, title: 'Invalid', slug: `local-invalid-${randomUUID()}`, description: 'Invalid cross-tenant fixture' }), /23503/);
  await denied(ownerA.c.from('venues').insert({ merchant_id: merchantA, name: 'Duplicate', slug: venueA.slug, area_id: area, address: 'Local only' }), /23505/);
  for (const invalid of [{ min_price: -1 }, { min_price: 300, max_price: 100 }, { min_group_size: 5, max_group_size: 2 }]) {
    await denied(ownerA.c.from('experiences').insert({ merchant_id: merchantA, venue_id: venueA.id, category_id: category, title: 'Invalid', slug: `local-invalid-${randomUUID()}`, description: 'Constraint test', ...invalid }), /23514/);
  }
  await denied(ownerA.c.from('drops').insert({ merchant_id: merchantA, venue_id: venueB.id, title: 'Invalid', slug: `local-invalid-${randomUUID()}`, description: 'Constraint test', drop_price: 0, starts_at: new Date().toISOString(), ends_at: new Date(Date.now()+10000).toISOString(), claim_limit: 1, terms: 'Local only' }), /23503/);
  await denied(ownerA.c.from('drops').insert({ merchant_id: merchantA, title: 'Invalid', slug: `local-invalid-${randomUUID()}`, description: 'Constraint test', original_price: 10, drop_price: 20, starts_at: new Date().toISOString(), ends_at: new Date(Date.now()-10000).toISOString(), claim_limit: 0, terms: 'Local only' }), /23514/);
  assert.notEqual(sqlResult(`begin; update public.experiences set min_price='NaN'::numeric where id=${quote(experienceA.id)}; rollback;`).status, 0);
});

await test('anonymous publication visibility and protected-table denial', async () => {
  assert.equal((await ok(anon.from('experiences').select('id').eq('id', experienceA.id))).length, 1);
  assert.equal((await ok(anon.from('experiences').select('id').eq('id', draftExperience.id))).length, 0);
  await denied(anon.from('profiles').select('id'));
  await denied(anon.schema('private').from('merchant_contacts').select('*'));
  await denied(anon.schema('private').from('claim_secrets').select('*'));
  await denied(anon.from('merchant_members').insert({ merchant_id: merchantA, user_id: customers[0].id, role: 'owner' }));
  await denied(anon.from('plans').insert({ title: 'Unauthorized' }));
  await denied(anon.rpc('get_merchant_contact', { p_merchant_id: merchantA }));
});

await test('own profile updates, timestamp trigger and metadata cannot escalate authority', async () => {
  const u = customers[0]; const original = await ok(u.c.from('profiles').select().single());
  const updated = await ok(u.c.from('profiles').update({ display_name: 'LOCAL TEST ONLY Customer' }).eq('id', u.id).select().single());
  assert.ok(new Date(updated.updated_at) >= new Date(original.updated_at));
  assert.equal(updated.created_at, original.created_at);
  assert.equal((await ok(u.c.from('profiles').select('id').eq('id', customers[1].id))).length, 0);
  assert.equal((await ok(u.c.from('profiles').update({ display_name: 'Unauthorized' }).eq('id', customers[1].id).select('id'))).length, 0);
  await denied(u.c.from('profiles').update({ is_admin: true }).eq('id', u.id));
  await denied(u.c.from('profiles').update({ created_at: '2000-01-01T00:00:00Z' }).eq('id', u.id));
  await denied(u.c.rpc('admin_moderate_content', { p_kind: 'merchant', p_id: merchantA, p_status: 'approved' }), /ADMIN_REQUIRED/);
  for (const statement of [
    `insert into private.platform_admins(user_id) values(${quote(u.id)})`,
    `update private.platform_admins set user_id=${quote(u.id)}`,
    'delete from private.platform_admins',
  ]) forbiddenSql(u, statement);
});

await test('favorites and private plans are owner-only', async () => {
  const a=customers[0],b=customers[1];
  await ok(a.c.from('favorites').insert({ experience_id: experienceA.id }));
  assert.equal((await ok(b.c.from('favorites').select('*').eq('user_id',a.id))).length,0);
  assert.equal((await ok(b.c.from('favorites').delete().eq('user_id',a.id).select('*'))).length,0);
  await denied(a.c.from('favorites').insert({ experience_id:experienceA.id }),/23505/);
  await denied(a.c.from('favorites').insert({ user_id:b.id,experience_id:experienceB.id }));
  await ok(a.c.from('favorites').delete().eq('experience_id',experienceA.id));
  const p=await ok(a.c.from('plans').insert({title:'LOCAL TEST ONLY private plan'}).select().single());
  assert.match(p.share_id,/^[a-f0-9]{64}$/);
  assert.equal((await ok(b.c.from('plans').select('id').eq('id',p.id))).length,0);
  assert.equal(await ok(anon.rpc('get_shared_plan',{p_share_id:p.share_id})),null);
  await denied(b.c.from('plan_items').insert({plan_id:p.id,experience_id:experienceA.id}));
  await ok(a.c.from('plans').update({title:'LOCAL TEST ONLY edited plan'}).eq('id',p.id));
  await ok(a.c.from('plans').delete().eq('id',p.id));
});

await test('merchant roles, cross-business isolation, contacts and membership spoofing', async () => {
  const edited=await ok(managerA.c.from('venues').update({phone:'LOCAL-TEST'}).eq('id',venueA.id).select().single());
  assert.equal(edited.status,'pending_approval'); await moderate('venue',venueA.id,'published');
  assert.equal((await ok(ownerA.c.from('venues').update({phone:'Unauthorized'}).eq('id',venueB.id).select('id'))).length,0);
  await denied(ownerA.c.from('venues').insert({merchant_id:merchantB,name:'Unauthorized',slug:`local-invalid-${randomUUID()}`,area_id:area,address:'Local only'}));
  await denied(staffA.c.from('experiences').insert({merchant_id:merchantA,venue_id:venueA.id,category_id:category,title:'Unauthorized',slug:`local-invalid-${randomUUID()}`,description:'Local only'}));
  await denied(ownerA.c.from('merchant_members').insert({merchant_id:merchantB,user_id:ownerA.id,role:'owner'}));
  await denied(ownerA.c.rpc('admin_set_merchant_member',{p_merchant_id:merchantB,p_user_id:ownerA.id,p_role:'owner'}),/ADMIN_REQUIRED/);
  await ok(ownerA.c.rpc('set_merchant_contact',{p_merchant_id:merchantA,p_contact_name:'LOCAL TEST ONLY',p_email:'local@example.invalid',p_phone:'LOCAL-TEST'}));
  assert.equal((await ok(ownerA.c.rpc('get_merchant_contact',{p_merchant_id:merchantA}))).contact_name,'LOCAL TEST ONLY');
  await denied(ownerB.c.rpc('get_merchant_contact',{p_merchant_id:merchantA}),/MERCHANT_ACCESS_REQUIRED/);
  await denied(staffA.c.rpc('get_merchant_contact',{p_merchant_id:merchantA}),/MERCHANT_ACCESS_REQUIRED/);
});

await test('merchant cannot self-approve venues, experiences, Drops or featured fields', async () => {
  const d=await makeDrop();
  for (const [table,id,status,kind] of [['venues',venueA.id,'published','venue'],['experiences',experienceA.id,'published','experience'],['drops',d.id,'active','drop']]) {
    await denied(ownerA.c.from(table).update({status}).eq('id',id),/42501|permission denied/i);
    await denied(ownerA.c.rpc('merchant_set_content_status',{p_kind:kind,p_id:id,p_status:status}),/MODERATION_REQUIRED/);
    await denied(ownerA.c.from(table).insert({merchant_id:merchantA,status}),/42501|permission denied/i);
  }
  await denied(ownerA.c.from('experiences').update({featured:true}).eq('id',experienceA.id));
  await ok(platformAdmin.c.rpc('admin_set_experience_featured',{p_id:experienceA.id,p_featured:true}));
  assert.equal((await ok(anon.from('experiences').select('featured').eq('id',experienceA.id).single())).featured,true);
  await ok(ownerA.c.from('experiences').update({title:'LOCAL TEST ONLY re-review'}).eq('id',experienceA.id));
  assert.equal((await ok(anon.from('experiences').select('id').eq('id',experienceA.id))).length,0);
  await moderate('experience',experienceA.id,'published');
  const vibe=(await ok(anon.from('vibes').select('id').eq('slug','chill').single())).id;
  await ok(ownerA.c.from('experience_vibes').insert({experience_id:experienceA.id,vibe_id:vibe}));
  assert.equal((await ok(ownerA.c.from('experiences').select('status').eq('id',experienceA.id).single())).status,'pending_approval');
  await moderate('experience',experienceA.id,'published');
  await ok(ownerA.c.from('experience_schedules').insert({experience_id:experienceA.id,weekday:5,opens_at:'10:00',closes_at:'18:00'}));
  assert.equal((await ok(ownerA.c.from('experiences').select('status').eq('id',experienceA.id).single())).status,'pending_approval');
  await moderate('experience',experienceA.id,'published');
});

await test('claim inventory contention: six real JWT requests, exactly one issuance', async () => {
  const d=await makeDrop({claim_limit:1}); const lock=holdRow('drops',d.id); await lock.ready;
  const results=await Promise.all(customers.map(u=>u.c.rpc('claim_drop',{p_drop_id:d.id,p_request_id:randomUUID()}))); await lock.done;
  assert.equal(results.filter(r=>!r.error).length,1);
  assert.equal(results.filter(r=>r.error?.message==='DROP_SOLD_OUT').length,5);
  assert.equal(sql(`select count(*) from public.drop_claims where drop_id=${quote(d.id)};`),'1');
  const winner=results.find(r=>!r.error).data;
  assert.match(winner.redemption_code,/^KHI-[A-F0-9]{32}$/);
});

await test('per-user concurrency, idempotent retry, auth.uid ownership and direct state denial', async () => {
  const u=customers[0],d=await makeDrop({claim_limit:10,per_user_limit:1});
  const results=await Promise.all(Array.from({length:6},()=>u.c.rpc('claim_drop',{p_drop_id:d.id,p_request_id:randomUUID()})));
  assert.equal(results.filter(r=>!r.error).length,1);
  assert.equal(results.filter(r=>r.error?.message==='USER_CLAIM_LIMIT_REACHED').length,5);
  const idempotent=await makeDrop({claim_limit:1}); const key=randomUUID();
  const retries=await Promise.all(Array.from({length:4},()=>u.c.rpc('claim_drop',{p_drop_id:idempotent.id,p_request_id:key})));
  assert.ok(retries.every(r=>!r.error)); assert.equal(new Set(retries.map(r=>r.data.id)).size,1);
  const pass=retries[0].data;
  assert.equal(sql(`select user_id from public.drop_claims where id=${quote(pass.id)};`),u.id);
  assert.equal(sql(`select count(*) from public.drop_claims where drop_id=${quote(idempotent.id)};`),'1');
  await denied(u.c.rpc('claim_drop',{p_drop_id:d.id,p_user_id:customers[1].id}));
  await denied(anon.rpc('claim_drop',{p_drop_id:d.id}));
  await denied(customers[1].c.rpc('get_my_pass',{p_claim_id:pass.id}),/PASS_NOT_AVAILABLE/);
  assert.equal((await ok(customers[1].c.from('drop_claims').select('id').eq('id',pass.id))).length,0);
  await denied(u.c.from('drop_claims').update({status:'redeemed'}).eq('id',pass.id));
  await denied(ownerA.c.from('drop_claims').update({status:'redeemed'}).eq('id',pass.id));
  await denied(ownerA.c.from('drops').update({claim_revision:0}).eq('id',idempotent.id));
  await denied(ownerA.c.from('drop_claims').select('user_id').eq('id',pass.id));
  await ok(u.c.rpc('cancel_my_claim',{p_claim_id:pass.id}));
  await denied(customers[1].c.rpc('claim_drop',{p_drop_id:idempotent.id,p_request_id:randomUUID()}),/DROP_SOLD_OUT/);
});

await test('inactive, future, expired and unpublished Drops reject issuance', async () => {
  for (const [overrides,status] of [
    [{starts_at:new Date(Date.now()+600000).toISOString()},'scheduled'],
    [{starts_at:new Date(Date.now()-600000).toISOString(),ends_at:new Date(Date.now()-1000).toISOString()},'active'],
    [{},'paused'],[{},'draft'],[{},'pending_approval'],
  ]) {
    const d=await makeDrop(overrides);await moderate('drop',d.id,status);
    await denied(customers[0].c.rpc('claim_drop',{p_drop_id:d.id,p_request_id:randomUUID()}),/DROP_NOT_CLAIMABLE/);
  }
  await moderate('merchant',merchantA,'suspended');
  const visible=await ok(anon.from('experiences').select('id').eq('id',experienceA.id));assert.equal(visible.length,0);
  await moderate('merchant',merchantA,'approved');
});

await test('redemption contention: correct staff succeeds once; wrong merchant/user cannot redeem', async () => {
  const d=await makeDrop(),p=await claim(customers[0],d);
  await denied(ownerB.c.rpc('redeem_drop_code',{p_code:p.redemption_code}),/PASS_NOT_REDEEMABLE/);
  await denied(customers[0].c.rpc('redeem_drop_code',{p_code:p.redemption_code}),/PASS_NOT_REDEEMABLE/);
  const lock=holdRow('drop_claims',p.id);await lock.ready;
  const scans=await Promise.all([staffA,managerA,ownerA].map(u=>u.c.rpc('redeem_drop_code',{p_code:p.redemption_code})));await lock.done;
  assert.equal(scans.filter(r=>!r.error).length,1);assert.equal(scans.filter(r=>r.error?.message==='PASS_NOT_REDEEMABLE').length,2);
  assert.equal(sql(`select status from public.drop_claims where id=${quote(p.id)};`),'redeemed');
  assert.equal(sql(`select redeemed_at is not null from public.drop_claims where id=${quote(p.id)};`),'t');
  await denied(staffA.c.rpc('redeem_drop_code',{p_code:p.redemption_code}),/PASS_NOT_REDEEMABLE/);
});

await test('expiry is enforced after lock waits, without cleanup or cron', async () => {
  const d=await makeDrop(),p=await claim(customers[0],d);
  sql(`update public.drop_claims set expires_at=clock_timestamp()+interval '800 milliseconds' where id=${quote(p.id)};`);
  const lock=holdRow('drop_claims',p.id,1.5);await lock.ready;
  await denied(staffA.c.rpc('redeem_drop_code',{p_code:p.redemption_code}),/PASS_NOT_REDEEMABLE/);await lock.done;
  const actual=await ok(customers[0].c.rpc('get_my_pass',{p_claim_id:p.id}));
  assert.equal(actual.status,'expired');assert.equal(actual.redemption_code,null);
  assert.equal(sql(`select status from public.drop_claims where id=${quote(p.id)};`),'pending');
});

await test('anonymous voting capabilities, participant binding, unique votes and link revocation', async () => {
  const owner=customers[0],p=await ok(owner.c.from('plans').insert({title:'LOCAL TEST ONLY voting plan',status:'shared'}).select().single());
  const item=await ok(owner.c.from('plan_items').insert({plan_id:p.id,experience_id:experienceA.id}).select().single());
  await denied(owner.c.from('plan_items').insert({plan_id:p.id,experience_id:experienceA.id}),/23505/);
  const a=await ok(anon.rpc('join_shared_plan',{p_share_id:p.share_id,p_nickname:'LOCAL anonymous A'}));
  const b=await ok(anon.rpc('join_shared_plan',{p_share_id:p.share_id,p_nickname:'LOCAL anonymous B'}));
  assert.match(a.participant_token,/^[a-f0-9]{64}$/);assert.notEqual(a.participant_token,b.participant_token);
  await denied(anon.rpc('cast_plan_vote',{p_share_id:p.share_id,p_participant_token:'0'.repeat(64),p_item_id:item.id,p_vote:'yes'}),/PLAN_VOTE_NOT_ALLOWED/);
  await denied(anon.rpc('cast_plan_vote',{p_share_id:p.share_id,p_participant_token:a.participant_token,p_participant_id:b.participant_id,p_item_id:item.id,p_vote:'yes'}));
  for (const vote of ['yes','maybe','no']) await ok(anon.rpc('cast_plan_vote',{p_share_id:p.share_id,p_participant_token:a.participant_token,p_item_id:item.id,p_vote:vote}));
  assert.equal(sql(`select count(*) from public.plan_votes where participant_id=${quote(a.participant_id)} and plan_item_id=${quote(item.id)};`),'1');
  assert.equal(sql(`select vote from public.plan_votes where participant_id=${quote(a.participant_id)} and plan_item_id=${quote(item.id)};`),'no');
  const signed=await ok(customers[1].c.rpc('join_shared_plan',{p_share_id:p.share_id,p_nickname:'LOCAL signed participant'}));
  await denied(customers[2].c.rpc('cast_plan_vote',{p_share_id:p.share_id,p_participant_token:signed.participant_token,p_item_id:item.id,p_vote:'yes'}),/PLAN_VOTE_NOT_ALLOWED/);
  const shared=await ok(anon.rpc('get_shared_plan',{p_share_id:p.share_id}));
  assert.equal(shared.items[0].no,1);const payload=JSON.stringify(shared);
  for (const secret of [owner.id,customers[1].id,a.participant_token,b.participant_token,'participant_token_hash','user_id','owner_id']) assert.equal(payload.includes(secret),false);
  await denied(anon.from('plan_participants').select('*'));await denied(anon.from('plan_votes').select('*'));
  const newShare=await ok(owner.c.rpc('rotate_plan_share_id',{p_plan_id:p.id}));assert.notEqual(newShare,p.share_id);assert.match(newShare,/^[a-f0-9]{64}$/);
  assert.equal(await ok(anon.rpc('get_shared_plan',{p_share_id:p.share_id})),null);
  await denied(anon.rpc('cast_plan_vote',{p_share_id:p.share_id,p_participant_token:a.participant_token,p_item_id:item.id,p_vote:'yes'}),/PLAN_VOTE_NOT_ALLOWED/);
  await ok(owner.c.from('plans').update({status:'closed'}).eq('id',p.id));
  await denied(anon.rpc('cast_plan_vote',{p_share_id:newShare,p_participant_token:a.participant_token,p_item_id:item.id,p_vote:'yes'}),/PLAN_VOTE_NOT_ALLOWED/);
});

await test('SECURITY DEFINER owners, fixed paths and function ACL audit', async () => {
  const functions=JSON.parse(sql(`select jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'acl',p.proacl::text,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'auth_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef;`));
  const anonymous=new Set(['public.get_drop_availability','public.get_shared_plan','public.join_shared_plan','public.cast_plan_vote',
    'private.is_admin','private.is_merchant_member','private.has_merchant_role','private.merchant_is_public','private.venue_is_public','private.experience_is_public','private.drop_is_public','private.owns_plan','private.experience_merchant']);
  assert.ok(functions.length>=20);
  for(const f of functions){assert.equal(f.owner,'postgres',f.name);assert.ok(f.config.includes('search_path=""'),f.name);assert.equal(/[{,]=X\//.test(f.acl??''),false,`PUBLIC execution ${f.name}`);if(f.anon_execute)assert.ok(anonymous.has(f.name),`Unexpected anon execution ${f.name}`);}
  for(const name of ['private.require_admin','private.change_content_status','private.bootstrap_profile','private.guard_drop_history','private.requeue_experience']){
    const f=functions.find(f=>f.name===name);assert.ok(f);assert.equal(f.auth_execute,false,name);assert.equal(f.anon_execute,false,name);
  }
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'),envFingerprint);
});

await test('repeatable-read contention rejects stale transactions instead of overselling', async () => {
  const d=await makeDrop({claim_limit:1});
  const blocker=spawn(docker,psqlArgs,{env:commandEnv,stdio:['pipe','pipe','pipe']});
  let blocked='';
  const locked=new Promise((resolve,reject)=>{
    blocker.stdout.on('data',chunk=>{blocked+=chunk;if(blocked.includes('LOCKED'))resolve();});
    blocker.on('error',reject);
  });
  const released=new Promise((resolve,reject)=>{blocker.on('close',code=>code===0?resolve():reject(new Error('Local barrier failed')));});
  blocker.stdin.write(`begin; select id from public.drops where id=${quote(d.id)} for update; select 'LOCKED';\n`);
  await locked;
  function transaction(user){
    const claims=JSON.parse(Buffer.from(user.token.split('.')[1],'base64url').toString('utf8'));
    const child=spawn(docker,psqlArgs,{env:commandEnv,stdio:['pipe','pipe','pipe']});let output='',error='';
    const ready=new Promise((resolve,reject)=>{child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('SNAPSHOT_READY'))resolve();});child.on('error',reject);});
    child.stderr.on('data',chunk=>{error+=chunk;});
    const done=new Promise((resolve,reject)=>{child.on('close',status=>resolve({status,error}));child.on('error',reject);});
    child.stdin.end(`begin isolation level repeatable read; set local role authenticated; select set_config('request.jwt.claims',${quote(JSON.stringify(claims))},true); select count(*) from public.drops; select 'SNAPSHOT_READY'; select public.claim_drop(${quote(d.id)},${quote(randomUUID())}); commit;`);
    return {ready,done};
  }
  const first=transaction(customers[3]),second=transaction(customers[4]);
  try {await Promise.all([first.ready,second.ready]);}
  finally {blocker.stdin.end('commit;\n');}
  await released;
  const results=await Promise.all([first.done,second.done]);
  assert.equal(results.filter(r=>r.status===0).length,1);
  assert.equal(results.filter(r=>/could not serialize access due to concurrent update/i.test(r.error)).length,1);
  assert.equal(sql(`select count(*) from public.drop_claims where drop_id=${quote(d.id)};`),'1');
});

await test('redemption/cancellation race leaves one consistent terminal state', async () => {
  const d=await makeDrop(),p=await claim(customers[0],d);
  const [redemption,cancellation]=await Promise.all([
    staffA.c.rpc('redeem_drop_code',{p_code:p.redemption_code}),
    customers[0].c.rpc('cancel_my_claim',{p_claim_id:p.id}),
  ]);
  assert.equal(cancellation.error,null);
  const state=JSON.parse(sql(`select jsonb_build_object('status',status,'redeemed',redeemed_at is not null,'cancelled',cancelled_at is not null) from public.drop_claims where id=${quote(p.id)};`));
  assert.ok(['redeemed','cancelled'].includes(state.status));assert.notEqual(state.redeemed,state.cancelled);
  assert.equal(redemption.error===null,state.status==='redeemed');
  if(redemption.error) assert.equal(redemption.error.message,'PASS_NOT_REDEEMABLE');
});

await test('merchant suspension blocks issued pass redemption', async () => {
  const d=await makeDrop(),p=await claim(customers[0],d);
  await moderate('merchant',merchantA,'suspended');
  await denied(staffA.c.rpc('redeem_drop_code',{p_code:p.redemption_code}),/PASS_NOT_REDEEMABLE/);
  await moderate('merchant',merchantA,'approved');
});
