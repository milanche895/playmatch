// Express 4 ignores promises returned by route handlers, so a thrown error in an
// async handler (e.g. a CastError from an invalid :id) never gets a response and the
// request hangs until the Vercel function times out. This wraps every handler of a
// router so a rejected promise is passed to next(err) instead.
function wrapHandler(handle) {
  // Error handlers (4 args) are left alone, Express detects them by arity
  if (typeof handle !== 'function' || handle.length === 4 || handle.__asyncWrapped) return handle;
  const wrapped = function asyncHandler(req, res, next) {
    try {
      const result = handle.call(this, req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
      return result;
    } catch (err) {
      return next(err);
    }
  };
  wrapped.__asyncWrapped = true;
  return wrapped;
}

function catchAsyncErrors(router) {
  for (const layer of router.stack) {
    if (layer.route) {
      for (const routeLayer of layer.route.stack) {
        routeLayer.handle = wrapHandler(routeLayer.handle);
      }
    } else {
      layer.handle = wrapHandler(layer.handle);
    }
  }
  return router;
}

// Last middleware: always answer with JSON instead of an HTML stack trace.
function apiErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err && err.name === 'CastError') {
    return res.status(404).json({ message: 'Nije pronađeno' });
  }
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Neispravni podaci' });
  }
  if (err && err.name === 'MulterError') {
    return res.status(400).json({
      message: err.code === 'LIMIT_FILE_SIZE' ? 'Fajl je prevelik (maksimum 5MB)' : 'Greška pri otpremanju fajla',
    });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Neispravan JSON' });
  }

  console.error(`API error ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({ message: 'Greška servera' });
}

module.exports = { catchAsyncErrors, apiErrorHandler };
