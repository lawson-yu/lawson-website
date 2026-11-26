import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function ProjectNotFound() {
  const t = await getTranslations("Projects");
  return (
    <main className="works-not-found">
      <p className="works-not-found__code">404</p>
      <h1>{t("notFoundTitle")}</h1>
      <p>{t("notFoundDescription")}</p>
      <Link href="/projects">
        {t("backToWorks")}
        <ArrowRight aria-hidden="true" size={17} />
      </Link>
    </main>
  );
}
