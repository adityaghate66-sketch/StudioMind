const { generate } = require('../../services/gemini/textGeneration')
const storyboardPrompt = require('../../prompts/storyboardPrompt')
const storyboardSchema = require('../../schemas/storyboard')

/**
 * Storyboard agent: turns a scene + continuity report into a 4-8 shot list.
 * @param {string} sceneText - The screenplay scene text.
 * @param {Object} continuityReport - The continuity synthesis result.
 * @returns {Promise<Object>} - { shots: [...], totalShots }
 */
const runStoryboardAgent = async (sceneText, continuityReport) => {
  const prompt = storyboardPrompt(sceneText, continuityReport)
  const result = await generate({ prompt, expectJson: true, schema: storyboardSchema })
  return result
}

module.exports = runStoryboardAgent
