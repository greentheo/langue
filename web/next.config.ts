import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to web/. Without this Turbopack walks up looking
    // for a lockfile, finds a stray one in the home directory, and warns that
    // it is outside the repository.
    root: path.resolve(process.cwd()),
  },

  // Emit a self-contained server bundle: the Docker runtime stage copies
  // .next/standalone instead of the whole node_modules tree.
  output: "standalone",

  // The Prisma client is generated into src/generated and loads its query
  // engine at runtime, so it must stay external rather than being bundled.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
