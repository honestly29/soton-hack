import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["repomix", "officeparser", "unpdf"],
};

export default nextConfig;
