/** @type {import('next').NextConfig} */
const nextConfig = {

  async rewrites() {
    return [
      // AR assets proxy only — menu uses the API route proxy for auth headers
      {
        source:      '/api/ar/:path*',
        destination: `${process.env.NEXT_PUBLIC_AR_BASE ?? 'https://987eskfgd8.execute-api.ap-south-1.amazonaws.com/Prod'}/ar/:path*`,
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',  value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.s3.amazonaws.com'  },
      { protocol: 'https', hostname: '*.cloudfront.net'    },
    ],
  },

  transpilePackages: ['three'],
}

module.exports = nextConfig