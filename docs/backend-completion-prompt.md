# StudioMind — Remaining Backend Work

Paste everything below the line into a fresh agent session opened **in the StudioMind repo root**.
State captured 7 Sept 2026, ~16:15 IST.

---

You are finishing the backend of **StudioMind**, a submission for the Google Cloud
Agentic Cinema Hackathon (Parallel partner track) on Devpost.

**Hard deadline: 9 Sept 2026, 2:00 PM PT (10 Sept, 2:30 AM IST).** Judging happens weeks
later, so whatever you deploy must still be alive and working in October.

Read `CODE.md` first — it explains every file in plain language, and section 7 is the API
contract the frontend is built against.

## Where things actually stand

**Committed** (`eaca005 "completing backend"`): the whole pipeline, Vertex AI transport
(`USE_VERTEX=true` → ADC-authenticated Vertex client, same `generate()` interface, public
API-key path kept as fallback), conditional env validation, and the raised
`PIPELINE_TIMEOUT_MS` default (300s) are all committed. No run has been proven end to end
on either transport yet — the last logged attempt (`server/.acceptance.log`, 08:00, 7 Sept)
died on the screenplay step, and the note in `env.js` says why: the free-tier default
`gemini-3.6-flash` was quota-exhausted and `gemini-flash-latest` 503s on schema-constrained
JSON. `.env` currently pins `GEMINI_MODEL=gemini-3.5-flash`, untested.

**Uncommitted in the working tree right now — and it is broken. Fix this before anything else.**

Someone started wiring retry/backoff into the production path and left it half-done:

- `server/src/config/errors.js` (new, untracked) exports `{ isTransient, extractRetryDelay,
  withRetry }` — but **`withRetry` is never defined in that file.** Just requiring it throws
  `ReferenceError: withRetry is not defined` at the `module.exports` line.
- `server/src/services/gemini/textGeneration.js` was rewritten with its own local, working
  `withRetry` implementation (exponential backoff, honours the API's own `retryDelay`,
  respects `AbortSignal`, only retries on `isTransient(err)`) — this part is actually good.
  But because it requires `./config/errors.js`, loading *this* file also throws immediately.
- `server/src/services/parallel/verifyClaim.js` was rewritten to *call* `withRetry(...)`
  around the Parallel search call, but only imports `{ isTransient, extractRetryDelay }`
  from `errors.js` — never `withRetry` itself. A second `ReferenceError` waiting behind the
  first.
- Net effect: **the server does not boot.** `node src/server.js` crashes on require before
  Express even starts. Verified directly — this is not a maybe.
- `package.json` / `package-lock.json` also picked up `helmet` and `express-rate-limit` as
  dependencies (installed in `node_modules`) but neither is wired into `app.js` yet — Phase 3
  hasn't actually started despite the deps being present. `p-retry` and `retry` are also in
  `node_modules` but unused by any source file — probably an abandoned approach; fine to
  remove from `package.json` if they're not imported anywhere once you're done.
- `CODE.md` has one stray blank-line-only diff — harmless, ignore or keep.

Not started at all: Phase 3 wiring (helmet/rate-limit actually mounted), Dockerfile, Cloud
Run deployment, Atlas network access from Cloud Run, README/CODE.md §8 update. The frontend
(`client/src`) is still the Vite starter — not your job.

Housekeeping: a stale `.git/index.lock` may exist from an earlier interrupted git command.
`rm -f .git/index.lock` before your first commit if `git status` complains.

## Non-negotiable rules

1. **Never rename or change a field in the `GET /runs/:id` response** (CODE.md §7).
   Ajay's screen is built against those exact names. Additive fields are fine.
2. **Edit in place.** Never retype a file from terminal output — output truncates and you
   silently lose the bottom of the file.
3. **Never commit `server/.env`**, never print key values. Confirm `.gitignore` covers it.
4. Keep the folder layout and the one-file-one-job convention.
5. Commit each phase separately with a real message. Don't push to `main` without saying so.
6. Don't loosen a schema or delete a validation to make an error disappear. Fix the cause.
7. Before you report anything as "done," run it. A file that compiles or `git diff`s cleanly
   is not evidence it works — this exact prompt exists because the last attempt skipped that.

---

## Phase 0 — Fix the crash (do this first, it blocks literally everything)

