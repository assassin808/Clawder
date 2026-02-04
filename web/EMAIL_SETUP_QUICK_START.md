# 📧 Email Setup Quick Start

## 🎯 Goal
Enable real password reset emails instead of console logs.

## ⚡ Quick Setup (5 minutes)

### Step 1: Get Resend API Key
1. Go to [resend.com](https://resend.com) and sign up
2. Navigate to [API Keys](https://resend.com/api-keys)
3. Click "Create API Key"
4. Copy the key (starts with `re_`)

### Step 2: Configure Environment Variables
Add to `web/.env.local`:

```env
# Password Reset Email
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> 💡 **Note:** `onboarding@resend.dev` is Resend's test domain - works immediately for testing!

### Step 3: Restart Dev Server
```bash
cd web
npm run dev
```

### Step 4: Test It!
1. Go to http://localhost:3000/forgot-password
2. Enter your email
3. Check your inbox 📬
4. Click the reset link
5. Set new password

## ✅ Done!

You should receive a beautiful email like this:

```
┌─────────────────────────────────┐
│   🔐 Reset Your Password        │
│   (Purple gradient header)      │
├─────────────────────────────────┤
│                                 │
│  Hi there,                      │
│                                 │
│  We received a request to       │
│  reset your password...         │
│                                 │
│    [ Reset Password ]           │
│    (Big purple button)          │
│                                 │
│  Or copy this link:             │
│  http://localhost:3000/...      │
│                                 │
│  ⏰ This link expires in 1 hour │
│                                 │
└─────────────────────────────────┘
```

## 🚀 Production Setup

For production, verify your own domain:

1. Go to [Resend Domains](https://resend.com/domains)
2. Add your domain (e.g., `yourdomain.com`)
3. Add the DNS records they provide
4. Wait for verification (usually < 5 minutes)
5. Update `.env.local`:
   ```env
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

## 🔍 Troubleshooting

**Emails not sending?**
- Check console for error messages
- Verify `RESEND_API_KEY` is correct
- Make sure you restarted the dev server
- Check Resend dashboard for logs

**Using console logs instead?**
- System automatically falls back to console if:
  - `RESEND_API_KEY` is not set
  - `RESEND_FROM_EMAIL` is not set
  - Email sending fails
- Perfect for development!

## 📊 Monitoring

Check your Resend dashboard:
- [Logs](https://resend.com/logs) - See all sent emails
- [Analytics](https://resend.com/analytics) - Track delivery rates
- [API Keys](https://resend.com/api-keys) - Manage keys

## 💰 Pricing

- **Free tier:** 100 emails/day, 3,000/month
- **Pro:** $20/month for 50,000 emails
- Perfect for most applications!

## 🆘 Need Help?

- Resend Docs: https://resend.com/docs
- Discord: https://discord.gg/resend
- Email: support@resend.com
