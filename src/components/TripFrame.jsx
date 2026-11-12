import Link from "next/link";

export const TRIP_TABS = {
  nz2027: [
    { id: "schedule", href: "/nz2027", label: "行程" },
    { id: "dining", href: "/nz2027/dining", label: "吃什么" },
    { id: "prep", href: "/nz2027/prep", label: "清单" },
    { id: "costs", href: "/nz2027/costs", label: "花销" },
  ],
  au2026: [
    { id: "guide", href: "/au2026", label: "自驾攻略" },
    { id: "schedule", href: "/au2026/days", label: "每日行程" },
  ],
};

const TRIP_LABELS = {
  nz2027: ["澳新 2027", "2027年2月1日 – 17日 · 悉尼 + 新西兰南北岛"],
  au2026: ["澳洲 2026", "2026年7月28日 – 8月13日 · 墨尔本、凯恩斯、悉尼"],
};

export default function TripFrame({ trip, view, children }) {
  const [name, dates] = TRIP_LABELS[trip];
  return (
    <div className={`nz nz-view-${view} share-trip-${trip}`}>
      <header className="nz-top share-top">
        <Link href="/" className="nz-mark">← 两次旅行</Link>
        <span><b>{name}</b> · {dates}</span>
      </header>
      <nav className="nz-tabs" aria-label="主导航">
        {TRIP_TABS[trip].map((tab) => (
          <Link key={tab.id} href={tab.href} className={tab.id === view ? "is-active" : ""} aria-current={tab.id === view ? "page" : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>
      <main className="nz-main">{children}</main>
    </div>
  );
}
