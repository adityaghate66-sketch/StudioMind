const { generate } = require('../../services/gemini/textGeneration')
const screenplayPrompt = require('../../prompts/screenplayPrompt')

/**
 * Screenplay agent: takes a brief, returns a scene (150-300 words).
 * @param {string} brief - The user's text brief.
 * @returns {Promise<string>} - The scene text.
 */
const runScreenplayAgent = async (brief) => {
  const prompt = screenplayPrompt(brief)
  const sceneText = await generate({ prompt, expectJson: false })
  return sceneText
}

module.exports = runScreenplayAgent
