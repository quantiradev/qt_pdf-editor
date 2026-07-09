import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Empty turbopack config satisfies Next.js 16 requirement (canvas alias handled by pdfjs worker config in lib/pdf.ts)
  turbopack: {},
  async rewrites() {
    return [
      // PDF editing backend (Python FastAPI, port 8001) — more specific paths first
      {
        source: "/api/files/:path*",
        destination: "http://127.0.0.1:8001/api/files/:path*",
      },
      {
        source: "/api/health",
        destination: "http://127.0.0.1:8001/api/health",
      },
      // Auth backend (Node.js Express, port 5001)
      {
        source: "/api/:path*",
        destination: "http://localhost:5001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
