# Local fictional demo inventory

Run from the project root in PowerShell after starting local Supabase:

```powershell
npx.cmd supabase start
npm.cmd run seed:demo:local
npm.cmd run test:demo:local
```

For a clean database, first verify `npx.cmd supabase status -o json` reports the loopback API and confirm the workspace is unlinked; only then run `npx.cmd supabase db reset --local`. A reset removes all local data.

The loader reads credentials from `supabase status`, requires a loopback API URL, and refuses a linked workspace. It never reads or changes `.env.local`. It uses a disposable local platform admin and owner to create content through the existing RPC and moderation workflow. Stable `demo-khi-` slugs make reruns idempotent. All names and offers are fictional and marked `LOCAL FICTIONAL DEMO`.

For UI checks, start Next with local API credentials in the process environment, not by editing `.env.local`:

```powershell
$status = npx.cmd supabase status -o json | ConvertFrom-Json
$env:NEXT_PUBLIC_SUPABASE_URL = $status.API_URL
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $status.PUBLISHABLE_KEY
npm.cmd run dev
```

Close that PowerShell session to discard those temporary values. Confirm the URL starts with `http://127.0.0.1:` and the publishable key starts with `sb_publishable_` before starting Next. The loader does not modify hosted Supabase or production migrations.

With a local-configured Next server running, set `$env:KHI_LOCAL_UI_ORIGIN='http://localhost:3101'` and run `npm.cmd run test:ui:local`. This uses cached Playwright and Chrome to check the five public routes at 390 px and 1280 px. It does not load database credentials.

Budget and group limits are enforced by the discovery database query. Area, category, vibe and Karachi date windows are applied by application code after fetching published rows. The app lists only active Drops within their availability window, while RLS can expose scheduled and sold out Drops for other public use cases. The demo's fixed Drop window ends at the start of 2028 UTC; update the fictional fixture window after that date before using it for screenshots.
