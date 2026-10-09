# KHI PASS database foundation

**Executed on disposable LOCAL Supabase. No remote migrations or data changes. See LOCAL_VERIFICATION.md for results.**

## Baseline and deployment prerequisites

This is a fresh baseline for Supabase PostgreSQL 15 or newer. No old SQL or CLI configuration existed in this workspace. Standard Supabase `auth`, `public`, `extensions`, `anon`, `authenticated` and `postgres` must exist. The migration owner must be `postgres` (or an equally reviewed owner with RLS bypass): the private definer helpers deliberately avoid recursive membership policies by reading as the table owner. Do not FORCE RLS on these helper-owned tables without redesigning/testing the helpers. Keep `private` OUT of Data API exposed schemas and do not grant CREATE in it to clients. Verify the remote schema is compatible before applying this fresh baseline; these files have not inspected an existing remote schema.

Money/budget constraints reject PostgreSQL numeric NaN as well as negatives; Drop timestamps must be finite.

Seven original ordered migrations separate foundation, businesses, claims, plans, guards/indexes, RPCs, and RLS/column grants. An eighth corrective migration fixes the redemption function alias collision discovered during local execution; the seven original files are preserved. Tables have RLS and revoked client grants from their creation migration onward. Migrations use normal CREATE statements so collisions fail. Only shared Supabase extension/schema setup and the separately optional reference seed are idempotent.

Text plus CHECK constraints make status evolution straightforward compared with PostgreSQL enum replacement. Every timestamp is timestamptz; weekly schedule slots use local `time` plus a venue timezone fixed to Asia/Karachi. Weekday 0 means Sunday. Split overnight windows at midnight (PostgreSQL `time '24:00'` is available). No schedule rows means availability is unknown, not guaranteed or booked. Event dates supplement recurring schedules; booking inventory is outside this MVP.

## Relationships and private data

- `auth.users` -> one `profiles` row, bootstrapped by a definer trigger. Existing auth users receive empty profiles when applied; no auth users are created. User metadata never supplies privileges. Profiles are readable by their owner or trusted admins, and only display_name/avatar_url/phone are user-editable.
- `auth.users` -> many `merchant_members` -> many `merchants`. Owner/manager/staff are merchant-specific memberships, not platform roles. Users may manage multiple businesses. Initial onboarding and membership assignment use admin-checked RPCs; a client cannot attach itself to an existing business. Account deletion can remove a last owner, so operational offboarding must transfer ownership first; admin membership RPCs protect the last owner.
- Internal contact_name/email/phone live in `private.merchant_contacts`, accessed only by admin or owner/manager RPCs. Business name/description/logo/social/site/type are public on approved merchants. Public venue phone is intentionally a business contact, not a user's phone.
- Merchant -> venues -> experiences; a direct experience merchant_id supports tenant queries and RLS, with a composite FK proving it matches the venue's merchant. Drop -> merchant and optional venue/experience; selecting an experience requires its venue and composite FKs prohibit cross-business associations.
- Experience -> vibes and weekly schedules. `image_paths` references future controlled Storage object paths rather than arbitrary uploader ownership.
- `drop_claims` represents both a pass and its single redemption ledger row. Claim merchant/venue are issuance snapshots protected by composite FKs. Prices/terms are snapshotted. Auth account deletion anonymizes claim ownership while retaining issued inventory/history. Issued Drop associations cannot be reassigned. No client can insert/update/delete claims.
- Favorite uniqueness is (user, experience). Plan -> participants/items/votes. Candidate experience duplicates are prohibited. Composite vote FKs require participant and item from the same plan; one vote per participant/item. Plans/participants/votes are not public tables.
- `private.platform_admins` is the tamper-resistant authority source. There is no is_admin on profiles, global merchant flag or client-role authorization. Only trusted SQL/server operations may provision admins after an actual user exists. No initial admins are seeded. `private.moderation_audit` retains moderated status changes and admin membership actions; clients cannot edit it.

## Content moderation

Owners/managers insert draft venues/experiences/Drops through column-restricted table grants. Staff read tenant content and redeem, but do not author it. Public status/featured/demo/tenant identity fields cannot be directly updated or inserted by clients. Merchant business edits automatically return an approved merchant to pending. Editing published experience/venue content or approved Drop content returns it to pending_approval; changing published vibes/schedules also requeues the parent experience. Suspended merchants cannot manage or redeem. Members can still inspect their own suspended tenant's records.

`merchant_set_content_status(kind,id,status)` accepts only non-approving states: merchant pending; venue/experience draft, pending_approval or archived; Drop draft, pending_approval or paused. `admin_moderate_content` alone permits approval/publication/activation via trusted admin authorization and records reasons. Database CHECK constraints validate all final statuses. Closing/pausing/hiding content is immediate; existing passes on a paused/rejected/unapproved Drop or suspended merchant cannot be redeemed. Expired/sold-out Drops can honor already issued passes until their independent redemption deadline. Featured content uses the admin-checked and audited admin_set_experience_featured RPC; no client UPDATE grant permits it.

## Claiming, expiry and redemption

