const express = require("express");
const { config } = require("../lib/config");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    telnyxNumber: config.telnyx.phoneNumber,
    locationId: config.ghl.locationId
  });
});

module.exports = router;

