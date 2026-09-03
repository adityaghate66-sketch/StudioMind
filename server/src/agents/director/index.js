const runScreenplayAgent = require('../screenplay')
const runContinuityAgent = require('../continuity')
const runStoryboardAgent = require('../storyboard')

/**
 * Director agent: orchestrates the full pipeline.
 * brief -> Screenplay -> Continuity & Legal Risk -> Storyboard
 *
 * Each step's output feeds into the next. If any step fails, the error is thrown.
 * When a `run` document is passed, the agent writes progress to it after each step
 * so the frontend can poll for live status.
 *
 * @param {string} brief - The user's text brief.
 * @param {Object} [run] - Optional Mongoose PipelineRun document to update in-place.
 * @returns {Promise<Object>} - { sceneText, continuityReport, storyboard }
 */
const runDirectorPipeline = async (brief, run) => {
  // Helper: update agent status on the run doc (fire-and-forget)
  const setAgentStatus = async (agent) => {
    if (run) {
      run.agentStatus = agent
      await run.save().catch(() => {}) // don't let a save failure kill the pipeline
    }
  }

  // Step 1: Screenplay
  await setAgentStatus('screenplay')
  console.log('[Director] Running Screenplay agent...')
  const sceneText = await runScreenplayAgent(brief)
  console.log('[Director] Screenplay complete.')

  // Step 2: Continuity & Legal Risk
  await setAgentStatus('continuity')
  console.log('[Director] Running Continuity & Legal Risk agent...')
  const continuityReport = await runContinuityAgent(sceneText)
  console.log('[Director] Continuity complete.')

  // Step 3: Storyboard
  await setAgentStatus('storyboard')
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
