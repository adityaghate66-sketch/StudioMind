# StudioMind

An agentic pre-production assistant for film and video. You give it a one-line
brief; a chain of Gemini-powered agents turns it into a scene, fact-checks the
real-world claims inside that scene against live web sources, and produces a
shot list with the risky shots flagged.

Built for the **Google Cloud Agentic Cinema Hackathon** — **Parallel track**.

---

## The problem

Writers' rooms invent details. A scene says the getaway car pulls out onto a
one-way street in Lisbon, or that a character reloads a revolver with a
magazine, or name-drops a real brand. Somebody downstream — a producer, a
lawyer, a continuity supervisor — has to catch those before they cost money.
That check happens late, by hand, and it is easy to miss things.

StudioMind runs that check at the moment the scene is written.

## How it works

A **Director** agent runs three specialist agents in a fixed order. Each step's
output is the next step's input.

```
brief
  |
  v
[1] Screenplay agent      Gemini writes a 150-300 word scene
  |
  v
[2] Continuity & Legal Risk agent
        a. Gemini extracts every checkable real-world claim
        b. Parallel Search API verifies each claim against live sources
        c. Gemini turns the search results into producer-facing verdicts
  |
  v
[3] Storyboard agent      Gemini builds a 4-8 shot list and flags any shot
                          that depicts a disputed or legally risky claim
  |
  v
saved run (polled by the frontend as each agent finishes)
```

The pipeline is deterministic — the same three stages run in the same order
every time. It is not a chatbot.

### Why Parallel

Step 2 is the reason this project exists, and it cannot be done by a language
model alone. Asking Gemini "is this claim true" only returns what Gemini
remembers. Parallel's Search API goes and looks, and returns sources — so every
verdict in the continuity report can be traced back to a URL a producer can
open.

## Tech

| Layer | Used |
|---|---|
| Model | Gemini (`@google/genai`) |
| Web verification | Parallel Search API |
| Backend | Node.js, Express 5 |
| Data | MongoDB (Mongoose) |
| Frontend | React 19, Vite |

## API

The pipeline runs in the background. `POST` returns immediately with a run in
`running` state; poll `GET /runs/:id` to watch `agentStatus` move through
`screenplay` -> `continuity` -> `storyboard`.

| Method | Route | Does |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/pipeline/runs` | Start a run. Body: `{ "brief": "..." }` |
| `GET` | `/api/pipeline/runs/:id` | Fetch one run (poll this for progress) |
| `GET` | `/api/pipeline/runs` | List runs, newest first |

## Running it locally

**Requires:** Node 20+, a MongoDB instance, a Gemini API key, a Parallel API key.

```bash
git clone https://github.com/adityaghate66-sketch/StudioMind.git
cd StudioMind

# backend
cd server
npm install
cp .env.example .env      # then fill in your keys
npm run dev               # http://localhost:3000

# frontend, in a second terminal
cd ../client
npm install
npm run dev
```

### Environment variables

Set these in `server/.env`:

| Variable | Meaning |
|---|---|
| `PORT` | Server port. Defaults to `3000`. |
| `MONGO_URI` | MongoDB connection string. |
| `GEMINI_API_KEY` | Google Gemini API key. |
| `PARALLEL_API_KEY` | Parallel API key. |
| `PIPELINE_TIMEOUT_MS` | Max pipeline runtime. Defaults to `120000`. |

### Try it

```bash
curl -X POST http://localhost:3000/api/pipeline/runs \
  -H 'Content-Type: application/json' \
  -d '{"brief":"A tense handoff on a Lisbon tram at dusk."}'
```

Take the `_id` from the response and poll:

```bash
curl http://localhost:3000/api/pipeline/runs/<id>
```

## Repository layout

```
server/src/
  agents/       director, screenplay, continuity, storyboard
  prompts/      one prompt builder per agent step
  services/     gemini/ and parallel/ API wrappers
  controllers/  request handling + normalising model output
  models/       PipelineRun schema
  routes/       route definitions
  config/       env, database, Gemini client
client/         React + Vite frontend
```

## License

MIT — see [LICENSE](LICENSE).
