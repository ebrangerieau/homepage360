# Authentication System - Testing Guide

## Setup Complete ✅

The authentication system has been successfully implemented with the following components:

### Backend
- ✅ `server/auth.js` - Core authentication logic
- ✅ `server/middleware/auth.js` - Session validation middleware
- ✅ `server/users.json` - User database (file-based)
- ✅ `server/index.js` - Integrated authentication routes
- ✅ Dependencies installed: bcrypt, cookie-parser

### Frontend
- ✅ `login.html` - Login page
- ✅ `login.css` - Styled login interface
- ✅ `js/login.js` - Login form logic
- ✅ `js/modules/auth.js` - Session management module
- ✅ `index.html` - Added logout button
- ✅ `js/main.js` - Integrated auth checks

### Configuration
- ✅ `.gitignore` - Excludes server/users.json
- ✅ `README.md` - Documentation updated

## Default Credentials

- **Username**: `admin`
- **Password**: `admin123`

## Manual Testing Checklist

### Test 1: Server Startup
```bash
export MONITOR_API_KEY=435e56fce124ca6c5729bd1673cd050c570caa8201fed3281ad5be0d59c15e76
cd server && npm start
```

Expected output:
```
✅ Homepage360 Server v2.2 running on port 3000
🔒 API Key configured: Yes
```

### Test 2: Unauthenticated Access Redirect
1. Open browser: http://localhost:3000/
2. **Expected**: Automatic redirect to `/login.html`
3. **Expected**: Login form displayed

### Test 3: Successful Login
1. Navigate to: http://localhost:3000/login.html
2. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
3. Click "Login"
4. **Expected**: Redirect to `/` (main dashboard)
5. **Expected**: Dashboard loads normally
6. **Expected**: Cookie `homepage360_session` set in browser (check DevTools)

### Test 4: Failed Login - Invalid Credentials
1. Navigate to: http://localhost:3000/login.html
2. Enter wrong password
3. **Expected**: Error message "Invalid username or password (4 attempts remaining)"
4. **Expected**: Stay on login page

### Test 5: Brute Force Protection
1. Try to login with wrong password 5 times
2. **Expected**: After 5 attempts, see error "Too many failed attempts. Account locked for 15 minutes."
3. **Expected**: HTTP 429 status code
4. Wait 15 minutes or restart server to reset

### Test 6: Remember Me
1. Login with "Remember me" checkbox checked
2. Check cookie expiration in DevTools
3. **Expected**: Cookie max-age = 2592000 seconds (30 days)

Without "Remember me":
- **Expected**: Cookie max-age = 86400 seconds (24 hours)

### Test 7: Protected Routes
While NOT logged in, try to access:
```bash
curl -I http://localhost:3000/api/status
```
**Expected**: HTTP 401 Unauthorized

After logging in (with valid session cookie):
```bash
curl -b "homepage360_session=<your-token>" http://localhost:3000/api/status
```
**Expected**: HTTP 200 OK with device statuses

### Test 8: Logout
1. While logged in, click the logout button (🚪)
2. **Expected**: Redirect to `/login.html`
3. **Expected**: Session cookie deleted
4. Try to access `/` again
5. **Expected**: Redirect to login page

### Test 9: Session Expiry (Simulated)
To test session expiry, temporarily modify `server/auth.js`:
```javascript
const SESSION_CONFIG = {
  sessionDuration: 10 * 1000, // 10 seconds
  // ...
};
```

1. Login successfully
2. Wait 11 seconds
3. Refresh the page
4. **Expected**: Redirect to login (session expired)

### Test 10: Inactivity Timeout (Simulated)
Modify `server/auth.js`:
```javascript
const SESSION_CONFIG = {
  inactivityTimeout: 10 * 1000, // 10 seconds
  // ...
};
```

1. Login successfully
2. Don't interact with the page for 11 seconds
3. Try to access any page
4. **Expected**: Redirect to login (inactivity timeout)

### Test 11: Periodic Session Refresh
1. Login successfully
2. Keep the dashboard open
3. Check browser DevTools Network tab
4. **Expected**: Every 30 minutes, see a GET request to `/api/auth/check`
5. **Expected**: Session stays alive as long as page is open

### Test 12: Agent Monitoring Unaffected
The monitoring agent should continue to work with API key authentication:

```bash
# From agent directory
curl -X POST http://localhost:3000/api/status \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 435e56fce124ca6c5729bd1673cd050c570caa8201fed3281ad5be0d59c15e76" \
  -d '{"statuses": [{"name": "Test", "host": "1.1.1.1", "alive": true, "latency": 10}]}'
```

**Expected**: HTTP 200 OK with `{"success": true}`

### Test 13: Static Files Protection
Try to access static files without authentication:
```bash
curl -I http://localhost:3000/style.css
curl -I http://localhost:3000/js/main.js
```
**Expected**: HTTP 302 redirect to /login.html

Login page resources should be accessible:
```bash
curl -I http://localhost:3000/login.css
curl -I http://localhost:3000/js/login.js
```
**Expected**: HTTP 200 OK

## Security Verification

### ✅ Cookies are Secure
Check cookie attributes in browser DevTools:
- `HttpOnly`: ✅ (prevents XSS access)
- `Secure`: ✅ (HTTPS only in production)
- `SameSite`: `Strict` ✅ (CSRF protection)

### ✅ Passwords are Hashed
Check `server/users.json`:
- Passwords are stored as bcrypt hashes (starting with `$2b$12$`)
- Never stored in plaintext

### ✅ Timing-Safe Comparisons
Session tokens are compared using `crypto.timingSafeEqual()` to prevent timing attacks

### ✅ Structured Logging
All auth events are logged in JSON format:
```json
{
  "timestamp": "2026-02-10T...",
  "level": "INFO",
  "message": "User logged in",
  "username": "admin",
  "ip": "::1",
  "sessionId": "abc123..."
}
```

## Troubleshooting

### Issue: "Module not found: bcrypt"
Solution: Run `cd server && npm install`

### Issue: Server won't start - "MONITOR_API_KEY must be set"
Solution: Export the API key:
```bash
export MONITOR_API_KEY=435e56fce124ca6c5729bd1673cd050c570caa8201fed3281ad5be0d59c15e76
```

### Issue: Login always fails
1. Check `server/users.json` exists
2. Verify password hash was generated correctly
3. Check server logs for detailed error messages

### Issue: Session expires immediately
Check that cookies are enabled in browser and not blocked by extensions

### Issue: CORS errors
Make sure you're accessing via the correct origin (localhost:3000, not 127.0.0.1)

## Architecture Summary

```
User → Login Page → POST /api/auth/login → Validate credentials
  ↓                                              ↓
Cookie Set ← Session Created ← Password verified
  ↓
Protected Routes → requireAuth middleware → Validate session
  ↓                                             ↓
Access Granted ← Session Valid ← Token verified
```

## Next Steps

1. ✅ Test all scenarios above
2. 🔄 Change default admin password in production
3. 🔄 Add more users to `server/users.json` as needed
4. 🔄 Configure environment variables for production deployment
5. 🔄 Set up HTTPS in production (cookies will be Secure)

## Production Deployment Notes

- Set `NODE_ENV=production` for secure cookies
- Use HTTPS (Let's Encrypt via Traefik)
- Rotate API keys periodically
- Monitor failed login attempts in logs
- Consider adding 2FA in the future
- Backup `server/users.json` regularly
