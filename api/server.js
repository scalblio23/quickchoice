const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8080;

// Environment variables (set in Railway Variables tab — NEVER in code)
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_VERIFY_PROFILE_ID = process.env.TELNYX_VERIFY_PROFILE_ID;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (!TELNYX_API_KEY || !TELNYX_VERIFY_PROFILE_ID) {
  console.error('⚠️  Missing env vars: TELNYX_API_KEY and TELNYX_VERIFY_PROFILE_ID required');
}

// Email transport — configure via SMTP_* env vars (works with SendGrid, Mailgun, SMTP2GO, etc.)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'QuickChoice <no-reply@quickchoice.com.au>';

let mailer = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  console.log(`📧 Email transport ready via ${SMTP_HOST}:${SMTP_PORT}`);
} else {
  console.warn('⚠️  SMTP_HOST / SMTP_USER / SMTP_PASS not set — confirmation emails disabled');
}

// Human-readable labels for each survey field
const QUESTION_LABELS = {
  assetType:    'Vehicle type',
  purpose:      'Personal or business use',
  abnDuration:  'ABN held for',
  gst:          'Registered for GST',
  property:     'Own property',
  amount:       'Loan amount',
  credit:       'Credit rating',
  residency:    'Australian resident or citizen',
  income:       'Annual gross income',
  state:        'State',
  postcode:     'Postcode',
  helpDescription: 'How we can help',
  bestTime:     'Best time to call',
};

// Format a dollar amount back to a readable string
function formatDollar(val) {
  const n = Number(val);
  if (isNaN(n)) return val;
  if (n >= 500000) return '$500,000+';
  return '$' + n.toLocaleString('en-AU');
}

