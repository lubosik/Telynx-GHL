const express = require("express");
const logger = require("../lib/logger");
const { addMessage, updateMessageByProviderId } = require("../lib/messageLog");
const { logInboundSms } = require("../services/ghl");

const router = express.Router();

function getTelnyxError(payload = {}, toEntry = {}) {
  const error = payload.errors?.[0] || toEntry.errors?.[0];
  if (!error) return "";

  return [error.code, error.title, error.detail].filter(Boolean).join(" - ");
}

function getDeliveryStatus(payload = {}) {
  const toEntry = Array.isArray(payload.to) ? payload.to[0] || {} : payload.to || {};

  return {
    providerId: payload.id || "",
    from: payload.from?.phone_number || "",
    to: toEntry.phone_number || "",
    message: payload.text || "",
    providerStatus: toEntry.status || payload.status || "",
    error: getTelnyxError(payload, toEntry)
  };
}

function isDeliveryEvent(eventType = "") {
  return eventType === "message.sent" || eventType === "message.delivered" || eventType === "message.finalized";
}

router.post("/inbound", async (req, res) => {
  const eventType = req.body?.data?.event_type;
  const payload = req.body?.data?.payload || {};
  const from = payload?.from?.phone_number;
  const to = Array.isArray(payload?.to) ? payload.to[0]?.phone_number : payload?.to?.phone_number;
  const message = payload?.text || "";

  try {
    if (isDeliveryEvent(eventType)) {
      const delivery = getDeliveryStatus(payload);
      const isFailure = ["delivery_failed", "sending_failed", "failed", "gw_timeout", "dlr_timeout"].includes(delivery.providerStatus);
      const status = isFailure ? "error" : delivery.providerStatus === "delivered" ? "delivered" : "submitted";

      if (delivery.providerId) {
        const updated = updateMessageByProviderId(delivery.providerId, {
          status,
          providerStatus: delivery.providerStatus,
          providerEvent: eventType,
          error: delivery.error
        });

        if (!updated) {
          addMessage({
            direction: "OUT",
            from: delivery.from,
            to: delivery.to,
            message: delivery.message,
            status,
            providerStatus: delivery.providerStatus,
            providerEvent: eventType,
            providerId: delivery.providerId,
            error: delivery.error
          });
        }
      }

      logger.log(`Telnyx delivery event: ${eventType}`, {
        messageId: delivery.providerId,
        providerStatus: delivery.providerStatus,
        error: delivery.error
      });

      return res.status(200).json({ success: true });
    }

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
