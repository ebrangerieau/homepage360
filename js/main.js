
import { loadState, getConfig, persistState, getState, setActiveProfile, deleteProfile, createProfile, setState } from './modules/store.js';
import { showToast, showConfirm } from './modules/ui.js';
import { initBackground } from './modules/background.js';
import { initRSS, fetchAllRSS } from './modules/rss.js';
import { initClock, initWeather } from './modules/widgets.js';
import { initNotes } from './modules/notes.js';
import { initNetwork } from './modules/network.js';

// Init State
loadState();

// Core Render Logic
function render(searchQuery = '') {
    const config = getConfig();
    if (!config) return;

    const query = searchQuery.toLowerCase().trim();
    const zonesContainer = document.getElementById('zones');
    zonesContainer.innerHTML = '';

    config.zones.forEach(zone => {
        const blocksInZone = config.blocks.filter(b => b.zone === zone.id);
        const filteredBlocks = blocksInZone.filter(b =>
            b.label.toLowerCase().includes(query) ||
            b.url.toLowerCase().includes(query)
        );

        if (query && filteredBlocks.length === 0) return;

        const zoneEl = document.createElement('section');
        zoneEl.className = 'zone';
        zoneEl.dataset.zoneId = zone.id;

        const cols = zone.columns || 1;
        zoneEl.innerHTML = `
      <div class="zone-header">
        <h2>${zone.title}</h2>
        <div class="zone-controls">
            <button class="layout-zone-btn" data-zone-id="${zone.id}" title="Layout: ${cols} colonne(s)">
                ${cols === 1 ? '1️⃣' : cols === 2 ? '2️⃣' : '3️⃣'}
            </button>
            <button class="delete-zone-btn" aria-label="Delete zone" data-zone-id="${zone.id}">×</button>
        </div>
      </div>
    `;
        const blockList = document.createElement('div');
        blockList.className = `block-list cols-${cols}`;

        filteredBlocks.forEach(block => {
            const blk = document.createElement('div');
            blk.className = 'block';
            blk.dataset.blockId = block.id;
            if (block.color) {
                blk.style.background = block.color;
            }

            blk.onclick = (e) => {
                if (!e.target.closest('.block-action-btn')) {
                    window.open(block.url, '_blank');
                }
            };

            blk.innerHTML = `
        <span>${block.label}</span>
        <div class="block-actions">
           <button class="block-action-btn edit" title="Modifier">✎</button>
           <button class="block-action-btn delete" title="Supprimer">×</button>
        </div>
      `;

            blk.querySelector('.edit').addEventListener('click', (e) => {
                e.stopPropagation();
                editBlock(block.id);
            });
            blk.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteBlock(block.id);
            });

            blockList.appendChild(blk);
        });

        zoneEl.appendChild(blockList);
        zonesContainer.appendChild(zoneEl);
    });

    document.querySelectorAll('.delete-zone-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const zId = e.currentTarget.dataset.zoneId;
            deleteZone(zId);
        };
    });

    document.querySelectorAll('.layout-zone-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            toggleZoneLayout(e.currentTarget.dataset.zoneId);
        };
    });

    initDrag();
}

function initDrag() {
    const zonesContainer = document.getElementById('zones');
    const lists = document.querySelectorAll('.zone .block-list');
    const isSearchActive = document.getElementById('search-input').value.trim() !== '';

    if (isSearchActive) {
        if (zonesContainer._sortable) {
            zonesContainer._sortable.destroy();
            delete zonesContainer._sortable;
        }
    } else if (!zonesContainer._sortable && window.Sortable) {
        zonesContainer._sortable = new window.Sortable(zonesContainer, {
            animation: 150,
            handle: '.zone-header',
            onEnd: saveLayout
        });
    }

    lists.forEach(list => {
        if (isSearchActive) {
            if (list._sortable) {
                list._sortable.destroy();
                delete list._sortable;
            }
            return;
        }

        if (!list._sortable && window.Sortable) {
            list._sortable = new window.Sortable(list, {
                group: 'shared',
                animation: 150,
                onEnd: saveLayout
            });
        }
    });
}

