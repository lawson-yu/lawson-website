import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function ArticleNotFound() {
  const t = await getTranslations("Articles");
  return (
    <main className="article-reading">
      <p>404</p>
      <h1>{t("notFoundTitle")}</h1>
      <p>{t("notFoundDescription")}</p>
      <Link href="/articles">
        {t("back")}
        <ArrowRight aria-hidden="true" size={17} />
      </Link>
    </main>
  );
}
