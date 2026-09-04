const Parallel = require('parallel-web')
const env = require('../../config/env')

/**
 * Verify a claim using Parallel's official Search API.
 *
 * Implementation note (verified against https://docs.parallel.ai/api-reference/search/search
 * and the parallel-web SDK types, Sept 2026): the SDK posts to POST https://api.parallel.ai/v1/search
 * with the `x-api-key` header. The request body accepted by V1 is:
 *
 *   {
 *     search_queries: string[],                    // REQUIRED — 3-6 word keyword queries; provide 2-3
 *     objective: string,                           // natural-language goal of the search
 *     mode: 'turbo' | 'fast' | 'basic' | 'advanced', // defaults to 'advanced' server-side
 *     max_chars_total: number,                     // optional cap on excerpt characters (not used here)
 *     advanced_settings: {
 *       max_results: number,                       // cap on number of results (default 10)
 *       excerpt_settings: { max_chars_per_result } // optional; excerpts are ON by default
 *     }
 *   }
 *
 *   WARNING — this object is strict (additionalProperties: false). Beta-era top-level fields
 *   `max_results` and `excerpts` will be rejected with HTTP 422. That is why this function maps
 *   maxResults -> advanced_settings.max_results and does not send an excerpt count at all:
 *   V1 always returns excerpts and has no per-result excerpt-count parameter.
 *
 * CONFIRMED RESPONSE SHAPE — this function returns the raw V1 Search response untouched.
 * The continuity synthesis prompt receives exactly this object per claim, as the claim's
 * `verification` value:
 *
 *   {
 *     search_id: string,                     // e.g. "search_8a911eb..."
 *     session_id: string,                    // e.g. "session_8a911eb..." (echoed or generated)
 *     results: [                             // ordered by decreasing relevance
 *       {
 *         url: string,                       // ← the source URL for a claim's "sources" list
 *         title: string | null,
 *         publish_date: string | null,       // "YYYY-MM-DD" when available, else null
 *         excerpts: string[],                // ← markdown evidence text; the actual page content
 *       }
 *     ],
 *     warnings: [...] | null,                // non-fatal input adjustments, if any
 *     usage: [{ name: string, count: number }] | null,
 *   }
 *
 * Errors are normalized so the HTTP status AND the full response body end up in the thrown
 * error's message — a misconfigured request now shows up loudly in logs instead of silently
 * degrading every claim to "verification_failed".
 *
 * @param {Object} options
 * @param {string} options.objective - What to verify about the claim (natural language).
 * @param {string[]} options.searchQueries - Keyword search queries to run against the web.
 * @param {string} [options.mode='fast'] - Search mode: 'turbo', 'fast', 'basic', or 'advanced'.
 *   ('fast' ≈ 700ms high-quality; 'advanced' is the highest-quality default but ~3s.)
 * @param {number} [options.maxResults=5] - Max results to request (mapped to advanced_settings.max_results).
 * @param {number} [options.excerpts] - DEPRECATED, accepted only for signature compatibility.
 *   V1 removed the per-result excerpt-count parameter; results always include excerpts.
 * @param {AbortSignal} [options.signal] - AbortSignal for pipeline cancellation.
 * @returns {Promise<Object>} - Raw Parallel V1 Search response (shape documented above).
 */
const verifyClaim = async ({ objective, searchQueries, mode = 'fast', maxResults = 5, signal }) => {
  if (!env.PARALLEL_API_KEY) {
    throw new Error('PARALLEL_API_KEY is not set in environment variables')
  }

  try {
    return await getClient().search(
      {
        objective,
        search_queries: searchQueries,
        mode,
        advanced_settings: { max_results: maxResults },
      },
      // RequestOptions — carries the AbortSignal used for pipeline cancellation.
      { signal }
    )
  } catch (err) {
    // parallel-web throws typed APIError subclasses (AuthenticationError, UnprocessableEntityError,
    // RateLimitError, ...) for non-2xx responses; err.status is the HTTP status and err.error is the
    // parsed response body. Normalize them into a single message so logs are self-explanatory.
    if (typeof err.status === 'number') {
      const body = err.error
      const detail = body && body.error ? body.error : body
      // 422 = strict request validation (additionalProperties: false) — a schema drift shows up here.
      const hint =
        err.status === 422
          ? ' — check request field names against https://docs.parallel.ai/api-reference/search/search'
          : ''
      throw new Error(
        `Parallel Search API error (HTTP ${err.status}): ${detail && detail.message ? detail.message : err.message}` +
          (body ? ` Response body: ${JSON.stringify(body)}` : '') +
          hint
      )
    }
    // Anything else (request aborted via signal, connection failure) passes through unchanged.
    throw err
  }
}

let client = null

// Build the SDK client once and reuse it (same convention as config/gemini.js).
// apiKey defaults to process.env.PARALLEL_API_KEY, but we pass it explicitly from env.js.
const getClient = () => {
  if (!client) {
    client = new Parallel({ apiKey: env.PARALLEL_API_KEY })
  }
  return client
}

module.exports = { verifyClaim }
