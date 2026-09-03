# Kiroku Agent Instructions

Kiroku is a personal anime tracker (React 19 + TypeScript + Vite), live at **https://kiroku.pro**,
deployed on Vercel: static SPA + serverless functions in `api/`, with Supabase for auth and data.

## Commands
- `npm run dev`: Vite dev server. It also serves every `/api/*` function locally (see "Dev parity"), so `vercel dev` is not needed.
- `npm run build`: Typechecks (`tsc -b`) and builds.
- `npm run lint`: ESLint.
- `npm run test`: Vitest, single run. `npm run test:watch` to iterate.

## Tech Stack
- **Framework**: React 19 + TypeScript + Vite. Routing with `react-router-dom` v7 (routes in `src/App.tsx`).
- **Styling**: Tailwind CSS 4 via `@tailwindcss/vite`. Config in `tailwind.config.js`.
- **Animations**: GSAP with `ScrollTrigger` and `@gsap/react`.
- **Backend/DB**: Supabase (client in `src/lib/supabase.ts`) + Vercel serverless functions in `api/`.
- **Monitoring**: Sentry (`src/lib/monitoring.ts`, opt-in via `VITE_SENTRY_DSN`) + Vercel Analytics.
- **Tests**: Vitest + Testing Library on jsdom (`src/test/setup.ts`).

## External data: one authoritative source per field

Three anime APIs are in play. Mixing them for the same displayed field caused a real, user-visible
bug (two different anime each showing "#1"), so **which API owns which field is a hard rule**:

| Source | Service file | Owns |
| --- | --- | --- |
| **AniList** (GraphQL, called from the browser) | `src/services/aniListApi.ts` | **Primary** for anime details (`getAnimeFullByMalId` — info + relations + trailer + streaming in one query), search, seasonal browsing, airing calendar, recommendations, batched import summaries |
| **MyAnimeList API v2** (official, through our own proxy) | `src/services/malApi.ts` → `api/mal/*` | **Rank, popularity and score everywhere** (Home, `/top/:filter`, AnimeDetails badges) **and the whole characters section** (grid, detail panel, `/personaje/:id`) |
| **Jikan v4** (unofficial MAL) | `src/services/jikanApi.ts` | **Fallback only**: details when AniList has no mapping for a MAL id or fails, that fallback's streaming, and the cover-with-title-logo upgrade over AniList art. Cover art goes through our own proxy (`api/jikan/media.ts`); the rest is still called straight from the browser |

Also `src/services/translateApi.ts`: Google's public keyless endpoint translates synopses in the
background. Never a hard dependency — if it fails, the English text stays.

**List import** has two paths, and they are deliberately different shapes:
`src/utils/malXmlParser.ts` parses an uploaded MyAnimeList XML (which carries no covers/genres, hence
the background enrichment pass), while `src/services/aniListImport.ts` reads a public AniList list
straight from `MediaListCollection` by username — no auth, no file, no token, and the response
already carries cover, genres, studios, duration and year, so those rows land complete.

Rules when touching this area:
- Any rank / popularity / "MAL score" number comes from `malApi.ts`. Never from AniList's `rankings`
  or `averageScore`, never from Jikan. `mapAniListFull` sets `rank: null, popularity: null` on purpose.
- Do not route general image lookups through the MAL proxy. MAL's `main_picture.large` is the same CDN
  file Jikan already serves, and a long tail of arbitrary ids would wreck the cache-hit rate the
  ranking feature depends on. Images that arrive inside a ranking payload are free and already used.
- The MAL character endpoints are undocumented in MAL's public reference (verified against the live
  API). Treat any failure as "no data" rather than an error state. MAL exposes no voice actor — known gap.
