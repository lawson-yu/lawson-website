import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BriefcaseBusiness, Camera, Code2, Link2, Video } from "lucide-react";
import type { SocialIcon, SocialLink } from "@/lib/site-settings";
import { getSiteSetting } from "@/server/site-settings";

const socialIcons = {
  code: Code2,
  work: BriefcaseBusiness,
  camera: Camera,
  video: Video,
  link: Link2,
} satisfies Record<SocialIcon, typeof Link2>;

export async function PublicFooter() {
  const t = await getTranslations("Footer");
  const navigation = await getTranslations("Navigation");
  const home = await getTranslations("Home");
  const siteSetting = await getSiteSetting();
  const socialLinks = (siteSetting?.socialLinks ?? []) as unknown as SocialLink[];

  return (
    <footer className="public-footer" id="contact">
      <span className="public-footer__wordmark">LAWSON</span>
      <nav aria-label={t("navigation")}>
        <Link href="/">{navigation("home")}</Link>
        <Link href="/articles">{navigation("articles")}</Link>
        <Link href="/projects">{navigation("projects")}</Link>
        <Link href="/privacy">{t("privacy")}</Link>
      </nav>
      {(siteSetting?.contactUrl || socialLinks.length > 0) && (
        <nav
          className="public-footer__links"
          aria-label={t("socialNavigation")}
        >
          {siteSetting?.contactUrl && (
            <a href={siteSetting.contactUrl}>{home("contact")}</a>
          )}
          {socialLinks.map((socialLink) => {
            const Icon = socialIcons[socialLink.icon];
            return (
              <a
                key={`${socialLink.name}-${socialLink.url}`}
                href={socialLink.url}
                target="_blank"
                rel="noreferrer"
              >
                <Icon aria-hidden="true" size={16} />
                <span>{socialLink.name}</span>
              </a>
            );
          })}
        </nav>
      )}
      <a className="public-footer__top" href="#top">
        {t("backToTop")}
      </a>
    </footer>
  );
}
