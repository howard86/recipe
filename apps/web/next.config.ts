import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedEnv: true,
  },
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
