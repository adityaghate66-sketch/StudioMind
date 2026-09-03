const mongoose = require('mongoose')
const env = require('./env')

const connectDB = async () => {
  // MONGO_URI is validated at boot by env.validate(); if we reach here it is set.
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
