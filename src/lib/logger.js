function timestamp() {
  return new Date().toISOString();
}

function log(message, meta) {
  if (meta) {
    console.log(`[${timestamp()}] ${message}`, meta);
    return;
  }

  console.log(`[${timestamp()}] ${message}`);
}

function error(message, err) {
  const details = err?.response?.data || err?.message || err;
  console.error(`[${timestamp()}] ${message}`, details);
}

module.exports = {
  log,
  error
};

