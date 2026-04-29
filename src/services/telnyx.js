const axios = require("axios");
const { config } = require("../lib/config");

const TELNYX_API_URL = "https://api.telnyx.com/v2/messages";

function requireTelnyxConfig() {
  const missing = [];

  if (!config.telnyx.apiKey) missing.push("TELNYX_API_KEY");
  if (!config.telnyx.phoneNumber) missing.push("TELNYX_PHONE_NUMBER");
  if (!config.telnyx.messagingProfileId) missing.push("TELNYX_MESSAGING_PROFILE_ID");

  if (missing.length) {
    throw new Error(`Missing Telnyx config: ${missing.join(", ")}`);
  }
}

async function sendSms({ to, message }) {
  requireTelnyxConfig();

  const response = await axios.post(
    TELNYX_API_URL,
    {
      from: config.telnyx.phoneNumber,
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
  sendSms
};

