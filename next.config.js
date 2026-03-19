/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three'],
  webpack: (config) => {
    config.module.rules.push({
      test: /\.glb$/,
      type: 'asset/resource',
    });
    // MediaPipe uses non-standard exports field (missing "." key).
    // Point webpack directly to the ESM bundle via path.
    const path = require('path');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@mediapipe/tasks-vision': path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'),
    };
    return config;
  },
};

module.exports = nextConfig;
