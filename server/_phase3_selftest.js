// Offline smoke test for Phase 3 middleware — imports app.js directly so it
// never touches Mongo, Gemini, or Parallel (all unreachable from this shell).
// Deleted immediately after running; not part of the deliverable.
process.env.CORS_ORIGIN = 'http://localhost:5173,http://allowed.example'
process.env.APP_SHARED_SECRET = 'topsecret123'
process.env.BRIEF_MAX_CHARS = '2000'

const app = require('./src/app')
const server = app.listen(0, async () => {
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`
  const results = []

  const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail })

  // 1. Health + helmet headers
  {
    const r = await fetch(`${base}/api/health`)
    const body = await r.json()
    check('health returns ok', r.status === 200 && body.ok === true, `status=${r.status}`)
    check('helmet sets x-content-type-options', r.headers.get('x-content-type-options') === 'nosniff')
    check('helmet removes x-powered-by', !r.headers.get('x-powered-by'))
  }

  // 2. CORS allowed origin
  {
    const r = await fetch(`${base}/api/health`, { headers: { Origin: 'http://allowed.example' } })
    check('allowed origin echoed in ACAO', r.headers.get('access-control-allow-origin') === 'http://allowed.example', r.headers.get('access-control-allow-origin'))
  }

  // 3. CORS disallowed origin (browsers pre-flight OPTIONS; cors() surfaces the error via next())
  {
    const r = await fetch(`${base}/api/pipeline/runs`, {
      method: 'POST',
      headers: { Origin: 'http://evil.example', 'Content-Type': 'application/json', 'x-studiomind-key': 'topsecret123' },
      body: JSON.stringify({ brief: 'x' }),
    })
    const body = await r.json().catch(() => ({}))
    check('disallowed origin refused', r.status >= 400, `status=${r.status} body=${JSON.stringify(body)}`)
  }

  // 4. Missing brief -> 400 (no DB needed, validation happens first)
  {
    const r = await fetch(`${base}/api/pipeline/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-studiomind-key': 'topsecret123' },
      body: JSON.stringify({}),
    })
    check('missing brief -> 400', r.status === 400, `status=${r.status}`)
  }

  // 5. Oversized brief -> 400 (well under the 32kb hard body cap, so it's the controller's check)
  {
    const r = await fetch(`${base}/api/pipeline/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-studiomind-key': 'topsecret123' },
      body: JSON.stringify({ brief: 'x'.repeat(2001) }),
    })
    const body = await r.json().catch(() => ({}))
    check('brief > BRIEF_MAX_CHARS -> 400', r.status === 400, `status=${r.status} msg=${body.message}`)
  }

  // 6. Oversized raw body (>32kb) -> 413
  {
    const r = await fetch(`${base}/api/pipeline/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-studiomind-key': 'topsecret123' },
      body: JSON.stringify({ brief: 'x'.repeat(40000) }),
    })
    check('body > 32kb -> 413', r.status === 413, `status=${r.status}`)
  }

  // 7. Missing shared secret -> 401
  {
    const r = await fetch(`${base}/api/pipeline/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: 'valid brief text' }),
    })
    check('missing x-studiomind-key -> 401', r.status === 401, `status=${r.status}`)
  }

  // 8. Correct shared secret -> passes the gate (will hang/timeout on Mongo, which is fine —
  //    we only care that it is NOT rejected by the secret check itself).
  {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 1500)
    try {
      const r = await fetch(`${base}/api/pipeline/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-studiomind-key': 'topsecret123' },
        body: JSON.stringify({ brief: 'valid brief text' }),
        signal: ac.signal,
      })
      check('correct secret passes gate (unexpected fast response)', r.status !== 401, `status=${r.status}`)
    } catch (e) {
      // Aborted because Mongo is unreachable here — that's expected and fine;
      // it proves the request got PAST the 401 gate.
      check('correct secret passes gate (timed out past the gate, as expected)', e.name === 'AbortError', e.message)
    } finally {
      clearTimeout(t)
    }
  }

  // 9. Rate limit: fire 8 concurrent POSTs with a valid secret+brief; the 6th+ should 429
  //    immediately (rate-limit middleware runs before the Mongo call, so it doesn't need to wait).
  {
    const reqs = Array.from({ length: 8 }, () => {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 1500)
      return fetch(`${base}/api/pipeline/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-studiomind-key': 'topsecret123' },
        body: JSON.stringify({ brief: 'valid brief text' }),
        signal: ac.signal,
      })
        .then((r) => ({ status: r.status }))
        .catch((e) => ({ status: 'aborted(' + e.name + ')' }))
        .finally(() => clearTimeout(t))
    })
    const statuses = await Promise.all(reqs)
    const got429 = statuses.filter((s) => s.status === 429).length
    check('6th+ rapid POST gets 429', got429 >= 3, JSON.stringify(statuses))
  }

  console.log('\n=== Phase 3 self-test results ===')
  let allPass = true
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`)
    if (!r.pass) allPass = false
  }
  console.log(allPass ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED')

  server.close(() => process.exit(allPass ? 0 : 1))
})
