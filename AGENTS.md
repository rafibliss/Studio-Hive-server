# AGENTS.md

## Overview

Backend API server for "studio-space". The entire server lives in `index.js` (ESM, `"type": "module"` in package.json) — Express 5 + MongoDB driver + dotenv. No TypeScript, no tests, no lint/format config.

## Commands

- Run the server: `node index.js` (no start/dev script; `npm test` intentionally fails with "no test specified").
- Seed sample studios: `npm run seed` (`seed.js`, idempotent — deletes and re-inserts only docs with `hostEmail: "alex@studiohive.com"`).
- Seed 5 gallery-demo listings: `npm run seed:samples` (`seed-samples.js`, idempotent — deletes and re-inserts only docs with `hostEmail: "samples@studiohive.com"`; one studio per genre: vocal booth, full-band tracking, electronic mastering, vintage analog, modern production lounge, each with a 3-image gallery).
- No lint, typecheck, or build step.
- Manual verification: `curl http://localhost:8000` → `{"msg":"server is running fine "}`.

## Data endpoints (all JSON + CORS-credentialed from localhost:3000)

- **JWT-protected mutations** (simple `jsonwebtoken` + `cookie-parser` layer, independent of Better Auth sessions): `verifyToken` middleware reads the HTTPOnly `token` cookie, verifies it against `JWT_SECRET` (`.env`), 401s when missing/invalid, else sets `req.user = { id, email }`. Applied to: `POST /studios` (aliases `/add-studio`, `/api/studios`), `DELETE /studios/:id`, `POST /bookings`. The `token` cookie (7-day expiry, `Path=/`, `secure: false` for local HTTP) is issued by `sendTokenCookie()` on register/login — Google social login does NOT set it.
- **JWT issuance covers BOTH route layers**: the frontend authClient calls Better Auth's native paths, so `/api/auth/sign-in/email` and `/api/auth/sign-up/email` are registered on the same Express handlers as the aliases AND listed in `AUTH_ALIASES` (so nuAuth skips them). Adding another frontend login path that must issue a JWT → route it through these handlers, not nuAuth.
- **The frontend (`../studio-space`) authClient must point HERE** (`NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8000` in its `.env`). Two traps caused "Invalid origin" + missing-JWT bugs: (1) the frontend has its own Better Auth instance (`src/lib/auth.ts` + `/api/auth/[...all]` route) — if requests land there, better-auth infers baseURL from its `BETTER_AUTH_URL` env (:8000) while requests come from :3000 → "Invalid origin"; it now has `trustedOrigins: ['http://localhost:3000']` as a fallback guard. (2) `process.env.BETTER_AUTH_URL` is undefined in Next.js client bundles (only `NEXT_PUBLIC_*` is inlined), so the browser authClient silently fell back to same-origin (:3000) and bypassed this backend. The authClient (`auth-client.ts`) must resolve to :8000 in the browser.
- Studios: `POST /add-studio`, `GET /studios` (`?limit`, `?category`, `?email`), `GET /studios/:id`, `PUT`/`DELETE /studios/:id` (both also under `/api/studios/:id`).
  - **Gallery**: every studio doc carries an `images` array of URL strings (the legacy single `image`/`imageUrl` field is kept). All read/write paths accept and return `images`:
    - POST and PUT validate `images` as an array of strings (malformed input → 400 `'images' must be an array of strings`); an empty array is fine.
    - POST derives `images` from `imageUrl` when `images` is omitted.
    - PUT with `images` replaces the gallery AND syncs `imageUrl` to `images[0]`; PUT with only `imageUrl` rebuilds the gallery to `[imageUrl]`. Legacy docs without `images` are normalized on read (derived from `image`/`imageUrl`) with no DB write.
  - Update/delete validate the ObjectId first: malformed id → 400/404, well-formed-but-missing → 404. PUT casts numeric fields (`hourlyRate`, `securityDeposit`, `maxCapacity`) and rejects bad types with 400; returns `{ success, message, studio }` (the doc after update).
