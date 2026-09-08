# StudioMind — Final Backend Push

Paste everything below the line into a fresh agent session opened **in the StudioMind repo
root**, on a machine with real internet access (this has to reach generativelanguage.
googleapis.com / Vertex, api.parallel.ai, and your MongoDB Atlas cluster — a sandboxed shell
with no external network route cannot do this step, which is exactly what stalled it before).

State captured 8 Sept 2026, ~11:45 IST.

---

You are finishing the backend of **StudioMind**, a submission for the Google Cloud
Agentic Cinema Hackathon (Parallel partner track) on Devpost.

**Hard deadline: 9 Sept 2026, 2:00 PM PT (10 Sept, 2:30 AM IST).** Judging happens weeks
later, so whatever you deploy must still be alive and working in October.

Read `CODE.md` first — it explains every file in plain language, and section 7 is the API
contract the frontend is built against. Section 8 ("Where we actually are") is current as
of this commit and is the most reliable status source in the repo.

## Where things actually stand

All the code is written and committed (`822e501 "Wire endpoint protection, add Dockerfile,
update docs"`, plus everything before it): the full agent pipeline, the crash fix, Vertex AI
transport, retry/backoff on both Gemini and Parallel calls, `responseSchema` constraints,
endpoint protection (helmet, CORS allowlist, rate limits, body/brief caps, optional
shared-secret gate), a `Dockerfile` + `.dockerignore`, and up-to-date README/CODE.md.

**The one thing that has never happened, in the entire life of this project: a pipeline run
completing end to end with real Gemini and Parallel calls.** `server/.acceptance.log` is
still the same 4-line failure from 7 Sept — dies on the screenplay step through retry 3/4.
Nothing has proven this code actually works against live APIs. This is not a code problem to
guess at; it needs to be run, for real, with real network access, and the actual error read.

**Housekeeping first:** a later commit (`3f646ee "backend done"`) accidentally checked in
scratch/junk files that should not be in the repo: `_to_delete/` (several empty stub files),
`server/_phase3_selftest.js` (a throwaway offline test script), and possibly
`docs/backend-completion-prompt.md` itself (this file — fine to keep or remove, your call).
Clean these up as your first commit:

```bash
git rm -r _to_delete server/_phase3_selftest.js
git commit -m "Remove scratch files accidentally committed"
```

Not started at all: an actual Docker build (the `Dockerfile` has never been built — no
Docker was available where it was authored), Cloud Run deployment, and Atlas network access
configuration for Cloud Run's dynamic egress IPs. The frontend (`client/src`) is still the
Vite starter — not your job.

## Non-negotiable rules

1. **Never rename or change a field in the `GET /runs/:id` response** (CODE.md §7).
   Ajay's screen is built against those exact names. Additive fields are fine.
2. **Edit in place.** Never retype a file from terminal output — output truncates and you
   silently lose the bottom of the file.
3. **Never commit `server/.env`**, never print key values. Confirm `.gitignore` covers it.
4. Keep the folder layout and the one-file-one-job convention.
5. Commit each phase separately with a real message. Don't push to `main` without saying so.
6. Don't loosen a schema or delete a validation to make an error disappear. Fix the cause.
7. Before you report anything as "done," run it. Every phase below has an acceptance check
   that means actually executing something — not just reading code or `git diff`.

---

## Phase 1 — Prove one run finishes end to end (the real gate, do this first)

Nothing else matters until this happens once.

1. `cd server && node runSchemaAcceptance.js 1` — one brief, fast feedback. If it fails,
   capture and read the **actual thrown error**, not just the harness's "transient
   API/network error" summary line — that line hides what's really wrong.
2. If it's a genuine Gemini quota wall on the public API key: switch to Vertex. Confirm the
   GCP project has billing enabled, enable `aiplatform.googleapis.com`, run
   `gcloud auth application-default login` locally, set `USE_VERTEX=true`, `GCP_PROJECT_ID`,
   `GCP_LOCATION` in `server/.env`, and set `GEMINI_MODEL` to a model ID valid for that
   project/region on Vertex. The Vertex code path is already written in `config/gemini.js` —
   this is configuration, not new code.
3. If Vertex blocks on billing/quota/org policy and you can't clear it within ~30 minutes:
   stay on the public API key with `GEMINI_MODEL=gemini-3.5-flash` (or whatever model your
   key can actually call), and say so in your report. A working public URL on the API-key
   path beats a broken Vertex integration. Leave the Vertex code path in either way.
