require('./config/env')
const app = require('./app')
const connectDB = require('./config/db')
const env = require('./config/env')

const start = async () => {
  // Validate required env vars before touching the DB or the network.
  // Throws immediately if MONGO_URI, GEMINI_API_KEY, or PARALLEL_API_KEY is missing.
  env.validate()

  // Connect to MongoDB
  await connectDB()

  app.listen(env.PORT, () => {
    console.log(`StudioMind server running on port ${env.PORT}`)
  })
}

start().catch((err) => {
  console.error(`Startup failed: ${err.message}`)
  process.exit(1)
})
