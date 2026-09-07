const { getGeminiClient } = require('../../config/gemini')
const env = require('../../config/env')

/**
 * Generate text using Gemini.
 * @param {Object} options
 * @param {string} options.prompt - The full prompt to send.
 * @param {boolean} [options.expectJson=false] - If true, request JSON output and parse it.
 * @param {Object} [options.schema] - Optional JSON schema the model is constrained to follow
 *   (passed as config.responseSchema, requires responseMimeType: application/json).
 *   Define these in server/src/schemas/ — one per JSON-returning agent step.
 * @param {string} [options.model] - Model to use. Defaults to env.GEMINI_MODEL,
 *   then 'gemini-3.6-flash'.
 * @returns {Promise<string|object>} - Raw text or parsed JSON.
 */
const generate = async ({ prompt, expectJson = false, model, schema }) => {
  const resolvedModel = model || env.GEMINI_MODEL || 'gemini-3.6-flash'
  const genai = getGeminiClient()

  const config = {}
  // A responseSchema only makes sense with a JSON mime type, so a schema implies JSON output.
  if (expectJson || schema) {
    config.responseMimeType = 'application/json'
  }
  if (schema) {
    config.responseSchema = schema
  }

  const response = await genai.models.generateContent({
    model: resolvedModel,
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
