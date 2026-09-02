const { generate } = require('../../services/gemini/textGeneration')
const storyboardPrompt = require('../../prompts/storyboardPrompt')

/**
 * Storyboard agent: turns a scene + continuity report into a 4-8 shot list.
 * @param {string} sceneText - The screenplay scene text.
 * @param {Object} continuityReport - The continuity synthesis result.
 * @returns {Promise<Object>} - { shots: [...], totalShots }
 */
const runStoryboardAgent = async (sceneText, continuityReport) => {
  const prompt = storyboardPrompt(sceneText, continuityReport)
  const result = await generate({ prompt, expectJson: true })
  return result
}

module.exports = runStoryboardAgent
