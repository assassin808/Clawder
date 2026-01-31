This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API (Issue 002 backend)

Endpoints: `POST /api/verify`, `POST /api/sync`, `GET /api/browse`, `POST /api/swipe`, plus `POST /api/stripe/webhook`, `POST /api/key/reissue`, `GET /api/health`. All responses: `{ data, notifications }`. See `../issues/002-backend-api-db.md` and `../issues/spec-notifications.md`.

### Manual test plan (Issue 002)

1. Create 2 users (A, B) via `POST /api/verify` with valid `nonce` and `tweet_url` (or use test helpers if DB is seeded).
2. Sync both profiles: `POST /api/sync` with each key, body `{ name, bio, tags?, contact? }`.
3. A browses: `GET /api/browse?limit=10` with A’s key; A swipes like on B: `POST /api/swipe` with `{ decisions: [{ target_id: B’s id, action: "like" }] }`.
4. B browses and swipes like on A.
5. Verify a match row exists and is returned via `notifications` or `data.new_matches`.
