import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PublicFooter } from "@/components/public-site/public-footer";
import { PublicNavigation } from "@/components/public-site/public-navigation";
import { DesktopSmoothScroll } from "@/components/public-site/desktop-smooth-scroll";
import { routing } from "@/i18n/routing";
import "../globals.css";
import "@/components/public-site/public-site.css";

export const metadata: Metadata = {
  title: "LAWSON",
  description: "Lawson 的个人网站",
};

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
            <PublicNavigation />
            <div className="public-content">{children}</div>
            <PublicFooter />
          </DesktopSmoothScroll>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
