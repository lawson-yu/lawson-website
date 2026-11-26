import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleInternationalizedRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
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

  // Cache Components sends the shell before a request-time notFound() can set the HTTP status.
  // shortcut: this ID-only check queries PostgreSQL per detail request until Next supports a cache-aware pre-stream check.
  if (request.method === "GET" || request.method === "HEAD") {
    const articleRoute = pathname.match(/^\/(zh|en)\/articles\/([^/]+)\/?$/);
    if (articleRoute) {
      const [, locale, slug] = articleRoute;
      const { isPublishedArticleSlug } = await import("@/server/articles");
      if (!(await isPublishedArticleSlug(slug))) return publicNotFound(locale, "articles");
    }

    const projectRoute = pathname.match(/^\/(zh|en)\/projects\/([^/]+)\/?$/);
    if (projectRoute) {
      const [, locale, slug] = projectRoute;
      const { isPublishedProjectSlug } = await import("@/server/projects");
      if (!(await isPublishedProjectSlug(slug))) return publicNotFound(locale, "projects");
    }
  }

  return handleInternationalizedRouting(request);
}

async function publicNotFound(locale: string, section: "articles" | "projects") {
  const messages = locale === "en"
    ? (await import("@/messages/en.json")).default
    : (await import("@/messages/zh.json")).default;
  const copy = section === "articles"
    ? {
        title: messages.Articles.notFoundTitle,
        description: messages.Articles.notFoundDescription,
        back: messages.Articles.back,
      }
    : {
        title: messages.Projects.notFoundTitle,
        description: messages.Projects.notFoundDescription,
        back: messages.Projects.backToWorks,
      };
  const body = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404 · ${copy.title}</title></head><body><main><p>404</p><h1>${copy.title}</h1><p>${copy.description}</p><a href="/${locale}/${section}">${copy.back}</a></main></body></html>`;

  return new NextResponse(body, {
    status: 404,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
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
