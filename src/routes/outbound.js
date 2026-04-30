const express = require("express");
const { config } = require("../lib/config");
const { createDedupeKey, markSendFailure, markSendSuccess, reserveSend, waitForSendResult } = require("../lib/dedupe");
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
  let dedupeKey;

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

    dedupeKey = createDedupeKey({ to, message, contactId });
    const reservation = reserveSend(dedupeKey);

    if (reservation.duplicate) {
      const entry = reservation.entry.status === "pending" ? await waitForSendResult(dedupeKey, 20000) : reservation.entry;

      if (!entry) {
        const retryReservation = reserveSend(dedupeKey);
        if (!retryReservation.duplicate) {
          logger.log(`Retrying outbound SMS after previous attempt failed for ${to}`, { contactId });
        } else {
          const existingResponse = retryReservation.entry.response || { success: true, status: "pending" };

          logger.log(`Duplicate outbound SMS suppressed for ${to}`, {
            contactId,
            messageId: existingResponse.messageId || "",
            dedupeStatus: retryReservation.entry.status
          });

          return res.json({
            ...existingResponse,
            success: true,
            duplicate: true,
            dedupeStatus: retryReservation.entry.status
          });
        }
      } else if (entry.status === "pending" && !entry.response) {
        logger.log(`Duplicate outbound SMS is waiting on original send for ${to}`, { contactId });

        return res.status(503).json({
          success: false,
          error: "Original send is still pending; retry later",
          duplicate: true,
          dedupeStatus: "pending"
        });
      } else {
        const existingResponse = entry.response || { success: true, status: "pending" };

        logger.log(`Duplicate outbound SMS suppressed for ${to}`, {
          contactId,
          messageId: existingResponse.messageId || "",
          dedupeStatus: entry.status
        });

        return res.json({
          ...existingResponse,
          success: true,
          duplicate: true,
          dedupeStatus: entry.status
        });
      }
    }

    const from = getSenderForDestination(to);
    const telnyxMessage = await sendSms({ to, message });
    const messageId = telnyxMessage?.id || "";
    const providerStatus = telnyxMessage?.to?.[0]?.status || telnyxMessage?.status || "accepted";
    const responseBody = { success: true, messageId, status: providerStatus };

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
    markSendSuccess(dedupeKey, responseBody);

    return res.json(responseBody);
  } catch (err) {
    if (dedupeKey) {
      markSendFailure(dedupeKey);
    }

    const errorMessage = err?.response?.data?.errors?.[0]?.detail || err?.response?.data?.message || err.message || "Telnyx send failed";
    logger.error("Outbound SMS failed", err);

    return res.status(err.statusCode || 500).json({ success: false, error: errorMessage });
  }
});

module.exports = router;
