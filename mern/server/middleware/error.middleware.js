function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message || err);
  const status = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? "Internal server error" : err.message
  });
}

module.exports = { notFound, errorHandler };
