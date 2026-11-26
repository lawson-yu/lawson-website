"use client";

import { useEffect, useRef } from "react";
import { Link, useRouter } from "@/i18n/navigation";

export function LoadMoreArticles({ href, label }: { href: string; label: string }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const router = useRouter();

  useEffect(() => {
    const link = linkRef.current;
    if (!link || typeof IntersectionObserver === "undefined") return;

    let requested = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || requested) return;
      requested = true;
      observer.disconnect();
      router.push(href, { scroll: false });
    }, { rootMargin: "320px 0px" });

    observer.observe(link);
    return () => observer.disconnect();
  }, [href, router]);

  return (
    <div className="articles-index__load-more">
      <Link className="articles-index__load-more-link" href={href} ref={linkRef} scroll={false}>
        {label}
      </Link>
    </div>
  );
}
