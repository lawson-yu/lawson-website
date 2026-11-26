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

  const articleRoute = pathname.match(/^\/(zh|en)\/articles\/([^/]+)\/?$/);
  if (articleRoute && (request.method === "GET" || request.method === "HEAD")) {
    const [, locale, slug] = articleRoute;
    const { isPublishedArticleSlug } = await import("@/server/articles");
    if (!(await isPublishedArticleSlug(slug))) return articleNotFound(locale);
  }

  const pathSegments = pathname.split("/").filter(Boolean);
  if (pathSegments.length === 3 && pathSegments[1] === "projects" &&
      (request.method === "GET" || request.method === "HEAD")) {
    const response = await requirePublishedProjectAccess(pathSegments[0], pathSegments[2]);
    if (response) return response;
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
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function requirePublishedProjectAccess(locale: string, slug: string) {
  const { getPrisma } = await import("@/server/db");
  const project = await getPrisma().project.findFirst({
    where: { slug, status: "PUBLISHED", cardTarget: "INTERNAL" },
    select: { id: true },
  });
  if (project) return null;

  const content = locale === "en"
    ? {
        title: "This project is unavailable",
        description: "The project may be unpublished, withdrawn, or the address may be incorrect.",
        link: "Back to works",
      }
    : {
        title: "页面暂不可用",
        description: "这个作品可能尚未公开、已撤下，或地址有误。",
        link: "返回作品列表",
      };
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 · ${content.title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101012;color:#f4f4f6;font:16px/1.65 system-ui,sans-serif}main{max-width:38rem;padding:2rem}p{color:#b1b2b9}a{display:inline-flex;min-height:44px;align-items:center;color:#d7effa;text-underline-offset:.25em}</style></head><body><main><p>404</p><h1>${content.title}</h1><p>${content.description}</p><a href="/${locale}/projects">${content.link}</a></main></body></html>`;
  return new NextResponse(html, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
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
