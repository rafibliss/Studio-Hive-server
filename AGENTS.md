# AGENTS.md

## Overview

Backend API server for "studio-space". The entire server lives in `index.js` (ESM, `"type": "module"` in package.json) — Express 5 + MongoDB driver + dotenv. No TypeScript, no tests, no lint/format config.

## Commands

- Run the server: `node index.js` (no start/dev script; `npm test` intentionally fails with "no test specified").
- Seed sample studios: `npm run seed` (`seed.js`, idempotent — deletes and re-inserts only docs with `hostEmail: "alex@studiohive.com"`).
- No lint, typecheck, or build step.
- Manual verification: `curl http://localhost:8000` → `{"msg":"server is running fine "}`.

## Auth (Better Auth)

- `auth` instance lives in `index.js`, backed by the same Mongo client (`mongodbAdapter(db, { client })`); creates `user`/`account`/`session` collections in StudioSpace.
- **Ordering matters**: Better Auth is mounted via a middleware (`toNodeHandler(auth)`) BEFORE `express.json()` because it parses the raw body. The middleware skips Better Auth for alias paths (see `AUTH_ALIASES` set) so `/api/auth/sign-in`, `/api/auth/sign-up`, and `/api/auth/me` fall through to Express handlers that need JSON parsing. Adding a new `/api/auth/<name>` alias requires adding it to that set.
- Alias routes (validate input, delegate to `auth.api.*` with `asResponse: true`): `POST /api/auth/sign-in` + `/api/login`, `POST /api/auth/sign-up` + `/api/register`, `GET /api/auth/me` + `/api/session` (returns `{ authenticated, user, session }`). Better Auth's native routes (`/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/get-session`) also work.
- Sign-up "already exists" comes back from Better Auth as 422; the alias maps it to 400 with `message: 'Email is already registered'`.
- Env: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in `.env` (gitignored) alongside `MONGODB_URI`. CORS allows credentials from `http://localhost:3000` only.

## Gotchas

- **`.env` is required to start**: `index.js` constructs `MongoClient` from `process.env.MONGODB_URI` at module load and `.env` is gitignored. If the file is missing or you're in a fresh checkout, the Mongo connection fails (silently — errors are `console.dir`'d, not fatal; the HTTP server still starts). Never commit `.env` or paste its contents.
- **Express 5, not 4**: routing/path-to-regexp behavior differs from Express 4 (e.g., wildcard syntax `*` → `*splat`, no `app.del`). Check Express 5 docs when touching routes.
- **Port 8000 is hardcoded** in `index.js` (`const PORT = 8000`), not read from env.
- **Mongo client is module-level and fire-and-forget**: `connectToMongoDB()` is called at top level without await; routes currently don't use the client. `/add-studio` is an empty stub — routes registered before any DB logic exists.
- Only dependencies: `express@^5`, `mongodb`, `dotenv`. Keep it that way unless adding features requires more.
