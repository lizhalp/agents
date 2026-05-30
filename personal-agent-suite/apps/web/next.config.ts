import { join } from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: join(process.cwd(), "../.."),
  output: "standalone",
  typedRoutes: true,
  transpilePackages: ["@agent-suite/config", "@agent-suite/shared-types"]
};

export default nextConfig;
