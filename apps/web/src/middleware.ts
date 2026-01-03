import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // NextAuth routes should be handled by Next.js API routes, not proxied
  // Skip middleware processing for NextAuth routes - let Next.js route them directly
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  
  // For dashboard routes, continue with existing logic
  if (pathname.startsWith("/dashboard/")) {
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  // Match all API routes and dashboard routes
  matcher: ["/api/:path*", "/dashboard/:path*"],
};