`claim_drop(drop_id, request_id DEFAULT NULL)` derives auth.uid(), locks the approved merchant then the Drop row, checks publication/time, counts all issued rows and user rows, and issues a pass atomically. Pass lifetime defaults to 600 seconds and is configurable from 60 to 86400 seconds; expiry is capped by redemption_ends_at, or ends_at when no extended redemption window is provided. No client user_id or timestamp is accepted. Send a stable UUID request_id per claim attempt to make retries idempotent; it is scoped by (user, Drop, request_id). Without a supplied key, each call is a separate claim attempt and still obeys limits.

Inventory and per-user limits count ALL lifetime-issued claims, including expired/cancelled/redeemed rows. Cancellation never refunds inventory or user quota. No editable remaining-stock counter exists. A protected claim_revision increments only during issuance to mutate the locked row version: at repeatable-read/serializable isolation stale concurrent transactions must retry instead of overselling. Standard PostgREST read-committed operation is serialized by the Drop row lock. Lowering limits below issued counts is rejected. Public `get_drop_availability` supplies an advisory stock/claimable snapshot; only claim_drop guarantees stock. scheduled Drops become time-claimable at starts_at without cron. End times and inventory are authoritative even if an informational status has not yet been cleaned up.

Codes are `KHI-` plus 32 uppercase random hexadecimal characters (128 bits from pgcrypto). They are suitable for QR encoding and substantially safer than six digits. Store codes only in private.claim_secrets with a UNIQUE constraint; members cannot list them. `get_my_pass` exposes a code only to its owning user while pending and unexpired. Do not log codes, share tokens, participant tokens or QR payloads.

`redeem_drop_code(code)` requires authenticated owner/manager/staff membership for that merchant; locks merchant, membership, Drop, then claim; checks exact ownership, approved merchant and usable Drop; samples database time AFTER lock waits; and atomically changes pending -> redeemed with server redeemed_at/redeemed_by. Concurrent scans cannot both succeed. Wrong/missing/expired/already-used codes and wrong merchants receive the same PASS_NOT_REDEEMABLE error. Expiration is enforced by expires_at at use time, never by cron. Pending rows may remain physically pending after expiry: get_my_pass and merchant_claim_stats expose effective expiry. cancel_my_claim closes a user's pending claim under a row lock. Claims are retained and anonymized on user deletion; a separate retention/privacy policy is needed before production.

## Shared plans and anonymous voting

Owner-only plans have 256-bit share_id values generated by the database. Owners can set status, expiration, and rotate the share identifier to revoke an old link. `get_shared_plan` requires a matching shared/closed unexpired capability; it returns explicit context, published candidate IDs, nicknames and vote totals, never owner/user UUIDs, hashes, raw votes or secrets. Hiding an experience also hides it from a shared plan. Do not embed personal data in shared plan titles/nicknames.

`join_shared_plan` accepts a nickname, generates a separate 256-bit participant token and stores only SHA-256 of it. auth.uid() is derived, never accepted from a client. Signed-in users get one participant per plan; rejoining rotates their token. Anonymous users have no stable human identity. A plan row lock enforces a 100-participant cap and coordinates voting with plan closing/expiry. `cast_plan_vote` requires the share capability AND participant token, binds signed-in participants to their current auth.uid(), verifies plan-item membership, and upserts exactly one vote. Deleted signed-in identities invalidate their tokens rather than downgrading them into anonymous access.

MVP limitation: a link holder can make multiple anonymous identities, so this is casual group voting, not election-grade one-human-one-vote. The participant cap is resource protection, not Sybil prevention. Before exposing the UI, add server/API rate limits and abuse controls, store bearer tokens safely (prefer protected application cookies), and avoid analytics/referrer/log exposure. Closing a plan or rotating its share_id revokes old link capabilities. Owner moderation can remove participants and their cascading votes. No anonymous direct table grants exist.

## RLS summary

| Tables | Read | Write |
| --- | --- | --- |
| profiles | Own profile; trusted admin | Own allowlisted fields; bootstrap-only insert |
| areas/categories/vibes | Active public reference rows; admins see inactive | Admin-only, allowlisted fields |
| merchants | Approved public; own members; admins | Owner/manager public-field edits; admin onboarding/status RPCs |
| merchant_members | Own membership; owner/manager roster; admins | Admin-only RPC |
| venues/experiences/drops | Published/public through approved parent chain; own members; admins | Owner/manager or admin allowlisted drafts/edits; approval RPC only |
| experience_vibes/schedules | Published parent; parent merchant members/admins | Owner/manager or admin; published parent requeued |
| drop_claims | Own or own merchant or admin, with sensitive columns withheld | Claim/redemption/cancellation RPC only |
| favorites | Own | Own insert/delete; only publicly discoverable experiences can be added |
| plans | Owner | Owner, with server share IDs and timestamps |
| plan_participants | Owner roster or own participant, no hashes/user IDs in granted columns | Join RPC; owner removes participants |
| plan_items | Owner | Owner candidates/position; only public experiences may be inserted |
| plan_votes | Owner | Capability-checked vote RPC only |
| private admin/contact/code/audit tables | No direct client grants or policies | Narrow definer functions/trusted operators only |

