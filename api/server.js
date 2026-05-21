
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Environment variables (set in Railway Variables tab — NEVER in code)
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_VERIFY_PROFILE_ID = process.env.TELNYX_VERIFY_PROFILE_ID;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

if (!TELNYX_API_KEY || !TELNYX_VERIFY_PROFILE_ID) {
  console.error('⚠️  Missing env vars: TELNYX_API_KEY and TELNYX_VERIFY_PROFILE_ID required');
}

// CORS — only allow the Quick Choice domain to call this API
app.use(cors({
  origin: ALLOWED_ORIGIN,
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
// For now: just logs to console. Wire to GHL/Formspree later.
app.post('/api/submit-lead', rateLimit, async (req, res) => {
  try {
    const lead = req.body;
    console.log('📥 Lead received:', JSON.stringify(lead, null, 2));
    // TODO: forward to GHL webhook
    // await fetch(process.env.GHL_WEBHOOK_URL, { method: 'POST', ... });
    return res.json({ success: true });
  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ error: 'Server error saving lead' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ quickchoice-api listening on port ${PORT}`);
});