- Two AniList quirks are load-bearing and verified live; both have long comments at the call site.
  `pageInfo.total` is a **sentinel**: real only when everything fits on one page, otherwise always
  exactly 5000 — never show it raw. And inside `MediaListCollection`, `studios(isMain: true)` is
  **ignored** (it returns producers and TV networks too), so that one query must use
  `studios { edges { isMain node } }` and filter in code — unlike `Media` and `Page.media`, where the
  argument works.

## Rate limiting and caching (three separate layers — don't collapse them)

1. **Single-lane queues** in `jikanApi.ts` (`MIN_GAP_MS = 380`) and `api/_lib/mal.ts` (`350`), with
   retries and a cooldown on 429. Jikan 429s hard on concurrent bursts; never bypass the queue with a
   raw `fetch`. Both Jikan paths (browser and proxy) also sit behind a **circuit breaker**: after N
   consecutive failures they stop calling out entirely for a few minutes, then let a single probe
   through before reopening. A 404 counts as success — it answers the question and says nothing about
   the API's health. Never "simplify" the breaker away: retrying through an outage is what made a
   user notice we were hammering Jikan in the first place.
2. **CDN cache headers** on every `api/mal/*` response (`s-maxage` + `stale-while-revalidate`). This,
   not the in-memory queue, is the real defense: serverless instances are ephemeral, so the queue only
   coordinates requests landing on the same warm instance.
3. **`src/utils/queryCache.ts`** — memory + localStorage cache with in-flight dedup and
   stale-while-error. **Bump `SCHEMA_VERSION` whenever the shape of anything cached with
   `persist: true` changes**, or returning users keep getting the old shape and the UI crashes.

The browser cache and the CDN cache solve different problems and both matter: localStorage saves the
request for *one* visitor, the edge saves the upstream request for *everyone*. Only the second one
protects the third-party APIs, so a new external call belongs behind a proxy with a cache header.

TTLs are set per how mutable the data actually is, not by a single default:

| Data | Where | TTL |
| --- | --- | --- |
| Cover art (`cover:*`) | localStorage + edge | 1 year / `immutable` — it never changes. **Only successes are cached**: `getCoverUrl` throws on "no cover" so a transient Jikan 504 can't blank that title for a year |
| Anime details (AniList bundle, Jikan `/full`) | localStorage + edge | 7 days |
| Character lists | **edge only** | 7 days — 10-40 KB each would eat the ~5 MB localStorage budget and slow the synchronous pre-warm at startup |
| Character detail, streaming | localStorage | 7 days / 1 day |
| Rankings, seasonal, rank/score lookups | localStorage + edge | 15-30 min — these genuinely move |

**The user's own list is cached in the database, not in the browser.** `saved_animes` holds the cover,
genres, studios and year; `backfillSavedMetadata` in `UserDataContext` fills the gaps in batches of 50
via AniList once per session, and `SavedAnimeCover` resolves anything still missing when a card
scrolls into view. Per-account, permanent, no quota ceiling. Prefer this over growing localStorage.

## Serverless functions (`api/`)

- `api/mal/{ranking,anime,characters}.ts` + `api/_lib/mal.ts` — the proxy exists because MAL sends no
  CORS headers and its Client ID must stay server-side.
- `api/jikan/media.ts` + `api/_lib/jikan.ts` — cover art. Jikan *does* send CORS headers; this proxy
  exists for volume, so one anime costs one upstream request for every visitor in the world instead of
  one per browser. Returns the URL as JSON, never the image bytes. A failure answers `{ url: null }`
  with a 60-second cache (never the 1-year one) and the caller keeps the cover it already had.
- `api/auth/login.ts` — resolves username→email behind the service-role key, then signs in through an
  anon client so the returned session is an ordinary user session. Uniform error message (no
  account-existence oracle) plus an IP rate limit.
- `api/auth/reset-password.ts` — always answers 200; `redirectTo` is built from this deployment's own
  host, never from the request body.
- `api/account/delete.ts` — resolves the caller from their own bearer token, removes their Storage
  files, then `auth.admin.deleteUser` (everything else cascades).
