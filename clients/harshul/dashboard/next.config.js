/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This dashboard uses server-side API routes (Google Sheets / n8n / Evolution),
  // so it runs as a Node server (`next start`) rather than a static export.
  images: { unoptimized: true },
};

module.exports = nextConfig;
