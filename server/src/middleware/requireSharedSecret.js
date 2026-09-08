const env = require('../config/env')

/**
 * Optional shared-secret gate for POST /api/pipeline/runs (Phase 3).
 *
 * Skipped entirely when APP_SHARED_SECRET is unset — local dev and the
 * existing frontend contract are unaffected until this is deliberately
 * turned on. When it IS set, the frontend must send the same value in an
 * `x-studiomind-key` header. Tell Ajay before enabling this in production;
 * it changes his fetch call.
 */
const requireSharedSecret = (req, res, next) => {
  if (!env.APP_SHARED_SECRET) return next()

  const provided = req.header('x-studiomind-key')
  if (provided && provided === env.APP_SHARED_SECRET) return next()

  return res.status(401).json({
    success: false,
    message: 'Missing or invalid x-studiomind-key header.',
  })
}

module.exports = requireSharedSecret
