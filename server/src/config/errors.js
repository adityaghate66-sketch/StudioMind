/**
 * Shared error-classification and retry helpers.
 *
 * The acceptance harness already knows how to decide whether a failure is a
 * transient API/network spike (503/429, DNS, socket, timeout) vs a real
 * schema/validation failure that should fail immediately. This module is the
 * single source of truth for that decision so the production path doesn't
 * invent a second, subtly different heuristic.
 *
 * Rules baked into isTransient:
 *  - 429 / 5xx / quota / "high demand" / "rate limit"         → retry
 *  - DNS / socket / connection resets / timeouts               → retry
 *  - Anything HTTP 4xx that is NOT 429                          → NOT retryable
 *  - Schema parsing errors, validation errors, bad JSON         → NOT retryable
 */

/** HTTP status codes that plausibly resolve on retry. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

/**
 * Return true when `err` looks like a transient API/network failure that is
 * worth retrying, false when it looks like a real bug / bad request / bad
 * response from the model.
 */
const isTransient = (err) => {
  if (!err || typeof err !== 'object') return false

  // Explicit HTTP status from a typed SDK error (Parallel APIError,
  // Gemini API errors that carry status, etc.).
  const status = err.status
  if (typeof status === 'number') {
    // Only 429 and 5xx are transient. 400/401/403/422 = our problem.
    if (status === 429) return true
    if (RETRYABLE_STATUSES.has(status)) return true
    return false
  }

  // Fall back to the message text, the way the acceptance harness does.
  const msg = err.message ? String(err.message) : ''
  if (!msg) return false

  const transient = /503|429|UNAVAILABLE|high demand|rate limit|too many requests|ETIMEDOUT|ECONNRESET|fetch failed|ENOTFOUND|socket hang up|timeout/i.test(msg)
  const notTransient = /json parse|response could not be parsed|failed to parse|validation|invalid|unprocessable|bad request|400|401|403|422/i.test(msg)

  // If the message screams "bad request / bad response", do not retry it.
  if (notTransient) return false
  return transient
}

/**
 * Try to read a retry delay the API itself suggested, in seconds.
 * Honors the SDK/provider RetryInfo retryDelay when present, otherwise
 * falls back to the harness's "retry in Ns" phrasing.
 *
 * Returns a positive number, or null when there is no usable hint.
 */
const extractRetryDelay = (err) => {
  if (!err || !err.message) return null

  const msg = err.message
  const fromRetryInfo = msg.match(/retryDelay[\s:]+"?([\d.]+)/i)
  if (fromRetryInfo) {
    const secs = Number(fromRetryInfo[1])
    if (Number.isFinite(secs) && secs > 0) return secs
  }

  const fromPhrase = msg.match(/retry in ([\d.]+)s/i)
  if (fromPhrase) {
    const secs = Number(fromPhrase[1])
    if (Number.isFinite(secs) && secs > 0) return secs
  }

  return null
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff (4 attempts). Only transient failures are
// retried; schema / validation / parse errors fail immediately.
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 4
const BASE_DELAY_MS = 5000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const withRetry = async (label, fn, { signal } = {}) => {
  let lastTransient = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal && signal.aborted) {
      const reason = signal.reason ? String(signal.reason) : 'aborted'
      throw Object.assign(new Error(`Cancelled: ${label} (${reason})`), { statusCode: 503 })
    }

    try {
      return await fn()
    } catch (err) {
      // If the inner call already propagated a cancellation, do not retry it.
      if (signal && signal.aborted) {
        const reason = signal.reason ? String(signal.reason) : 'aborted'
        throw Object.assign(new Error(`Cancelled: ${label} (${reason})`), { statusCode: 503 })
      }

      if (!isTransient(err)) throw err

      lastTransient = err

      if (attempt === MAX_ATTEMPTS) throw err

      const hint = extractRetryDelay(err)
      // Honor the API's own retryDelay when present; otherwise exponential backoff.
      const backoffSec = hint != null ? hint : BASE_DELAY_MS / 1000 * attempt
      const delayMs = Math.round(backoffSec * 1000 * 1.2)

      console.warn(
        `[retry:${label}] transient error (attempt ${attempt}/${MAX_ATTEMPTS}); ` +
        `retrying in ${delayMs}ms — ${err.message.split('\n')[0]}`
      )

      await sleep(delayMs)
    }
  }
}

module.exports = { isTransient, extractRetryDelay, withRetry }
