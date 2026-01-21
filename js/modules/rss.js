
// RSS Module
import { getConfig, persistState } from './store.js';
import { showToast } from './ui.js';

async function fetchRSS(feedUrl) {
    // Using rss2json service as a free CORS proxy
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (data.status === 'ok') {
            // Get fallback image from feed (logo/icon)
            const feedImage = data.feed?.image || null;

            return data.items.map(item => {
                // Try to extract image from multiple sources
                let image = item.enclosure?.link || item.thumbnail || null;

                // If no image found, try to extract from HTML content
                if (!image && (item.content || item.description)) {
                    const htmlContent = item.content || item.description;
                    const imgMatch = htmlContent.match(/<img[^>]+src="([^">]+)"/);
                    if (imgMatch && imgMatch[1]) {
                        image = imgMatch[1];
                    }
                }

                // Use feed image as last fallback if no article image found
                if (!image && feedImage) {
                    image = feedImage;
                }

                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    description: item.description.replace(/<[^>]*>?/gm, '').slice(0, 150) + '...',
                    source: data.feed.title || 'Source',
                    image: image
                };
            });
        }
        return [];
    } catch (err) {
        console.error('RSS Fetch Error:', err);
        return [];
    }
}

export async function fetchAllRSS() {
    const rssList = document.getElementById('rss-list');
    rssList.innerHTML = '<div style="text-align:center; padding:2rem; opacity:0.5;">Mise à jour des flux...</div>';

    const config = getConfig(); // Get latest config
    if (!config) return;

    let allItems = [];
    const limit = config.rssItemsLimit || 3;
    const fetches = config.rss.map(feed => fetchRSS(feed.url));
    const results = await Promise.all(fetches);

    results.forEach(items => {
        // Limit items per feed before adding to aggregate
        allItems = allItems.concat(items.slice(0, limit));
    });

    // Sort by date and take total top (still reasonable limit)
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    renderRSS(allItems);

    // Update status widget with sync time
    const statusText = document.querySelector('.status-text');
    if (statusText) {
        const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        statusText.textContent = `SYNC: ${now}`;
    }
}

function renderRSS(items) {
    const rssList = document.getElementById('rss-list');
    if (items.length === 0) {
        rssList.innerHTML = '<div style="text-align:center; padding:2rem; opacity:0.5;">Aucun flux disponible</div>';
        return;
    }

    rssList.innerHTML = items.map(item => `
    <article class="rss-item" onclick="window.open('${item.link}', '_blank')">
      ${item.image ? `<img src="${item.image}" alt="${item.title}" class="rss-image" loading="lazy" onerror="this.style.display='none'"/>` : ''}
      <div class="rss-content">
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="rss-meta">
          <span>${item.source}</span>
          <span>${new Date(item.pubDate).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </article>
  `).join('');
}

export function initRSS() {
    const refreshBtn = document.getElementById('refresh-rss');
    refreshBtn.addEventListener('click', () => {
        fetchAllRSS();
        showToast('Flux mis à jour', 'info');
    });

    const rssList = document.getElementById('rss-list');
    const upBtn = document.getElementById('rss-up-btn');
    const downBtn = document.getElementById('rss-down-btn');

    if (upBtn && downBtn && rssList) {
        upBtn.addEventListener('click', () => {
            rssList.scrollBy({ top: -200, behavior: 'smooth' });
        });
        downBtn.addEventListener('click', () => {
            rssList.scrollBy({ top: 200, behavior: 'smooth' });
        });
    }

    fetchAllRSS();

    // Refresh every 15 minutes
    setInterval(fetchAllRSS, 15 * 60 * 1000);
    initRSSManagement();
}

function initRSSManagement() {
    const modal = document.getElementById('rss-modal');
    const openBtn = document.getElementById('rss-settings-btn');
    const closeBtn = document.getElementById('close-rss-modal');
    const form = document.getElementById('add-rss-form');
    const list = document.getElementById('rss-manage-list');
    const limitInput = document.getElementById('rss-items-limit');

    const renderManageList = () => {
        const config = getConfig();
        limitInput.value = config.rssItemsLimit || 3;
        list.innerHTML = config.rss.map((feed, index) => `
      <div class="rss-manage-item">
        <span>${feed.name}</span>
        <button class="delete-rss-btn" data-index="${index}" title="Supprimer">×</button>
      </div>
    `).join('');

        list.querySelectorAll('.delete-rss-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                config.rss.splice(index, 1);
                persistState();
                renderManageList();
                fetchAllRSS();
                showToast('Flux supprimé', 'info');
            });
        });
    };

    openBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        renderManageList();
    });

    const close = () => modal.classList.add('hidden');
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    limitInput.addEventListener('change', (e) => {
        const config = getConfig();
        config.rssItemsLimit = parseInt(e.target.value) || 3;
        persistState();
        fetchAllRSS();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const newFeed = {
            name: formData.get('rss-name'),
            url: formData.get('rss-url')
        };
        const config = getConfig();
        config.rss.push(newFeed);
        persistState();
        renderManageList();
        fetchAllRSS();
        form.reset();
        showToast('Flux ajouté avec succès !', 'success');
    });
}
