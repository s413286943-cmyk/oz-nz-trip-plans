import Link from "next/link";

export const TRIP_TABS = {
  nz: [
    { id: "schedule", href: "/nz", label: "行程" },
    { id: "dining", href: "/nz/dining", label: "吃什么" },
    { id: "prep", href: "/nz/prep", label: "清单" },
    { id: "costs", href: "/nz/costs", label: "花销" },
  ],
  au2026: [
    { id: "atlas", href: "/au2026", label: "行程" },
    { id: "guide", href: "/au2026/guide", label: "攻略" },
    { id: "schedule", href: "/au2026/days", label: "改行程" },
  ],
  mine: [
    { id: "schedule", href: "/mine", label: "行程" },
    { id: "costs", href: "/mine/budget", label: "预算" },
    { id: "prep", href: "/mine/prep", label: "清单" },
  ],
};

const TRIP_LABELS = {
  nz: ["澳新 17 天", "南半球夏天 · 悉尼 + 新西兰南北岛"],
  au2026: ["澳洲 2026", "2026年7月28日 – 8月13日 · 墨尔本、凯恩斯、悉尼"],
  mine: ["方案", "排好的路线"],
};

// The map links open Google Maps, which needs a way past the firewall in mainland China.
const MAP_NOTE = <p className="share-fine share-map-note">页面里的「地图」和「在 Google 地图里打开」都是 Google 地图：在国内要能上 Google 才打得开，到了当地可以直接用。地名多是英文原名，可以复制到别的地图里搜。</p>;

export default function TripFrame({ trip, view, wide = false, children }) {
  const [name, dates] = TRIP_LABELS[trip];
  const note = ["schedule", "dining", "atlas", "guide"].includes(view) ? MAP_NOTE : null;
  return (
    <div className={`nz nz-view-${view} share-trip-${trip}${trip === "au2026" ? " share-light" : ""}`}>
      <header className="nz-top share-top">
        <Link href="/" className="nz-mark">← 首页</Link>
        <span><b>{name}</b> · {dates}</span>
        <Link href={trip === "mine" ? "/plan" : `/plan?from=${trip}`} className="share-top-plan">{trip === "mine" ? "改路线" : "排路线"}</Link>
      </header>
      <nav className="nz-tabs" aria-label="主导航">
        {TRIP_TABS[trip].map((tab) => (
          <Link key={tab.id} href={tab.href} className={tab.id === view ? "is-active" : ""} aria-current={tab.id === view ? "page" : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>
      {wide ? <main className="share-wide">{children}{note}</main> : <main className="nz-main">{children}{note}</main>}
    </div>
  );
}
