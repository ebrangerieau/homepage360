
// State Management Module

export const defaultState = {
    activeProfileId: 'default',
    profiles: {
        'default': {
            name: 'Défaut',
            zones: [
                { id: 'tools', title: 'Outils' },
                { id: 'microsoft', title: 'Microsoft' },
                { id: 'ia', title: 'IA' }
            ],
            blocks: [
                { id: 'vscode', label: 'VS Code', url: 'https://code.visualstudio.com', zone: 'tools' },
                { id: 'azure', label: 'Azure', url: 'https://azure.microsoft.com', zone: 'microsoft' },
                { id: 'chatgpt', label: 'ChatGPT', url: 'https://chat.openai.com', zone: 'ia' }
            ],
            rss: [
                { name: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml' },
                { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
                { name: 'Wired', url: 'https://www.wired.com/feed/rss' }
            ],
            rssItemsLimit: 3
        }
    }
};

let appState = { ...defaultState };
let currentConfig = null;

export function loadState() {
    const saved = localStorage.getItem('homepageLayout');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.profiles && data.activeProfileId) {
                appState = data;
            } else {
                // Migration from old single-config format
                appState.profiles.default = { ...appState.profiles.default, ...data };
            }
        } catch (e) {
            console.warn('Failed to parse saved layout');
        }
    }
    updateCurrentConfig();
    return appState;
}

export function persistState() {
    localStorage.setItem('homepageLayout', JSON.stringify(appState));
}

function updateCurrentConfig() {
    currentConfig = appState.profiles[appState.activeProfileId];
}

export function getState() {
    return appState;
}

/**
 * Validate URL to prevent javascript: and other dangerous protocols
 */
function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

/**
 * Validate state structure to prevent malformed imports
 */
function validateState(state) {
    if (!state || typeof state !== 'object') return false;
    if (!state.profiles || typeof state.profiles !== 'object') return false;
    if (!state.activeProfileId || typeof state.activeProfileId !== 'string') return false;
    if (!state.profiles[state.activeProfileId]) return false;

    // Validate each profile
    for (const [id, profile] of Object.entries(state.profiles)) {
        if (!profile || typeof profile !== 'object') return false;
        if (!profile.name || typeof profile.name !== 'string') return false;
        if (!Array.isArray(profile.zones)) return false;
        if (!Array.isArray(profile.blocks)) return false;

        // Sanitize URLs in blocks
        for (const block of profile.blocks) {
            if (block.url && !isValidUrl(block.url)) {
                console.warn('Invalid URL sanitized in block:', block.label);
                block.url = '#invalid-url';
            }
        }
    }
    return true;
}

export function setState(newState) {
    if (!validateState(newState)) {
        console.error('Invalid state format - import rejected');
        return false;
    }
    appState = newState;
    updateCurrentConfig();
    persistState();
    return true;
}

// Get the configuration (zones, blocks, etc.) for the ACTIVE profile
export function getConfig() {
    return currentConfig;
}

export function setActiveProfile(profileId) {
    if (appState.profiles[profileId]) {
        appState.activeProfileId = profileId;
        updateCurrentConfig();
        persistState();
        return currentConfig;
    }
    return null;
}

export function deleteProfile(profileId) {
    if (appState.profiles[profileId]) {
        delete appState.profiles[profileId];
        persistState();
        return true;
    }
    return false;
}

export function createProfile(id, name, templateRss = []) {
    appState.profiles[id] = {
        name: name,
        zones: [{ id: 'general-' + Date.now(), title: 'Général' }],
        blocks: [],
        rss: [...templateRss] // Copy RSS config by default
    };
    persistState();
    return appState.profiles[id];
}