- `api/og.ts` — Open Graph meta tags for link previews; `vercel.json` rewrites only send known bots here.
- Files and folders under `api/` prefixed with `_` are shared libs, not routes.

**`tsc -b` does NOT typecheck `api/`** (neither tsconfig includes it). Verify changes there by hand.

## Dev parity

`vite.config.ts` loads the real handler modules through `server.ssrLoadModule` and mounts them as dev
middleware, so dev and prod run identical code. A new endpoint must be registered in `MAL_ROUTES` or
`SERVERLESS_ROUTES` there, or it 404s locally.

## Database (Supabase)

7 tables, all with RLS enabled: `profiles`, `saved_animes`, `profile_followers`, `profile_likes`,
`profile_comments`, `profile_top10`, `profile_favorite_characters`.

- **`profiles` is readable only by its owner.** Anything public goes through the `public_profiles`
  view, which excludes `email` and nulls bio/banner for private profiles. That view is intentionally
  `security_invoker = off` — **never "fix" the advisor's Security Definer View warning from the
  dashboard**; doing so empties the view for everyone and breaks public profiles.
- **`private.can_view_profile(uuid)`** is the visibility primitive: it's you, or the profile is public,
  or you follow it with `status = 'accepted'`. Every public-facing SELECT policy is built on it, and
  any new table holding user content must gate its SELECT the same way.
- Writes are always `auth.uid() = user_id`, written as `(SELECT auth.uid())`.
- Triggers enforce what the client must not decide: follow `status` (pending/accepted by the target's
  privacy), edge immutability, and rate limits (5 comments/min, 30 follows/min, 30 likes/min, and a
  hard cap of 12 favorite characters).
- **Notifications are derived, not stored** — `get_notifications()` unions the existing tables, so
  unfollowing someone makes their notifications disappear automatically. Read state is the single
  `profiles.notifications_seen_at` watermark. Don't add a notifications table.
- Storage: buckets `avatars` and `banners`, public read, writes scoped to the user's `<uid>/` folder.

Schema changes are applied live through the Supabase MCP and recorded as `supabase_*.sql` files at the
repo root. Note that `.gitignore` contains `/*.sql`: the existing files stay tracked, but a **new** one
must be force-added (`git add -f`) or it is silently left out of the repo.

## Environment variables
- Client (bundled): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_SENTRY_DSN`.
- Server-only, **never** with a `VITE_` prefix: `MAL_CLIENT_ID` (plus the unused `MAL_CLIENT_SECRET`),
  `SUPABASE_SERVICE_ROLE_KEY`, optional `SITE_URL`. Read via `process.env` inside `api/`, and copied
  into `process.env` by `vite.config.ts` for dev. They live in `.env`, which is gitignored — production
  values must be set in Vercel's project settings.

## Key directories
- `src/pages/`: route components. `src/components/`: UI grouped by feature (`animeDetails/`, `home/`, `profile/`, `notifications/`).
- `src/services/`: external API clients. `src/hooks/`, `src/contexts/` (`UserDataContext` holds the session, the saved list and the login modal).
- `src/ui/`: heavy visual components — `AnimeScrollCanvas` runs a frame-by-frame scroll animation over the WebP frames in `public/sequence/`, and is skipped entirely on mobile and under `prefers-reduced-motion` (see `src/utils/motion.ts`).
- `src/types/anime.ts` and `src/types/profile.ts`: shared types. Every source API is mapped into the `Anime`/`JikanResponse` shapes so consumer components don't care where data came from.

## Conventions
- Code and older comments are in English; user-facing strings and newer explanatory comments are in Spanish. Match the file you're editing.
- Comments explain *why*, especially where a workaround encodes verified external-API behavior. Don't delete those.
- Secondary data (characters, streaming, translations, cover upgrades) must fail silently and never block the main render.

## Verification flow
1. `npm run lint`
2. `npm run test`
3. `npm run build` (typecheck + Vite build)