function saveLayout() {
    const config = getConfig();
    const newZones = [];
    const newBlocks = [];

    document.querySelectorAll('.zone').forEach(zoneEl => {
        const zoneId = zoneEl.dataset.zoneId;
        const originalZone = config.zones.find(z => z.id === zoneId);
        if (originalZone) {
            newZones.push(originalZone);
        }

        zoneEl.querySelectorAll('.block').forEach(blockEl => {
            const blockId = blockEl.dataset.blockId;
            const original = config.blocks.find(b => b.id === blockId);
            if (original) {
                newBlocks.push({ ...original, zone: zoneId });
            }
        });
    });

    config.zones = newZones;
    config.blocks = newBlocks;
    persistState();
}

function deleteBlock(id) {
    showConfirm('Supprimer ce bloc ?', 'Cette action est irréversible.', () => {
        const config = getConfig();
        const blockEl = document.querySelector(`.block[data-block-id="${id}"]`);

        const removeLogic = () => {
            config.blocks = config.blocks.filter(b => b.id !== id);
            persistState();
            render();
            showToast('Bloc supprimé', 'info');
        };

        if (blockEl) {
            blockEl.classList.add('removing');
            setTimeout(removeLogic, 300);
        } else {
            removeLogic();
        }
    });
}

function deleteZone(zoneId) {
    const config = getConfig();
    const blocksInZone = config.blocks.filter(b => b.zone === zoneId);
    if (blocksInZone.length > 0) {
        showToast('Impossible de supprimer une zone non vide', 'error');
        return;
    }
    showConfirm('Supprimer cette zone ?', 'La zone sera définitivement retirée.', () => {
        const el = document.querySelector(`.zone[data-zone-id="${zoneId}"]`);

        const removeLogic = () => {
            config.zones = config.zones.filter(z => z.id !== zoneId);
            persistState();
            render();
            showToast('Zone supprimée', 'info');
        };

        if (el) {
            el.classList.add('removing');
            setTimeout(removeLogic, 400);
        } else {
            removeLogic();
        }
    });
}

function toggleZoneLayout(zoneId) {
    const config = getConfig();
    const zone = config.zones.find(z => z.id === zoneId);
    if (zone) {
        const current = zone.columns || 1;
        // Cycle 1 -> 2 -> 3 -> 1
        zone.columns = current >= 3 ? 1 : current + 1;
        persistState();
        render();
    }
}

let editingBlockId = null;

function editBlock(id) {
    const config = getConfig();
    const block = config.blocks.find(b => b.id === id);
    if (block) {
        openBlockModal('edit', block);
    }
}

function openBlockModal(mode = 'add', blockData = null) {
    const modal = document.getElementById('add-modal');
    const modalTitle = modal.querySelector('h3');
    const submitBtn = modal.querySelector('button[type="submit"]');
    const form = document.getElementById('add-block-form');
    const select = document.getElementById('zone-select');
    const config = getConfig();

    select.innerHTML = config.zones.map(z => `<option value="${z.id}">${z.title}</option>`).join('');

    modal.classList.remove('hidden');
    if (mode === 'edit' && blockData) {
        modalTitle.textContent = 'Modifier le bloc';
        submitBtn.textContent = 'Enregistrer';
        editingBlockId = blockData.id;
        form.elements['label'].value = blockData.label;
        form.elements['url'].value = blockData.url;
        form.elements['zone'].value = blockData.zone;
        form.elements['color'].value = blockData.color || '#4b2bee';
    } else {
        modalTitle.textContent = 'Ajouter un bloc';
        submitBtn.textContent = 'Ajouter';
        editingBlockId = null;
        form.reset();
    }
}

