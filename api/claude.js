const crypto = require('crypto');

// Shared secret for request signing
const APP_SECRET = process.env.APP_SECRET || 'dev-secret-change-in-production';

// Simple in-memory rate limiting (resets on cold start)
const requestCounts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip);
  // Remove old requests outside the window
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true;
}

function verifySignature(timestamp, signature, body) {
  if (!timestamp || !signature) {
    return { valid: false, error: 'Missing authentication headers' };
  }
  
  // Check if timestamp is within 5 minutes
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return { valid: false, error: 'Request timestamp expired' };
  }
  
  // Verify signature
  const data = timestamp + JSON.stringify(body);
  const expectedSignature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(data)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  return { valid: true };
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, timestamp, signature');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
  
  // Verify signature
  const { timestamp, signature } = req.headers;
  const verification = verifySignature(timestamp, signature, req.body);
  if (!verification.valid) {
    return res.status(401).json({ error: verification.error });
  }
  
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
};
