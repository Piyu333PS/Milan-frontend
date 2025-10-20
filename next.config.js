// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },        // build ke time lint skip
  typescript: { ignoreBuildErrors: true },     // TS check skip (tum pages/ me JS hi use kar rahe ho)
  productionBrowserSourceMaps: false,          // sourcemaps off
  swcMinify: true,                             // default, but keep explicit
};
module.exports = nextConfig;
