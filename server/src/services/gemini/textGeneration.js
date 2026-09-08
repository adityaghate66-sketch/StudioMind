const { getGeminiClient } = require('../../config/gemini')
const env = require('../../config/env')
const { isTransient, extractRetryDelay, withRetry } = require('../../config/errors')

/**
 * Generate text using Gemini.
 *
 * Production note (Phase 2): the underlying network call is wrapped in retry
 * with exponential backoff so a transient 429/503 mid-pipeline does not kill
 * the whole run. Retry is bounded to 4 attempts and respects both the API's
 * own retryDelay when present and the AbortSignal so a pipeline timeout still
 * cancels cleanly.
 *
 * @param {Object} options
 * @param {string} options.prompt - The full prompt to send.
 * @param {boolean} [options.expectJson=false] - If true, request JSON output and parse it.
 * @param {Object} [options.schema] - Optional JSON schema the model is constrained to follow
 *   (passed as config.responseSchema, requires responseMimeType: application/json).
 *   Define these in server/src/schemas/ — one per JSON-returning agent step.
 * @param {string} [options.model] - Model to use. Defaults to env.GEMINI_MODEL,
 *   then 'gemini-3.7-flash' (a model verified to serve schema-constrained JSON;
 *   the older 3.6-flash fallback was exhausted and 503'd on responseSchema).
 * @param {AbortSignal} [options.signal] - Pipeline cancellation signal.
 * @returns {Promise<string|object>} - Raw text or parsed JSON.
 */
const generate = async ({ prompt, expectJson = false, model, schema, signal }) => {
  const resolvedModel = model || env.GEMINI_MODEL || 'gemini-3.7-flash'
  const genai = getGeminiClient()

  const config = {}
  // A responseSchema only makes sense with a JSON mime type, so a schema implies JSON output.
  if (expectJson || schema) {
    config.responseMimeType = 'application/json'
  }
  if (schema) {
    config.responseSchema = schema
  }

  return withRetry(`Gemini ${resolvedModel}`, async () => {
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
  }, { signal })
}

module.exports = { generate }
