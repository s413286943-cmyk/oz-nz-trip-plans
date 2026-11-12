import Image from "next/image";
import Link from "next/link";

import au2026 from "@data/au2026.json";
import nz2027 from "@data/nz2027.json";

const trips = [
  {
    id: "nz2027",
    href: "/nz2027",
    image: nz2027.trip.coverImageUrl,
    alt: nz2027.trip.coverImageAlt,
    when: "2027 年 2 月 · 17 天 · 两人",
    title: "悉尼 3 晚 + 新西兰南岛自驾 + 奥克兰",
    line: "悉尼进，基督城取车一路开到皇后镇，Milford 坐大巴，最后飞奥克兰。每天写满细节，二选一的地方都写了选这个会错过什么。",
    who: "适合：第一次去新西兰、想自驾南岛的人",
    status: "出发前的行程，回来后补上经验和花销",
  },
  {
    id: "au2026",
    href: "/au2026",
    image: au2026.trip.coverImageUrl,
    alt: au2026.trip.coverImageAlt,
    when: "2026 年 7 月底 – 8 月中 · 16 天 · 两对夫妻",
    title: "澳洲自驾：4 次租车、6 天开车，我们踩过的坑",
    line: "墨尔本进、悉尼出，大洋路、凯恩斯高原和 Palm Cove、悉尼南海岸自己开车。每天去哪、住哪、吃什么，租车、保险和花销，都附了我们的经验。",
    who: "适合：冬天去澳洲、想自己开一段的人",
    status: "16 天行程 + 自驾攻略",
  },
];

export default function Home() {
  return (
    <div className="nz share-home">
      <main className="nz-main">
        <header className="share-home-head">
          <p className="nz-eyebrow">我们的行程 · 可以直接改成你的</p>
          <h1>澳新两次旅行</h1>
          <p>我们两次澳新旅行的行程和攻略：每天去哪、住哪、吃什么、花了多少。打开任意一天就能改成你的，改动只存在你的手机或电脑上，也能导出文字版带走。</p>
        </header>
        <ul className="share-trip-cards">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link href={trip.href} className="share-trip-card">
                <span className="share-trip-photo">
                  <Image src={trip.image} alt={trip.alt || ""} fill sizes="(max-width: 640px) 100vw, 640px" priority />
                </span>
                <span className="share-trip-copy">
                  <small>{trip.when}</small>
                  <strong>{trip.title}</strong>
                  <span>{trip.line}</span>
                  <em>{trip.who}</em>
                  <i>{trip.status}</i>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <footer className="share-footer">
          <p>个人参考随意用，转载请注明出处。地点、价格和营业时间以出发时的官网为准。</p>
        </footer>
      </main>
    </div>
  );
}