function initModal() {
    const modal = document.getElementById('add-modal');
    const btn = document.getElementById('add-block-btn');
    const cancel = document.getElementById('cancel-btn');
    const form = document.getElementById('add-block-form');

    btn.addEventListener('click', () => openBlockModal('add'));

    const close = () => modal.classList.add('hidden');
    cancel.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const config = getConfig();
        const formData = new FormData(form);
        const blockData = {
            label: formData.get('label'),
            url: formData.get('url'),
            zone: formData.get('zone'),
            color: formData.get('color')
        };

        if (editingBlockId) {
            const idx = config.blocks.findIndex(b => b.id === editingBlockId);
            if (idx !== -1) {
                config.blocks[idx] = { ...config.blocks[idx], ...blockData };
                showToast('Bloc modifié avec succès !', 'success');
            }
        } else {
            config.blocks.push({
                id: 'block-' + Date.now(),
                ...blockData
            });
            showToast('Bloc ajouté avec succès !', 'success');
        }

        persistState();
        render();
        close();
        form.reset();
    });
}


function initZoneModal() {
    const modal = document.getElementById('add-zone-modal');
    const btn = document.getElementById('add-zone-btn');
    const cancel = document.getElementById('cancel-zone-btn');
    const form = document.getElementById('add-zone-form');

    btn.addEventListener('click', () => modal.classList.remove('hidden'));

    const close = () => modal.classList.add('hidden');
    cancel.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const config = getConfig();
        const formData = new FormData(form);
        const title = formData.get('zone-title');
        const newZone = {
            id: 'zone-' + Date.now(),
            title: title
        };
        config.zones.push(newZone);
        persistState();
        render();
        close();
        form.reset();
        showToast('Zone ajoutée avec succès !', 'success');
    });
}

function initTheme() {
    const btn = document.getElementById('theme-toggle');
    const current = localStorage.getItem('theme') || 'light';
    document.documentElement.dataset.theme = current;
    btn.addEventListener('click', () => {
        const newTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
    });
}

function initSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        render(e.target.value);
    });
}

function initProfiles() {
    const select = document.getElementById('profile-select');
    const addBtn = document.getElementById('add-profile-btn');
    const renameBtn = document.getElementById('rename-profile-btn');
    const deleteBtn = document.getElementById('delete-profile-btn');
    const modal = document.getElementById('profile-modal');
    const title = document.getElementById('profile-modal-title');
    const form = document.getElementById('profile-form');
    const submitBtn = document.getElementById('profile-submit-btn');
    const cancelBtn = document.getElementById('cancel-profile-btn');
    const nameInput = document.getElementById('profile-name-input');

    const appState = getState();

    let profileMode = 'add';

    const renderSelect = () => {
        const currentId = appState.activeProfileId;
        select.innerHTML = Object.keys(appState.profiles).map(id =>
            `<option value="${id}" ${id === currentId ? 'selected' : ''}>${appState.profiles[id].name}</option>`
        ).join('');
        deleteBtn.style.display = Object.keys(appState.profiles).length > 1 ? 'block' : 'none';
    };

    const openModal = (mode) => {
        profileMode = mode;
        modal.classList.remove('hidden');
        if (mode === 'add') {
            title.textContent = 'Nouveau Profil';
            submitBtn.textContent = 'Créer';
            form.reset();
        } else {
            title.textContent = 'Renommer le profil';
            submitBtn.textContent = 'Enregistrer';
            nameInput.value = getConfig().name;
        }
        nameInput.focus();
    };

    const close = () => modal.classList.add('hidden');

    select.addEventListener('change', (e) => {
        const config = setActiveProfile(e.target.value);
        showToast(`Passage au profil : ${config.name}`, 'info');
        render();
        fetchAllRSS();
        renderSelect();
    });

    renameBtn.addEventListener('click', () => openModal('rename'));

    deleteBtn.addEventListener('click', () => {
        const appState = getState();
        if (Object.keys(appState.profiles).length <= 1) return;

        const profileName = getConfig().name;
        showConfirm('Supprimer le profil ?', `Voulez-vous vraiment supprimer "${profileName}" ?`, () => {
            const oldId = appState.activeProfileId;
            const otherIds = Object.keys(appState.profiles).filter(id => id !== oldId);

            setActiveProfile(otherIds[0]);
            deleteProfile(oldId);

            renderSelect();
            render();
            fetchAllRSS();
            showToast(`Profil "${profileName}" supprimé`, 'info');
        });
    });

    addBtn.addEventListener('click', () => openModal('add'));
    cancelBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = new FormData(form).get('profile-name');

        if (profileMode === 'add') {
            const currentRSS = getConfig().rss;
            const id = 'profile-' + Date.now();
            createProfile(id, name, currentRSS);
            setActiveProfile(id);
            showToast(`Profil "${name}" créé !`, 'success');
        } else {
            const config = getConfig();
            config.name = name;
            persistState();
            showToast(`Profil renommé en "${name}"`, 'success');
        }

        renderSelect();
        render();
        fetchAllRSS();
        close();
        form.reset();
    });

    renderSelect();
}

