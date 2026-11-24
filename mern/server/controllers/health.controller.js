const mongoose = require("mongoose");

function getHealth(req, res) {
  const connected = mongoose.connection.readyState === 1;
  return res.status(connected ? 200 : 503).json({
    success: connected,
    application: "Campus Care MERN API",
    database: connected ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString()
  });
}

module.exports = { getHealth };
