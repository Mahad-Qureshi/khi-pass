# KHI PASS authentication foundation

## Implementation

Routes: /auth/login, /auth/sign-up, /auth/check-email, /auth/callback and /profile.

Email/password authentication uses validated Next.js Server Actions with the existing typed Supabase server client. React Hook Form and Zod validate the browser form; the same schemas validate untrusted action input. Supabase handles password verification. The current hosted password minimum is six characters with no required character classes; signup follows that policy and recommends a long unique password. Existing accounts are not subjected to the signup minimum when logging in.

Google initiation uses the existing cookie-based browser client with PKCE, a same-origin callback URL, and a public provider-settings preflight. Disabled/unavailable providers produce a generic UI error. No Google login success was assumed. The server callback exchanges the code with exchangeCodeForSession, verifies getUser, initializes safe display data, preserves session cookies/cache headers and redirects to a validated internal destination. Missing/invalid codes return a fixed public error. No app logging of provider details, codes or tokens was added.

Next.js 16.4.0 Cache Components require request-dependent auth pages to render behind Suspense. Login/signup/check-email and profile use that pattern without caching identity or profile data. The callback also corrects NextURL's normalization of loopback IPs to localhost: only a loopback request hostname on the same port may replace the framework hostname. This preserves local cookie scope and was verified with a real PKCE exchange.

