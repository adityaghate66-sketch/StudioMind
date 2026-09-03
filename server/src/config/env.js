require('dotenv').config()

const env = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  PARALLEL_API_KEY: process.env.PARALLEL_API_KEY || '',
  PIPELINE_TIMEOUT_MS: Number(process.env.PIPELINE_TIMEOUT_MS) || 120_000,
}

module.exports = env
