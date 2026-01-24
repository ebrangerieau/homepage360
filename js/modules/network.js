// Network Status Module
// Fetches and displays network device statuses

let networkRefreshInterval = null;

export function initNetwork() {
    // Check if network zone exists in current profile
    renderNetworkZone();
    startAutoRefresh();
}

function renderNetworkZone() {
    // Create or update the network status zone
    let networkZone = document.getElementById('network-status-zone');

    if (!networkZone) {
        // Create the zone if it doesn't exist
        const zonesContainer = document.getElementById('zones');
        if (!zonesContainer) return;

        networkZone = document.createElement('section');
        networkZone.id = 'network-status-zone';
        networkZone.className = 'zone network-zone';
        networkZone.innerHTML = `
            <div class="zone-header">
                <h2>📡 Réseau</h2>
                <div class="zone-controls">
                    <button class="refresh-network-btn" title="Rafraîchir">🔄</button>
                </div>
            </div>
            <div class="network-devices">
                <div class="network-loading">Chargement des statuts...</div>
            </div>
        `;

        // Insert at the beginning of zones
        zonesContainer.insertBefore(networkZone, zonesContainer.firstChild);

        // Add refresh button handler
        networkZone.querySelector('.refresh-network-btn').onclick = () => fetchNetworkStatus();
    }

    fetchNetworkStatus();
}

async function fetchNetworkStatus() {
    const devicesContainer = document.querySelector('#network-status-zone .network-devices');
    if (!devicesContainer) return;

    try {
        const response = await fetch('/api/status');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.devices || data.devices.length === 0) {
            devicesContainer.innerHTML = `
                <div class="network-empty">
                    <span style="font-size: 2rem;">📡</span>
                    <p>Aucun appareil surveillé</p>
                    <small>Configurez l'agent local pour voir les statuts</small>
                </div>
            `;
            return;
        }

        // Sort: alive first, then by name
        const sortedDevices = data.devices.sort((a, b) => {
            if (a.alive !== b.alive) return b.alive - a.alive;
            return a.name.localeCompare(b.name);
        });

        devicesContainer.innerHTML = sortedDevices.map(device => {
            const statusIcon = device.alive ? '🟢' : '🔴';
            const statusClass = device.alive ? 'online' : 'offline';
            const latencyText = device.alive && device.latency ? `${device.latency}ms` : '';
            const latencyClass = device.latency > 100 ? 'high-latency' : '';

            return `
                <div class="network-device ${statusClass}">
                    <span class="device-status">${statusIcon}</span>
                    <span class="device-name">${device.name}</span>
                    <span class="device-host">${device.host}</span>
                    ${latencyText ? `<span class="device-latency ${latencyClass}">${latencyText}</span>` : ''}
                </div>
            `;
        }).join('');

        // Update last check time
        if (data.lastUpdate) {
            const lastCheck = new Date(data.lastUpdate);
            const timeStr = lastCheck.toLocaleTimeString('fr-FR');

            let lastCheckEl = document.querySelector('#network-status-zone .network-last-check');
            if (!lastCheckEl) {
                lastCheckEl = document.createElement('div');
                lastCheckEl.className = 'network-last-check';
                devicesContainer.parentNode.appendChild(lastCheckEl);
            }
            lastCheckEl.textContent = `Dernière vérification: ${timeStr}`;
        }

    } catch (err) {
        console.warn('Failed to fetch network status:', err);
        devicesContainer.innerHTML = `
            <div class="network-error">
                <span style="font-size: 1.5rem;">⚠️</span>
                <p>Impossible de charger les statuts</p>
                <small>${err.message}</small>
            </div>
        `;
    }
}

function startAutoRefresh() {
    // Refresh every 30 seconds
    if (networkRefreshInterval) {
        clearInterval(networkRefreshInterval);
    }
    networkRefreshInterval = setInterval(fetchNetworkStatus, 30000);
}

export function stopNetworkRefresh() {
    if (networkRefreshInterval) {
        clearInterval(networkRefreshInterval);
        networkRefreshInterval = null;
    }
}
