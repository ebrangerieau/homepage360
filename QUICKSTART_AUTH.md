# Quick Start Guide - Authentication System

## Test the Authentication System in 60 Seconds

### Step 1: Start the Server (10 seconds)

```bash
# From the homepage360 root directory
export MONITOR_API_KEY=435e56fce124ca6c5729bd1673cd050c570caa8201fed3281ad5be0d59c15e76
cd server
npm start
```

You should see:
```
✅ Homepage360 Server v2.2 running on port 3000
🔒 API Key configured: Yes
```

### Step 2: Test Unauthenticated Access (10 seconds)

Open your browser and navigate to:
```
http://localhost:3000/
```

**Expected Result**: You'll be automatically redirected to `/login.html`

### Step 3: Login (10 seconds)

On the login page, enter:
- **Username**: `admin`
- **Password**: `admin123`

Click "Login"

**Expected Result**: Redirect to main dashboard with all features working

### Step 4: Verify Session (10 seconds)

Open Browser DevTools (F12) → Application → Cookies → http://localhost:3000

You should see a cookie named `homepage360_session` with:
- ✅ HttpOnly flag
- ✅ SameSite: Strict
- ✅ Max-Age: 86400 (24 hours)

### Step 5: Test Logout (10 seconds)

Click the logout button (🚪) in the top-right corner

**Expected Result**:
- Redirected back to `/login.html`
- Cookie is deleted
- Can't access `/` without logging in again

### Step 6: Test Brute Force Protection (10 seconds)

Try to login with wrong password 5 times:
- Password: `wrongpassword` → Click Login
- Repeat 5 times

**Expected Result**: After 5 attempts, you'll see:
```
Too many failed attempts. Account locked for 15 minutes.
```

---

## That's It! 🎉

Your authentication system is working correctly.

## Next Steps

1. **Change the default password** (see README.md)
2. **Test with your monitoring agent** (agent should still work with API key)
3. **Deploy to production** (see IMPLEMENTATION_SUMMARY.md)

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Make sure you exported the MONITOR_API_KEY

### Login doesn't work
- Check `server/users.json` exists
- Verify server logs for errors
- Try clearing browser cookies and cache

### Redirects to login immediately after logging in
- Check browser console for errors
- Verify cookies are enabled
- Check that you're using `localhost:3000` not `127.0.0.1:3000`

## Full Documentation

- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Complete Testing Guide**: `AUTH_TESTING.md`
- **Setup Instructions**: `README.md`
