const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.MONITOR_API_KEY || 'change-me-in-production';

// In-memory storage for device statuses
let deviceStatuses = {};
let lastUpdate = null;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from parent directory (Homepage360 frontend)
app.use(express.static(path.join(__dirname, '..')));

// API Key validation middleware
const validateApiKey = (req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    next();
};

// POST /api/status - Receive status updates from agent (protected)
app.post('/api/status', validateApiKey, (req, res) => {
    const { statuses } = req.body;

    if (!statuses || !Array.isArray(statuses)) {
        return res.status(400).json({ error: 'Invalid payload: expected { statuses: [...] }' });
    }

    // Update stored statuses
    statuses.forEach(status => {
        deviceStatuses[status.name] = {
            name: status.name,
            host: status.host,
            alive: status.alive,
            latency: status.latency,
            lastCheck: new Date().toISOString()
        };
    });

    lastUpdate = new Date().toISOString();

    console.log(`[${lastUpdate}] Received status update for ${statuses.length} devices`);
    res.json({ success: true, count: statuses.length });
});

// GET /api/status - Return current statuses (public for frontend)
app.get('/api/status', (req, res) => {
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
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Homepage360 server running on port ${PORT}`);
    console.log(`API Key configured: ${API_KEY !== 'change-me-in-production' ? 'Yes' : 'No (using default - CHANGE THIS!)'}`);
});
