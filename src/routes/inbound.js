const express = require("express");
const logger = require("../lib/logger");
const { addMessage } = require("../lib/messageLog");
const { logInboundSms } = require("../services/ghl");

const router = express.Router();

router.post("/inbound", async (req, res) => {
  const eventType = req.body?.data?.event_type;
  const payload = req.body?.data?.payload || {};
  const from = payload?.from?.phone_number;
  const to = Array.isArray(payload?.to) ? payload.to[0]?.phone_number : payload?.to?.phone_number;
  const message = payload?.text || "";

  try {
    if (eventType && eventType !== "message.received") {
      logger.log(`Ignoring Telnyx event type: ${eventType}`);
      return res.status(200).json({ success: true, ignored: true });
    }

    if (!from || !message) {
      logger.log("Inbound webhook missing sender or message text");
      return res.status(200).json({ success: false, error: "Missing sender or message text" });
    }

    logger.log(`Inbound SMS received from ${from}`);

    const result = await logInboundSms({ phone: from, message });

    addMessage({
      direction: "IN",
      from,
      to,
      message,
      contactId: result.contactId
    });

    logger.log(`Inbound SMS logged to GHL for ${from}`, { contactId: result.contactId });

    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Inbound SMS processing failed", err);

    addMessage({
      direction: "IN",
      from,
      to,
      message,
      status: "error",
      error: err.message || "Inbound processing failed"
    });

    return res.status(200).json({ success: false, error: "Inbound webhook accepted but processing failed" });
  }
});

module.exports = router;

