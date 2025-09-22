/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export' はVercelでは使用しない
  images: {
    unoptimized: true
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

module.exports = nextConfig;