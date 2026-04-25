function success(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function error(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

function apiError(res, message, type = 'invalid_request_error', httpStatus = 400) {
  return res.status(httpStatus).json({
    error: { message, type },
  });
}

module.exports = { success, error, apiError };
