import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleInternationalizedRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/zh", request.url), 301);
  }

  const requestedLocale = pathname.split("/")[1];
  if (!routing.locales.includes(requestedLocale as (typeof routing.locales)[number])) {
    return new NextResponse(null, { status: 404 });
  }

  return handleInternationalizedRouting(request);
}

export const config = {
  matcher: ["/", "/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
