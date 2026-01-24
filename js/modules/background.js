// Custom Background Module
// Note: showToast and other UI helpers could be imported if needed, 
// but we'll inject them or pass them as args if we want to avoid circular deps with main UI.
// Here we import specific helpers from ui.js
import { showToast, isValidImageUrl } from './ui.js';

export function initBackground() {
    const bgBtn = document.getElementById('bg-btn');
    const bgModal = document.getElementById('bg-modal');
    const bgForm = document.getElementById('bg-form');
    const cancelBgBtn = document.getElementById('cancel-bg-btn');
    const resetBgBtn = document.getElementById('reset-bg-btn');

    const savedBg = localStorage.getItem('customBackground');
    if (savedBg) {
        applyBgStyles(savedBg);
    }

    bgBtn.addEventListener('click', () => bgModal.classList.remove('hidden'));

    const close = () => {
        bgModal.classList.add('hidden');
        bgForm.reset();
    };
    cancelBgBtn.addEventListener('click', close);
    bgModal.addEventListener('click', (e) => { if (e.target === bgModal) close(); });

    resetBgBtn.addEventListener('click', () => {
        document.body.style.backgroundImage = '';
        document.body.classList.remove('has-bg');
        localStorage.removeItem('customBackground');
        close();
    });

    bgForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(bgForm);
        const bgUrl = formData.get('bg-url');
        const fileInput = document.getElementById('bg-file-input');

        if (fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                compressAndApply(event.target.result, close);
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else if (bgUrl) {
            saveAndApply(bgUrl, close);
        } else {
            close();
        }
    });
}

function applyBgStyles(url) {
    // Validate URL before applying
    if (!isValidImageUrl(url)) {
        console.warn('Invalid background URL blocked:', url.substring(0, 50));
        return false;
    }
    // Escape CSS special characters to prevent injection
    const safeUrl = url.replace(/[()'"`]/g, encodeURIComponent);
    document.body.style.backgroundImage = `url("${safeUrl}")`;
    document.body.classList.add('has-bg');
    return true;
}

function saveAndApply(url, closeCallback) {
    try {
        if (!applyBgStyles(url)) {
            showToast('URL d\'image invalide', 'error');
            return;
        }
        localStorage.setItem('customBackground', url);
        if (closeCallback) closeCallback();
        showToast('Fond d\'écran mis à jour', 'success');
    } catch (e) {
        console.error('Storage error:', e);
        showToast('L\'image est trop lourde pour être sauvegardée (max ~5Mo)', 'error');
    }
}

function compressAndApply(dataUrl, closeCallback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max resolution for background (Full HD-ish is enough for BG)
        const MAX_WIDTH = 1920;
        if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress as JPEG
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.8);
        saveAndApply(compressedUrl, closeCallback);
    };
    img.src = dataUrl;
}
