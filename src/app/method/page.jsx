import path from "node:path";

import Link from "next/link";

import { loadGuide } from "@/lib/guide";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({ title: "排路线的方法", description: "怎么排一趟自驾旅行：从两条参考路线总结出来的做法，去别的地方也能用。" });

export default function MethodPage() {
  const method = loadGuide(path.join(process.cwd(), "content/method.md"));
  return (
    <div className="nz share-home share-method">
      <header className="nz-top share-top">
        <Link href="/" className="nz-mark">← 首页</Link>
        <Link href="/plan">排路线</Link>
      </header>
      <main className="nz-main">
        <article className="share-guide">
          <header className="nz-page-head">
            <p className="nz-eyebrow">去哪儿都能用</p>
            <h1>{method.title}</h1>
          </header>
          <nav className="share-toc" aria-label="目录">
            <ol>
              {method.headings.map((heading) => <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}
            </ol>
          </nav>
          <div className="share-prose" dangerouslySetInnerHTML={{ __html: method.html }} />
          <p className="share-method-next">
            照这些做法排一条：<Link href="/plan">开始排路线</Link>。
          </p>
        </article>
      </main>
    </div>
  );
}
