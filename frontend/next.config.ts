import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  /* config options here */
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.join(__dirname, "."),
  },
};

export default nextConfig;