The existing private.bootstrap_profile trigger creates exactly one empty profile when auth.users is inserted. No profile insert/upsert was added. Signup sends only display_name user metadata. After a verified session, initialization validates display_name (or Google's full_name), updates only that user's existing profile and only when display_name is null. Metadata never grants roles or admin authority. Confirmation-required signup stores display_name until verified login/callback; signup returning a session initializes it immediately.

Profile is server-protected using the existing requireAuthenticatedUser helper, which calls the Auth server's getUser. Anonymous users redirect to /auth/login?next=%2Fprofile. Only safe profile fields and the verified user's email are displayed. Avatar URLs must be HTTPS with no embedded credentials. There is no profile editing or merchant/admin UI.

Logout calls signOut({ scope: 'local' }) through a Server Action, revalidates auth-dependent UI and redirects to login. It does not globally sign out other sessions. Successful password auth also revalidates and performs a full browser navigation, avoiding stale prefetched auth payloads.

## Security review

- Redirects default to /profile and accept only internal paths. Protocol-relative/external URLs, backslashes, control characters, encoded separator attacks and auth-loop destinations are rejected.
- Next.js Server Action POST/Origin protections remain enabled. Signup callback origin is checked against the action's Host/X-Forwarded-Host and accepts HTTPS or loopback HTTP only.
- Authorization is server-side; no cookie-embedded user or client state is trusted for profile access.
- Profile queries use the existing publishable-key client and RLS. No service-role credential is in application/browser code. The local test runner obtains a LOCAL service key solely for local fixture cleanup.
- No custom localStorage session storage, auth logging, untrusted role metadata, raw provider errors, or shared auth caches were added. Existing session-refresh Proxy and cookie/cache-header behavior remain intact.
- Callback URLs contain only Supabase's necessary one-time PKCE code, not access/refresh tokens; the callback immediately redirects to a clean URL and sends Referrer-Policy: no-referrer.
- No remote Auth settings, migrations, .env.local or existing Supabase clients/proxy/helpers were modified.

## Actual configuration inspected

Hosted project xpiwommljqoiplgrnnwp:
- Email signup enabled; signup not disabled.
- Email confirmation required.
- Password minimum 6, no required character classes.
- Google disabled; CAPTCHA disabled.
- Site URL http://localhost:3000.
- Additional redirect allowlist empty.

These settings were read, not changed. The deployed app still needs the URL/provider configuration below. Supabase throttling remains authoritative; configure production SMTP, rate limits and abuse/CAPTCHA controls as appropriate before public traffic. No CAPTCHA was enabled without credentials.

## Required Supabase/Google configuration

1. In Supabase Dashboard, Authentication > URL Configuration:
   - Set Site URL to the actual production HTTPS application origin once deployed.
   - Add the callback allowlist for each origin used:
     - http://localhost:3000/auth/callback**
     - http://127.0.0.1:3000/auth/callback** (only if local development uses this host)
     - https://YOUR-PRODUCTION-DOMAIN/auth/callback**
   - The trailing glob supports the validated next query parameter. Keep production entries restricted to your exact application host and callback path; do not allow arbitrary production domains.
   - Keep the default email ConfirmationURL template (or a compatible PKCE template). Open confirmation links in the same browser used for signup so the verifier cookie is available. No token_hash/verifyOtp route is implemented here.

2. In Google Cloud Console:
   - Configure OAuth consent/branding, audience and test users while in testing.
   - Create a Web application OAuth client.
   - Authorized JavaScript origins: http://localhost:3000 and the actual production HTTPS origin (plus http://127.0.0.1:3000 if used).
   - Authorized redirect URI must be exactly:
     https://xpiwommljqoiplgrnnwp.supabase.co/auth/v1/callback

3. In Supabase Dashboard, Authentication > Providers > Google:
   - Enable Google and enter the Google client ID and client secret in the Dashboard.
   - Do not put the client secret in source, public env variables or chat.
   - Supabase's Google callback above is different from the application callback: Google returns to Supabase, then Supabase returns to the allowed application /auth/callback URL.

The actual production domain was not supplied, so no production URL was invented. Hosted Google and actual hosted signup email delivery were not exercised.

## Verification

Commands:
~~~powershell
npm.cmd run test:auth
npm.cmd run lint
npm.cmd run build
~~~

Results: four focused Node test groups passed; final lint passed with no warnings; final Next.js production build and strict TypeScript passed.

Real Chrome browser flows against LOCAL Supabase passed:
- Anonymous profile redirects to login.
- Accessible inline form validation.
- Disabled Google provider returns a safe error.
- Actual UI signup returning a session, cookie persistence, profile bootstrap and display-name initialization.
- Authenticated login page redirects.
- Own profile read and another user's profile RLS isolation.
- Current-session logout clears auth cookies and prevents profile access.
- Actual password login.
- Malicious next parameter falls back internally.
- Missing/invalid PKCE codes fail safely.
- A real local Mailpit email link performs a successful PKCE code exchange, saves session cookies and renders the verified profile.

The successful email-link test uses a local recovery email solely to exercise the real PKCE transport/callback; it does not add password-recovery UI or claim that hosted signup email confirmation was tested. Local signup has confirmation disabled, so the no-session signup branch is implemented and reviewed but hosted email delivery is a remaining manual check.

Disposable LOCAL test users/profiles were deleted. No hosted test users or application data were created. .env.local and all eight migration fingerprints remain unchanged.

Re-run Windows local browser checks with Docker/local Supabase running and port 3000 free:
~~~powershell
npx.cmd --yes --package=playwright -- playwright --version
npm.cmd run test:auth:local
~~~
The runner uses installed Chrome and a temporary npm-cache Playwright package; no browser testing dependency was added to the project. It launches the app with local credentials, never .env.local hosted credentials, and refuses non-loopback Auth URLs. Node native TypeScript tests require a recent Node release (verified on Node 24.21.0). The focused tests may print Node's harmless module-type-detection warning; package-wide module semantics were preserved.

## Files

Created:
- src/app/auth/login/page.tsx
- src/app/auth/sign-up/page.tsx
- src/app/auth/check-email/page.tsx
- src/app/auth/callback/route.ts
- src/app/profile/page.tsx
- src/features/auth/actions.ts
- src/features/auth/redirect.ts
- src/features/auth/profile.ts
- src/features/auth/schemas/auth.ts
- src/features/auth/components/AuthShell.tsx
- src/features/auth/components/AuthForm.tsx
- src/features/auth/components/LogoutButton.tsx
- src/features/auth/components/ProfileCard.tsx
- src/features/auth/tests/auth.test.mjs
- src/features/auth/tests/local-auth-flow.mjs
- src/features/auth/README.md

Modified: package.json (test:auth and test:auth:local scripts only).
No merchant/admin authorization UI or discovery UI was added.

Official guidance reviewed:
- https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://supabase.com/docs/guides/auth/social-login/auth-google
- Installed Next.js docs for Server Actions, cookies, authentication with Cache Components, and redirect.

