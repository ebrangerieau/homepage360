
// RSS Module
import { getConfig, persistState } from './store.js';
import { showToast } from './ui.js';

// Cache for scraped images (in memory for session)
const imageCache = new Map();

// Load image cache from localStorage
function loadImageCache() {
    try {
        const cached = localStorage.getItem('rss_image_cache');
        if (cached) {
            const parsed = JSON.parse(cached);
            Object.entries(parsed).forEach(([url, img]) => imageCache.set(url, img));
        }
    } catch (e) {
        console.error('Failed to load image cache:', e);
    }
}

// Save image cache to localStorage
function saveImageCache() {
    try {
        const cacheObj = {};
        imageCache.forEach((value, key) => {
            cacheObj[key] = value;
        });
        localStorage.setItem('rss_image_cache', JSON.stringify(cacheObj));
    } catch (e) {
        console.error('Failed to save image cache:', e);
    }
}

// Initialize cache on module load
loadImageCache();

// Function to scrape Open Graph image from article URL (optimized)
async function scrapeOGImage(articleUrl, timeout = 5000) {
    // Check cache first
    if (imageCache.has(articleUrl)) {
        return imageCache.get(articleUrl);
    }

    try {
        // Using allorigins as CORS proxy with timeout
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(articleUrl)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(proxyUrl, {
            signal: controller.signal,
            // Only read first 1MB like danb/rss does
        });
        clearTimeout(timeoutId);

        // Read only first 1MB to save memory and time
        const reader = response.body.getReader();
        const chunks = [];
        let totalSize = 0;
        const maxSize = 1024 * 1024; // 1MB limit

        while (totalSize < maxSize) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalSize += value.length;
        }

        // Cancel reading if we hit the limit
        await reader.cancel();

        // Convert chunks to text
        const blob = new Blob(chunks);
        const html = await blob.text();

        // Try to find og:image meta tag
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

        if (ogImageMatch && ogImageMatch[1]) {
            const imageUrl = ogImageMatch[1];
            imageCache.set(articleUrl, imageUrl);
            saveImageCache();
            return imageUrl;
        }

        // Fallback: try twitter:image
        const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);

        if (twitterImageMatch && twitterImageMatch[1]) {
            const imageUrl = twitterImageMatch[1];
            imageCache.set(articleUrl, imageUrl);
            saveImageCache();
            return imageUrl;
        }

        // Cache null result to avoid retrying
        imageCache.set(articleUrl, null);
        return null;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.warn('Scraping timeout for', articleUrl);
        } else {
            console.error('OG Image scraping error for', articleUrl, ':', err);
        }
        return null;
    }
}

// Helper function to limit concurrent requests
async function limitConcurrency(items, asyncFn, limit = 3) {
    const results = [];
    const executing = [];

    for (const item of items) {
        const p = asyncFn(item).then(result => {
            executing.splice(executing.indexOf(p), 1);
            return result;
        });

        results.push(p);
        executing.push(p);

        if (executing.length >= limit) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
}

async function fetchRSS(feedUrl) {
    // Using rss2json service as a free CORS proxy
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (data.status === 'ok') {
            // First, extract basic data and check for existing images
            const items = data.items.map(item => ({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                description: item.description.replace(/<[^>]*>?/gm, '').slice(0, 150) + '...',
                source: data.feed.title || 'Source',
                image: item.enclosure?.link || item.thumbnail || null,
                rawContent: item.content || item.description
            }));

            // Process items with limited concurrency for scraping
            const itemsWithImages = await limitConcurrency(items, async (item) => {
                let image = item.image;

                // If no image found, try to extract from HTML content
                if (!image && item.rawContent) {
                    const imgMatch = item.rawContent.match(/<img[^>]+src="([^">]+)"/);
                    if (imgMatch && imgMatch[1]) {
                        image = imgMatch[1];
                    }
                }

                // If still no image, scrape the article page for Open Graph image
                if (!image && item.link) {
                    image = await scrapeOGImage(item.link);
                }

                // Return item without rawContent
                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    description: item.description,
                    source: item.source,
                    image: image
                };
            }, 3); // Max 3 concurrent scraping requests

            return itemsWithImages;
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
