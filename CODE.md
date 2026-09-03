# StudioMind — How The Code Works

Read this before you touch a part of the code you didn't write.

It explains what each file is for, why it exists as its own file, and how they
all connect. Plain language, no jargon. Sections marked **What's next here**
tell you what that part is going to become before we submit.

---

## 1. What StudioMind does, in one breath

Someone types a brief. Three AI agents run one after another — one writes a
scene, one fact-checks the real-world claims inside that scene against live web
sources, one turns it into a shot list and flags the risky shots. The screen
watches it happen, agent by agent.

It is a **pipeline**, not a chatbot. The same three steps run in the same order
every time. That predictability is the whole point.

---

## 2. Why there are so many files

You could write this entire thing in one big `server.js`. It would work.

But then when Gemini returns broken JSON, you'd be scrolling through 600 lines
trying to find where to fix it. Splitting it up means **every problem has one
obvious place to go and look.**

The rule we follow: *each file does one job, and doesn't know about the other
files' jobs.* The screenplay agent doesn't know a database exists. The database
file doesn't know Gemini exists. They hand things to each other and stay out of
each other's business.

Think of `server/` as a small production office where each person has one job.

---

## 3. Follow one request all the way through

Someone types "A tense handoff on a Lisbon tram at dusk" and hits Run.

### `server.js` — the person who opens the office in the morning

Runs once, at startup. Checks the keys are there, connects the database, starts
listening. That's it. It never handles a request.

It's its own file so that "how does this thing boot" is one short readable file,
instead of being buried at the bottom of something bigger.

### `app.js` — the building itself

Sets up Express: read JSON bodies, allow CORS, here's the health check, here are
the routes, here's what happens on a 404.

Why is this separate from `server.js`? Because `app.js` **builds** the app but
doesn't **start** it. That means you can import it in a test file and hit routes
without ever opening a port.

### `routes/pipelineRoutes.js` — the sign at reception

Just a mapping. `POST /runs` goes to this function, `GET /runs/:id` goes to that
one. Four lines, no logic.

Come here when you want to know what URLs exist.

### `controllers/pipelineController.js` — the receptionist

The first person who actually handles the request. Checks the brief isn't empty,
creates a record in the database, and then does the important bit:

**It replies immediately, and starts the real work in the background.**

This is worth understanding properly. Normally a server does the work and then
replies. Here it replies first — "got it, here's your ticket number" — and *then*
starts working.

Why? The full pipeline takes 60 to 120 seconds. Cloud Run and most proxies cut a
connection off at around 60 seconds, so the browser would give up waiting. And
even if it didn't, the user would be staring at a spinner with no idea what was
happening.

So instead: reply instantly with an id, and let the browser ask "is it done yet?"
every couple of seconds.

The controller also holds the stopwatch. If the pipeline runs past 120 seconds,
it pulls the plug.

### `agents/director/index.js` — the manager

Doesn't do any actual work itself. It just knows the order: screenplay first,
then continuity, then storyboard. It calls each one, hands the output to the
next, and **saves the result to the database after every step.**

That "after every step" part is deliberate and it matters a lot.

If the Director saved everything only at the end, the screen would show three
spinners for two minutes and then dump everything at once. Because it saves as
it goes, the screenplay appears while the fact-checking is still running.

That progressive reveal *is* the demo. Don't break it.

### `agents/screenplay/`, `continuity/`, `storyboard/` — the three workers

Each does exactly one thing and knows nothing about the others. The screenplay
agent has no idea a continuity agent exists. It takes a brief, returns a scene.
That's the entire contract.

**The continuity agent is the interesting one.** It does three things:

1. Asks Gemini to pull out every checkable real-world fact in the scene —
   locations, historical details, technical claims, brand names, real people.
2. Sends each of those facts to **Parallel**, which actually searches the web
   and comes back with sources.
3. Asks Gemini to read those search results and give a verdict on each claim:
   confirmed, disputed, or unverifiable — with sources attached.

**Why Parallel and not just Gemini?** Because asking a model "is this true" only
gets you what the model *remembers*. Parallel goes and *looks*, and brings back
links. Every verdict traces to a URL a producer can actually open.

That's the difference between a guess and a check. It's the reason this project
exists, and it's what our Parallel track submission rests on.

One detail: the searches run **one at a time**, with a small gap between them.
Not all at once. Firing ten simultaneous searches gets us rate-limited, and the
rejections come back looking like "unverifiable" verdicts instead of a visible
error — which would be a very confusing bug to chase.

### And then it's done

The controller saves the shots, marks the run `complete`, and the browser's next
check sees it and stops asking.

If anything breaks along the way — a bad key, a rejected request, the timeout —
the run gets marked `failed` with the error message, so the screen can show a
failure instead of polling forever.

---

