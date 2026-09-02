const { getGeminiClient } = require('../../config/gemini')

/**
 * Generate text using Gemini.
 * @param {Object} options
 * @param {string} options.prompt - The full prompt to send.
 * @param {boolean} [options.expectJson=false] - If true, request JSON output.
 * @param {string} [options.model='gemini-2.5-flash'] - Model to use.
 * @returns {Promise<string|object>} - Raw text or parsed JSON.
 */
const generate = async ({ prompt, expectJson = false, model = 'gemini-2.5-flash' }) => {
  const genai = getGeminiClient()

  const config = {}
  if (expectJson) {
    config.responseMimeType = 'application/json'
  }

  const response = await genai.models.generateContent({
    model,
    contents: prompt,
    config,
  })

  const text = response.text

  if (expectJson) {
    try {
      return JSON.parse(text)
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim())
      }
      throw new Error('Failed to parse Gemini response as JSON')
    }
  }

  return text
}

module.exports = { generate }
