import path from 'path'

// Hosts (not URLs) that may load the dev server besides localhost. Without
// this, opening the app from another device (e.g. http://192.168.117.86:3000)
// blocks /_next/webpack-hmr, the page never hydrates and forms misbehave.
// Set NEXT_DEV_ALLOWED_ORIGINS in .env.local as a comma-separated list, e.g.
//   NEXT_DEV_ALLOWED_ORIGINS=192.168.117.86,*.my-tunnel.dev
// Restart `npm run dev` after changing it. Wildcards like *.example.dev work.
function envDevOrigins(): string[] {
  return (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    // tolerate a pasted URL: drop the scheme, path and port
    .map(o => o.trim().replace(/^[a-z]+:\/\//i, '').replace(/[/:].*$/, ''))
    .filter(Boolean)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [...new Set(['snaking-easing-mystify.ngrok-free.dev', ...envDevOrigins()])],
  reactStrictMode: false,
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = nextConfig;