## 4. The files that aren't obvious

These are the ones where people ask "why is this its own file?"

### `prompts/` — the instruction sheets

Each one is just a function that builds a big string. No API calls, no logic.

**Why separate?** Because prompts are the thing you change most. You'll tweak the
screenplay prompt fifteen times this week. If it lives inside the agent code,
every tweak risks breaking the agent. Kept on its own, you're just editing text
in a file that *can't* break anything.

Bonus: you can read all four prompts side by side and see exactly what the AI is
being told, without wading through code.

> **What's next here:** the extraction prompt is too broad. A 300-word scene can
> produce a dozen claims, which means a dozen web searches — minutes of runtime
> and real money per run. We need to cap the number of claims and prioritise the
> legal-risk and brand ones over trivia.

### `services/` — the phone lines to the outside world

One file for calling Gemini, one for calling Parallel. They handle the API key,
the URL, the request format, and turning errors into readable messages.

**Why separate?** Two reasons.

First, three different agents call Gemini. Without this, the same API-calling
code would be copy-pasted three times — and you'd fix a bug in one copy and
forget the other two.

Second, when we move to Vertex AI next week, we change **one file** and nothing
else moves. That's the whole payoff.

> **What's next here — this is our biggest unknown.** Nobody has confirmed that
> our Parallel request actually matches their API. We send fields called
> `objective`, `search_queries`, `mode`, `max_results`, `excerpts`. If even one
> name is wrong, we get a rejection, the code quietly swallows it, and every
> claim comes back "unverifiable" with no error shown anywhere.
>
> Our entire partner-track eligibility depends on this one call working. It has
> to be proven with a real successful response before anything else matters.

### `utils/normalise.js` — quality control at the door

Gemini returns whatever it feels like. Sometimes `"Confirmed"` with a capital C.
Sometimes it forgets a field entirely. Our database has strict rules and rejects
anything that doesn't match exactly.

So this file sits in between and cleans things up — lowercases values, fills in
missing fields, throws out anything it doesn't recognise.

And it fills them in **carefully**. If Gemini forgets to say whether a claim is
confirmed, this marks it **unverifiable** — never confirmed.

That's on purpose. This is a legal-risk tool. Quietly saying "we checked it,
it's fine" when we didn't check is the worst possible way to be wrong.

It's a shared file because both the Director and the controller need it. Two
copy-pasted versions would drift apart, and you'd fix a bug in one and spend an
evening confused about why it didn't work.

> **What's next here:** cleaning up afterwards is a safety net, not a real fix.
> The proper answer is `responseSchema` in the Gemini call — an actual schema
> the model is forced to follow. Once that's in, this file becomes a last line
> of defence instead of the thing holding everything together.

### `models/PipelineRun.js` — the form everything gets written on

Defines what a run looks like in the database: a brief, a status, a scene, a
list of claims, a list of shots. It also enforces the rules — a verdict has to
be one of exactly three words.

Everything lives in **one record**, rather than separate tables for claims and
shots. That's because the screen asks for one run, by its id, every two seconds.
One record means one lookup per check. Splitting it up would mean joining tables
on every single poll, for no benefit at all.

> **What's next here:** `listRuns` currently fetches every run ever created,
> with every field. It needs a limit of about 20, and it should skip the scene
> text, claims and shots — a list view doesn't need any of that. The database
> also wants an index for sorting by date.

### `config/` — the settings drawer

`env.js` reads your `.env` once, so no other file ever touches `process.env`
directly. `db.js` connects to Mongo. `gemini.js` builds the Gemini client once
and reuses it, instead of making a new one on every call.

The best part here is `env.validate()`. It runs at startup and stops the server
immediately if a key is missing, telling you exactly which one.

Without it, the server would start up looking perfectly healthy, and you'd only
find out about the missing key twenty minutes later when a run mysteriously
failed for no visible reason.

> **What's next here:** `gemini.js` moves to **Vertex AI**. Right now we use a
> plain AI Studio key, which is the consumer API — not Google Cloud. One of the
> four judging criteria is how well we use Google Cloud, so this costs us points
> as it stands. Same SDK, just a different mode. We'll keep the key-based path
> behind a flag so local development doesn't need extra setup.

### `app.js`, again — one warning

The error handler has to stay **last**. Express only treats a four-argument
function as an error handler if everything else is registered before it. Move it
up and errors silently stop being caught.

> **What's next here — before the link goes public.** Judges get this URL, and
> so does everyone else. Every request triggers four Gemini calls and a pile of
> web searches, all billed to us. We need CORS locked to our own frontend
> instead of open to everyone, a length limit on the brief (it goes straight
> into a prompt), and a rate limit on the POST route only — the polling requests
> must stay unlimited or the screen breaks.

---

## 5. How it all connects

Everything flows in one direction:

