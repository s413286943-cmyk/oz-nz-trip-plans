import Image from "next/image";
import Link from "next/link";

import au2026 from "@data/au2026.json";
import nz from "@data/nz.json";
import HomeResume from "@/components/HomeResume";
import { ROUTE_CARDS, ROUTE_PAGES } from "@/lib/routes";

const covers = { nz: nz.trip, au2026: au2026.trip };

const takeaways = [
  { title: "每一天的安排", text: "定好去哪几个地方、顺序和每处住几晚，按参考路线里的路段和每天的安排排出每一天，并提醒开车太久、该给天气留一天的地方。" },
  { title: "预算", text: "按参考路线的价格，按人数、房间、车和天数估，每一行都能改。" },
  { title: "什么时候订什么", text: "机票、租车、住处、活动和热门餐厅，按出发日排成具体日期。" },
  { title: "出发前清单", text: "可以勾、可以删，也能加新的。" },
];

export default function Home() {
  return (
    <div className="nz share-home">
      <main className="nz-main">
        <header className="share-home-head">
          <p className="nz-eyebrow">参考路线 · 排路线</p>
          <h1>澳新自驾</h1>
          <p>两条排好的澳新自驾路线：每天去哪、住哪、吃什么、花多少。可以直接看，也可以拿来排一条新路线。</p>
          <div className="share-home-actions share-home-top">
            <Link className="share-cta" href="/plan">排路线</Link>
            <a className="share-cta is-quiet" href="#home-ours">看参考路线</a>
          </div>
          <HomeResume />
        </header>

        <section className="share-home-section" aria-labelledby="home-ours">
          <h2 id="home-ours">参考路线</h2>
          <ul className="share-trip-cards">
            {ROUTE_CARDS.map((trip, index) => (
              <li key={trip.id}>
                <Link href={ROUTE_PAGES[trip.id].view} className="share-trip-card">
                  <span className="share-trip-photo">
                    <Image src={covers[trip.id].coverImageUrl} alt={covers[trip.id].coverImageAlt || ""} fill sizes="(max-width: 640px) 100vw, 640px" priority={index === 0} />
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
        </section>

        <section className="share-home-section share-home-make" aria-labelledby="home-make">
          <h2 id="home-make">排路线</h2>
          <p>不用照搬：从空白开始，或者载入一条参考路线再改。排好以后有：</p>
          <ul className="share-takeaways">
            {takeaways.map((item) => (
              <li key={item.title}><b>{item.title}</b><span>{item.text}</span></li>
            ))}
          </ul>
          <div className="share-home-actions">
            <Link className="share-cta" href="/plan">开始排路线</Link>
            <Link className="share-cta is-quiet" href="/method">看排路线的方法</Link>
          </div>
          <p className="share-fine">方案只存在这台手机或电脑上，不会上传。可以存成文件，也能导出文字版或打印。</p>
        </section>

        <footer className="share-footer">
          <p>个人参考随意用，转载请注明出处。地点、价格和营业时间以出发时的官网为准。</p>
          <p>排的路线、改的行程和清单都只存在这台设备上，不会上传。取天气预报时，各地的位置会发给 Open-Meteo，方案的日子不发；网站托管平台可能统计页面的打开次数。</p>
        </footer>
      </main>
    </div>
  );
}
