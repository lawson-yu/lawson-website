import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "文章",
    description: "为后续的 Markdown 文章与详情页留出入口。",
  },
  {
    title: "首页作品 / 应用",
    description: "为后续展示并链接到外部作品留出入口。",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-12 px-6 py-20 sm:px-10">
      <header className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">
          Next.js · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          个人网站 Starter
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
          基础骨架已就绪。这里为后续首页、文章和作品内容预留清晰入口。
        </p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href="/api/health" />}
        >
          查看服务健康状态
        </Button>
      </header>

      <section aria-label="内容入口" className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <article
            className="rounded-xl border bg-card p-6"
            key={section.title}
          >
            <h2 className="text-xl font-medium">{section.title}</h2>
            <p className="mt-2 leading-7 text-muted-foreground">
              {section.description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
