import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@timefly/core", "@timefly/db"],
  serverExternalPackages: ["postgres"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
};

export default nextConfig;
