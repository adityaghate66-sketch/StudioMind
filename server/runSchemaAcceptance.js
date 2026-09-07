/* Temporary acceptance harness — runSchemaAcceptance.js
 * Runs screenplay -> continuity -> storyboard over 5 briefs (the pipeline's JSON steps),
 * then normalises exactly as director/controller do and counts:
 *   - schema violations   (shape/enum mismatches the schema should have prevented)
 *   - normalise substitutions (console.warn('[normalise] ...') emitted by utils/normalise.js)
 */
const runScreenplayAgent = require('./src/agents/screenplay')
const runContinuityAgent = require('./src/agents/continuity')
const runStoryboardAgent = require('./src/agents/storyboard')
const { normaliseResult } = require('./src/utils/normalise')

const CLAIM_TYPES = ['historical', 'technical', 'location', 'brand', 'legal_risk', 'other']
const VERDICTS = ['confirmed', 'disputed', 'unverifiable']
const CONFIDENCE = ['high', 'medium', 'low']
const RISKS = ['low', 'medium', 'high']
const FRAMING = ['wide', 'medium', 'close-up', 'extreme-close-up', 'over-shoulder', 'aerial', 'tracking', 'static']

const briefs = [
  'A tense handoff on a Lisbon tram at dusk, between a courier and an old Fado singer.',
  'A diver investigates a 1945 shipwreck off the coast of Okinawa.',
  'A night-shift baker in Paris discovers a note hidden in a baguette.',
  'A documentary crew films Arctic foxes near Svalbard as the ice breaks up.',
  'A retired astronaut gives a tour of a decommissioned Saturn V at the Kennedy Space Center.',
]

const tally = { briefs: 0, schemaViolations: [], normaliseWarnings: 0, runs: [] }

// Capture [normalise] warnings (they also pass through to the console).
const origWarn = console.warn
console.warn = (...args) => {
  const line = args.join(' ')
  if (line.startsWith('[normalise]')) tally.normaliseWarnings += 1
  origWarn(...args)
}

const isStr = (v) => typeof v === 'string' && v.length > 0
const isArr = (v) => Array.isArray(v)

function check(cond, msg) {
  if (!cond) tally.schemaViolations.push(msg)
}

function checkExtraction(claims, run) {
  check(isArr(claims), `[${run}] extraction is not an array`)
  if (!isArr(claims)) return
  claims.forEach((c, i) => {
    check(isStr(c.claim), `[${run}] claim[${i}].claim not a string`)
    check(isStr(c.context), `[${run}] claim[${i}].context not a string`)
    check(CLAIM_TYPES.includes(c.type), `[${run}] claim[${i}].type invalid: ${JSON.stringify(c.type)}`)
  })
}

function checkSynthesis(report, run) {
  check(report && typeof report === 'object' && !Array.isArray(report), `[${run}] synthesis not an object`)
  if (!report) return
  check(isArr(report.claims), `[${run}] report.claims not an array`)
  check(RISKS.includes(report.overallRisk), `[${run}] overallRisk invalid: ${JSON.stringify(report.overallRisk)}`)
  check(isStr(report.summary), `[${run}] summary not a string`)
  if (!isArr(report.claims)) return
  report.claims.forEach((c, i) => {
    check(isStr(c.claim), `[${run}] verdict claim[${i}].claim not a string`)
    check(CLAIM_TYPES.includes(c.type), `[${run}] verdict claim[${i}].type invalid: ${JSON.stringify(c.type)}`)
    check(VERDICTS.includes(c.verdict), `[${run}] verdict claim[${i}].verdict invalid: ${JSON.stringify(c.verdict)}`)
    check(CONFIDENCE.includes(c.confidence), `[${run}] verdict claim[${i}].confidence invalid: ${JSON.stringify(c.confidence)}`)
    check(isStr(c.summary), `[${run}] verdict claim[${i}].summary not a string`)
    check(isArr(c.sources), `[${run}] verdict claim[${i}].sources not an array`)
    if (isArr(c.sources)) c.sources.forEach((s) => check(isStr(s), `[${run}] verdict claim[${i}].sources entry not a string`))
  })
}

