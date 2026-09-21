import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WebAssembly and data files that must load from node_modules
  // as-is rather than being bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