1. Open `server/src/config/errors.js`. It already has `isTransient` and `extractRetryDelay`
   correctly implemented — good code, just missing the third function. Move the working
   `withRetry` implementation out of `server/src/services/gemini/textGeneration.js` (it's
   already correct there: `MAX_ATTEMPTS = 4`, `BASE_DELAY_MS = 5000`, checks `signal.aborted`
   before and after each attempt, calls `isTransient(err)` to decide whether to retry, uses
   `extractRetryDelay(err)` when present else exponential backoff) into `errors.js`, and
   export it from there instead.
2. Update `textGeneration.js` to import `withRetry` from `../../config/errors` alongside
   `isTransient`/`extractRetryDelay`, and delete its now-duplicate local copy.
3. Update `verifyClaim.js` to import `withRetry` from `../../config/errors` too (it already
   calls `withRetry(...)` — it's just missing the import).
4. Sanity check both files load without crashing:
   `cd server && node -e "require('./src/services/gemini/textGeneration.js'); require('./src/services/parallel/verifyClaim.js'); console.log('OK')"`
5. Start the server and confirm it comes up clean: `node src/server.js` should print
   `MongoDB Connected: ...` and `StudioMind server running on port ...`, not a stack trace.
   `curl localhost:3000/api/health` should return `{"ok":true}`.
6. Commit this fix on its own before moving on — do not bundle it with Phase 1 or 2 work.

**Acceptance:** server boots clean, health check responds, both retry-wrapped modules load
without error.

## Phase 1 — Prove one run finishes end to end (this is the real gate)

Nothing after this matters until a run reaches `complete`. This is where the project has
been stuck since 4 Sept.

1. `cd server && node runSchemaAcceptance.js 1` — one brief first, fast feedback loop. If it
   fails, read the actual thrown error (not just the harness's "transient API/network error"
   summary line) before guessing at a fix.
2. If the public Gemini API key is still quota-blocked, switch to Vertex: confirm the GCP
   project has billing enabled, enable `aiplatform.googleapis.com`, run
   `gcloud auth application-default login` locally, set `USE_VERTEX=true`, `GCP_PROJECT_ID`,
   `GCP_LOCATION` in `server/.env`, and set `GEMINI_MODEL` to a model ID valid for that
   project/region on Vertex.
3. If Vertex blocks on billing/quota/org policy and you can't clear it within ~30 minutes:
   stay on the public API key, keep `GEMINI_MODEL=gemini-3.5-flash` (or whatever model your
   key can actually call — verify with a direct one-off call if unsure), and say so in your
   report. A working public URL on the API-key path beats a broken Vertex integration. Leave
   the Vertex code path in either way.
4. Once brief 1 passes, run the full sweep:
   `node runSchemaAcceptance.js all 2>&1 | tee .acceptance.log`.
5. Then prove it over real HTTP: `npm run dev`, `POST /api/pipeline/runs` with a brief, poll
   `GET /api/pipeline/runs/:id` every 2s. Confirm `agentStatus` moves
   `screenplay → continuity → storyboard` and `status` ends `complete`, with populated
   `sceneText`, `continuityClaims` (each with at least one real Parallel source URL),
   `continuitySummary`, `continuityOverallRisk`, and 4-8 `shots`.
6. Commit.

**Acceptance:** 5/5 briefs pass the harness, and one real HTTP run reaches `complete` with
genuine source URLs. Report: which transport ended up working, briefs passed, schema
violations, `[normalise] substitution` count, and wall-clock time for one full run. If a run
takes more than ~4 minutes, raise `PIPELINE_TIMEOUT_MS` — Cloud Run's `--timeout` in Phase 4
must exceed whatever this number is.

## Phase 2 — Confirm the retry logic actually helps (quick, do right after Phase 1)

Now that Phase 0's fix is in and Phase 1 has a real run to compare against:

- Deliberately trigger a transient failure if you can (e.g. temporarily lower
  `advanced_settings.max_results` isn't it — instead, watch the logs during the Phase 1 run
  for any `[retry:...]` lines; if you see one, confirm the run still completed).
- Confirm the per-claim `verification_failed` fallback in `continuity/index.js` still catches
  a hard failure from `verifyClaim` without killing the whole run.
- No code changes expected here unless the Phase 1 run surfaces a new failure mode — this
  phase is verification, not construction.

**Acceptance:** confirmed either "no retries needed, happy path" or "N retries fired and the
run still completed" — either is fine, silence is not.

## Phase 3 — Endpoint protection

The API is wide open right now; anyone with the URL can burn the Gemini and Parallel quota,
and that quota has to survive until October judging. `helmet` and `express-rate-limit` are
already in `package.json` — they just need to be used.

- Mount `helmet()` in `app.js`.
- `express-rate-limit` on `/api/pipeline` — tight on POST (about 5 runs per IP per 15 min),
  generous on GET so the frontend can poll freely.
- `express.json({ limit: '32kb' })` and cap `brief` at ~2,000 chars with a 400.
- Replace bare `cors()` with an allowlist from `CORS_ORIGIN` (comma-separated), defaulting
  to the deployed frontend origin plus `http://localhost:5173`.
- Preferred: a shared-secret header on POST only (`x-studiomind-key` vs `APP_SHARED_SECRET`),
  skipped entirely when the env var is unset so local dev is unaffected. Tell Ajay before
  enabling it — it changes his fetch call.
- Leave `/api/health` open and unthrottled; Cloud Run needs it.
- While you're in `package.json`: if `p-retry` and `retry` end up unused (nothing in `src/`
  imports them), remove them — dead deps from an earlier attempt.

