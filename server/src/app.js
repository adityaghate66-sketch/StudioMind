const express = require('express')
const cors = require('cors')
const errorHandler = require('./middleware/errorHandler')
const pipelineRoutes = require('./routes/pipelineRoutes')

const app = express()

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

// Routes
app.use('/api/pipeline', pipelineRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` })
})

// Global error handler — must be last
app.use(errorHandler)

module.exports = app
