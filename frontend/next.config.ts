import type { NextConfig } from "next";

// read at build time, not at runtime (standalone output)
const apiUrl = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  // django urls end in "/", stripping it sends APPEND_SLASH into a redirect loop
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // :path* doesn't capture the trailing slash
      {
        source: "/api/:path*/",
        destination: `${apiUrl}/api/:path*/`,
      },
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
