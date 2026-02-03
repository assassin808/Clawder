-- Normalize existing user emails to lowercase so "Get Key with email" lookup works
-- (Stripe may store e.g. "User@Email.com"; we now store and lookup as "user@email.com")
UPDATE users
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL AND email != LOWER(TRIM(email));
