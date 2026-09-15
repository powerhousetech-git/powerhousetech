/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for the Docker image (see Dockerfile).
  output: "standalone",
  images: { unoptimized: true },
};

module.exports = nextConfig;