```
routes → controller → director → the three agents → services → Gemini / Parallel
```

And off to the side, the agents borrow from `prompts`, `utils` and `models` as
they need them.

**The important part: arrows never point backwards.** An agent can call a
service. A service can *never* call an agent. `prompts` imports nothing at all.

That's why you can test the screenplay agent completely on its own — no server,
no database, no HTTP. It's just a function that takes a string and returns a
string.

Keep it that way. The moment a service starts reaching back into an agent, this
stops being testable and starts being a knot.

---

## 6. The folder map

```
server/src/
├── server.js          Boots the app: check keys → connect DB → listen
├── app.js             Express setup: middleware, routes, 404, error handler
│
├── config/
│   ├── env.js         Reads .env, validates required keys at startup
│   ├── db.js          Mongo connection + clean shutdown
│   └── gemini.js      Builds the Gemini client once, reuses it
│
├── routes/            URL → function mapping. Nothing else.
├── controllers/       The HTTP layer. Starts the background job, owns the timeout.
│
├── agents/
│   ├── director/      Runs the three below in order, saves after each step
│   ├── screenplay/    brief          → scene text
│   ├── continuity/    scene text     → verified claims (this is the Parallel one)
│   └── storyboard/    scene + claims → shot list with flags
│
├── prompts/           One string builder per agent. Pure. Imports nothing.
├── services/          Wrappers for Gemini and Parallel. Auth, format, errors.
├── utils/normalise.js Cleans Gemini's messy JSON into what the database accepts
├── models/            The PipelineRun database shape
└── middleware/        The error handler

client/                React + Vite. Talks to the server over HTTP only.
shared/                Reserved for code both sides use. Currently empty.
docs/                  Notes.
```

`client/` never imports from `server/`. The only thing joining them is the JSON
shape below.

---

## 7. The contract with the frontend

This is what `GET /runs/:id` returns. **Ajay's screen is built against these
exact field names — don't rename anything without telling him.**

```json
{
  "_id": "...",
  "brief": "A tense handoff on a Lisbon tram at dusk.",
  "status": "running | complete | failed",
  "agentStatus": "screenplay | continuity | storyboard | \"\"",
  "sceneText": "INT. TRAM — DUSK\n...",
  "continuityClaims": [
    {
      "claim": "...",
      "type": "historical | technical | location | brand | legal_risk | other",
      "verdict": "confirmed | disputed | unverifiable",
      "confidence": "high | medium | low",
      "summary": "...",
      "sources": ["https://..."]
    }
  ],
  "continuitySummary": "...",
  "continuityOverallRisk": "low | medium | high",
  "shots": [
    {
      "shotNumber": 1,
      "framing": "wide | medium | close-up | extreme-close-up | over-shoulder | aerial | tracking | static",
      "description": "...",
      "flagged": true,
      "flagReason": "..."
    }
  ],
  "error": "",
  "createdAt": "...",
  "updatedAt": "..."
}
```

The three routes:

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/health` | Is the server alive |
| `POST` | `/api/pipeline/runs` | Start a run. Body: `{ "brief": "..." }`. Returns instantly. |
| `GET` | `/api/pipeline/runs/:id` | Check on a run. **Poll this every ~2s.** |
| `GET` | `/api/pipeline/runs` | List runs, newest first |

---

## 8. Where we actually are

| Part | State |
|---|---|
| Agent pipeline | Written |
| Background job + polling | Working |
| Saving after each step | Working |
| Timeout / cancellation | Working |
| Startup key checking | Working |
| **Proven to run end to end** | **Not yet** |
| **Parallel request verified** | **Not yet** |
| Vertex AI (Google Cloud) | Not started |
| Endpoint protection | Not started |
| Deployment (Cloud Run) | Not started |
| Frontend | Ajay, in progress |

**Order of work:**

1. Run it once with real keys — prove Gemini and Parallel both actually respond
2. Verify the Parallel request against their live docs
3. Add `responseSchema` to the Gemini calls
4. Move to Vertex AI
5. Protect the endpoints
6. Dockerfile → Cloud Run → a working public URL

**Step 1 gates everything.** Until one run completes end to end, everything
below it is guesswork.

---

## 9. Four things to keep in mind

**Judging happens weeks after we submit.** The public URL has to still work in
October — quota intact, billing alive, database up. A dead link during judging
is the same as never submitting.

**Don't break the contract in section 7.** Renaming a field silently breaks
Ajay's screen, and he won't find out until he next runs it.

**The prompts are the product.** Most of the quality in this project lives in
four string-building functions, not in the plumbing around them. When you tune
one, test it across several different briefs — not just the one you're looking at.

**Never retype a file from terminal output.** Edit it in place. Terminal output
gets truncated and you will silently lose the bottom half of a file without
noticing.
