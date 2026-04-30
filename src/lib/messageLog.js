const MAX_MESSAGES = 50;
const messages = [];

function addMessage(entry) {
  messages.unshift({
    id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    direction: entry.direction,
    from: entry.from || "",
    to: entry.to || "",
    message: entry.message || "",
    status: entry.status || "ok",
    providerStatus: entry.providerStatus || "",
    providerEvent: entry.providerEvent || "",
    providerId: entry.providerId || "",
    contactId: entry.contactId || "",
    error: entry.error || ""
  });

  if (messages.length > MAX_MESSAGES) {
    messages.length = MAX_MESSAGES;
  }
}

function getMessages(limit = MAX_MESSAGES) {
  return messages.slice(0, limit);
}

function updateMessageByProviderId(providerId, updates = {}) {
  const message = messages.find((entry) => entry.providerId === providerId);

  if (!message) {
    return false;
  }

  Object.assign(message, {
    ...updates,
    updatedAt: new Date().toISOString()
  });

  return true;
}

module.exports = {
  addMessage,
  getMessages,
  updateMessageByProviderId
};