**Acceptance:** health open; a 6th rapid POST returns 429; an oversized body returns 400; a
disallowed origin is refused; the normal frontend flow still works.

## Phase 4 — Dockerfile and Cloud Run

**Read this first: the pipeline is fire-and-forget background work that continues after the
HTTP response returns. Cloud Run throttles CPU to zero after a response unless CPU is always
allocated — deploy with `--no-cpu-throttling` or every run will sit at `screenplay` forever.**

- `server/Dockerfile`: `node:20-slim`, non-root user, `npm ci --omit=dev`, copy `src/`,
  `CMD ["node", "src/server.js"]`. Add `.dockerignore` (node_modules, .env, logs).
- Server must bind `process.env.PORT` — Cloud Run injects it. Verify nothing hardcodes 3000.
- Deploy: `gcloud run deploy studiomind-api --source server --region <region>
  --allow-unauthenticated --no-cpu-throttling --timeout 300 --min-instances 1`, with
  `MONGO_URI` / `PARALLEL_API_KEY` (and `APP_SHARED_SECRET`) injected via `--set-secrets`
  from Secret Manager — **never** `--set-env-vars`.
- If Vertex is on, `GEMINI_API_KEY` is not needed in the image at all; the Cloud Run service
  account provides ADC. Grant it the Vertex AI User role.
- `--min-instances 1` keeps it warm for judging. Confirm the monthly cost before setting it
  and state the number in your report.
- **MongoDB Atlas:** Cloud Run egress IPs are dynamic. Either allow `0.0.0.0/0` on the
  cluster (fine for a hackathon with a strong password) or add a VPC connector with a static
  NAT IP. Pick one and do it. A DB failure and a model failure look identical from the
  outside — check this first if deployed behaves differently from local.
- Confirm the Atlas cluster does not auto-pause. A paused cluster in October is a dead demo.

**Acceptance:** against the public URL — `/api/health` returns `{ok:true}`, a POSTed brief
runs to `complete`, `GET /runs` lists it. Paste the URL in your report.

## Phase 5 — Close it out

- `README.md`: deployed URL, the Vertex/API-key toggle, new env vars, a real curl example
  against production, and the model actually in use.
- Rewrite `CODE.md` §8 ("Where we actually are") so every row matches reality.
- A short paragraph Ajay can paste: base URL, whether the shared-secret header is required,
  the CORS origin he must be served from, and confirmation that the §7 contract is unchanged.
- Leave the tree clean.

## How to report

After each phase: files changed, commands run, actual output, what is still broken, what you
need from a human. Never call a phase done because the code compiles or `git diff` looks
right — the crash this prompt opens with is exactly that mistake. Every phase above has an
acceptance check that involves running something for real.

If any single item blocks you for more than ~20 minutes, stop and report the exact error.
Priority if time runs short: **Phase 0, then 1, then 4, then 3.** A deployed URL that works
beats every other improvement on this list.
