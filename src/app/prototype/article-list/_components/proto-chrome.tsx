"use client";

// 共用 chrome（#29 已定）：整站只有右上角一组控件，向下滚动收起，向上滚动或回到顶部出现。

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";

export function ProtoChrome() {
  const [shown, setShown] = useState(true);
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<"zh" | "en">("zh");

  useEffect(() => {
    let last = window.scrollY;
    let acc = 0;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      last = y;
      if (y <= 8) {
        setShown(true);
        acc = 0;
        return;
      }
      // 同向累计超过 32px 才判定方向：平滑滚动收尾会回漂约 1px/帧（#29）。
      acc = Math.sign(delta) === Math.sign(acc) ? acc + delta : delta;
      if (acc > 32) {
        setShown(false);
        acc = 0;
      } else if (acc < -32) {
        setShown(true);
        acc = 0;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="proto-chrome" data-shown={shown || undefined}>
      <div className="proto-seg" role="group" aria-label="界面语言">
        <button aria-pressed={locale === "zh"} onClick={() => setLocale("zh")}>
          中
        </button>
        <button aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
          EN
        </button>
      </div>
      <button
        className="proto-icon"
        aria-label={open ? "关闭菜单" : "打开菜单"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>

      {open && (
        <>
          <button className="proto-scrim" aria-label="关闭菜单" onClick={() => setOpen(false)} />
          <nav className="proto-menu" aria-label="主导航">
            <p className="proto-mark">LAWSON</p>
            <ul>
              <li>
                <a href="#home">首页</a>
              </li>
              <li>
                <a href="#articles" aria-current="page">
                  文章
                </a>
              </li>
              <li>
                <a href="#works">作品</a>
              </li>
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
