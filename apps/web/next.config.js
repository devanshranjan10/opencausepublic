/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@opencause/types"],
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  images: {
    domains: ["localhost"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path((?!auth).)*",
        destination: (process.env.NEXT_PUBLIC_API_URL || "https://api.opencause.world") + "/:path*",
      },
    ];
  },
  // Note: NextAuth routes (/api/auth/*) are excluded from rewrites and handled by Next.js route handlers
  webpack: (config, { isServer }) => {
    // Ignore optional dependencies that are not needed in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "@react-native-async-storage/async-storage": false,
        "pino-pretty": false,
        fs: false,
        path: false,
        crypto: false,
      };
      
      // Ignore face-api.js Node.js-specific modules
      config.resolve.alias = {
        ...config.resolve.alias,
      };
      
      // Exclude face-api.js Node.js env modules from bundling by replacing with empty module
      const path = require('path');
      config.plugins = [
        ...config.plugins,
        new (require('webpack').NormalModuleReplacementPlugin)(
          /node_modules\/face-api\.js\/.*\/env\/createFileSystem\.js$/,
          path.resolve(__dirname, 'src/lib/kyc/face-api-stub.js')
        ),
      ];
    }
    return config;
  },
};

module.exports = nextConfig;


