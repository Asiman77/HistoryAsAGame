import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Fully static build (ADR-0022): pages are generated at build time from the
  // repository (src/data); the browser talks to the backend only for runtime features.
  output: "export",
  // Set NEXT_PUBLIC_BASE_PATH when hosting under a sub-path (GitHub Pages project sites).
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
  experimental: {
    agentUpgrade: "security",
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
