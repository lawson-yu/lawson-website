import type { ReactNode } from "react";
import "../globals.css";
import "@/components/public-site/public-site.css";
import "./admin.css";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
