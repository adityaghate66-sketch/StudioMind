require('dotenv').config()

// USE_VERTEX is opt-in: value 'true' (case-insensitive) switches the Gemini
// transport from the public API key to Vertex AI (ADC auth). See config/gemini.js.
const USE_VERTEX = String(process.env.USE_VERTEX).toLowerCase() === 'true'

const env = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  PARALLEL_API_KEY: process.env.PARALLEL_API_KEY || '',
  PIPELINE_TIMEOUT_MS: Number(process.env.PIPELINE_TIMEOUT_MS) || 300_000,
  // Optional override for the Gemini model. Locally this resolved to
  // 'gemini-3.5-flash' (the free-tier default gemini-3.6-flash was exhausted
  // and gemini-flash-latest 503s on schema-constrained JSON). On Vertex the
  // same override picks the Vertex model ID.
  GEMINI_MODEL: process.env.GEMINI_MODEL || '',
  // Vertex AI transport (only consulted when USE_VERTEX=true).
  USE_VERTEX,
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || '',
  GCP_LOCATION: process.env.GCP_LOCATION || 'us-central1',
}

/**
 * Validate that every required env var is set.
 * Call this once at boot — before the server or DB is touched.
 * Throws with a message naming the specific missing variable.
 *
 * MONGO_URI and PARALLEL_API_KEY are always required. The Gemini credential
 * is conditional: GEMINI_API_KEY for the public API path, GCP_PROJECT_ID
 * (with the ADC credentials behind it) for the Vertex path.
 */
const validate = () => {
  const required = {
    MONGO_URI: env.MONGO_URI,
    PARALLEL_API_KEY: env.PARALLEL_API_KEY,
  }

  if (env.USE_VERTEX) {
    required.GCP_PROJECT_ID = env.GCP_PROJECT_ID
  } else {
    required.GEMINI_API_KEY = env.GEMINI_API_KEY
  }

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k)

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`
    )
  }
}

module.exports = env
module.exports.validate = validate
