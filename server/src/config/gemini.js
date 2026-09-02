const { GoogleGenAI } = require('@google/genai')
const env = require('./env')

let genaiClient = null

const getGeminiClient = () => {
  if (!genaiClient) {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables')
    }
    genaiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  }
  return genaiClient
}

module.exports = { getGeminiClient }
