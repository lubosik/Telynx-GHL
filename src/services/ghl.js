const axios = require("axios");
const { config } = require("../lib/config");
const logger = require("../lib/logger");

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const TOKEN_CACHE_MS = 55 * 60 * 1000;

let tokenCache = {
  token: "",
  expiresAt: 0,
  companyId: ""
};

function requireGhlConfig() {
  const missing = [];

  if (!config.ghl.agencyToken) missing.push("GHL_AGENCY_TOKEN");
  if (!config.ghl.locationId) missing.push("GHL_LOCATION_ID");

  if (missing.length) {
    throw new Error(`Missing GHL config: ${missing.join(", ")}`);
  }
}

function baseHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_VERSION,
    Accept: "application/json"
  };
}

function normalizeContacts(responseData) {
  if (Array.isArray(responseData?.contacts)) return responseData.contacts;
  if (Array.isArray(responseData?.contact)) return responseData.contact;
  if (Array.isArray(responseData)) return responseData;
  return [];
}

function getContactId(responseData) {
  return responseData?.contact?.id || responseData?.id || responseData?.data?.id || "";
}

async function resolveCompanyId() {
  if (config.ghl.companyId) return config.ghl.companyId;
  if (tokenCache.companyId) return tokenCache.companyId;

  try {
    const response = await axios.get(`${GHL_API_BASE}/locations/${config.ghl.locationId}`, {
      headers: baseHeaders(config.ghl.agencyToken),
      timeout: 15000
    });

    const companyId = response.data?.location?.companyId || response.data?.companyId;

    if (companyId) {
      tokenCache.companyId = companyId;
      return companyId;
    }
  } catch (err) {
    logger.error("GHL location lookup failed while resolving companyId", err);
  }

  const response = await axios.get(`${GHL_API_BASE}/oauth/installedLocations`, {
    headers: baseHeaders(config.ghl.agencyToken),
    timeout: 15000
  });

  const locations = response.data?.locations || response.data?.installedLocations || response.data?.data || [];
  const match = Array.isArray(locations)
    ? locations.find((location) => location.locationId === config.ghl.locationId || location.id === config.ghl.locationId)
    : null;

  const companyId = match?.companyId || response.data?.companyId;

  if (!companyId) {
    throw new Error("GHL_COMPANY_ID is required; could not infer companyId from installed locations");
  }

  tokenCache.companyId = companyId;
  return companyId;
}

async function requestLocationToken(companyId) {
  const response = await axios.post(
    `${GHL_API_BASE}/oauth/locationToken`,
    {
      companyId,
      locationId: config.ghl.locationId
    },
    {
      headers: {
        ...baseHeaders(config.ghl.agencyToken),
        "Content-Type": "application/json"
      },
      timeout: 15000
    }
  );

  const token = response.data?.access_token || response.data?.accessToken;

  if (!token) {
    throw new Error("GHL location token response did not include access_token");
  }

  tokenCache = {
    token,
    expiresAt: Date.now() + TOKEN_CACHE_MS,
    companyId: response.data?.companyId || companyId
  };

  return token;
}

async function getLocationToken() {
  requireGhlConfig();

  if (tokenCache.token && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const companyId = await resolveCompanyId();
      return await requestLocationToken(companyId);
    } catch (err) {
      lastError = err;
      logger.error(`GHL location token exchange failed on attempt ${attempt}`, err);

      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError;
}

async function ghlRequest(method, path, data, params) {
  const token = await getLocationToken();

  const response = await axios({
    method,
    url: `${GHL_API_BASE}${path}`,
    data,
    params,
    headers: {
      ...baseHeaders(token),
      "Content-Type": "application/json"
    },
    timeout: 15000
  });

  return response.data;
}

async function findContactByPhone(phone) {
  const data = await ghlRequest("get", "/contacts/", null, {
    locationId: config.ghl.locationId,
    phone
  });

  return normalizeContacts(data)[0] || null;
}

async function createContact(phone) {
  const data = await ghlRequest("post", "/contacts/", {
    locationId: config.ghl.locationId,
    phone
  });

  return {
    id: getContactId(data),
    raw: data
  };
}

async function addInboundMessage({ phone, message, contactId }) {
  const payload = {
    type: "SMS",
    phone,
    message
  };

  if (contactId) {
    payload.contactId = contactId;
  }

  return ghlRequest("post", "/conversations/messages/inbound", {
    ...payload
  });
}

async function logInboundSms({ phone, message }) {
  const existingContact = await findContactByPhone(phone);
  const contact = existingContact || (await createContact(phone));
  const contactId = existingContact?.id || contact?.id || "";
  const conversationMessage = await addInboundMessage({ phone, message, contactId });

  return {
    contactId,
    conversationMessage
  };
}

module.exports = {
  getLocationToken,
  findContactByPhone,
  createContact,
  addInboundMessage,
  logInboundSms
};
