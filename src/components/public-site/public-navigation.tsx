"use client";

import { Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { PublicAuthentication } from "./public-authentication";

function LanguageSwitch({ beforeChange }: { beforeChange?: () => void }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Navigation");

  function changeLocale(nextLocale: (typeof routing.locales)[number]) {
    if (nextLocale === locale) return;

    beforeChange?.();
    router.replace(`${pathname}${window.location.search}${window.location.hash}`, {
      locale: nextLocale,
    });
  }

  return (
    <div className="public-language" role="group" aria-label={t("language")}>
      <button
        type="button"
        aria-pressed={locale === "zh"}
        onClick={() => changeLocale("zh")}
      >
        中
      </button>
      <button
        type="button"
        aria-pressed={locale === "en"}
        onClick={() => changeLocale("en")}
      >
        EN
      </button>
    </div>
  );
}

function LanguageSwitchFallback({ label }: { label: string }) {
  return (
    <div className="public-language" role="group" aria-label={label}>
      <button type="button" disabled>中</button>
      <button type="button" disabled>EN</button>
    </div>
  );
}

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("Navigation");

  return (
    <nav className="public-menu__links" aria-label={t("menuTitle")}>
      <Link href="/" onClick={onNavigate}>
        {t("home")}
      </Link>
      <Link href="/articles" onClick={onNavigate}>
        {t("articles")}
      </Link>
      <Link href="/projects" onClick={onNavigate}>
        {t("projects")}
      </Link>
    </nav>
  );
}

function MenuDialog({ onDismiss }: { onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("Navigation");

  useEffect(() => {
    dialogRef.current?.showModal();
    closeRef.current?.focus();
  }, []);

  function dismiss() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className="public-menu"
      aria-label={t("menuTitle")}
      onClose={onDismiss}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="public-menu__panel">
        <div className="public-menu__heading">
          <span className="public-wordmark">LAWSON</span>
          <button
            ref={closeRef}
            className="public-icon"
            type="button"
            aria-label={t("closeMenu")}
            onClick={dismiss}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <NavigationLinks onNavigate={dismiss} />
        <Suspense fallback={<LanguageSwitchFallback label={t("language")} />}>
          <LanguageSwitch beforeChange={dismiss} />
        </Suspense>
      </div>
    </dialog>
  );
}

export function PublicNavigation() {
  const t = useTranslations("Navigation");
  const [menuOpen, setMenuOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const travel = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    function updateOnScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastY.current;
      lastY.current = currentY;

      if (currentY <= 0) {
        travel.current = 0;
        setVisible(true);
        return;
      }

      if (delta === 0) return;
      travel.current = travel.current * delta < 0 ? delta : travel.current + delta;

      if (travel.current > 32) {
        travel.current = 0;
        setVisible(false);
      } else if (travel.current < -32) {
        travel.current = 0;
        setVisible(true);
      }
    }

    window.addEventListener("scroll", updateOnScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateOnScroll);
  }, []);

  return (
    <>
      <header
        className="public-chrome"
        data-hidden={!visible || undefined}
        inert={!visible && !menuOpen ? true : undefined}
      >
        <Suspense fallback={<LanguageSwitchFallback label={t("language")} />}>
          <LanguageSwitch />
        </Suspense>
        <PublicAuthentication />
        <button
          className="public-icon"
          type="button"
          aria-label={t("openMenu")}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu aria-hidden="true" size={20} />
        </button>
      </header>
      {menuOpen && <MenuDialog onDismiss={() => setMenuOpen(false)} />}
    </>
  );
}
