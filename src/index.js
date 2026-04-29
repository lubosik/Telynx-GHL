const express = require("express");
const { config } = require("./lib/config");
const logger = require("./lib/logger");
const healthRoutes = require("./routes/health");
const outboundRoutes = require("./routes/outbound");
const inboundRoutes = require("./routes/inbound");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(healthRoutes);
app.use(outboundRoutes);
app.use(inboundRoutes);
app.use(dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

app.use((err, req, res, next) => {
  logger.error("Unhandled Express error", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

app.listen(config.port, () => {
  logger.log(`Telnyx GHL bridge listening on port ${config.port}`);
});

