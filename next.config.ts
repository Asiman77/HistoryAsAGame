import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static build: the app has no backend yet. Swap the repository
  // implementation (src/data) to move to a REST API later.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
