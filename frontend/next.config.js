/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 允许直接 transpile workspace 共享包
  transpilePackages: ['@atlas/shared'],
};

module.exports = nextConfig;
