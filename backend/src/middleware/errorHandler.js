/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
  // Log the error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Default error
  let error = {
    message: 'Internal Server Error',
    status: 500
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error.message = err.message;
    error.status = 400;
  } else if (err.name === 'UnauthorizedError') {
    error.message = 'Unauthorized';
    error.status = 401;
  } else if (err.message.includes('not found')) {
    error.message = 'Resource not found';
    error.status = 404;
  } else if (err.message.includes('rate limit')) {
    error.message = 'Rate limit exceeded';
    error.status = 429;
  } else if (err.message.includes('Redis')) {
    error.message = 'Service temporarily unavailable';
    error.status = 503;
  }

  // In development, include stack trace
  if (process.env.NODE_ENV === 'development') {
    error.stack = err.stack;
  }

  res.status(error.status).json({
    error: error.message,
    timestamp: new Date().toISOString(),
    ...(error.stack && { stack: error.stack })
  });
}

module.exports = errorHandler;