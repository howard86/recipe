import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedEnv: true,
  },
  reactStrictMode: true,
  transpilePackages: ["@workspace-template/ui"],
  typedRoutes: true,
};

export default nextConfig;
