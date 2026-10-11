# Public discovery foundation

The homepage and `/discover` read reference options (`areas`, `categories`, `vibes`) and published experiences through a server-only Supabase client with the publishable key and **anonymous** RLS context. This is deliberate: merchant or admin sessions must not make private rows appear in public discovery. The existing SSR authentication client and Proxy remain responsible for account state and protected routes.

## URL contract

The URL is the filter source of truth. The homepage keeps selections on `/` until **Explore Karachi** navigates to `/discover` with the selected parameters. On `/discover`, each selection adds a history entry, so Back and Forward restore selections and results. Reloading retains selections. Unknown parameters are left alone; invalid or duplicate known parameters are removed from the URL when the filter controls hydrate.

| Parameter | Values | Matching rule |
| --- | --- | --- |
| `when` | `tonight`, `tomorrow`, `weekend` | Asia/Karachi local time. Tonight begins at 18:00 and ends at midnight; Tomorrow is the next local day; Weekend is the current or next Saturday–Sunday. Elapsed slots are excluded. Dated intervals or matching valid weekly schedule slots are required. |
| `area` | Active `areas.slug` | Experience venue's area. |
| `budget` | `under-2000`, `2000-5000`, `5000-plus` | Published starting price in PKR; boundaries are inclusive. No selection means any price. |
| `vibe` | Active `vibes.slug` | Linked experience vibe. |
| `group` | `solo`, `couple`, `friends`, `family` | Party-size fit through `min_group_size` and `max_group_size`. Solo=1, Couple=2, Friends=4, Family=4. These are size presets, not merchant-defined group labels. |
| `category` | Active `categories.slug` | Experience category. |

The default for every filter is **Any**. Invalid selections behave like Any. The controls also normalize invalid known URL values. Selection changes preserve every other URL parameter; the search CTA sends only valid discovery filters to `/discover`.

## Data and current limits

- Published experiences are read under anonymous RLS; the server also checks `status='published'`. Reference options are active only. Dated and weekly schedules are evaluated in Karachi time. Public results do not include unpublished merchant data.
- Active PASS Drops are displayed only within their start/end window. Claiming and redemption are outside this phase.
- Storage buckets and public derivatives are not provisioned. Cards reserve a 16:10 image area and display a fallback; stored `image_paths` are not converted into public URLs.
- Trending rankings and geolocation are not present in the schema/product yet. Their homepage sections explain that limitation rather than inventing results. New experiences are those created in the last 30 days; the schema has no separate `published_at` timestamp.
- Discover reads published rows in batches and filters their public relationships server-side. This foundation has no database-side search RPC or paginated result protocol yet; high-volume catalogs should add one before large-scale traffic.
