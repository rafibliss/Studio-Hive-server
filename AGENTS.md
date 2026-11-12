# AGENTS.md

## Overview

Pure **data API** for "studio-space". The entire server lives in `index.js` (ESM, `"type": "module"` in package.json) — Express 5 + native MongoDB driver + dotenv + jsonwebtoken. **No authentication lives here**: all auth (email/password + Google OAuth) is handled by the Next.js frontend (`../studio-space`), which signs JWTs this backend only verifies. No TypeScript, no tests, no lint/format config.

## Commands

- Run the server: `node index.js` (no start/dev script; `npm test` intentionally fails with "no test specified").
- Seed sample studios: `npm run seed` (`seed.js`, idempotent — deletes and re-inserts only docs with `hostEmail: "alex@studiohive.com"`).
- Seed 5 gallery-demo listings: `npm run seed:samples` (`seed-samples.js`, idempotent — deletes and re-inserts only docs with `hostEmail: "samples@studiohive.com"`; one studio per genre: vocal booth, full-band tracking, electronic mastering, vintage analog, modern production lounge, each with a 3-image gallery).
- No lint, typecheck, or build step.
- Manual verification: `curl http://localhost:8000` → `{"msg":"server is running fine "}`.

## Auth (JWT verification only)

- `verifyJWT` middleware (async) reads `Authorization: Bearer <token>` and verifies with **`jose`** against the **frontend's JWKS**: `createRemoteJWKSet(new URL('/api/auth/jwks', CLIENT_URL))` — the JWKS lives on the FRONTEND origin (`http://localhost:3000/api/auth/jwks` in dev), never this server's. Better Auth's `jwt()` plugin signs tokens **asymmetrically (EdDSA / Ed25519)** — no shared secret is used anywhere in this repo (`jsonwebtoken` and the old HS256/`BETTER_AUTH_SECRET` verification were removed). `jwtVerify` options pin `issuer` and `audience` to `CLIENT_URL` (the frontend's Better Auth `baseURL`, which is the jwt plugin's default `iss`/`aud`) and `algorithms: ['EdDSA']`. Sets `req.user = { id: payload.sub || payload.id, email: payload.email }`.
- Verification failures return **401 with a `reason` field** (jose error code, e.g. `ERR_JWS_INVALID`, `ERR_JWKS_NO_MATCHING_KEY` = token signed by an unexpected key/instance, `ERR_JWT_EXPIRED`, claim-validation failures) and `console.error` the same — if the frontend's JWKS/issuer/audience config drifts, the 401 body says exactly why.
- **Protected (mutating) routes**: `POST /studios` (aliases `/add-studio`, `/api/studios`), `PUT /studios/:id`, `DELETE /studios/:id`, `POST /bookings`, `DELETE /bookings/:id`, `PATCH /bookings/:id`, `PATCH /bookings/:id/cancel`.
- **Public (read) routes**: `GET /studios`, `GET /studios/:id`, `GET /bookings` (`?email=`, `?status=`), `GET /`.
- Ownership checks (booking cancel/status/delete) match `req.user.email` against the booking's `userEmail`, case-insensitive → 403 otherwise.
- The backend does NOT mint tokens, sessions, or cookies anymore. There are **no `/api/auth/*` routes** — they 404. The frontend owns the full auth surface (sign-in/up + OAuth + the `jwt()` plugin exposing `/api/auth/token` and `/api/auth/jwks`).
- The `user`/`account`/`session` (+ jwt plugin key) collections in StudioSpace are shared with the frontend's Better Auth instance (same Mongo DB); this backend never writes to them.

## Data endpoints (JSON; CORS-credentialed from `CLIENT_URL`)

