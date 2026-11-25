import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleInternationalizedRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return requireAdminAccess(request);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/zh", request.url), 301);
  }

  const requestedLocale = pathname.split("/")[1];
  if (!routing.locales.includes(requestedLocale as (typeof routing.locales)[number])) {
    return new NextResponse(null, { status: 404 });
  }

  return handleInternationalizedRouting(request);
}

async function requireAdminAccess(request: NextRequest) {
  const [{ getAuth }, { isSiteOwner }] = await Promise.all([
    import("@/server/auth"),
    import("@/lib/auth-policy"),
  ]);
  const auth = getAuth();
  if (!auth) {
    return NextResponse.redirect(new URL("/zh?next=%2Fadmin", request.url));
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/zh?next=%2Fadmin", request.url));
  }
  if (!isSiteOwner(session.user.email, session.user.emailVerified)) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
