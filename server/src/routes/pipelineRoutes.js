const express = require('express')
const router = express.Router()
const { createRun, getRun, listRuns } = require('../controllers/pipelineController')
const requireSharedSecret = require('../middleware/requireSharedSecret')
const { createRunLimiter, readLimiter } = require('../middleware/rateLimiters')

// POST is the expensive path (Gemini + Parallel) — rate limited and,
// optionally, gated behind a shared secret (see requireSharedSecret).
router.post('/runs', createRunLimiter, requireSharedSecret, createRun)

// GET is polled by the frontend every ~2s — generous limiter only.
router.get('/runs/:id', readLimiter, getRun)
router.get('/runs', readLimiter, listRuns)

module.exports = router
