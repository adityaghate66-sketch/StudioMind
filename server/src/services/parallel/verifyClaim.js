const env = require('../../config/env')

const PARALLEL_API_URL = 'https://api.parallel.ai/v1/search'

/**
 * Verify a claim using Parallel's Search API.
 * @param {Object} options
 * @param {string} options.objective - What to verify about the claim.
 * @param {string[]} options.searchQueries - Search queries to run.
 * @param {string} [options.mode='fast'] - Search mode: 'fast', 'advanced', or 'turbo'.
 * @param {number} [options.maxResults=5] - Max search results to return.
 * @param {number} [options.excerpts=3] - Max excerpts per result.
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation.
 * @returns {Promise<Object>} - Parallel search response.
 */
const verifyClaim = async ({ objective, searchQueries, mode = 'fast', maxResults = 5, excerpts = 3, signal }) => {
  if (!env.PARALLEL_API_KEY) {
    throw new Error('PARALLEL_API_KEY is not set in environment variables')
  }

  const response = await fetch(PARALLEL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.PARALLEL_API_KEY,
    },
    body: JSON.stringify({
      objective,
      search_queries: searchQueries,
      mode,
      max_results: maxResults,
      excerpts,
    }),
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Parallel API error (${response.status}): ${errorBody}`)
  }

  return response.json()
}

module.exports = { verifyClaim }
