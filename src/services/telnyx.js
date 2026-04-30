const axios = require("axios");
const { config } = require("../lib/config");

const TELNYX_API_URL = "https://api.telnyx.com/v2/messages";
const ALPHANUMERIC_SENDER_RE = /^(?=.*[A-Za-z])[A-Za-z0-9 ]{1,11}$/;

function requireTelnyxConfig() {
  const missing = [];

  if (!config.telnyx.apiKey) missing.push("TELNYX_API_KEY");
  if (!config.telnyx.phoneNumber) missing.push("TELNYX_PHONE_NUMBER");
  if (!config.telnyx.messagingProfileId) missing.push("TELNYX_MESSAGING_PROFILE_ID");

  if (missing.length) {
    throw new Error(`Missing Telnyx config: ${missing.join(", ")}`);
  }
}

function isInternationalDestination(to = "") {
  const raw = String(to).trim();
  const digits = raw.replace(/\D/g, "");

  return !(raw.startsWith("+1") || (digits.length === 11 && digits.startsWith("1")));
}

function getSenderForDestination(to) {
  if (!isInternationalDestination(to)) {
    return config.telnyx.phoneNumber;
  }

  if (!config.telnyx.alphanumericSenderId) {
    const error = new Error(
      "International SMS requires TELNYX_ALPHANUMERIC_SENDER_ID configured on the Telnyx messaging profile. Add an approved alphanumeric sender ID for +44/UK sends, or send to a +1 number."
    );
    error.statusCode = 400;
    throw error;
  }

  if (!ALPHANUMERIC_SENDER_RE.test(config.telnyx.alphanumericSenderId)) {
    const error = new Error("TELNYX_ALPHANUMERIC_SENDER_ID must be 1-11 letters/numbers/spaces and include at least one letter.");
    error.statusCode = 400;
    throw error;
  }

  return config.telnyx.alphanumericSenderId;
}

async function sendSms({ to, message }) {
  requireTelnyxConfig();
  const from = getSenderForDestination(to);

  const response = await axios.post(
    TELNYX_API_URL,
    {
      from,
      to,
      text: message,
      messaging_profile_id: config.telnyx.messagingProfileId
    },
    {
      headers: {
        Authorization: `Bearer ${config.telnyx.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      timeout: 15000
    }
  );

  return response.data?.data || response.data;
}

module.exports = {
  sendSms,
  getSenderForDestination
};
