const ping = require('ping');
const fs = require('fs');
const path = require('path');

// ============================================
// Security: Path Validation
// ============================================
const configPath = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');

// Prevent path traversal attacks
const resolvedPath = path.resolve(configPath);
const allowedDir = path.resolve(__dirname);

if (!resolvedPath.startsWith(allowedDir)) {
    console.error('❌ FATAL: CONFIG_PATH must be within the agent directory');
    console.error('   Attempted path:', resolvedPath);
    process.exit(1);
}

if (!resolvedPath.endsWith('.json')) {
    console.error('❌ FATAL: CONFIG_PATH must be a .json file');
    process.exit(1);
}

// ============================================
// Load Configuration
// ============================================
let config;
try {
    config = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
} catch (err) {
    console.error('❌ Error loading config.json:', err.message);
    console.error('   Please create config.json based on config.example.json');
    process.exit(1);
}

const { targets, endpoint, intervalSeconds = 30 } = config;

// Support API key from environment variable (more secure)
const apiKey = process.env.AGENT_API_KEY || config.apiKey;

// ============================================
// Validation
// ============================================
if (!targets || !Array.isArray(targets) || targets.length === 0) {
    console.error('❌ Missing or invalid "targets" in config');
    process.exit(1);
}

if (!endpoint || typeof endpoint !== 'string') {
    console.error('❌ Missing "endpoint" in config');
    process.exit(1);
}

if (!apiKey || apiKey.includes('CHANGE_ME')) {
    console.error('❌ API key not configured');
    console.error('   Set AGENT_API_KEY environment variable or update apiKey in config.json');
    console.error('   Generate one with: openssl rand -hex 32');
    process.exit(1);
}

// Security check: HTTPS required in production
if (!endpoint.startsWith('https://') && !endpoint.includes('localhost') && !endpoint.includes('127.0.0.1')) {
    console.error('❌ Endpoint must use HTTPS in production');
    console.error('   Current endpoint:', endpoint);
    process.exit(1);
}

console.log(`✅ Homepage360 Network Agent starting...`);
console.log(`📡 Monitoring ${targets.length} targets every ${intervalSeconds}s`);
console.log(`🌐 Reporting to: ${endpoint}`);
console.log(`🔒 API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);


async function checkDevices() {
    const statuses = [];

    for (const target of targets) {
        try {
            const result = await ping.promise.probe(target.host, {
                timeout: 5,
                extra: ['-c', '1'] // Single ping on Linux
            });

            statuses.push({
                name: target.name,
                host: target.host,
                alive: result.alive,
                latency: result.alive ? Math.round(parseFloat(result.time)) : null
            });

            const status = result.alive ? '🟢' : '🔴';
            const latencyStr = result.alive ? `${result.time}ms` : 'timeout';
            console.log(`  ${status} ${target.name} (${target.host}): ${latencyStr}`);

        } catch (err) {
            statuses.push({
                name: target.name,
                host: target.host,
                alive: false,
                latency: null,
                error: err.message
            });
            console.log(`  🔴 ${target.name} (${target.host}): error - ${err.message}`);
        }
    }

    return statuses;
}

async function sendStatuses(statuses) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({ statuses })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`  ✅ Sent ${data.count} statuses to server`);

    } catch (err) {
        console.error(`  ❌ Failed to send statuses: ${err.message}`);
    }
}

async function runCheck() {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] Running network check...`);

    const statuses = await checkDevices();
    await sendStatuses(statuses);
}

// Initial check
runCheck();

// Schedule periodic checks
setInterval(runCheck, intervalSeconds * 1000);

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Agent shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Agent interrupted...');
    process.exit(0);
});