- Bookings (collection `bookings`): `POST /bookings` (requires `studioId`, `userEmail`, `bookingDate`, `timeSlot`; defaults `status: "Pending"`, `createdAt: now`), `GET /bookings` (`?email=` maps to `userEmail`, sorted `createdAt: -1`), `DELETE /bookings/:id`. All also under `/api/bookings`.

## Auth (Better Auth)

- `auth` instance lives in `index.js`, backed by the same Mongo client (`mongodbAdapter(db, { client })`); creates `user`/`account`/`session` collections in StudioSpace.
- **Ordering matters**: Better Auth is mounted via a middleware (`toNodeHandler(auth)`) BEFORE `express.json()` because it parses the raw body. The middleware skips Better Auth for alias paths (see `AUTH_ALIASES` set) so `/api/auth/sign-in`, `/api/auth/sign-up`, and `/api/auth/me` fall through to Express handlers that need JSON parsing. Adding a new `/api/auth/<name>` alias requires adding it to that set.
- Alias routes (validate input, delegate to `auth.api.*` with `asResponse: true`): `POST /api/auth/sign-in` + `/api/login`, `POST /api/auth/sign-up` + `/api/register`, `GET /api/auth/me` + `/api/session` (returns `{ authenticated, user, session }`). Better Auth's native routes (`/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/get-session`) also work.
- Sign-up "already exists" comes back from Better Auth as 422; the alias maps it to 400 with `message: 'Email is already registered'`.
- Env: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in `.env` (gitignored) alongside `MONGODB_URI`. CORS allows credentials from `http://localhost:3000` only.
- **Google OAuth** is configured via `socialProviders.google` (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`). Frontend starts the flow with `POST /api/auth/sign-in/social` `{ provider: 'google', callbackURL }` — the callbackURL must be an ABSOLUTE frontend URL (`http://localhost:3000/`); a relative "/" resolves against this backend's origin and lands the user on `:8000`. The callback is handled by the Express route `GET /api/auth/callback/google` (in `AUTH_ALIASES`, which calls `auth.api.callbackOAuth` directly): **`params: { id: 'google' }` is REQUIRED** — the endpoint's path is `/callback/:id` and a direct `auth.api.*` call does not infer path params; without `params` it crashes with `TypeError: ... reading 'id'` before the code exchange. It forwards Better Auth's session cookie, issues the JWT cookie via `sendTokenCookie` for social users, and redirects per Better Auth's Location — rewriting Better Auth's internal `/api/auth/error?...` redirects to the frontend login page, and surfacing thrown errors as `&error=<reason>` query params (e.g. `invalid_code` = the exchange was rejected; `state_not_found` = initiation/retry mismatch). The redirect URI must be registered as an Authorized redirect URI in Google Cloud Console. `FRONTEND_URL` env (default `http://localhost:3000`) is the fallback target.

## Gotchas

- **`.env` is required to start**: `index.js` constructs `MongoClient` from `process.env.MONGODB_URI` at module load and `.env` is gitignored. If the file is missing or you're in a fresh checkout, the Mongo connection fails (silently — errors are `console.dir`'d, not fatal; the HTTP server still starts). Never commit `.env` or paste its contents.
- **Express 5, not 4**: routing/path-to-regexp behavior differs from Express 4 (e.g., wildcard syntax `*` → `*splat`, no `app.del`). Check Express 5 docs when touching routes.
- **Port 8000 is hardcoded** in `index.js` (`const PORT = 8000`), not read from env.
- **Mongo client is module-level and fire-and-forget**: `connectToMongoDB()` is called at top level without await; routes currently don't use the client. `/add-studio` is an empty stub — routes registered before any DB logic exists.
- Only dependencies: `express@^5`, `mongodb`, `dotenv`. Keep it that way unless adding features requires more.
