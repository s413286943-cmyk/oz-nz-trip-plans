import Link from "next/link";

import TripFrame from "@/components/TripFrame";
import { loadGuide } from "@/lib/guide";

export const metadata = { title: "澳洲自驾攻略（2026 年 8 月）" };

export default function Au2026GuidePage() {
  const guide = loadGuide();
  return (
    <TripFrame trip="au2026" view="guide">
      <article className="share-guide">
        <header className="nz-page-head">
          <p className="nz-eyebrow">2026.07.28 – 08.13 · 两对夫妻 · 澳洲冬季</p>
          <h1>{guide.title}</h1>
          <p>
            走完回来写的攻略全文：租车、保险、路线、住哪、花了多少都按实际。每日路书和每天的事后备注在
            <Link href="/au2026">行程+总结</Link>里。
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
