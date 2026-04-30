const crypto = require("crypto");

const DEFAULT_WINDOW_MS = 30 * 60 * 1000;
const entries = new Map();

function getDedupeWindowMs() {
  const minutes = Number(process.env.DEDUPE_WINDOW_MINUTES || 30);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return DEFAULT_WINDOW_MS;
  }

  return minutes * 60 * 1000;
}

function normalizePhone(value = "") {
  const raw = String(value).trim();
  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length) return `+${digits}`;
  return "";
}

function normalizeMessage(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function createDedupeKey({ to, message, contactId }) {
  const source = JSON.stringify({
    to: normalizePhone(to),
    contactId: String(contactId || "").trim(),
    message: normalizeMessage(message)
  });

  return crypto.createHash("sha256").update(source).digest("hex");
}

function pruneExpired(now = Date.now()) {
  const windowMs = getDedupeWindowMs();

  for (const [key, entry] of entries.entries()) {
    if (now - entry.createdAt > windowMs) {
      entries.delete(key);
    }
  }
}

function reserveSend(key) {
  const now = Date.now();
  pruneExpired(now);

  const existing = entries.get(key);
  if (existing) {
    return { duplicate: true, entry: existing };
  }

  const entry = {
    status: "pending",
    createdAt: now,
    updatedAt: now,
    response: null
  };

  entries.set(key, entry);
  return { duplicate: false, entry };
}

function markSendSuccess(key, response) {
  const entry = entries.get(key);
  if (!entry) return;

  entry.status = "sent";
  entry.updatedAt = Date.now();
  entry.response = response;
}

function markSendFailure(key) {
  entries.delete(key);
}

async function waitForSendResult(key, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const entry = entries.get(key);

    if (!entry || entry.status !== "pending") {
      return entry || null;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return entries.get(key) || null;
}

function getDedupeStats() {
  pruneExpired();

  return {
    windowMinutes: Math.round(getDedupeWindowMs() / 60000),
    entries: entries.size
  };
}

module.exports = {
  createDedupeKey,
  getDedupeStats,
  markSendFailure,
  markSendSuccess,
  normalizePhone,
  reserveSend,
  waitForSendResult
};
