/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mui/material', '@mui/system', '@mui/icons-material'],
  // Keep Node-only server deps out of the Vercel function bundle.
  serverExternalPackages: [
    'mongoose',
    'bcryptjs',
    'web-push',
    'jsonwebtoken',
    'passport',
    'passport-google-oauth20',
    'passport-facebook',
    'multer',
    'cloudinary',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

module.exports = nextConfig;
