import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Every screen is per-user and per-tenant, so there is no static shell worth caching.
  transpilePackages: ["@immo/core"],
  serverExternalPackages: ["pg", "@react-pdf/renderer"],
  // The PDF fonts are read from disk at runtime, so they must be traced into the deployment.
  outputFileTracingIncludes: { "/app/**/*.pdf": ["./assets/fonts/*"] },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
