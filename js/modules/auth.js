/**
 * Authentication module
 * Handles session verification, logout, and periodic session refresh
 */

const SESSION_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

/**
 * Check if user is authenticated and redirect to login if not
 * Should be called at app initialization
 */
export async function checkAuthAndRedirect() {
    try {
        const response = await fetch('/api/auth/check', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            // Not authenticated, redirect to login
            window.location.href = '/login.html';
            return false;
        }

        const data = await response.json();
        return data.valid;
    } catch (error) {
        console.error('Auth check failed:', error);
        // On network error, redirect to login to be safe
        window.location.href = '/login.html';
        return false;
    }
}

/**
 * Logout user and redirect to login page
 */
export async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Always redirect to login, even if logout request fails
        window.location.href = '/login.html';
    }
}

/**
 * Periodically refresh session to keep it alive
 * Pings the server every 30 minutes to update lastActivity
 */
export function refreshSessionPeriodically() {
    setInterval(async () => {
        try {
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                // Session expired or invalid
                console.warn('Session expired, redirecting to login');
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Session refresh failed:', error);
            // Don't redirect on network error, user might be temporarily offline
        }
    }, SESSION_CHECK_INTERVAL);
}
