/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true, // next/image's optimizer needs a server; static export can't run it
  },
};

module.exports = nextConfig;