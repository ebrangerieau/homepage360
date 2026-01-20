
// UI Utilities Module

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
