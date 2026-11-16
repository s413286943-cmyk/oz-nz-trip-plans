import Link from "next/link";

import TripFrame from "@/components/TripFrame";
import { loadGuide } from "@/lib/guide";

export const metadata = { title: "澳洲自驾攻略" };

export default function Au2026GuidePage() {
  const guide = loadGuide();
  return (
    <TripFrame trip="au2026" view="guide">
      <article className="share-guide">
        <header className="nz-page-head">
          <p className="nz-eyebrow">2026.07.28 – 08.13 · 两对夫妻 · 澳洲冬季</p>
          <h1>{guide.title}</h1>
          <p>
            我们回来后写的自驾攻略：租车、保险、三段自驾路线、住哪、花了多少。每天怎么走在
            <Link href="/au2026">行程</Link>里。
          </p>
        </header>
        <nav className="share-toc" aria-label="目录">
          <ol>
            {guide.headings.map((heading) => <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}
          </ol>
        </nav>
        <div className="share-prose" dangerouslySetInnerHTML={{ __html: guide.html }} />
      </article>
    </TripFrame>
  );
}
