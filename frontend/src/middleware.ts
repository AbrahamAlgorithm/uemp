import { NextResponse, type NextRequest } from "next/server";

import { ROLE_HOME } from "@/lib/constants";
import type { Role } from "@/lib/types";

const AREAS = Object.values(ROLE_HOME);

function isRole(value: string | undefined): value is Role {
  return value !== undefined && value in ROLE_HOME;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const area = AREAS.find((home) => pathname === home || pathname.startsWith(`${home}/`));
  if (!area) return NextResponse.next();

  // the access cookie expires after 15 minutes, the role cookie lives as long as the refresh token.
  // it only picks the redirect; the api still checks the real session on every request
  const role = request.cookies.get("uemp_role")?.value;
  if (!isRole(role)) return NextResponse.redirect(new URL("/login", request.url));

  const home = ROLE_HOME[role];
  if (home !== area) return NextResponse.redirect(new URL(home, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/lecturer/:path*", "/department/:path*", "/admin/:path*"],
};
