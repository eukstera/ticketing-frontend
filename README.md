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

## LAN / dev setup

Copy `.env.local.example` to `.env.local` (git-ignored) and edit it.

**Same machine** (Laravel via `php artisan serve` on 127.0.0.1:8000):

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

**Opening the app from another device** (e.g. `http://192.168.117.86:3000`):

1. Backend: `php artisan serve --host=0.0.0.0 --port=8000`, and allow TCP 8000 in Windows Firewall.
2. `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://192.168.117.86:8000/api
   NEXT_DEV_ALLOWED_ORIGINS=192.168.117.86
   ```
   `NEXT_DEV_ALLOWED_ORIGINS` is a comma-separated list of hosts (no scheme or port; wildcards like `*.example.dev` work). It feeds `allowedDevOrigins` in `next.config.ts`.
3. The BE CORS config must allow the origin you browse from (`http://192.168.117.86:3000`).

Notes:

- **Restart `npm run dev`** after editing `.env.local` or `next.config.ts`.
- `NEXT_PUBLIC_*` values are inlined into the JS at build/dev start, so changing them needs a restart (or rebuild), not just a refresh.
- If the dev origin is not allowed, Next blocks `/_next/webpack-hmr`, the page never hydrates and the console/`.next/dev/logs` show "Blocked cross-origin request ... add it to allowedDevOrigins". Forms are written so that this cannot leak credentials into the URL (they use `method="post"` and their submit stays disabled until hydrated), but the app will not work until the origin is allowed.
- Do **not** use Laragon's `TicketingSystem-API.gbtrghsc.dev` host. It serves a different, old copy of the API (`C:\laragon\www\TicketingSystem-API`), not the `../TicketingSystem-API` next to this project inside "Ticketing System".

## Tests

`npm test` runs the unit tests (Vitest); `npm run test:watch` watches.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
