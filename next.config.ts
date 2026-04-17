import type { NextConfig } from "next";

const isApkExport = process.env.BUILD_TARGET === "apk";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  ...(isApkExport
    ? {
        output: "export",
      }
    : {}),
};

export default nextConfig;
