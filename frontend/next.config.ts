import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Empty turbopack config satisfies Next.js 16 requirement (canvas alias handled by pdfjs worker config in lib/pdf.ts)
  turbopack: {},
  async rewrites() {
    return [
      // Route all /api requests to the unified Python backend (port 8001)
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
