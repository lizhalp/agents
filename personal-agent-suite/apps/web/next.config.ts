import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@agent-suite/config", "@agent-suite/shared-types"]
};

export default nextConfig;
