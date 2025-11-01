/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure proper static file serving
  distDir: '.next',
  generateEtags: true,
  poweredByHeader: false,
}

module.exports = nextConfig

