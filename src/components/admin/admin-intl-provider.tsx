"use client";

import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/zh.json";

export function AdminIntlProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="zh" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
