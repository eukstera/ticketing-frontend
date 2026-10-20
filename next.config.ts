import path from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['snaking-easing-mystify.ngrok-free.dev'],
  reactStrictMode: false,
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = nextConfig;