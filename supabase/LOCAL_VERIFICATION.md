# Local database verification

Verified 2026-10-09 (Asia/Karachi). All database operations targeted the disposable Docker Supabase stack for project_id `khi-pass`. No hosted database connection, login, link, db push, or linked reset was used. `.env.local` was not loaded for database credentials and its SHA-256 fingerprint is unchanged.

## Environment and execution

- Supabase project-local CLI: 2.120.0, installed as a dev dependency.
- Docker Desktop server: 29.8.2; context: desktop-linux; Linux containers.
- PostgreSQL image: 17.11.0.004; database container: supabase_db_khi-pass.
- Local API: http://127.0.0.1:54321; local database port: 54322.
- `private` is excluded from configured exposed Data API schemas.
- `npx.cmd supabase start` completed. `npx.cmd supabase db reset --local` completed twice, including a fresh replay after the corrective migration.
- All seven original migrations executed in order. Corrective migration 20261009000800 executed afterward. Hashes of all seven original migration files and seed.sql match their pre-task hashes.
- Seed executed successfully: 10 areas, 10 categories, 8 vibes; no businesses or users in seed.sql.
- Actual catalog: 21 application tables, all 21 with RLS; 52 policies; 33 foreign keys; 69 indexes including primary/unique indexes; 31 SECURITY DEFINER functions. All eight migration versions are recorded locally.

Database, Auth, gateway, Storage, Realtime, Studio, postgres-meta and Analytics were healthy at the final check. REST and Edge Runtime were running. The optional Vector logging collector restarts because its configured Docker log source cannot connect to host.docker.internal:2375 (connection refused). This does not prevent the database/Auth/API tests; local log collection is unavailable. No Docker daemon settings were changed or unauthenticated TCP Docker access enabled to work around it.

## Bug discovered and exact fix

The first live database run passed 14/17 test groups. Redemption returned SQLSTATE 42702: column reference "c.id" is ambiguous. In redeem_drop_code, both the PL/pgSQL record variable and the joined drop_claims table used the name `c`.

The new 20261009000800_fix_redemption_alias.sql uses CREATE OR REPLACE FUNCTION and changes only the SELECT's table alias:

```sql
select claimed.id,claimed.merchant_id,claimed.drop_id into v_claim,v_merchant,v_drop
  from private.claim_secrets s
  join public.drop_claims claimed on claimed.id=s.claim_id
  where s.redemption_code=upper(btrim(p_code));
```

The record variable remains `c`. Existing arguments, return type, ownership, empty search_path, authentication/tenant/status/expiry checks, lock order and grants are retained. The original seven migration files were preserved. A clean replay and the function ACL audit confirmed the replacement remained restricted to authenticated callers with internal membership checks.

The Windows test runner also explicitly adds the installed Docker Desktop bin directory to child-process PATH. Without it, the CLI status subprocess failed before any database assertion despite the Docker daemon running. No production application code changed.

## Executed integration results

`npm.cmd run test:db:local`: **17 tests passed, 0 failed, 0 skipped**, approximately 22.7 seconds on the final clean database.

The setup creates eleven disposable local Auth users, signs them in for real JWTs, and creates explicitly labelled fictional Merchants A/B. Only the local service credential creates Auth users. Only local privileged SQL provisions the test platform admin. Application requests then use anonymous-key clients and each actual user's JWT. The suite never prints credentials, passwords, pass codes or bearer capabilities.

| Verification | Actual result |
| --- | --- |
| Schema integrity | Tables, RLS, private ACLs, reference seed, profile bootstrap, UUID/timestamp defaults, generated search column and indexes verified |
| Constraints | Cross-tenant composite FKs, duplicate slugs/favorites/items, negative/inverted prices/groups, invalid Drop constraints and numeric NaN rejected |
| Anonymous | Published experience visible, draft hidden; profiles, contacts, claim secrets and protected writes denied |
| Normal user | Own allowed profile fields update; other profile inaccessible; timestamps protected; spoofed admin metadata provides no privileges |
| Plans/favorites | Own CRUD works; another user's rows/mutations and private plan access denied |
| Merchant roles | Owner/manager A author allowed A content; cannot author B; staff cannot author; membership spoofing and contact leaks denied |
| Admin authority | Intended private admin provisioning and moderation work; normal user's private platform_admins INSERT/UPDATE/DELETE denied in authenticated JWT SQL context |
| Moderation | Direct venue/experience/Drop approval and featured changes denied; admin RPC works; published edits/vibes/schedules requeue |
| Stock concurrency | Six actual concurrent real-JWT claim requests blocked behind the same Drop row lock: exactly one issued claim, five DROP_SOLD_OUT failures; ledger count 1 |
| Per-user concurrency | Six concurrent requests by one user: exactly one success, five USER_CLAIM_LIMIT_REACHED failures |
| Idempotency | Four simultaneous requests with one stable key return the same pass; ledger count 1; cancellation does not restore inventory |
| Claim authorization | Caller identity equals auth.uid(); supplied user_id, anonymous claim, other-user pass lookup and direct ledger mutation denied |
| Unclaimable Drops | Future, expired, paused, draft and pending approval rejected; suspended merchant hides discovery |
| Scan concurrency | Three concurrent staff/manager/owner scans blocked behind the claim row lock: exactly one redemption, two PASS_NOT_REDEEMABLE failures; server timestamp present |
| Redemption denial | Wrong merchant, non-member customer, already redeemed, expired and suspended merchant rejected |
| Lock-wait expiry | Claim expires while a scan waits on row lock: redemption rejected; get_my_pass reports expired without code despite raw pending status; no cron needed |
| Voting | Invalid token/participant spoofing rejected; repeated votes upsert to one effective vote; signed participant bound to user; shared response redacted; token entropy/uniqueness, rotated-link revocation and closed-plan rejection verified |
| Higher isolation | Two actual repeatable-read PostgreSQL transactions establish snapshots behind a held Drop lock: one issues, one fails with concurrent-update serialization error; ledger count 1 |
| Cancellation race | Concurrent redemption/cancellation leaves one consistent terminal state with mutually exclusive timestamps; a losing redemption must return the intended denial |

