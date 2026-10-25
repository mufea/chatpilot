import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Session-authenticated SaaS routes read cookies on the server. Cache
  // Components stays off until those screens are migrated behind Suspense.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
