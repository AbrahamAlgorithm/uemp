import { NextResponse } from "next/server";

export function middleware() {
  // TODO: role-based redirects
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
