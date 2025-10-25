import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "admin_auth";
const ADMIN_PUBLIC_PATHS = new Set(["/admin/login", "/admin/logout"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const normalizedPath =
    pathname.endsWith("/") && pathname.length > 1
      ? pathname.slice(0, -1)
      : pathname;

  if (normalizedPath.startsWith("/admin")) {
    if (ADMIN_PUBLIC_PATHS.has(normalizedPath)) {
      return NextResponse.next();
    }

    const hasCookie = req.cookies.get(ADMIN_COOKIE)?.value;
    const devBypass = process.env.NEXT_PUBLIC_DEV_ADMIN_BYPASS === "true";
    const host = req.headers.get("host") || "";
    const isLocal =
      host.startsWith("localhost:") || host.startsWith("127.0.0.1:");

    if (devBypass && isLocal) {
      return NextResponse.next();
    }

    if (!hasCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", normalizedPath);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