- Studios: `POST /add-studio`, `GET /studios` (`?limit`, `?category`, `?email`), `GET /studios/:id`, `PUT`/`DELETE /studios/:id` (both also under `/api/studios/:id`).
  - **Gallery**: every studio doc carries an `images` array of URL strings (the legacy single `image`/`imageUrl` field is kept). All read/write paths accept and return `images`:
    - POST and PUT validate `images` as an array of strings (malformed input → 400 `'images' must be an array of strings`); an empty array is fine.
    - POST derives `images` from `imageUrl` when `images` is omitted.
    - PUT with `images` replaces the gallery AND syncs `imageUrl` to `images[0]`; PUT with only `imageUrl` rebuilds the gallery to `[imageUrl]`. Legacy docs without `images` are normalized on read (derived from `image`/`imageUrl`) with no DB write.
  - Update/delete validate the ObjectId first: malformed id → 400/404, well-formed-but-missing → 404. PUT casts numeric fields (`hourlyRate`, `securityDeposit`, `maxCapacity`) and rejects bad types with 400; returns `{ success, message, studio }` (the doc after update).
- Bookings (collection `bookings`): `POST /bookings` (requires `studioId`, `userEmail`, `bookingDate`, `timeSlot`; defaults `status: "Pending"`, `createdAt: now`), `GET /bookings` (`?email=` maps to `userEmail`, sorted `createdAt: -1`), `DELETE /bookings/:id`. All also under `/api/bookings`.
  - **Status management**: statuses are the enum `Pending | Confirmed | Completed | Cancelled`, default `Pending` at creation. No Mongoose model — rules live in `index.js` (`BOOKING_STATUSES` / `BOOKING_TRANSITIONS`).
  - `PATCH /bookings/:id/cancel` (JWT-protected): cancels the **caller's own** booking (case-insensitive email match) and **only if `status: "Pending"`**; re-checks status in the update filter to avoid racing a concurrent confirm/completion. Idempotent on already-cancelled bookings, 403 for other users' bookings, 400 "only pending" otherwise.
  - `PATCH /bookings/:id` (JWT-protected, body `{ status }`): owner-only lifecycle move with allowed transitions `Pending→Confirmed/Cancelled`, `Confirmed→Completed/Cancelled` (terminal states accept nothing); reuse the update filter race guard.
  - `GET /bookings` always returns a badge-ready `status` (older docs without one default to `Pending` in the response, no DB write) and accepts an optional `?status=` enum filter. Conflict detection treats `Cancelled`/`Completed` as inactive (only `Pending`/`Confirmed` block a slot).

## Gotchas

- **`.env` is required to start**: `index.js` constructs `MongoClient` from `process.env.MONGODB_URI` at module load and `.env` is gitignored. If the file is missing or you're in a fresh checkout, the Mongo connection fails (silently — errors are `console.dir`'d, not fatal; the HTTP server still starts). Never commit `.env` or paste its contents. See `.env.example` for the full list: `MONGODB_URI`, `BETTER_AUTH_SECRET` (shared signing secret with the frontend), `JWT_SECRET`, `CLIENT_URL`.
- **Express 5, not 4**: routing/path-to-regexp behavior differs from Express 4 (e.g., wildcard syntax `*` → `*splat`, no `app.del`). Check Express 5 docs when touching routes.
- **Port is env-driven**: `const PORT = process.env.PORT || 8000` — Render/Vercel inject `PORT` and it takes precedence; local dev stays 8000.
- **Env-driven URLs**: `CLIENT_URL` (or legacy `FRONTEND_URL`) is the frontend origin used for CORS — never hardcode `http://localhost:3000` in business logic.
- **Mongo client is cached for serverless**: `index.js` keeps a per-instance singleton on `globalThis.__studioSpaceMongoCache` (`{ client, db, connectPromise }`) with `maxIdleTimeMS: 10000`, `serverSelectionTimeoutMS: 10000`, `maxPoolSize: 10`. A global middleware awaits `connectToMongoDB()` (the cached promise) before every route and returns **503 `Database unavailable`** if the connection failed. Never create a `MongoClient` per request — that's what causes `MongoTopologyClosedError` on Vercel.
- Only dependencies: `express@^5`, `mongodb`, `dotenv`, `jsonwebtoken`, `cors`. Keep it that way unless adding features requires more.
