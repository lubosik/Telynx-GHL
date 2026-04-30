require("dotenv").config();

const config = {
  port: Number(process.env.PORT || 3000),
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  telnyx: {
    apiKey: process.env.TELNYX_API_KEY || "",
    phoneNumber: process.env.TELNYX_PHONE_NUMBER || "",
    alphanumericSenderId: process.env.TELNYX_ALPHANUMERIC_SENDER_ID || "",
    messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID || ""
  },
  ghl: {
    agencyToken: process.env.GHL_AGENCY_TOKEN || "",
    locationId: process.env.GHL_LOCATION_ID || "",
    companyId: process.env.GHL_COMPANY_ID || ""
  }
};

function getConfigStatus() {
  return {
    telnyxApiKey: Boolean(config.telnyx.apiKey),
    telnyxPhoneNumber: Boolean(config.telnyx.phoneNumber),
    telnyxAlphanumericSenderId: Boolean(config.telnyx.alphanumericSenderId),
    telnyxMessagingProfileId: Boolean(config.telnyx.messagingProfileId),
    ghlAgencyToken: Boolean(config.ghl.agencyToken),
    ghlLocationId: Boolean(config.ghl.locationId),
    ghlCompanyId: Boolean(config.ghl.companyId),
    webhookSecret: Boolean(config.webhookSecret)
  };
}

module.exports = {
  config,
  getConfigStatus
};
