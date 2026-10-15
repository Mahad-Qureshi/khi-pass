# PASS claim and redemption

The public Drop detail reads public availability as advisory information. The Claim PASS button sends a stable request UUID to the server action. The server verifies the Supabase user, validates both UUIDs, and calls the existing atomic `claim_drop` RPC. Inventory, claim limits, and the final expiration time are decided inside that RPC. A successful action returns only the claim ID to the browser.

`/passes` and `/passes/[id]` require a verified Supabase session. Migration `20261015000100_pass_reads.sql` adds `get_my_pass_details` and `list_my_passes` because the existing `drop_claims` SELECT policy also permits merchant members to read claims. Both new RPCs restrict customer PASS reads to `auth.uid()`; only an unexpired pending PASS includes its redemption code. The list is paginated at 20 items per page. The QR image is generated on the application server from the redemption code alone, without contacting a QR service.

`/merchant/redeem` requires a membership row. The server action verifies the signed-in user and rechecks membership before calling the existing `redeem_drop_code` RPC. The RPC decides the claim's merchant, locks the relevant rows, checks expiry and membership again, and performs the single atomic state transition. The UI gives the same failure message for invalid, expired, already redeemed, and other-merchant codes.

## Local PowerShell verification

Confirm `supabase/.temp/project-ref` is absent and `npx.cmd supabase status -o json` reports a loopback API before applying migrations. Do not use `--linked` or a hosted database URL.

```powershell
npx.cmd supabase migration up --local
npm.cmd run seed:demo:local
npm.cmd run test:passes:local
npm.cmd run test:db:local
```

For browser testing, compile and start the app with local process variables. `.env.local` remains untouched:

```powershell
$status = npx.cmd supabase status -o json | ConvertFrom-Json
if ($status.API_URL -ne 'http://127.0.0.1:54321' -or $status.PUBLISHABLE_KEY -notmatch '^sb_publishable_') { throw 'Local Supabase required' }
$env:NEXT_PUBLIC_SUPABASE_URL = $status.API_URL
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $status.PUBLISHABLE_KEY
npm.cmd run build
npm.cmd run start -- -p 3101
```

In a second PowerShell session, set `$env:KHI_LOCAL_UI_ORIGIN='http://localhost:3101'` and run `npm.cmd run test:passes:browser`. The browser runner creates disposable local Auth users, verifies claim and redemption, and deletes those users afterward. The claimed ledger rows remain as local test history. It does not print pass codes or credentials.

Limits: a PASS still needs an online connection for the owner-only page and merchant scan. The merchant form accepts code entry; camera scanning and offline redemption are not included. The customer list supports up to 10,020 claims through the current offset range; very large histories would need cursor pagination. Abuse throttling for repeated invalid code attempts remains an operational concern, although codes have 128 random bits.
