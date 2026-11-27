import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { PublicFooter } from "@/components/public-site/public-footer";
import { PublicNavigation } from "@/components/public-site/public-navigation";
import { DesktopSmoothScroll } from "@/components/public-site/desktop-smooth-scroll";
import { routing } from "@/i18n/routing";
import { DEFAULT_OG_IMAGE_PATH } from "@/lib/media-url";
import { getSiteOrigin, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/seo";
import "../globals.css";
import "@/components/public-site/public-site.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Home" });

  return {
    metadataBase: new URL(getSiteOrigin()),
    title: "LAWSON",
    description: t("siteDescription"),
    openGraph: {
      siteName: "LAWSON",
      images: [
        {
          url: DEFAULT_OG_IMAGE_PATH,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: "LAWSON",
        },
      ],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <DesktopSmoothScroll>
            <Suspense fallback={null}>
              <PublicNavigation />
            </Suspense>
            <div className="public-content">{children}</div>
            <Suspense fallback={null}>
              <PublicFooter />
            </Suspense>
          </DesktopSmoothScroll>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
