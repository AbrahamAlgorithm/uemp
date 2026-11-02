import { NextResponse } from "next/server";

export function middleware() {
  // TODO: role-based redirects once auth exists, e.g. send signed-out users to
  // /login and keep each role inside its own area (/student, /lecturer,
  // /department, /admin).
  return NextResponse.next();
}

export const config = {
  // Skip the API proxy, Next.js internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
