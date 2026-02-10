/**
 * Login page logic
 * Handles form submission and authentication
 */

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const loginButton = loginForm.querySelector('.login-button');
const buttonText = loginButton.querySelector('.button-text');
const buttonLoading = loginButton.querySelector('.button-loading');

// Hide error message initially
function hideError() {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Set loading state
function setLoading(loading) {
    loginButton.disabled = loading;
    if (loading) {
        buttonText.style.display = 'none';
        buttonLoading.style.display = 'inline';
    } else {
        buttonText.style.display = 'inline';
        buttonLoading.style.display = 'none';
    }
}

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    setLoading(true);

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, rememberMe })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Login successful, redirect to main app
            window.location.href = '/';
        } else {
            // Login failed
            if (response.status === 429) {
                // Account locked
                const lockedUntil = data.lockedUntil ? new Date(data.lockedUntil) : null;
                if (lockedUntil) {
                    const minutes = Math.ceil((lockedUntil - new Date()) / 60000);
                    showError(`Too many failed attempts. Account locked for ${minutes} minute${minutes > 1 ? 's' : ''}.`);
                } else {
                    showError(data.error || 'Too many failed attempts. Please try again later.');
                }
            } else if (response.status === 401) {
                // Invalid credentials
                const attemptsMsg = data.attemptsRemaining !== undefined
                    ? ` (${data.attemptsRemaining} attempt${data.attemptsRemaining > 1 ? 's' : ''} remaining)`
                    : '';
                showError((data.error || 'Invalid username or password') + attemptsMsg);
            } else {
                showError(data.error || 'Login failed. Please try again.');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        setLoading(false);
    }
});

// Auto-focus username field on load
document.getElementById('username').focus();
