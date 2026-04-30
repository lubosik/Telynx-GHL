const express = require("express");
const { config } = require("../lib/config");
const logger = require("../lib/logger");
const { addMessage } = require("../lib/messageLog");
const { getSenderForDestination, sendSms } = require("../services/telnyx");

const router = express.Router();

function isAuthorized(req) {
  if (!config.webhookSecret) return true;

  const providedSecret = req.get("x-webhook-secret") || req.body?.webhookSecret || req.query?.secret;
  return providedSecret === config.webhookSecret;
}

function getOutboundPayload(body = {}) {
  const customData = body.customData || body.custom_data || body.data?.customData || {};

  return {
    to: body.to || customData.to || body.phone || body.contact?.phone,
    message: body.message || customData.message || body.text || customData.text,
    contactId: body.contactId || body.contactID || customData.contactId || customData.contactID || body.contact?.id
  };
}

router.post("/send", async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ success: false, error: "Unauthorized webhook request" });
    }

    const { to, message, contactId } = getOutboundPayload(req.body);

    if (!to || !message) {
      logger.log("Outbound webhook missing required fields", {
        bodyKeys: Object.keys(req.body || {}),
        customDataKeys: Object.keys(req.body?.customData || req.body?.custom_data || {})
      });

      return res.status(400).json({ success: false, error: "Missing required fields: to, message" });
    }

    logger.log(`Outbound SMS requested for ${to}`);

    const from = getSenderForDestination(to);
    const telnyxMessage = await sendSms({ to, message });
    const messageId = telnyxMessage?.id || "";
    const providerStatus = telnyxMessage?.to?.[0]?.status || telnyxMessage?.status || "accepted";

    addMessage({
      direction: "OUT",
      from,
      to,
      message,
      status: "submitted",
      providerStatus,
      providerEvent: "api.accepted",
      providerId: messageId,
      contactId
    });

    logger.log(`Outbound SMS submitted to Telnyx for ${to}`, { messageId, providerStatus });

    return res.json({ success: true, messageId, status: providerStatus });
  } catch (err) {
    const errorMessage = err?.response?.data?.errors?.[0]?.detail || err?.response?.data?.message || err.message || "Telnyx send failed";
    logger.error("Outbound SMS failed", err);

    return res.status(err.statusCode || 500).json({ success: false, error: errorMessage });
  }
});

module.exports = router;
