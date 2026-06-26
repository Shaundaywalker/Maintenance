import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The libsql client is a native module; keep it out of the bundle so it
  // loads from node_modules at runtime on the server.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
