# Telnyx GHL SMS Bridge

A lightweight Node.js/Express bridge that sends outbound SMS through Telnyx from GoHighLevel workflow webhooks and logs inbound Telnyx replies into GoHighLevel Conversations.

## Run locally

```bash
git clone https://github.com/lubosik/Telynx-GHL.git
cd Telynx-GHL
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000/health` to confirm the server is running.

## Environment variables

Create `.env` locally and add the same variables in Railway:

```env
TELNYX_API_KEY=
TELNYX_PHONE_NUMBER=+13054043184
TELNYX_MESSAGING_PROFILE_ID=40019dba-276f-4bc8-8046-8f013965e74c
GHL_AGENCY_TOKEN=
GHL_LOCATION_ID=K3zocv5e8VGH4dPBLmw2
GHL_COMPANY_ID=LN2eDfFYbzohmmTOBSKN
PORT=3000
WEBHOOK_SECRET=
```

`GHL_COMPANY_ID` is recommended because LeadConnector's `/oauth/locationToken` endpoint requires both `companyId` and `locationId`. For Vici Peptides, the company ID is `LN2eDfFYbzohmmTOBSKN`. If it is omitted, the app will first try to infer it from `/locations/{locationId}`, then from `/oauth/installedLocations`.

## Deploy to Railway

1. Push this repo to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Add the environment variables in the Railway dashboard.
4. Railway will use `railway.toml` and start the app with `node src/index.js`.

## Configure Telnyx inbound webhook

In Telnyx Mission Control, set the Messaging Profile inbound webhook URL to:

```text
https://telynx-ghl-production.up.railway.app/inbound
```

Telnyx webhook payloads are read from `data.payload`, and this server always returns HTTP 200 for `/inbound` so Telnyx does not repeatedly retry bad payloads or internal processing errors.

## Configure GHL outbound workflow

In the GoHighLevel workflow, add a Webhook action:

```text
POST https://telynx-ghl-production.up.railway.app/send
Content-Type: application/json
x-webhook-secret: your_WEBHOOK_SECRET_value
```

Body:

```json
{
  "to": "{{contact.phone}}",
  "message": "your message",
  "contactId": "{{contact.id}}"
}
```

If `WEBHOOK_SECRET` is blank, `/send` will accept requests without the `x-webhook-secret` header. Set it in production.

## Test

Health check:

```bash
curl https://telynx-ghl-production.up.railway.app/health
```

Outbound test:

```bash
curl -X POST https://telynx-ghl-production.up.railway.app/send \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_WEBHOOK_SECRET_value" \
  -d '{"to":"+447XXXXXXXXX","message":"Test from bridge","contactId":"test"}'
```

Inbound webhook test:

```bash
curl -X POST http://localhost:3000/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "event_type": "message.received",
      "payload": {
        "from": { "phone_number": "+447XXXXXXXXX" },
        "to": [{ "phone_number": "+13054043184" }],
        "text": "Customer reply here"
      }
    }
  }'
```

## Dashboard

Visit `/` to see bridge status, config status, and the latest 20 in-memory message events. The app keeps only the last 50 messages and does not persist data across restarts.

## Important behavior

This is a webhook bridge, not a native carrier integration. The Telnyx number will not appear in GHL Phone System settings. Inbound messages are posted into GHL Conversations through the API, and workflow outbound SMS must use a Webhook action pointed at `/send`, not GHL's native SMS action.
