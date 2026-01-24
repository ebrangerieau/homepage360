const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Security: Mandatory API Key
// ============================================
const API_KEY = process.env.MONITOR_API_KEY;
if (!API_KEY) {
    console.error('❌ FATAL: MONITOR_API_KEY environment variable must be set');
    console.error('   Generate one with: openssl rand -hex 32');
    process.exit(1);
}

// In-memory storage for device statuses
let deviceStatuses = {};
let lastUpdate = null;

// ============================================
// Middleware
// ============================================
app.use(cors());
app.use(express.json({ limit: '10kb' })); // Limit payload size

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
app.use(express.static(staticPath, {
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
    if (!providedKey || providedKey !== API_KEY) {
        console.warn(`[${new Date().toISOString()}] Unauthorized API access attempt from ${req.ip}`);
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    next();
};

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

// POST /api/status - Receive status updates from agent (protected)
app.post('/api/status', rateLimit, validateApiKey, (req, res) => {
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

    console.log(`[${lastUpdate}] Received status update: ${validCount}/${statuses.length} devices valid`);
    res.json({ success: true, count: validCount });
});

// GET /api/status - Return current statuses (public for frontend, rate limited)
app.get('/api/status', rateLimit, (req, res) => {
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
    console.log(`✅ Homepage360 server running on port ${PORT}`);
    console.log(`🔒 API Key configured: Yes`);
    console.log(`📁 Static files: ${staticPath}`);
});
