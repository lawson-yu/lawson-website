import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function PublicFooter() {
  const t = await getTranslations("Footer");
  const navigation = await getTranslations("Navigation");

  return (
    <footer className="public-footer" id="contact">
      <span className="public-footer__wordmark">LAWSON</span>
      <nav aria-label={t("navigation")}>
        <Link href="/">{navigation("home")}</Link>
        <Link href="/articles">{navigation("articles")}</Link>
        <Link href="/projects">{navigation("projects")}</Link>
      </nav>
      {/* #46 在这里接入正式联系地址与 Hero 联系录入。 */}
      <div data-contact-entry-slot />
      <a className="public-footer__top" href="#top">
        {t("backToTop")}
      </a>
    </footer>
  );
}
