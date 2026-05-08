import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
  images: {
    unoptimized: true, // Wyłącza optymalizację — pozwala ładować obrazy z dowolnego URL
  },
};

export default nextConfig;
