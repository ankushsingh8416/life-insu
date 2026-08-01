import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Required for correct `standalone` output in a monorepo: without this, Next's
  // file tracer can misdetect the workspace root and silently omit node_modules
  // from .next/standalone, producing a build that looks fine but crashes at
  // runtime with "Cannot find module 'next'". Points at the monorepo root (two
  // levels up from apps/web) where the hoisted node_modules actually lives.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@sabsepehle/shared-types"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
