
// UI Utilities Module

// ============================================
// Security Utilities
// ============================================

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for innerHTML
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') return String(str);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Validate URL to prevent javascript: and other dangerous protocols
 * @param {string} url - URL to validate
 * @returns {boolean} - True if URL is safe
 */
export function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

/**
 * Validate image URL (includes data: URLs for base64 images)
 * @param {string} url - URL to validate
 * @returns {boolean} - True if URL is a valid image source
 */
export function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        // Allow data: URLs for images
        if (url.startsWith('data:image/')) return true;

        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

// ============================================
// UI Components
// ============================================


export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span style="font-size: 1.2rem;">${icon}</span><span>${message}</span>`;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300); // Match slideOutRight animation duration
    }, duration);
}

export function showConfirm(title, message, callback) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    // Clone buttons to remove previous event listeners
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');

    newOkBtn.onclick = () => {
        callback();
        close();
    };

    newCancelBtn.onclick = close;

    // Update the onclick for modal background close as well, just in case
    modal.onclick = (e) => {
        if (e.target === modal) close();
    };
}