## SECURITY DEFINER review

All 31 public/private elevated functions were inspected in the actual local catalog: owner postgres; explicit `search_path = ''`; no PUBLIC EXECUTE; grants restricted to their intended roles. Source review checked auth.uid()/capability authorization, private data access and dynamic SQL. Identity is obtained from auth.uid(), never user_metadata or a supplied user_id. The authenticated admin RPCs still require the private database-backed admin predicate; an authenticated EXECUTE grant alone gives no admin authority.

- Private identity predicates: is_admin, is_merchant_member, has_merchant_role and owns_plan derive the caller identity. Private publication predicates merchant_is_public, venue_is_public, experience_is_public, drop_is_public and experience_merchant return only publication booleans or tenant identity used by policies. These nine helpers have intentional anon/authenticated EXECUTE but are outside exposed API schemas; private tables remain inaccessible.
- Internal-only definers: bootstrap_profile, guard_drop_history, requeue_experience, require_admin and change_content_status have neither anon nor authenticated EXECUTE. Bootstrap ignores untrusted role metadata. Trigger helpers maintain profile/moderation/issued-history invariants.
- Authenticated public definers: get_my_pass, claim_drop, redeem_drop_code, cancel_my_claim, admin_create_merchant, admin_set_merchant_member, get_merchant_contact, set_merchant_contact, merchant_set_content_status, admin_moderate_content, admin_set_experience_featured, merchant_claim_stats and rotate_plan_share_id check caller ownership, merchant roles or database-backed admin authority before privileged access.
- Anonymous-capability/public definers: get_drop_availability discloses advisory public stock only; get_shared_plan returns an explicit redacted payload; join_shared_plan and cast_plan_vote require an open/unexpired strong share capability and voting additionally validates the hashed participant token and signed-user binding.
- The only dynamic SQL in elevated application functions is change_content_status: table name comes from a fixed CASE allowlist, identifiers use format('%I'), and caller values use parameter binding with USING. No supplied arbitrary table/SQL text is executed.

No excess function grants were found by the catalog audit. The suite remains a finite regression matrix, not a proof against every possible application or operational attack.

## Files created/modified

- package.json: Supabase CLI dev dependency and test:db:local script.
- package-lock.json: locked local CLI installation.
- supabase/config.toml: generated local configuration (PostgreSQL 17, local seed enabled, private not exposed).
- supabase/.gitignore: ignore local CLI temporary/link/branch artifacts.
- supabase/tests/local-verification.test.mjs: reusable local-only regression suite; no heavy testing dependency.
- supabase/migrations/20261009000800_fix_redemption_alias.sql: correction described above.
- supabase/README.md: current local verification workflow and future preview instructions.
- supabase/LOCAL_VERIFICATION.md: this execution report.

The seven original migrations, seed.sql, .env.local and frontend source files were not changed by this resumed task. Disposable test data remains local for inspection and can be removed with an explicitly local reset.

## Frontend checks and limits

Final `npm.cmd run lint`: passed (exit 0).
Final `npm.cmd run build`: passed (exit 0), including Next.js 16.4.0 production compilation, TypeScript and static generation.

Remaining work before public deployment: separately verify hosted schema/PostgreSQL compatibility, run representative production EXPLAIN/load tests, implement planned media policies/processing, API abuse/rate controls, token handling and data-retention/offboarding rules. Anonymous voting remains a bearer-capability system with a participant cap, not one-human-one-vote verification. npm installation reported five high-severity dependency audit findings; those require separate dependency triage and were not force-fixed as part of this database task. Optional local logging needs Docker/CLI compatibility configuration review.

## Future remote preview commands (not executed)

Only after separately approved hosted-project inspection/linking:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref xpiwommljqoiplgrnnwp
npx.cmd supabase db push --dry-run
```

No remote application command was run. Local reset semantics follow the [Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-db-reset). Higher-isolation retry behavior follows [PostgreSQL 17 transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html).

Remote Supabase project was not modified.