// Format raw field values into readable labels
function formatFieldValue(key, val) {
  if (!val) return '—';
  if (key === 'amount' || key === 'income') return formatDollar(val);
  // Capitalise first letter and replace hyphens/underscores
  return String(val).replace(/[-_]/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

// Build the HTML confirmation email body
function buildConfirmationEmail(lead, formattedDate) {
  const firstName = lead.firstName || 'there';
  const isBusinessLoan = lead.purpose === 'business';

  // Only include business fields if it's a business loan
  const fieldsToShow = [
    'assetType', 'purpose',
    ...(isBusinessLoan ? ['abnDuration', 'gst'] : []),
    'property', 'amount', 'credit', 'residency', 'income',
    'state', 'postcode', 'helpDescription', 'bestTime',
  ].filter(key => lead[key]);

  const surveyRows = fieldsToShow.map(key => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #E2E7EF;color:#5A6B82;font-size:14px;width:45%">${QUESTION_LABELS[key] || key}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #E2E7EF;color:#0E2A4F;font-size:14px;font-weight:600">${formatFieldValue(key, lead[key])}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your QuickChoice Application Summary</title>
</head>
<body style="margin:0;padding:0;background:#F1F4F9;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F4F9;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:#0E2A4F;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center">
            <div style="color:#1FBA5C;font-size:24px;font-weight:800;letter-spacing:-0.5px">Quick<span style="color:#FFFFFF">Choice</span></div>
            <div style="color:#8DA4BF;font-size:13px;margin-top:4px">Finance Solutions</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#FFFFFF;padding:40px">

            <h1 style="margin:0 0 8px;color:#0E2A4F;font-size:22px;font-weight:700">Hi ${firstName}, you're all set! 🎉</h1>
            <p style="margin:0 0 28px;color:#5A6B82;font-size:15px;line-height:1.6">
              Thanks for completing our car loan questionnaire. We've received your details and one of our loan specialists will be in touch at your preferred time.
            </p>

            <!-- How It Works -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F4F9;border-radius:10px;margin-bottom:32px">
              <tr>
                <td style="padding:24px 28px">
                  <div style="color:#0E2A4F;font-size:16px;font-weight:700;margin-bottom:20px">How QuickChoice Works</div>

                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="vertical-align:top;width:36px">
                        <div style="background:#1FBA5C;color:#fff;border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px;font-size:13px;font-weight:700">1</div>
                      </td>
                      <td style="padding-left:14px;padding-bottom:18px">
                        <div style="color:#0E2A4F;font-weight:600;font-size:14px">We review your answers</div>
                        <div style="color:#5A6B82;font-size:13px;line-height:1.5;margin-top:3px">Our team analyses your questionnaire responses to understand your exact borrowing needs.</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="vertical-align:top;width:36px">
                        <div style="background:#1FBA5C;color:#fff;border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px;font-size:13px;font-weight:700">2</div>
                      </td>
                      <td style="padding-left:14px;padding-bottom:18px">
                        <div style="color:#0E2A4F;font-weight:600;font-size:14px">We match you to lenders</div>
                        <div style="color:#5A6B82;font-size:13px;line-height:1.5;margin-top:3px">We compare 30+ lenders across Australia to find the most competitive rates and terms for your profile.</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="vertical-align:top;width:36px">
                        <div style="background:#1FBA5C;color:#fff;border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px;font-size:13px;font-weight:700">3</div>
                      </td>
                      <td style="padding-left:14px;padding-bottom:18px">
                        <div style="color:#0E2A4F;font-weight:600;font-size:14px">A specialist calls you</div>
                        <div style="color:#5A6B82;font-size:13px;line-height:1.5;margin-top:3px">One of our Australian-based loan specialists will call at your preferred time to walk you through your options — no obligation.</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="vertical-align:top;width:36px">
                        <div style="background:#1FBA5C;color:#fff;border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px;font-size:13px;font-weight:700">4</div>
                      </td>
                      <td style="padding-left:14px">
                        <div style="color:#0E2A4F;font-weight:600;font-size:14px">You choose &amp; we settle</div>
                        <div style="color:#5A6B82;font-size:13px;line-height:1.5;margin-top:3px">You pick the loan that suits you. We handle all the paperwork and coordinate with the lender so you can drive away sooner.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Survey Summary -->
            <div style="color:#0E2A4F;font-size:16px;font-weight:700;margin-bottom:14px">Your Survey Answers</div>
            <p style="margin:0 0 16px;color:#5A6B82;font-size:14px">Here's a summary of the information you provided so you have it on record:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E7EF;border-radius:8px;overflow:hidden;border-collapse:collapse;margin-bottom:32px">
              ${surveyRows}
            </table>

            <p style="margin:0;color:#5A6B82;font-size:13px;line-height:1.6">
              Submitted on <strong style="color:#0E2A4F">${formattedDate} AEST</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F1F4F9;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center">
            <p style="margin:0 0 8px;color:#8DA4BF;font-size:12px">QuickChoice Finance Solutions &bull; Australia</p>
            <p style="margin:0;color:#B0BFCF;font-size:11px">This email was sent because you completed a loan enquiry at quickchoice.com.au. If you didn't submit this form, please ignore this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Build plain-text fallback
function buildConfirmationText(lead, formattedDate) {
  const firstName = lead.firstName || 'there';
  const isBusinessLoan = lead.purpose === 'business';

  const fieldsToShow = [
    'assetType', 'purpose',
    ...(isBusinessLoan ? ['abnDuration', 'gst'] : []),
    'property', 'amount', 'credit', 'residency', 'income',
    'state', 'postcode', 'helpDescription', 'bestTime',
  ].filter(key => lead[key]);

  const surveyLines = fieldsToShow.map(key =>
    `  ${QUESTION_LABELS[key] || key}: ${formatFieldValue(key, lead[key])}`
  ).join('\n');

  return `Hi ${firstName},

Thanks for completing our car loan questionnaire. We've received your details and a specialist will be in touch at your preferred time.

HOW QUICKCHOICE WORKS
──────────────────────
1. We review your answers — our team analyses your questionnaire to understand your borrowing needs.
2. We match you to lenders — we compare 30+ Australian lenders for the most competitive rates.
3. A specialist calls you — at your preferred time, no obligation.
4. You choose & we settle — we handle all paperwork so you can drive away sooner.

YOUR SURVEY ANSWERS
──────────────────────
${surveyLines}

Submitted: ${formattedDate} AEST

──────────────────────
QuickChoice Finance Solutions | Australia
This email was sent because you completed a loan enquiry at quickchoice.com.au.
`;
}

// CORS — allow configured brand domains (Quick Choice, Lease Right, future brands)
console.log('CORS allowed origins:', ALLOWED_ORIGINS);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['POST', 'OPTIONS'],
  credentials: false,
}));
app.use(express.json({ limit: '50kb' }));

// In-memory rate limit (per-IP, per-minute). Resets on restart — fine for MVP.
const rateLimitMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxRequests = 5;

  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count += 1;
  rateLimitMap.set(ip, record);

  if (record.count > maxRequests) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }
  next();
}

// Validate AU mobile and normalize to E.164 (+614XXXXXXXX)
function normalizeAuMobile(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s|-|\(|\)/g, '');
  // Accept: 04XXXXXXXX, +614XXXXXXXX, 614XXXXXXXX
  if (/^04\d{8}$/.test(cleaned)) return '+61' + cleaned.slice(1);
  if (/^\+614\d{8}$/.test(cleaned)) return cleaned;
  if (/^614\d{8}$/.test(cleaned)) return '+' + cleaned;
  return null;
}

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'quickchoice-api' });
});

