# Email Verification Implementation Summary

## Overview
Email verification is now implemented as a **soft requirement** - users are notified to verify their email within 24 hours but can still use the platform. A banner appears on the dashboard reminding them to verify.

## What Was Implemented

### 1. Database Schema
**File:** `web/supabase/migrations/00013_email_verification.sql` + `web/supabase/run-once.sql`

Added columns to `users` table:
- `email_verification_token` (TEXT) - unique token sent in email
- `email_verification_expires_at` (TIMESTAMPTZ) - 24h expiry
- `email_verified_at` (TIMESTAMPTZ) - timestamp when verified
- Index on `email_verification_token` for fast lookup

### 2. Registration Flow
**File:** `web/app/api/auth/register/route.ts`

- Generates a secure 32-byte token on signup
- Sends verification email via **Resend** (same config as password reset)
- User is logged in immediately (soft verification)
- Returns message: "Account created. Check your email to verify your address."

**Email content:**
- Subject: "Verify your email - Clawder"
- Branded HTML with gradient header
- "Verify email" button + plain link
- 24-hour expiry notice

### 3. Verification Endpoint
**File:** `web/app/api/auth/verify-email/route.ts`

- `GET /api/auth/verify-email?token=xxx`
- Validates token and expiry
- Sets `email_verified_at`, clears token
- Redirects to `/login?verified=1` on success
- Redirects to `/login?error=invalid_token` or `token_expired` on failure

**File:** `web/app/verify-email/page.tsx`
- User-facing page shown when clicking email link
- Displays "Verifying...", "Email verified", or "Verification failed"
- Redirects to login

### 4. Resend Verification Email
**File:** `web/app/api/auth/resend-verification/route.ts`

- `POST /api/auth/resend-verification`
- Requires authentication (Session or Bearer)
- Reuses existing token if still valid, generates new one if expired
- Returns: `{ message: "Verification email sent" }`

### 5. Dashboard Banner
**File:** `web/components/EmailVerificationBanner.tsx`

A dismissible banner component shown when email is not verified:
- Amber/orange gradient styling
- "Verify your email within 24 hours" message
- "Resend verification email" button
- Dismissible with X button

**File:** `web/app/dashboard/page.tsx`
- Shows banner at top of dashboard when `!emailVerified`
- Fetches `email_verified_at` from `/api/dashboard`
- Banner is hidden if user dismisses it or email is verified

**File:** `web/app/api/dashboard/route.ts`
- Returns `email_verified_at` in user object
- Type: `DashboardUser` includes `email_verified_at?: string | null`

## Configuration

Uses existing Resend setup (same as password reset):
- `RESEND_API_KEY` - Resend.com API key
- `RESEND_FROM_EMAIL` - Verified sender (e.g. `noreply@clawder.ai`)
- `NEXT_PUBLIC_APP_URL` - Base URL for verification links

**Dev mode:** If Resend not configured, verification links are logged to console.

## User Flow

1. **Register** → User creates account with email/password
2. **Email sent** → Verification email with 24h link
3. **Logged in** → User can use the app immediately
4. **Dashboard** → Banner appears: "Verify your email within 24 hours"
5. **Click email link** → `/verify-email?token=xxx` → verified
6. **Banner gone** → No more reminders after verification

**Resend option:** User can click "Resend verification email" in banner if they didn't receive it.

## Technical Details

- **Token:** 32-byte random hex (64 chars)
- **Expiry:** 24 hours from generation
- **Verification:** Atomic update (set `email_verified_at`, clear token & expiry)
- **Security:** Token is hashed in transit (HTTPS), stored as-is (not hashed in DB since it's single-use and expires)

## Files Changed

1. **Database:**
   - `web/supabase/migrations/00013_email_verification.sql` (new)
   - `web/supabase/run-once.sql` (updated)

2. **Backend:**
   - `web/app/api/auth/register/route.ts` (updated - send email)
   - `web/app/api/auth/verify-email/route.ts` (new)
   - `web/app/api/auth/resend-verification/route.ts` (new)
   - `web/app/api/dashboard/route.ts` (updated - return `email_verified_at`)

3. **Frontend:**
   - `web/app/verify-email/page.tsx` (new)
   - `web/components/EmailVerificationBanner.tsx` (new)
   - `web/app/dashboard/page.tsx` (updated - show banner)
   - `web/components/icons.tsx` (added `XCircle`)

## Next Steps (Optional)

If you want to **enforce** verification (block actions until verified):
1. Add middleware to check `email_verified_at` before sensitive actions (e.g. Pro upgrade, API key generation)
2. Add a "Please verify your email" error when accessing restricted features
3. Optionally block login until verified (more strict)

Currently it's **soft verification** - users are reminded but not blocked.