Definers use `search_path = ''`, schema-qualified references, auth.uid(), fixed entity-name allowlists and explicit EXECUTE revocations. Private policy helpers return only identity/publication booleans or a tenant ID; they are not exposed as Data API RPCs. Only specific public RPCs are granted. RLS policies do not substitute for RPC authorization: definer paths validate ownership explicitly because their migration owner bypasses RLS. Application code must use the existing publishable-key SSR clients, not a service role that bypasses these policies. Select explicit allowed columns on claims and participants instead of select('*').

## Discovery, analytics and search

Partial indexes support published category/price/featured/event discovery and scheduled/active ending-soon Drops. Venue area and bounding-box coordinate indexes avoid PostGIS for this MVP; latitude/longitude indexes are not a true distance index. Membership, claim inventory/user/merchant, favorites, plan ownership/share lookup, schedules/vibes, ordering and vote aggregation have targeted indexes. PKs/unique indexes cover many FK lookups already.

A generated simple-config tsvector and partial GIN cover experience title/description, including Roman Urdu tokens without English stemming. Merchant/venue/area/category search can join their rows using existing relationships; no misleading cross-table generated column or external search engine is added. Date/schedule discovery must apply event windows and Karachi-local weekday/time, not just publication status. merchant_claim_stats gives aggregate issued/redeemed/cancelled/expired/pending counts for a half-open claimed_at range; it does not expose customer contact data or claim secrets.

## Storage strategy (documented, NOT provisioned)

Future buckets: avatars, merchant-logos, venues, experiences. Use PRIVATE staging/original objects; publicly readable derivatives must be separately published only after content approval, since a public bucket URL would otherwise bypass moderation. Restrict JPEG/PNG/WebP (no SVG/HTML), validate decoded file content server-side, strip EXIF, limit avatars to 2 MiB and business images to 5 MiB, and keep bucket limits below the global Storage limit. Use random immutable object names.

Paths: avatars/<auth.uid()>/<object-id>.webp; merchant-logos/<merchant-id>/<object-id>.webp; venues/<merchant-id>/<venue-id>/<object-id>.webp; experiences/<merchant-id>/<experience-id>/<object-id>.webp. Authenticated uploads require own avatar UID or matching owner/manager membership plus actual venue/experience-to-merchant relationship. Reads of private objects require owner/member/admin or authorized signed URLs. Update/delete must apply the same ownership check; grant neither anon INSERT nor unrestricted authenticated INSERT. Bucket name and path-prefix checks alone do not prove tenant ownership. Admin publication and application image processing are deferred. Existing avatar_url/logo_url values require server URL validation/rendering rules when media UI is built.

## Seed, validation and next steps

supabase/seed.sql is deliberately separate from production migrations and supplies only 10 areas, 10 categories and 8 vibes. No fictional merchants/venues/experiences/Drops are added yet, keeping security review readable. A later clearly labelled fictional demo seed may populate the stated approximate targets with is_demo=true; never imply a real business partnership.

The local CLI configuration runs PostgreSQL 17 with `private` excluded from exposed Data API schemas. The reusable Node integration suite lives in `supabase/tests/local-verification.test.mjs`; it uses the existing Supabase SDK and Node built-ins, real local Auth JWTs, and PostgreSQL row-lock barriers. It refuses non-loopback API URLs and linked workspaces, obtains credentials only from local CLI status, never loads .env.local credentials, and verifies that file's fingerprint remains unchanged. Test users and clearly labelled fictional data remain in the disposable local database for inspection. Resetting local data removes those fixtures.

Run from the project root with Docker Desktop using Linux containers:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset --local
npm.cmd run test:db:local
npm.cmd run lint
npm.cmd run build
```

On Windows, ensure Docker's bin directory is on PATH for CLI commands. The test runner also recognizes the installed Docker Desktop path under LOCALAPPDATA/Programs/DockerDesktop/resources/bin and uses desktop-linux. Never run these tests against a hosted database; do not replace the loopback guard with .env.local credentials.

Local tests cover schema/constraints/defaults/triggers/RLS, anonymous and authenticated isolation, owner/manager/staff/admin permissions, moderation, concurrent stock and per-user claims, idempotency, repeatable-read serialization failure, concurrent scans/cancellation, expiry after lock waits, anonymous plan capabilities, and SECURITY DEFINER ownership/search_path/execution ACLs. See LOCAL_VERIFICATION.md for the actual run and limitations. Representative production query plans, operational abuse controls and retention policies still require review before launch. No Storage buckets, authentication UI, generated Database types or remote schema changes are provisioned by this verification task.

Future deployment preview only, after a separate approval to inspect/link the hosted project:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref xpiwommljqoiplgrnnwp
npx.cmd supabase db push --dry-run
```

These preview commands have NOT been run. No db push or linked reset was executed. Never supply secrets in committed files or command arguments recorded in logs.

Reference sources reviewed: https://supabase.com/docs/guides/database/postgres/row-level-security ; https://supabase.com/docs/guides/database/functions ; https://www.postgresql.org/docs/17/explicit-locking.html ; https://supabase.com/docs/guides/storage/buckets/fundamentals .
