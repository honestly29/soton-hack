import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["repomix", "officeparser", "unpdf"],
};

export default nextConfig;
