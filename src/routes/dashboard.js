const express = require("express");
const fs = require("fs");
const path = require("path");
const { config, getConfigStatus } = require("../lib/config");
const { getMessages } = require("../lib/messageLog");

const router = express.Router();
const dashboardPath = path.join(__dirname, "..", "dashboard", "index.html");

function getDashboardData() {
  return {
    status: "ok",
    uptime: Math.floor(process.uptime()),
    telnyxNumber: config.telnyx.phoneNumber,
    locationId: config.ghl.locationId,
    config: getConfigStatus(),
    messages: getMessages(20)
  };
}

router.get("/", (req, res) => {
  const html = fs.readFileSync(dashboardPath, "utf8");
  res.type("html").send(html.replace("__DASHBOARD_DATA_JSON__", JSON.stringify(getDashboardData())));
});

router.get("/dashboard.json", (req, res) => {
  res.json(getDashboardData());
});

module.exports = router;
