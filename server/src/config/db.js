const mongoose = require('mongoose')
const env = require('./env')

const connectDB = async () => {
  if (!env.MONGO_URI) {
    console.warn('⚠️  MONGO_URI is not set — running without database. Pipeline runs will not persist.')
    return
  }

  try {
    const conn = await mongoose.connect(env.MONGO_URI)
    console.log(`MongoDB Connected: ${conn.connection.host}`)
  } catch (error) {
    console.error('Database Connection Failed:', error.message)
    throw error
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('Database disconnected')
})

process.on('SIGTERM', async () => {
  await mongoose.connection.close()
  console.log('Database connection closed due to app termination')
  process.exit(0)
})

module.exports = connectDB
