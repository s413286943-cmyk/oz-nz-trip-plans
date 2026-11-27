import Link from "next/link";

import RouteBuilder from "@/components/RouteBuilder";
import au2026 from "@data/au2026.json";
import nz from "@data/nz.json";
import places from "@data/places.json";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({ title: "排路线", description: "排路线：定去哪几个地方、顺序和每处住几晚，按参考路线排出每一天，附预算和出发前清单。" });

export default function PlanPage() {
  return (
    <div className="nz share-home share-plan">
      <header className="nz-top share-top">
        <Link href="/" className="nz-mark">← 首页</Link>
        <Link href="/method">排路线的方法</Link>
      </header>
      <main className="nz-main">
        <RouteBuilder library={places} sources={{ nz, au2026 }} />
      </main>
    </div>
  );
}
