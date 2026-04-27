/**
 * Request logging middleware
 */
function logger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    
    // Call original json method
    return originalJson.call(this, body);
  };

  next();
}

module.exports = logger;