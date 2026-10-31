import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static build: the app has no backend yet. Swap the repository
  // implementation (src/data) to move to a REST API later.
  output: "export",
  // Set NEXT_PUBLIC_BASE_PATH when hosting under a sub-path (GitHub Pages project sites).
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
