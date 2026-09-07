require('dotenv').config()

const env = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  PARALLEL_API_KEY: process.env.PARALLEL_API_KEY || '',
  PIPELINE_TIMEOUT_MS: Number(process.env.PIPELINE_TIMEOUT_MS) || 120_000,
  // Optional override for the Gemini model (textGeneration.js defaults to
  // 'gemini-3.6-flash'); handy when a model is rate-limited or deprecated.
  GEMINI_MODEL: process.env.GEMINI_MODEL || '',
}

/**
 * Validate that every required env var is set.
 * Call this once at boot — before the server or DB is touched.
 * Throws with a message naming the specific missing variable.
 */
const validate = () => {
  const required = {
    MONGO_URI: env.MONGO_URI,
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    PARALLEL_API_KEY: env.PARALLEL_API_KEY,
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
