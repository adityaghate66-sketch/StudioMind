const runScreenplayAgent = require('../screenplay')
const runContinuityAgent = require('../continuity')
const runStoryboardAgent = require('../storyboard')

/**
 * Director agent: orchestrates the full pipeline.
 * brief -> Screenplay -> Continuity & Legal Risk -> Storyboard
 *
 * Each step's output feeds into the next. If any step fails, the error is thrown.
 *
 * @param {string} brief - The user's text brief.
 * @returns {Promise<Object>} - { sceneText, continuityReport, storyboard }
 */
const runDirectorPipeline = async (brief) => {
  // Step 1: Screenplay
  console.log('[Director] Running Screenplay agent...')
  const sceneText = await runScreenplayAgent(brief)
  console.log('[Director] Screenplay complete.')

  // Step 2: Continuity & Legal Risk
  console.log('[Director] Running Continuity & Legal Risk agent...')
  const continuityReport = await runContinuityAgent(sceneText)
  console.log('[Director] Continuity complete.')

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
