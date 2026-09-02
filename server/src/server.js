require('./config/env')
const app = require('./app')
const connectDB = require('./config/db')
const env = require('./config/env')

const start = async () => {
  // Connect to MongoDB (warns but doesn't crash if MONGO_URI is missing)
  await connectDB()

  app.listen(env.PORT, () => {
    console.log(`StudioMind server running on port ${env.PORT}`)
  })
}

start()
