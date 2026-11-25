import { ArrowDown } from "lucide-react";
import { MagazineCloud } from "./magazine-cloud";
import "./magazine-heading.css";

// 文章页头原型：在同一页面比较三种动态点云构图。
export const HEADINGS = [
  { id: "A", name: "流线" },
  { id: "B", name: "碎片" },
  { id: "C", name: "环波" },
  { id: "D", name: "融合" },
] as const;

export type HeadingVariant = (typeof HEADINGS)[number]["id"];

export function MagazineHeading({ variant }: { variant: HeadingVariant }) {
  return (
    <div className={`mag-heading mag-heading--${variant.toLowerCase()}`}>
      <MagazineCloud variant={variant} />
      <div className="mag-heading__frame">
        <div className="mag-heading__type" aria-hidden="true"><span>ARTICLES</span></div>
        <div className="mag-heading__intro">
          <h1>文章</h1>
          <p>关于 AI、设计与构建的实践记录。</p>
        </div>
        <a className="mag-heading__browse" href="#mag-articles">
          浏览所有文章 <ArrowDown size={17} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
