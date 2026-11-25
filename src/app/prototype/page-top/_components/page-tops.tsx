"use client";

// 内页顶部原型：三个方向并排 + 导航栏两个变体。一次性代码，只在 prototype/article-list 分支存在。

import { useState, type CSSProperties } from "react";
import "../../article-list/_components/proto.css";
import "./page-tops.css";

const rows = [
  { date: "2026-11-18", title: "如何让 AI 先写验收场景" },
  { date: "2026-10-30", title: "把提示词当接口来设计" },
  { date: "2026-10-02", title: "向量数据库迁移的三次翻车" },
];

function Nav({ variant }: { variant: "blend" | "glass" }) {
  return (
    <nav className={`pt-nav pt-nav--${variant}`} aria-label="主导航">
      <a className="pt-nav__mark" href="#top">
        LAWSON
      </a>
      <div className="pt-nav__links">
        <a href="#articles" aria-current="page">
          文章
        </a>
        <a href="#works">作品</a>
        <a href="#locale">EN</a>
      </div>
    </nav>
  );
}

function Rows() {
  return (
    <div className="pt-rows">
      {rows.map((row) => (
        <p className="pt-row" key={row.title}>
          <time dateTime={row.date}>{row.date}</time>
          <b>{row.title}</b>
        </p>
      ))}
    </div>
  );
}

// ── A 撕裂纸 ─────────────────────────────────────────────

function TopA() {
  return (
    <header className="pt-a">
      <div className="pt-a__sheet">
        <span className="pt-a__fibre" aria-hidden="true" />
        <div className="pt-a__paper">
          <div className="pt-a__head">
            <p className="pt-a__eyebrow">Index · 文章</p>
            <p className="pt-a__count">27 篇</p>
          </div>
          <div className="pt-a__main">
            <h1 className="pt-a__title">文章</h1>
            <ul className="pt-a__years">
              {[
                ["2026", 8],
                ["2025", 11],
                ["2024", 6],
                ["2023", 2],
              ].map(([year, count]) => (
                <li key={year}>
                  <span>{year}</span>
                  <b>{count}</b>
                </li>
              ))}
            </ul>
          </div>
          <p className="pt-a__meta">2020—2026 · 中文 / English · 按首次发布日期倒序</p>
        </div>
      </div>
    </header>
  );
}

// ── B 断层切片 ───────────────────────────────────────────

// 四条切片的错位量；切片在图片上的纵向位置由 CSS 的 --y 按 band/gap/slot 算出。
const bands = [-24, 14, -11, 20];

function Band({ index }: { index: number }) {
  return (
    <div
      className={`pt-b__band pt-b__band--${index + 1}`}
      style={{ "--dx": bands[index] } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/character/static-desktop.webp" alt="" />
    </div>
  );
}

function TopB() {
  return (
    <header className="pt-b">
      <div className="pt-b__stack">
        <Band index={0} />
        <Band index={1} />

        <div className="pt-b__slot">
          <h1 className="pt-b__title">文章</h1>
          <p className="pt-b__meta">27 篇 · 2020—2026</p>
        </div>

        <Band index={2} />
        <Band index={3} />
      </div>
    </header>
  );
}

// ── C 人物溢出 ───────────────────────────────────────────

function TopC() {
  return (
    <header className="pt-c">
      <span className="pt-c__grain" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="pt-c__figure"
        src="/images/character/static-desktop.webp"
        alt=""
        aria-hidden="true"
      />
      <h1 className="pt-c__title">
        文章<span className="pt-c__title-dot">.</span>
      </h1>
      <div className="pt-c__foot">
        <p className="pt-c__meta">27 篇 · 2020—2026 · 中文 / English</p>
      </div>
      <span className="pt-c__veil" aria-hidden="true" />
    </header>
  );
}

// ── 页面 ─────────────────────────────────────────────────

export function PageTops() {
  const [nav, setNav] = useState<"blend" | "glass">("blend");

  return (
    <div className="proto-root pt-root" id="top">
      {/* 撕边的毛糙感：位移滤镜。定义一次，由 .pt-a 的纸层和纤维层引用。 */}
      <svg className="pt-defs" aria-hidden="true" focusable="false">
        <filter id="pt-torn" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.03" numOctaves="3" seed="9" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* 纤维层用另一套噪点：纸面断口和纸芯断口不重合，才有厚度。 */}
        <filter id="pt-torn-fibre" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.045" numOctaves="3" seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <Nav variant={nav} />

      <section className="pt-sec">
        <p className="pt-label">
          A · 撕裂纸
          <span>纸盖在纯黑上，下沿留白纤维与卷边阴影，胶带压角</span>
        </p>
        <TopA />
        <Rows />
      </section>

      <section className="pt-sec">
        <p className="pt-label">
          B · 断层切片
          <span>人物静帧横切四条、各自错位，标题嵌在缝里；hover 拼合</span>
        </p>
        <TopB />
        <Rows />
      </section>

      <section className="pt-sec">
        <p className="pt-label">
          C · 人物溢出
          <span>巨型标题压满宽度，人物用 screen 混合叠在字上，底部渐隐</span>
        </p>
        <TopC />
        <Rows />
      </section>

      <aside className="proto-switch" aria-label="原型状态">
        <div className="proto-switch__row">
          <span className="proto-switch__label">内页顶部原型</span>
          <span className="proto-switch__state">三个方向 · 导航两个变体</span>
        </div>
        <div className="proto-switch__row proto-switch__row--presets">
          <button aria-pressed={nav === "blend"} onClick={() => setNav("blend")}>
            反色导航
          </button>
          <button aria-pressed={nav === "glass"} onClick={() => setNav("glass")}>
            玻璃导航
          </button>
        </div>
      </aside>
    </div>
  );
}
