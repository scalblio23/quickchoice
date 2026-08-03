# quickchoice-api

Telnyx SMS verification backend for Quick Choice Finance Solutions.

## Environment variables (set in Railway → Variables tab)

| Variable | Required | Description |
|----------|----------|-------------|
| `TELNYX_API_KEY` | Yes | Your Telnyx API key (starts with `KEY...`) |
| `TELNYX_VERIFY_PROFILE_ID` | Yes | The UUID of your Telnyx Verify Profile |
| `ALLOWED_ORIGIN` | Recommended | The exact domain allowed to call this API, e.g. `https://quickchoice.finchecker.com.au`. Defaults to `*` (any origin) — restrict for production. |
| `LEAD_WEBHOOK_URL` | Recommended | Make/Integromat webhook URL that writes leads to Google Sheets. |
| `SMTP_HOST` | Optional | SMTP server hostname, e.g. `smtp.sendgrid.net`. Required to enable confirmation emails. |
| `SMTP_PORT` | Optional | SMTP port. Defaults to `587`. Use `465` for SSL. |
| `SMTP_USER` | Optional | SMTP username, e.g. `apikey` for SendGrid. |
| `SMTP_PASS` | Optional | SMTP password / API key. |
| `SMTP_FROM` | Optional | Sender name and address, e.g. `QuickChoice <no-reply@quickchoice.com.au>`. |
| `PORT` | Auto | Railway injects this. Don't set manually. |

## Endpoints

- `GET /` — health check
- `POST /api/send-code` — body: `{ "mobile": "0412345678" }`
- `POST /api/check-code` — body: `{ "mobile": "0412345678", "code": "123456" }`
- `POST /api/submit-lead` — body: full lead payload, logs to console for now

## Rate limit

5 requests per IP per minute on each endpoint. Resets on server restart.
