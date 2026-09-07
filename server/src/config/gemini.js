const { GoogleGenAI } = require('@google/genai')
const env = require('./env')

let genaiClient = null

/**
 * Build (once) and return the Gemini client.
 *
 * Two transport paths satisfy the SAME generate() interface, so agents never
 * change:
 *
 * 1. Default (USE_VERTEX unset/false) — the public Gemini API keyed by
 *    GEMINI_API_KEY (Google AI Studio).
 * 2. USE_VERTEX=true — Vertex AI (Gemini Enterprise Agent Platform) using the
 *    project's attached credentials. On Cloud Run that is the instance's
 *    service account (ADC, no key file in the image); locally it needs
 *    `gcloud auth application-default login`.
 *
 * Vertex auth is handled inside the SDK via google-auth-library (ADC chain:
 * GOOGLE_APPLICATION_CREDENTIALS -> gcloud ADC -> metadata server).
 */
const getGeminiClient = () => {
  if (!genaiClient) {
    if (env.USE_VERTEX) {
      genaiClient = new GoogleGenAI({
        vertexai: true,
        project: env.GCP_PROJECT_ID,
        location: env.GCP_LOCATION,
      })
    } else {
      if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in environment variables')
      }
      genaiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
    }
  }
  return genaiClient
}

module.exports = { getGeminiClient }
