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

  // The Proxy preflight keeps withdrawn articles from receiving a streamed 200 response.
  // shortcut: checks PostgreSQL for each detail GET/HEAD until Next supports pre-stream cache checks.
  const articleRoute = pathname.match(/^\/(zh|en)\/articles\/([^/]+)\/?$/);
  if (articleRoute && (request.method === "GET" || request.method === "HEAD")) {
    const [, locale, slug] = articleRoute;
    const { isPublishedArticleSlug } = await import("@/server/articles");
    if (!(await isPublishedArticleSlug(slug))) return articleNotFound(locale);
  }

  return handleInternationalizedRouting(request);
}

function articleNotFound(locale: string) {
  const content = locale === "en"
    ? { title: "Article not found", message: "This article is unavailable.", back: "Browse articles" }
    : { title: "文章不存在", message: "这篇文章当前不可用。", back: "返回文章列表" };
  const body = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${content.title}</title></head><body><main><h1>404 · ${content.title}</h1><p>${content.message}</p><a href="/${locale}/articles">${content.back}</a></main></body></html>`;

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
