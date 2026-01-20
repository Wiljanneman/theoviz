const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = 3001;

// Shared secret for request signing (set in environment)
const APP_SECRET = process.env.APP_SECRET || 'dev-secret-change-in-production';

// Rate limiting: 10 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Allow all Codespaces origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'timestamp', 'signature'],
  credentials: false
}));

app.use(express.json());

// Handle preflight requests
app.options('*', cors());

// Middleware to verify request signature
function verifySignature(req, res, next) {
  const { timestamp, signature } = req.headers;
  
  if (!timestamp || !signature) {
    return res.status(401).json({ error: 'Missing authentication headers' });
  }
  
  // Check if timestamp is within 5 minutes (prevents replay attacks)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return res.status(401).json({ error: 'Request timestamp expired' });
  }
  
  // Verify signature
  const data = timestamp + JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(data)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
}

// Apply rate limiting and signature verification to Claude endpoint
app.post('/api/claude', limiter, verifySignature, async (req, res) => {
  console.log('Received authenticated request from:', req.get('origin'));
  
  try {
    const { prompt, apiKey } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Use provided API key or environment variable
    const key = apiKey || process.env.CLAUDE_API_KEY;
    
    if (!key) {
      return res.status(401).json({ error: 'API key not provided' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'API request failed' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Claude API proxy server running on http://localhost:${PORT}`);
  console.log(`Public URL: https://${process.env.CODESPACE_NAME}-${PORT}.app.github.dev`);
});
