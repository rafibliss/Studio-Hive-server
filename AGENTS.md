# AGENTS.md

## Overview

Backend API server for "studio-space". The entire server lives in `index.js` (ESM, `"type": "module"` in package.json) — Express 5 + MongoDB driver + dotenv. No TypeScript, no tests, no lint/format config, no CI.

## Commands

- Run the server: `node index.js` (no start/dev script exists; `npm test` intentionally fails with "no test specified").
- No lint, typecheck, or build step — nothing to run before committing.
- Manual verification: `curl http://localhost:8000` should return `{"msg":"server is running fine "}`.

## Gotchas

- **`.env` is required to start**: `index.js` constructs `MongoClient` from `process.env.MONGODB_URI` at module load and `.env` is gitignored. If the file is missing or you're in a fresh checkout, the Mongo connection fails (silently — errors are `console.dir`'d, not fatal; the HTTP server still starts). Never commit `.env` or paste its contents.
- **Express 5, not 4**: routing/path-to-regexp behavior differs from Express 4 (e.g., wildcard syntax `*` → `*splat`, no `app.del`). Check Express 5 docs when touching routes.
- **Port 8000 is hardcoded** in `index.js` (`const PORT = 8000`), not read from env.
- **Mongo client is module-level and fire-and-forget**: `connectToMongoDB()` is called at top level without await; routes currently don't use the client. `/add-studio` is an empty stub — routes registered before any DB logic exists.
- Only dependencies: `express@^5`, `mongodb`, `dotenv`. Keep it that way unless adding features requires more.
