import { getTranslations } from "next-intl/server";

export async function HomeParticleTransition({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <section
      className="particle-transition home-particle-transition"
      data-screen="transition"
      data-home-motion="particle-transition"
      aria-labelledby="home-particle-transition-title"
    >
      <div className="particle-transition__pin">
        <div className="particle-transition__copy">
          <h2 id="home-particle-transition-title">
            <span>{t("transitionLead")}<span className="particle-transition__capsule" aria-hidden="true" /></span>
            <span>{t("transitionBridge")}<em>{t("transitionAccent")}</em></span>
          </h2>
          <p>{t("transitionDescription")}</p>
        </div>
      </div>
    </section>
  );
}
