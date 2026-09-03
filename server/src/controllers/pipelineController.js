const PipelineRun = require('../models/PipelineRun')
const runDirectorPipeline = require('../agents/director')
const env = require('../config/env')

/**
 * Run a promise with a timeout. Rejects with a TimeoutError if it takes too long.
 * @param {Promise} promise
 * @param {number} ms
 * @returns {Promise}
 */
const withTimeout = (promise, ms) => {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Pipeline timed out after ${ms / 1000}s`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

// ---------- LLM output normalisation helpers ----------

const VALID_VERDICTS = ['confirmed', 'disputed', 'unverifiable']
const VALID_CONFIDENCE = ['high', 'medium', 'low']
const VALID_RISK = ['low', 'medium', 'high']
const VALID_FRAMING = [
  'wide', 'medium', 'close-up', 'extreme-close-up',
  'over-shoulder', 'aerial', 'tracking', 'static',
]

/** Lowercase and trim a string, return fallback if empty. */
const safeStr = (v, fallback = '') =>
  typeof v === 'string' ? v.trim() || fallback : fallback

/** Pick the closest valid enum value via prefix match, or return fallback. */
const closestEnum = (value, valid, fallback) => {
  const v = safeStr(value).toLowerCase()
  if (valid.includes(v)) return v
  const match = valid.find((e) => e.startsWith(v) || v.startsWith(e))
  return match || fallback
}

/** Normalise a single continuity claim from Gemini. */
const normaliseClaim = (c) => ({
  claim: safeStr(c?.claim, '[No claim text]'),
  type: safeStr(c?.type, 'other'),
  verdict: closestEnum(c?.verdict, VALID_VERDICTS, 'unverifiable'),
  confidence: closestEnum(c?.confidence, VALID_CONFIDENCE, 'medium'),
  summary: safeStr(c?.summary, 'No summary provided.'),
  sources: Array.isArray(c?.sources)
    ? c.sources.map((s) => safeStr(s)).filter(Boolean)
    : [],
})

/** Normalise a single shot from Gemini. */
const normaliseShot = (s) => ({
  shotNumber: Number.isFinite(Number(s?.shotNumber)) ? Number(s.shotNumber) : 0,
  framing: closestEnum(s?.framing, VALID_FRAMING, 'static'),
  description: safeStr(s?.description, '[No description]'),
  flagged: Boolean(s?.flagged),
  flagReason: s?.flagged ? safeStr(s?.flagReason, 'Flagged by AI') : null,
})

/** Normalise the full pipeline result before saving. */
const normaliseResult = (result) => {
  const continuityClaims = Array.isArray(result.continuityReport?.claims)
    ? result.continuityReport.claims.map(normaliseClaim)
    : []

  const continuityOverallRisk = closestEnum(
    result.continuityReport?.overallRisk,
    VALID_RISK,
    'low'
  )

  const continuitySummary = safeStr(result.continuityReport?.summary, '')

  const shots = Array.isArray(result.storyboard?.shots)
    ? result.storyboard.shots.map(normaliseShot)
    : []

  return { continuityClaims, continuityOverallRisk, continuitySummary, shots }
}

/**
 * POST /api/pipeline/runs
 * Create a new pipeline run and execute the full Director pipeline.
 */
const createRun = async (req, res, next) => {
  try {
    const { brief } = req.body

    if (!brief || typeof brief !== 'string' || brief.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-empty "brief" string is required in the request body.',
      })
    }

    // Create the run document in running state
    const run = await PipelineRun.create({ brief: brief.trim(), status: 'running' })

    // Return immediately — the pipeline runs in the background.
    // The frontend polls GET /runs/:id for live agent-by-agent progress.
    res.status(201).json(run)

    // Fire-and-forget: run the pipeline with a timeout
    withTimeout(runDirectorPipeline(brief.trim(), run), env.PIPELINE_TIMEOUT_MS)
      .then(async (result) => {
        // Normalise LLM output to satisfy strict Mongoose enums
        const normalised = normaliseResult(result)

        run.sceneText = result.sceneText
        run.continuityClaims = normalised.continuityClaims
        run.continuitySummary = normalised.continuitySummary
        run.continuityOverallRisk = normalised.continuityOverallRisk
        run.shots = normalised.shots
        run.status = 'complete'
        run.agentStatus = ''

        await run.save()
        console.log(`[Pipeline] Run ${run._id} complete.`)
      })
      .catch(async (pipelineError) => {
        console.error(`[Pipeline] Run ${run._id} failed:`, pipelineError.message)
        run.status = 'failed'
        run.error = pipelineError.message
        run.agentStatus = ''

        await run.save().catch((saveErr) => {
          console.error('[Pipeline] Failed to persist run status:', saveErr.message)
        })
      })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/pipeline/runs/:id
 * Get a single pipeline run by ID.
 */
const getRun = async (req, res, next) => {
  try {
    const run = await PipelineRun.findById(req.params.id)

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Pipeline run not found.',
      })
    }

    return res.json(run)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/pipeline/runs
 * List recent pipeline runs, newest first.
 */
const listRuns = async (req, res, next) => {
  try {
    const runs = await PipelineRun.find().sort({ createdAt: -1 })
    return res.json(runs)
  } catch (err) {
    next(err)
  }
}

module.exports = { createRun, getRun, listRuns }
