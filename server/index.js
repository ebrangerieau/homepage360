const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { login, logout, checkSession } = require('./auth');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Structured Logging
// ============================================
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;

function log(level, message, data = {}) {
    if (LOG_LEVELS[level] < currentLogLevel) return;

    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        service: 'homepage360-server',
        message,
        ...data
    };

    const logLine = JSON.stringify(logEntry);

    if (level === 'ERROR' || level === 'WARN') {
        console.error(logLine);
    } else {
        console.log(logLine);
    }
}

// ============================================
// Security: API Keys (supports rotation with multiple keys)
// ============================================
const API_KEY = process.env.MONITOR_API_KEY;
const API_KEY_PREVIOUS = process.env.MONITOR_API_KEY_PREVIOUS; // For rotation

if (!API_KEY) {
    console.error('❌ FATAL: MONITOR_API_KEY environment variable must be set');
    console.error('   Generate one with: openssl rand -hex 32');
    process.exit(1);
}

// Valid API keys (current + previous for rotation grace period)
const validApiKeys = [API_KEY, API_KEY_PREVIOUS].filter(Boolean);

// Signature tolerance window (5 minutes to handle clock skew)
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

// In-memory storage for device statuses
let deviceStatuses = {};
let lastUpdate = null;

// ============================================
// Middleware
// ============================================
app.use(cors());
app.use(express.json({ limit: '10kb' })); // Limit payload size
app.use(cookieParser());

// Simple rate limiting (in production, use express-rate-limit)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else {
        const record = rateLimitMap.get(ip);
        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + RATE_LIMIT_WINDOW;
        } else {
            record.count++;
            if (record.count > RATE_LIMIT_MAX) {
                return res.status(429).json({ error: 'Too many requests' });
            }
        }
    }
    next();
}

// Clean up rate limit map periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap) {
        if (now > record.resetTime) {
            rateLimitMap.delete(ip);
        }
    }
}, 60000);

// ============================================
// Static Files (restricted)
// ============================================
const staticPath = path.join(__dirname, '..');

// Exception for login page - allow without authentication
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'login.html'));
});
app.get('/login.css', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'login.css'));
});
app.get('/js/login.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'js', 'login.js'));
});

// Protect all other static files with authentication
app.use(requireAuth, express.static(staticPath, {
    index: 'index.html',
    dotfiles: 'deny', // Block .env, .gitignore, etc.
    extensions: ['html', 'css', 'js', 'png', 'json', 'webp', 'ico'],
    maxAge: '1d'
}));

// ============================================
// API Key Validation Middleware
// ============================================
const validateApiKey = (req, res, next) => {
    const providedKey = req.headers['x-api-key'];

    if (!providedKey || !validApiKeys.includes(providedKey)) {
        log('WARN', 'Unauthorized API access attempt', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent')
        });
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    // Mark if using previous key (for monitoring rotation)
    req.usingPreviousKey = (providedKey === API_KEY_PREVIOUS);

    next();
};

// ============================================
// HMAC Signature Verification
// ============================================
function verifySignature(req, res, next) {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];

    // If no signature provided, allow (backwards compatibility)
    // In strict mode, you can reject unsigned requests
    if (!signature || !timestamp) {
        req.signatureVerified = false;
        log('DEBUG', 'Request without signature', { ip: req.ip });
        return next();
    }

    // Check timestamp to prevent replay attacks
    const requestTime = parseInt(timestamp);
    const now = Date.now();

    if (isNaN(requestTime) || Math.abs(now - requestTime) > SIGNATURE_TOLERANCE_MS) {
        log('WARN', 'Signature timestamp expired or invalid', {
            ip: req.ip,
            timestamp,
            serverTime: now,
            diff: Math.abs(now - requestTime)
        });
        return res.status(401).json({ error: 'Signature timestamp expired' });
    }

    // Get the raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    const signatureData = `${timestamp}.${rawBody}`;

    // Try to verify with any valid API key
    let verified = false;
    for (const key of validApiKeys) {
        const expectedSignature = crypto
            .createHmac('sha256', key)
            .update(signatureData)
            .digest('hex');

        // Use timing-safe comparison
        if (signature.length === expectedSignature.length &&
            crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            verified = true;
            break;
        }
    }

    if (!verified) {
        log('WARN', 'Invalid HMAC signature', {
            ip: req.ip,
            path: req.path
        });
        return res.status(401).json({ error: 'Invalid signature' });
    }

    req.signatureVerified = true;
    next();
}

// ============================================
// Input Validation Helpers
// ============================================
function validateDeviceStatus(status) {
    if (!status || typeof status !== 'object') return false;
    if (typeof status.name !== 'string' || status.name.length > 100) return false;
    if (typeof status.host !== 'string' || status.host.length > 255) return false;
    if (typeof status.alive !== 'boolean') return false;
    if (status.latency !== null && status.latency !== undefined) {
        if (typeof status.latency !== 'number' || status.latency < 0 || status.latency > 99999) return false;
    }
    return true;
}

// ============================================
// API Routes
// ============================================

// Authentication routes
app.post('/api/auth/login', rateLimit, (req, res) => login(req, res, log));
app.post('/api/auth/logout', requireAuth, (req, res) => logout(req, res, log));
app.get('/api/auth/check', requireAuth, checkSession);

// POST /api/status - Receive status updates from agent (protected + signed)
app.post('/api/status', rateLimit, validateApiKey, verifySignature, (req, res) => {
    const { statuses } = req.body;

    if (!statuses || !Array.isArray(statuses)) {
        return res.status(400).json({ error: 'Invalid payload: expected { statuses: [...] }' });
    }

    if (statuses.length > 100) {
        return res.status(400).json({ error: 'Too many devices (max 100)' });
    }

    // Validate and update stored statuses
    let validCount = 0;
    statuses.forEach(status => {
        if (validateDeviceStatus(status)) {
            deviceStatuses[status.name] = {
                name: status.name.slice(0, 100),
                host: status.host.slice(0, 255),
                alive: status.alive,
                latency: status.latency ? Math.round(status.latency) : null,
                lastCheck: new Date().toISOString()
            };
            validCount++;
        }
    });

    lastUpdate = new Date().toISOString();

    log('INFO', 'Status update received', {
        validCount,
        totalCount: statuses.length,
        signatureVerified: req.signatureVerified,
        usingPreviousKey: req.usingPreviousKey,
        ip: req.ip
    });

    res.json({ success: true, count: validCount, signatureVerified: req.signatureVerified });
});

// GET /api/status - Return current statuses (protected for frontend, rate limited)
app.get('/api/status', requireAuth, rateLimit, (req, res) => {
    res.json({
        devices: Object.values(deviceStatuses),
        lastUpdate: lastUpdate
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    // Block access to sensitive files
    const blocked = ['.env', '.git', 'package.json', 'docker-compose', 'Dockerfile', 'node_modules'];
    if (blocked.some(b => req.path.includes(b))) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ============================================
// Server Start
// ============================================
app.listen(PORT, () => {
    log('INFO', 'Server started', {
        port: PORT,
        staticPath,
        keyRotationEnabled: !!API_KEY_PREVIOUS,
        hmacEnabled: true
    });

    console.log(`✅ Homepage360 Server v2.2 running on port ${PORT}`);
    console.log(`🔒 API Key configured: Yes`);
    console.log(`🔄 Key rotation: ${API_KEY_PREVIOUS ? 'Active (previous key set)' : 'Single key mode'}`);
    console.log(`🔏 HMAC Signature verification: Enabled`);
    console.log(`📁 Static files: ${staticPath}`);
});
