const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message)

  // body-parser (express.json/urlencoded) throws entity.too.large etc. with
  // `err.status`, not `err.statusCode` — check both so an oversized request
  // body maps to its real HTTP status instead of falling through to 500.
  const status = err.statusCode || err.status || 500

  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
  })
}

module.exports = errorHandler
