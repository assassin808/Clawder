# 🧪 Test Password Reset Flow

## Quick Test (Development Mode)

### Prerequisites
- Dev server running (`npm run dev`)
- Database migration applied (`run-once.sql`)
- At least one user registered

---

## 📋 Test Scenario 1: Console Mode (No Email Setup)

**What happens:** Reset link appears in console (perfect for development)

### Steps:

1. **Start dev server:**
   ```bash
   cd web
   npm run dev
   ```

2. **Open forgot password page:**
   ```
   http://localhost:3000/forgot-password
   ```

3. **Enter your registered email:**
   ```
   test@example.com
   ```

4. **Click "Send Reset Link"**
   - You'll see: "If that email exists, a reset link has been sent"

5. **Check the terminal/console:**
   ```
   === PASSWORD RESET EMAIL (DEV MODE) ===
   To: test@example.com
   Reset URL: http://localhost:3000/reset-password?token=abc123...
   Token: abc123...
   =======================================
   💡 Tip: Configure RESEND_API_KEY to send real emails
   ```

6. **Copy the reset URL and open it:**
   ```
   http://localhost:3000/reset-password?token=abc123...
   ```

7. **Enter new password:**
   - Password: `newpassword123`
   - Confirm: `newpassword123`

8. **Click "Reset Password"**
   - You'll see "Success!" message
   - Automatically redirected to login

9. **Login with new password:**
   ```
   Email: test@example.com
   Password: newpassword123
   ```

✅ **Success!** You should be logged in.

---

## 📧 Test Scenario 2: With Real Emails (Resend)

**What happens:** Real email sent to your inbox

### Prerequisites:
1. Get Resend API key from [resend.com](https://resend.com)
2. Add to `.env.local`:
   ```env
   RESEND_API_KEY=re_your_key_here
   RESEND_FROM_EMAIL=onboarding@resend.dev
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
3. Restart dev server

### Steps:

1. **Open forgot password page:**
   ```
   http://localhost:3000/forgot-password
   ```

2. **Enter YOUR real email address:**
   ```
   your-email@gmail.com
   ```
   (Make sure this email is registered in your app!)

3. **Click "Send Reset Link"**

4. **Check your email inbox 📬**
   - Subject: "Reset Your Password - Clawder"
   - From: onboarding@resend.dev
   - Beautiful purple gradient design

5. **Click the "Reset Password" button in email**
   - Opens: `http://localhost:3000/reset-password?token=...`

6. **Enter new password:**
   - Password: `MyNewPass123!`
   - Confirm: `MyNewPass123!`

7. **Click "Reset Password"**

8. **Login with new password**

✅ **Success!** Real email sent and received!

---

## 🐛 Troubleshooting

### Problem: "Could not find 'reset_token' column"
**Solution:** Run `run-once.sql` in Supabase Dashboard

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
```

### Problem: No email received
**Checklist:**
- [ ] Is `RESEND_API_KEY` set correctly?
- [ ] Is `RESEND_FROM_EMAIL` set correctly?
- [ ] Did you restart dev server after adding env vars?
- [ ] Check spam folder
- [ ] Check Resend dashboard [Logs](https://resend.com/logs)
- [ ] Is the email address actually registered in your database?

### Problem: "Invalid or expired reset token"
**Causes:**
- Token expired (1 hour limit)
- Token already used
- Token doesn't exist in database

**Solution:** Request a new reset link

### Problem: Console shows "Failed to send reset email"
**Check:**
- Resend API key is valid
- From email is verified (or use `onboarding@resend.dev`)
- Network connection is working
- Check console for detailed error message

---

## ✅ Expected Results Summary

| Step | Expected Console Output | Expected UI |
|------|------------------------|-------------|
| Enter email | `✅ Password reset email sent to: user@email.com` (with Resend) or `=== PASSWORD RESET EMAIL (DEV MODE) ===` | "If that email exists..." message |
| Open reset link | Route compile | Reset password form |
| Submit new password | `POST /api/auth/reset-password 200` | "Success!" → redirect |
| Login | `POST /api/auth/login 200` | Dashboard |

---

## 📊 Database Verification

Check if token was stored:

```sql
SELECT 
  email, 
  reset_token IS NOT NULL as has_token,
  reset_token_expires > now() as token_valid,
  reset_token_expires
FROM users 
WHERE email = 'test@example.com';
```

After successful reset:

```sql
-- Token should be NULL after use
SELECT 
  email, 
  reset_token,
  reset_token_expires,
  password_hash
FROM users 
WHERE email = 'test@example.com';
```

---

## 🎯 Edge Cases to Test

1. **Non-existent email:**
   - Enter: `notreal@example.com`
   - Expected: Same success message (prevents email enumeration)

2. **Expired token:**
   - Wait 1+ hour after requesting reset
   - Expected: "Reset token has expired"

3. **Reused token:**
   - Use reset link twice
   - Expected: "Invalid or expired reset token" on 2nd use

4. **Weak password:**
   - Enter password: `123`
   - Expected: "Password must be at least 8 characters"

5. **Password mismatch:**
   - Password: `password123`
   - Confirm: `password456`
   - Expected: "Passwords do not match"

---

## 🚀 Quick Test Script

Run this to test the full flow automatically:

```bash
# 1. Request reset
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 2. Get token from console, then reset
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN_HERE","password":"newpassword123"}'

# 3. Login with new password
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"newpassword123"}'
```

---

## 📝 Notes

- Tokens expire after **1 hour**
- Tokens are **single-use** (cleared after successful reset)
- Email address is **case-insensitive** (automatically lowercased)
- System prevents **email enumeration** (always returns success)
- Development mode works **without any email service**
- Production mode requires **Resend API key**

Happy testing! 🎉
