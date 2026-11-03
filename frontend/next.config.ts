import type { NextConfig } from "next";

// read at build time, not at runtime (standalone output)
const apiUrl = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

// pages folded into others keep working for old bookmarks
const MOVED: Record<string, string> = {
  "/student/registration": "/student/my-courses",
  "/student/courses": "/student/my-courses",
  "/student/courses/print": "/student/my-courses/slip",
  "/student/results": "/student/my-courses",
  "/student/results/print": "/student/my-courses/statement",
  "/lecturer/submissions": "/lecturer/courses",
  "/admin/faculties": "/admin/structure",
  "/admin/departments": "/admin/structure",
  "/admin/programs": "/admin/structure",
  "/admin/courses": "/admin/structure",
  "/admin/allocations": "/admin/structure",
  "/admin/sessions": "/admin/calendar",
};

const nextConfig: NextConfig = {
  output: "standalone",
  // django urls end in "/", stripping it sends APPEND_SLASH into a redirect loop
  skipTrailingSlashRedirect: true,
  async redirects() {
    return Object.entries(MOVED).map(([source, destination]) => ({ source, destination, permanent: false }));
  },
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
