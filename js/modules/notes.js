
import { showToast } from './ui.js';

export function initNotes() {
    // Inject HTML if not present
    if (!document.getElementById('notes-widget')) {
        const notesHTML = `
            <div id="notes-widget" class="notes-widget hidden">
                <div class="notes-header">
                    <h3>Notes Rapides</h3>
                    <div class="notes-actions">
                         <button id="copy-notes-btn" title="Copier">📋</button>
                         <button id="close-notes-btn" title="Fermer">×</button>
                    </div>
                </div>
                <textarea id="notes-area" placeholder="Écrivez vos idées ici..."></textarea>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', notesHTML);
    }

    const widget = document.getElementById('notes-widget');
    const textarea = document.getElementById('notes-area');
    const closeBtn = document.getElementById('close-notes-btn');
    const copyBtn = document.getElementById('copy-notes-btn');
    const toggleBtn = document.getElementById('notes-toggle-btn'); // Needs to be added to header

    // Load content
    const savedNotes = localStorage.getItem('quickNotes');
    if (savedNotes) {
        textarea.value = savedNotes;
    }

    // Auto-save debounce
    let timeout;
    textarea.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            localStorage.setItem('quickNotes', textarea.value);
        }, 500);
    });

    // Toggle
    const toggleNotes = () => {
        widget.classList.toggle('hidden');
        if (!widget.classList.contains('hidden')) {
            textarea.focus();
        }
    };

    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleNotes);
    }

    closeBtn.addEventListener('click', () => widget.classList.add('hidden'));

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(textarea.value);
        showToast('Notes copiées !', 'success');
    });

    // Keyboard shortcut (Alt + N)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            toggleNotes();
        }
    });
}
