const rateLimit = require('express-rate-limit')

/**
 * Rate limits for the pipeline API (Phase 3).
 *
 * A pipeline run chains multiple Gemini calls and several sequential Parallel
 * Search calls — it is the expensive path and the one worth protecting, since
 * the Gemini/Parallel quota has to survive until October judging.
 *
 * GET is left generous: the frontend polls GET /runs/:id roughly every 2s
 * while a run is in flight, so a tight GET limit would break normal use.
 */

const createRunLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many pipeline runs from this IP. Please try again later.',
  },
})

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = { createRunLimiter, readLimiter }
