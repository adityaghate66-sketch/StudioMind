const runScreenplayAgent = require('../screenplay')
const runContinuityAgent = require('../continuity')
const runStoryboardAgent = require('../storyboard')
const PipelineRun = require('../../models/PipelineRun')
const { normaliseClaim, safeStr, closestEnum } = require('../../utils/normalise')

const VALID_RISK = ['low', 'medium', 'high']

/**
 * Director agent: orchestrates the full pipeline.
 * brief -> Screenplay -> Continuity & Legal Risk -> Storyboard
 *
 * Each step's output feeds into the next. If any step fails, the error is thrown.
 * The Director writes progress to MongoDB via PipelineRun.updateOne() using the
 * run's _id — it never holds a Mongoose document, so there are no concurrent-
 * save conflicts with the controller.
 *
 * The signal is checked between each agent step.  When the AbortController fires
 * (on timeout or explicit cancellation), the pipeline stops at the next check.
 * In-flight fetch() calls in verifyClaim are also aborted via the same signal.
 *
 * @param {string} brief - The user's text brief.
 * @param {string} runId - The PipelineRun _id to write progress to.
 * @param {AbortSignal} [signal] - AbortSignal for cancellation.
 * @returns {Promise<Object>} - { sceneText, continuityReport, storyboard }
 */
const runDirectorPipeline = async (brief, runId, signal) => {
  // Helper: check abort between pipeline steps
  const abortCheck = () => {
    if (signal?.aborted) {
      throw new Error('Pipeline aborted')
    }
  }

  // Helper: persist intermediate progress via targeted $set update.
  // Save failures must not kill the pipeline.
  const saveProgress = async (fields) => {
    await PipelineRun.updateOne({ _id: runId }, { $set: fields }).catch(() => {})
  }

  // Step 1: Screenplay
  abortCheck()
  await saveProgress({ agentStatus: 'screenplay' })
  console.log('[Director] Running Screenplay agent...')
  const sceneText = await runScreenplayAgent(brief)
  console.log('[Director] Screenplay complete.')

  // Persist screenplay result + move to next agent
  abortCheck()
  await saveProgress({ sceneText, agentStatus: 'continuity' })

  // Step 2: Continuity & Legal Risk
  console.log('[Director] Running Continuity & Legal Risk agent...')
  const continuityReport = await runContinuityAgent(sceneText, signal)
  console.log('[Director] Continuity complete.')

  // Normalise and persist continuity result + move to next agent
  const continuityClaims = Array.isArray(continuityReport?.claims)
    ? continuityReport.claims.map(normaliseClaim)
    : []
  const continuityOverallRisk = closestEnum(
    continuityReport?.overallRisk,
    VALID_RISK,
    'low'
  )
  const continuitySummary = safeStr(continuityReport?.summary, '')

  abortCheck()
  await saveProgress({
    continuityClaims,
    continuitySummary,
    continuityOverallRisk,
    agentStatus: 'storyboard',
  })

  // Step 3: Storyboard
  console.log('[Director] Running Storyboard agent...')
  const storyboard = await runStoryboardAgent(sceneText, continuityReport)
  console.log('[Director] Storyboard complete.')

  return {
    sceneText,
    continuityReport,
    storyboard,
  }
}

module.exports = runDirectorPipeline
