import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight, BriefcaseBusiness, Camera, Code2, Link2, Video } from "lucide-react";
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
  const contactUrl = siteSetting?.contactUrl;

  return (
    <footer className="public-footer" id="contact">
      {contactUrl && (
        <div className="public-footer__contact">
          <h2>{t("contactLead")}<br /><span>{t("contactEmphasis")}</span></h2>
          <div>
            <p>{t("contactDescription")}</p>
            <p>{t("contactInvitation")}</p>
            <a className="public-footer__contact-link" href={contactUrl}>
              {contactUrl.toLowerCase().startsWith("mailto:")
                ? contactUrl.slice("mailto:".length).split("?")[0]
                : home("contact")}
              <ArrowUpRight aria-hidden="true" size={20} />
            </a>
          </div>
        </div>
      )}
      <div className="public-footer__navigation">
        <nav aria-label={t("navigation")}>
          <Link href="/">{navigation("home")}</Link>
          <Link href="/articles">{navigation("articles")}</Link>
          <Link href="/projects">{navigation("projects")}</Link>
          <Link href="/privacy">{t("privacy")}</Link>
        </nav>
        {socialLinks.length > 0 && (
          <nav className="public-footer__links" aria-label={t("socialNavigation")}>
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
                  <ArrowUpRight aria-hidden="true" size={15} />
                </a>
              );
            })}
          </nav>
        )}
      </div>
      <Link className="public-footer__wordmark" href="/" aria-label={`LAWSON · ${navigation("home")}`}>LAWSON</Link>
      <div className="public-footer__bottom">
        <span>© Lawson</span>
        <a className="public-footer__top" href="#top">{t("backToTop")}</a>
      </div>
    </footer>
  );
}