function initExportImport() {
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const fileInput = document.getElementById('import-file');

    exportBtn.addEventListener('click', () => {
        const data = {
            config: getState(),
            theme: document.documentElement.dataset.theme
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `homepage360-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Configuration complète exportée !', 'success');
    });

    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.config) {
                    if (data.config.profiles) {
                        setState(data.config);
                    } else {
                        const config = getConfig();
                        Object.assign(config, data.config);
                        persistState();
                    }

                    if (data.theme) {
                        document.documentElement.dataset.theme = data.theme;
                        localStorage.setItem('theme', data.theme);
                    }
                    render();
                    initProfiles();
                    fetchAllRSS();
                    showToast('Configuration restaurée avec succès !', 'success');
                } else {
                    showToast('Fichier de configuration invalide', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Erreur lors de la lecture du fichier', 'error');
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });
}

function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Note: Alt+N is handled in notes module now? 
        // We should ensure no collision, but global handler handles 'n' alone, notes uses 'Alt+N'. Correct.
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            if (e.key === 'Escape') {
                document.activeElement.blur();
                if (document.activeElement.id === 'search-input') {
                    document.activeElement.value = '';
                    render('');
                }
            }
            return;
        }

        switch (e.key.toLowerCase()) {
            case '/':
                e.preventDefault();
                document.getElementById('search-input').focus();
                break;
            case 'n':
                if (!e.altKey && !e.ctrlKey) {
                    e.preventDefault();
                    document.getElementById('add-block-btn').click();
                }
                break;
            case 'z':
                e.preventDefault();
                document.getElementById('add-zone-btn').click();
                break;
            case 't':
                e.preventDefault();
                document.getElementById('theme-toggle').click();
                break;
            case 'r':
                e.preventDefault();
                fetchAllRSS();
                showToast('Rafraîchissement des flux...', 'info');
                break;
            case 'h':
                e.preventDefault();
                document.getElementById('help-modal').classList.remove('hidden');
                break;
            case 'escape':
                document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
                    modal.classList.add('hidden');
                });
                break;
        }
    });
}

function initHelpModal() {
    const modal = document.getElementById('help-modal');
    const btn = document.getElementById('help-btn');
    const closeBtn = document.getElementById('close-help-btn');

    btn.addEventListener('click', () => modal.classList.remove('hidden'));

    const close = () => modal.classList.add('hidden');
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

function initSettings() { }

// Initialization Sequence
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    render();
    initSettings();
    initRSS();
    initBackground();
    initClock();
    initWeather();
    initSearch();
    initExportImport();
    initProfiles();
    initShortcuts();
    initHelpModal();
    initModal();     // Blocks modal
    initZoneModal(); // Zones modal
    initNotes();     // Quick Notes
    initNetwork();   // Network Status

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW Registered:', registration.scope))
            .catch(err => console.log('SW Registration Failed:', err));
    }
});
