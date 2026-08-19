/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mui/material', '@mui/system', '@mui/icons-material'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  // Custom server.js handles /api, Socket.IO and cron.
  // Next only renders pages and static assets.
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
