const PipelineRun = require('../models/PipelineRun')
const runDirectorPipeline = require('../agents/director')

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

    // Create the run document in pending state
    const run = await PipelineRun.create({ brief: brief.trim(), status: 'running' })

    try {
      // Execute the Director pipeline
      const result = await runDirectorPipeline(brief.trim())

      // Extract structured data from the continuity report
      const continuityClaims = result.continuityReport?.claims || []
      const continuitySummary = result.continuityReport?.summary || ''
      const continuityOverallRisk = result.continuityReport?.overallRisk || ''

      // Extract shots from storyboard
      const shots = result.storyboard?.shots || []

      // Update the run with results
      run.sceneText = result.sceneText
      run.continuityClaims = continuityClaims
      run.continuitySummary = continuitySummary
      run.continuityOverallRisk = continuityOverallRisk
      run.shots = shots
      run.status = 'complete'
    } catch (pipelineError) {
      console.error('[Pipeline] Execution failed:', pipelineError.message)
      run.status = 'failed'
      run.error = pipelineError.message
    }

    await run.save()

    return res.status(201).json(run)
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
