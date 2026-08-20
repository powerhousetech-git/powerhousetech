function jsonError(res, status, message, extra) {
  return res.status(status).json({ error: message, ...(extra || {}) });
}

function errorHandler(err, _req, res, _next) {
  console.error('[portal]', err);

  if (err && err.code === 'P2002') {
    return jsonError(res, 409, 'Contact already exists for this domain + name', {
      code: 'DUPLICATE',
    });
  }
  if (err && err.code === 'P2025') {
    return jsonError(res, 404, 'Contact not found');
  }

  const status = err.status || err.statusCode || 500;
  return jsonError(
    res,
    status,
    err.message || 'Unexpected server error',
  );
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler, jsonError };
