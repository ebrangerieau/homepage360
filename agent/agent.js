const ping = require('ping');
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');

let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    console.error('Error loading config.json:', err.message);
    console.error('Please create config.json based on config.example.json');
    process.exit(1);
}

const { targets, endpoint, apiKey, intervalSeconds = 30 } = config;

if (!targets || !endpoint || !apiKey) {
    console.error('Missing required config: targets, endpoint, or apiKey');
    process.exit(1);
}

console.log(`Homepage360 Network Agent starting...`);
console.log(`Monitoring ${targets.length} targets every ${intervalSeconds}s`);
console.log(`Reporting to: ${endpoint}`);

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
