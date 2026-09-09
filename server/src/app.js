const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const errorHandler = require('./middleware/errorHandler')
const pipelineRoutes = require('./routes/pipelineRoutes')
const env = require('./config/env')

const app = express()

// Security headers (Phase 3).
app.use(helmet())

// CORS allowlist — CORS_ORIGIN is a comma-separated list of allowed browser
// origins (defaults to local Vite dev only). Requests with no Origin header
// (curl, server-to-server health checks, Cloud Run's own probes) are allowed
// through since they aren't subject to the browser's same-origin policy.
const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error(`Origin "${origin}" is not allowed by CORS.`))
    },
  })
)

// A brief is at most BRIEF_MAX_CHARS (enforced again in the controller); a
// generous-but-bounded body limit stops obviously abusive payloads before
// they even reach JSON parsing.
app.use(express.json({ limit: '32kb' }))
app.use(express.urlencoded({ extended: true, limit: '32kb' }))

// Health check — deliberately ahead of rate limiting; Cloud Run polls this
// to decide whether the instance is alive.
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

// Routes
app.use('/api/pipeline', pipelineRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found and Server is Running.` })
})

// Global error handler — must be last
app.use(errorHandler)

module.exports = app
