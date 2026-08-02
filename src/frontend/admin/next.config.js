/** @type {import('next').NextConfig} */
const nextConfig = {

  async rewrites() {
    return [
      // ✅ Menu API proxy - ALL methods (GET, POST, PUT, DELETE)
      {
        source: '/api/menu/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/menu/:path*`,
      },
      // AR assets proxy
      {
        source: '/api/ar/:path*',
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
          // ✅ Allow all methods including DELETE
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Tenant-Id' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
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