function checkStoryboard(sb, run) {
  check(sb && typeof sb === 'object' && !Array.isArray(sb), `[${run}] storyboard not an object`)
  if (!sb) return
  check(isArr(sb.shots), `[${run}] shots not an array`)
  check(Number.isInteger(sb.totalShots), `[${run}] totalShots not an integer`)
  if (!isArr(sb.shots)) return
  sb.shots.forEach((s, i) => {
    check(Number.isInteger(s.shotNumber) && s.shotNumber >= 1, `[${run}] shot[${i}].shotNumber invalid: ${JSON.stringify(s.shotNumber)}`)
    check(FRAMING.includes(s.framing), `[${run}] shot[${i}].framing invalid: ${JSON.stringify(s.framing)}`)
    check(isStr(s.description), `[${run}] shot[${i}].description not a string`)
    check(typeof s.flagged === 'boolean', `[${run}] shot[${i}].flagged not a boolean`)
    check(s.flagReason === null || isStr(s.flagReason), `[${run}] shot[${i}].flagReason invalid: ${JSON.stringify(s.flagReason)}`)
    if (s.flagged) check(isStr(s.flagReason), `[${run}] shot[${i}] flagged but no flagReason`)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Optional argv: a 1-based brief index to run just that one (e.g. `node runSchemaAcceptance.js 3`),
// or 'all' (default) for the full 5-brief sweep.
const onlyIdx = (() => {
  const a = process.argv[2]
  if (a === undefined || a === 'all') return null
  const n = Number(a)
  return Number.isInteger(n) && n >= 1 && n <= briefs.length ? n : null
})()
if (process.argv[2] !== undefined && onlyIdx === null && process.argv[2] !== 'all') {
  console.log(`Ignoring unknown arg "${process.argv[2]}" (expected a brief index 1-${briefs.length} or 'all')`)
}

// Transient Gemini/API spikes (503/429) should not fail the acceptance run.
const withRetry = async (label, fn, attempts = 5) => {
  for (let a = 1; a <= attempts; a++) {
    try {
      return await fn()
    } catch (err) {
      const msg = String(err && err.message ? err.message : err)
      const transient = /(503|429|UNAVAILABLE|high demand|rate limit|ETIMEDOUT|ECONNRESET|fetch failed|ENOTFOUND|socket hang up|timeout)/i.test(msg)
      if (!transient || a === attempts) throw err
      // Prefer the API's own retryDelay (RetryInfo) when present, else exponential backoff.
      const delayMatch = msg.match(/retryDelay"?:\s*"?([\d.]+)s?"?/) || msg.match(/retry in ([\d.]+)s/i)
      const delay = delayMatch ? Math.ceil(Number(delayMatch[1]) * 1.5) : a * 10
      console.log(`[${label}] transient API/network error, retry ${a}/${attempts - 1} in ${delay}s...`)
      await sleep(delay * 1000)
    }
  }
}

;(async () => {
  for (let b = 0; b < briefs.length; b++) {
    if (onlyIdx !== null && b + 1 !== onlyIdx) continue
    const brief = briefs[b]
    const run = `run${b + 1}`
    tally.briefs += 1
    console.log(`\n========== ${run}: "${brief.slice(0, 60)}..." ==========`)

    const before = tally.schemaViolations.length

    // Step 1: screenplay (prose)
    const sceneText = await withRetry(`${run} screenplay`, () => runScreenplayAgent(brief))
    console.log(`[${run}] screenplay ok (${sceneText.split(/\s+/).length} words): ${sceneText.split('\n')[0]}`)

    // Step 2: continuity (extraction -> parallel verification -> synthesis)
    const continuityReport = await withRetry(`${run} continuity`, () => runContinuityAgent(sceneText))
    console.log(`[${run}] continuity: ${continuityReport.claims.length} verdicts, overallRisk=${continuityReport.overallRisk}`)
    checkSynthesis(continuityReport, run)

    // Step 3: storyboard
    const storyboard = await withRetry(`${run} storyboard`, () => runStoryboardAgent(sceneText, continuityReport))
    console.log(`[${run}] storyboard: ${storyboard.shots.length} shots, totalShots=${storyboard.totalShots}`)
    checkStoryboard(storyboard, run)

    // Normalise exactly like director/controller do (substitutions are logged via console.warn)
    const beforeNorm = tally.normaliseWarnings
    normaliseResult({ continuityReport, storyboard })
    const normWarnings = tally.normaliseWarnings - beforeNorm
    tally.runs.push({ run, claims: continuityReport.claims.length, shots: storyboard.shots.length, normWarnings })

    // Small pause between runs to be polite to the APIs
    if (b < briefs.length - 1) await sleep(1500)
  }

  console.log('\n================ SUMMARY ================')
  console.log('Briefs run:', tally.briefs)
  console.log('Normalise substitutions (all runs):', tally.normaliseWarnings)
  console.log('Schema violations:', tally.schemaViolations.length)
  if (tally.schemaViolations.length > 0) {
    console.log('Violations:')
    tally.schemaViolations.forEach((v) => console.log('  - ' + v))
  }
  const exit = tally.schemaViolations.length === 0 ? 0 : 1
  process.exit(exit)
})().catch((e) => {
  console.error('ACCEPTANCE FAILED:', e)
  process.exit(1)
})
