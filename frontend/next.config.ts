import type { NextConfig } from "next";

// Where the Next.js server forwards /api/* so the browser only talks to one origin.
// With output "standalone" rewrites are resolved at build time, so production
// images must be built with API_URL set (see Dockerfile and infra/deploy.sh).
const apiUrl = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  // Django URLs end in "/". Next must neither redirect the slash away nor drop
  // it when proxying (":path*" doesn't capture it), or Django's APPEND_SLASH
  // redirect and Next bounce the request back and forth.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
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
