import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import messagesEn from "@/messages/en.json";
import messagesZh from "@/messages/zh.json";
import { routing } from "./routing";

const messages = {
  en: messagesEn,
  zh: messagesZh,
};

export default getRequestConfig(async ({ locale: requestLocale }) => {
  const locale = requestLocale ?? (await rootLocale());

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return { locale, messages: messages[locale] };
});