// ===== SEND VERIFICATION CODE =====
app.post('/api/send-code', rateLimit, async (req, res) => {
  try {
    const phone = normalizeAuMobile(req.body.mobile);
    if (!phone) {
      return res.status(400).json({ error: 'Invalid Australian mobile number' });
    }

    const response = await fetch('https://api.telnyx.com/v2/verifications/sms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phone,
        verify_profile_id: TELNYX_VERIFY_PROFILE_ID,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Telnyx send error:', data);
      return res.status(500).json({ error: 'Could not send verification code. Please try again.' });
    }

    return res.json({ success: true, phone });
  } catch (err) {
    console.error('send-code error:', err);
    return res.status(500).json({ error: 'Server error sending code' });
  }
});

// ===== CHECK VERIFICATION CODE =====
app.post('/api/check-code', rateLimit, async (req, res) => {
  try {
    const phone = normalizeAuMobile(req.body.mobile);
    const code = (req.body.code || '').toString().trim();

    if (!phone) return res.status(400).json({ error: 'Invalid mobile number' });
    if (!/^\d{4,8}$/.test(code)) return res.status(400).json({ error: 'Invalid code format' });

    const response = await fetch(
      `https://api.telnyx.com/v2/verifications/by_phone_number/${encodeURIComponent(phone)}/actions/verify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          verify_profile_id: TELNYX_VERIFY_PROFILE_ID,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Telnyx check error:', data);
      return res.status(400).json({ error: 'Code is invalid or expired', verified: false });
    }

    // Telnyx returns response_code: "accepted" on success
    const verified = data?.data?.response_code === 'accepted';

    if (!verified) {
      return res.status(400).json({ error: 'Incorrect code', verified: false });
    }

    return res.json({ success: true, verified: true, phone });
  } catch (err) {
    console.error('check-code error:', err);
    return res.status(500).json({ error: 'Server error checking code' });
  }
});

// ===== SUBMIT LEAD (verified only) =====
const LEAD_WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL;

app.post('/api/submit-lead', rateLimit, async (req, res) => {
  try {
    const lead = req.body;

    // Format the date nicely for the sheet (Sydney local time)
    const submittedAt = new Date(lead.submittedAt || Date.now());
    const formattedDate = submittedAt.toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).replace(',', '');

    const payload = {
      date: formattedDate,
      firstName: lead.firstName || '',
      mobile: lead.mobile || '',
      email: lead.email || '',
      intent: lead.intent || '',
      assetType: lead.assetType || '',
      purpose: lead.purpose || '',
      abnDuration: lead.abnDuration || '',
      gst: lead.gst || '',
      property: lead.property || '',
      amount: lead.amount || '',
      credit: lead.credit || '',
      residency: lead.residency || '',
      income: lead.income || '',
      state: lead.state || '',
      postcode: lead.postcode || '',
      bestTime: lead.bestTime || '',
      helpDescription: lead.helpDescription || '',
      verified: lead.verified ? 'TRUE' : 'FALSE',
      source: lead.source || 'quickchoice-quiz',
    };

    console.log('📥 Lead received:', JSON.stringify(payload, null, 2));

    // Forward to Make webhook (which writes to Google Sheet)
    if (LEAD_WEBHOOK_URL) {
      try {
        const forward = await fetch(LEAD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!forward.ok) {
          console.error('Make webhook returned non-OK:', forward.status, await forward.text());
        } else {
          console.log('✅ Forwarded to Make webhook');
        }
      } catch (fwdErr) {
        // Don't fail the user-facing response if the webhook is down — log it
        console.error('Failed to forward to Make:', fwdErr.message);
      }
    } else {
      console.warn('⚠️  LEAD_WEBHOOK_URL not set — lead not forwarded');
    }

    // Send confirmation email to the lead (non-blocking — don't fail the response if email fails)
    if (mailer && lead.email) {
      const htmlBody = buildConfirmationEmail(lead, formattedDate);
      const textBody = buildConfirmationText(lead, formattedDate);
      mailer.sendMail({
        from: SMTP_FROM,
        to: lead.email,
        subject: `${lead.firstName ? lead.firstName + ', your' : 'Your'} QuickChoice application is being reviewed`,
        html: htmlBody,
        text: textBody,
      }).then(() => {
        console.log(`📧 Confirmation email sent to ${lead.email}`);
      }).catch(emailErr => {
        console.error('Failed to send confirmation email:', emailErr.message);
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ error: 'Server error saving lead' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ quickchoice-api listening on port ${PORT}`);
});