4. Once brief 1 passes: `node runSchemaAcceptance.js all 2>&1 | tee .acceptance.log`.
5. Then prove it over real HTTP: `npm run dev`, `POST /api/pipeline/runs` with a brief, poll
   `GET /api/pipeline/runs/:id` every 2s. Confirm `agentStatus` moves
   `screenplay → continuity → storyboard` and `status` ends `complete`, with populated
   `sceneText`, `continuityClaims` (each with at least one real Parallel source URL),
   `continuitySummary`, `continuityOverallRisk`, and 4-8 `shots`.
6. Commit.

**Acceptance:** 5/5 briefs pass the harness, and one real HTTP run reaches `complete` with
genuine source URLs. Report: which transport ended up working, briefs passed, schema
violations, `[normalise] substitution` count, and wall-clock time for one full run. If a run
takes more than ~4 minutes, raise `PIPELINE_TIMEOUT_MS` — Cloud Run's `--timeout` in Phase 3
must exceed it.

## Phase 2 — Sanity-check what's already built

The retry logic and endpoint protection were written and offline-verified (no real network),
but never exercised against live traffic. Now that Phase 1 gives you a real server running
against real APIs:

- Watch the logs during the Phase 1 HTTP run for any `[retry:...]` lines — if the API is
  flaky, confirm the run still completes despite them.
- Quickly re-confirm the endpoint protection still behaves as intended against the running
  server: `curl localhost:3000/api/health` (open, no auth), then send 6 rapid
  `POST /api/pipeline/runs` requests and confirm the 6th returns 429.
- If `APP_SHARED_SECRET` is unset (default), the frontend needs no changes — confirm the
  existing untouched Vite starter still isn't broken by anything here (it has no fetch calls
  yet, so this should be a non-issue, but check).

**Acceptance:** health open and unthrottled; 6th rapid POST returns 429; nothing regressed
from Phase 1.

## Phase 3 — Dockerfile and Cloud Run

**Read this first: the pipeline is fire-and-forget background work that continues after the
HTTP response returns. Cloud Run throttles CPU to zero after a response unless CPU is always
allocated — deploy with `--no-cpu-throttling` or every run will sit at `screenplay` forever.**

1. Build the image for real — it has never been built: `docker build -t studiomind-api
   server/`. Fix anything that breaks; the Dockerfile was authored without a Docker daemon
   available to test it against.
2. Deploy:
   ```
   gcloud run deploy studiomind-api --source server --region <region> \
     --allow-unauthenticated --no-cpu-throttling --timeout 300 --min-instances 1 \
     --set-secrets MONGO_URI=mongo-uri:latest,PARALLEL_API_KEY=parallel-key:latest[,GEMINI_API_KEY=gemini-key:latest]
   ```
   Inject secrets via Secret Manager (`--set-secrets`) — **never** `--set-env-vars`. If
   Vertex is on, `GEMINI_API_KEY` isn't needed in the image at all — grant the Cloud Run
   service account the Vertex AI User role instead.
3. `--min-instances 1` keeps it warm for judging. Confirm the monthly cost before setting it
   and state the number in your report.
4. **MongoDB Atlas:** Cloud Run egress IPs are dynamic. Either allow `0.0.0.0/0` on the
   cluster (fine for a hackathon with a strong password) or add a VPC connector with a static
   NAT IP. Pick one and do it. A DB failure and a model failure look identical from the
   outside — check this first if deployed behaves differently from local.
5. Confirm the Atlas cluster does not auto-pause. A paused cluster in October is a dead demo.

**Acceptance:** against the public URL — `/api/health` returns `{ok:true}`, a POSTed brief
runs to `complete`, `GET /runs` lists it. Paste the URL in your report.

## Phase 4 — Close it out

- Update `README.md`'s Deployment section with the actual deployed URL and any deviations
  from the command already documented there.
- Update `CODE.md` §8 so every row reflects reality — most rows should now say "Working" or
  "Deployed" instead of "Written" or "Not started".
- A short paragraph Ajay can paste: base URL, whether the shared-secret header is required,
  the CORS origin he must be served from, and confirmation that the §7 contract is unchanged.
- Leave the tree clean.

## How to report

After each phase: files changed, commands run, actual output, what is still broken, what you
need from a human. Never call a phase done because the code compiles or `git diff` looks
right — that mistake already happened once on this project. Every phase above has an
acceptance check that involves running something for real, against real infrastructure.

If any single item blocks you for more than ~20 minutes, stop and report the exact error.
Priority if time runs short: **Phase 1, then 3, then 2.** A deployed URL that works beats
every other improvement on this list — and Phase 1 is the only thing standing between "code
that should work" and "backend that actually works."
