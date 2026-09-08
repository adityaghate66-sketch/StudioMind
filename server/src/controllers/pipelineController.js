const PipelineRun = require('../models/PipelineRun')
const runDirectorPipeline = require('../agents/director')
const env = require('../config/env')
const { normaliseResult } = require('../utils/normalise')

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

    if (brief.trim().length > env.BRIEF_MAX_CHARS) {
      return res.status(400).json({
        success: false,
        message: `"brief" must be ${env.BRIEF_MAX_CHARS} characters or fewer.`,
      })
    }

    // Create the run document in running state
    const run = await PipelineRun.create({ brief: brief.trim(), status: 'running' })
    const runId = run._id

    // Return immediately — the pipeline runs in the background.
    // The frontend polls GET /runs/:id for live agent-by-agent progress.
    res.status(201).json(run)

    // --- Fire-and-forget background pipeline ---
    const ac = new AbortController()
    const { signal } = ac

    // Abort the pipeline when the timeout fires
    const timer = setTimeout(() => ac.abort(), env.PIPELINE_TIMEOUT_MS)

    runDirectorPipeline(brief.trim(), runId, signal)
      .then(async (result) => {
        clearTimeout(timer)
        const normalised = normaliseResult(result)

        await PipelineRun.updateOne(
          { _id: runId },
          { $set: { shots: normalised.shots, status: 'complete', agentStatus: '' } }
        )
        console.log(`[Pipeline] Run ${runId} complete.`)
      })
      .catch(async (pipelineError) => {
        clearTimeout(timer)
        console.error(`[Pipeline] Run ${runId} failed:`, pipelineError.message)

        await PipelineRun.updateOne(
          { _id: runId },
          { $set: { status: 'failed', error: pipelineError.message, agentStatus: '' } }
        ).catch((saveErr) => {
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
