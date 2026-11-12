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
    line: "悉尼进，基督城取车一路开到皇后镇，Milford 坐大巴，最后飞奥克兰。每天写满细节，二选一的地方都标了会错过什么。",
    who: "适合：第一次去新西兰、想自驾南岛的人",
    status: "出发前的计划，回来后会补真实花销",
  },
  {
    id: "au2026",
    href: "/au2026",
    image: au2026.trip.coverImageUrl,
    alt: au2026.trip.coverImageAlt,
    when: "2026 年 7 月底 – 8 月中 · 16 天 · 两对夫妻",
    title: "澳洲自驾：4 次租车、6 天开车，我们踩过的坑",
    line: "出发前排的 D0–D16 每日路书，每天和每一段都补上了走完回来的总结：墨尔本大洋路、凯恩斯高原和 Palm Cove、悉尼南海岸，租车、保险、路线、花销都按实际写。",
    who: "适合：冬天去澳洲、想自己开一段的人",
    status: "已经走完：路书 + 事后总结 + 攻略全文",
  },
];

export default function Home() {
  return (
    <div className="nz share-home">
      <main className="nz-main">
        <header className="share-home-head">
          <p className="nz-eyebrow">真实行程 · 可以直接改成你的</p>
          <h1>澳新两次旅行</h1>
          <p>我们自己用的行程和攻略，去掉了订单号这些私人信息。打开任意一天就能改，改动只存在你的浏览器里，可以导出文字版带走。</p>
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
          <p>个人参考随意用；转载请注明出处。地点、价格、营业时间以出发时官网为准。</p>
          <p><a href="https://github.com/s413286943-cmyk/oz-nz-trip-plans" target="_blank" rel="noreferrer">GitHub 上的源码</a> · 想换成自己的行程，复制仓库后改 <code>data/</code> 里的文件。</p>
        </footer>
      </main>
    </div>
  );
}
