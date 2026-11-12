"use client";

// The 2026 trip in the same layout as our own site, with what we learned added for the whole trip, each stage and each day.
import Image from "next/image";
import Link from "next/link";

import LazyDayDetails from "@/components/LazyDayDetails";
import { buildDayTimeline, collectMapActions, parseMealPlan } from "@/lib/today";
import { useTripCopy } from "@/lib/useTripCopy";

const resourceLabels = { map: "地图", official: "官网", booking: "预订", restaurant: "餐厅", photo: "图片参考", note: "备注" };
const BOOKENDS = ["d0", "d16"];

export default function AtlasTrip({ original, retro }) {
  const { data, mine } = useTripCopy("au2026", original);
  const { trip, stages, days } = data;
  const bookends = days.filter((day) => BOOKENDS.includes(day.id));

  return (
    <div className="itinerary-shell route-atlas travel-mode-after share-atlas">
      <Hero trip={trip} stages={stages} retro={retro} />
      <RetroSummary retro={retro} mine={mine} />
      <RouteManifest days={days} stages={stages} />
      <section className="day-jump route-jump" aria-label="快速跳转">
        {days.map((day) => <a key={day.id} href={`#${day.id}`}>{day.label}</a>)}
      </section>
      <section className="final-day share-bookend-out">
        {bookends.filter((day) => day.id === "d0").map((day) => <DayCard key={day.id} day={day} retro={retro.days[day.id]} compact />)}
      </section>
      <section className="stage-stack" aria-label="行程时间线">
        {stages.map((stage, index) => (
          <StageSection
            key={stage.id}
            stage={stage}
            stageRetro={retro.stages[stage.id]}
            days={days.filter((day) => stage.dayIds.includes(day.id))}
            dayRetro={retro.days}
            eagerImage={index === 0}
          />
        ))}
      </section>
      <section className="final-day">
        {bookends.filter((day) => day.id === "d16").map((day) => <DayCard key={day.id} day={day} retro={retro.days[day.id]} compact />)}
      </section>
      <section className="share-atlas-cta" aria-label="改成你的行程">
        <div>
          <span className="section-kicker">想照着走</span>
          <h2>改成你自己的行程</h2>
          <p>在“改成你的”里可以改每一天的标题和每一步、加一步、删一步，也能导出文字版带走。改动只存在你的手机或电脑上，这一页也会显示你改过的样子。</p>
        </div>
        <div className="share-atlas-cta-links">
          <Link href="/au2026/days" className="post-trip-primary">改成你的</Link>
          <Link href="/au2026/guide">看攻略</Link>
        </div>
      </section>
    </div>
  );
}

function Hero({ trip, stages, retro }) {
  return (
    <header className="itinerary-hero route-hero">
      <Image className="itinerary-hero-image" src={trip.coverImageUrl} alt={trip.coverImageAlt || ""} fill loading="eager" priority sizes="(max-width: 1180px) 100vw, 1180px" />
      <div className="itinerary-hero-copy">
        <p>{trip.route}</p>
        <h1>
          <span>{trip.title} ·</span>
          <span>{trip.subtitle}</span>
        </h1>
        <div className="hero-meta">
          <span>{trip.dates}</span>
          <span>两对夫妻 · 4 人</span>
          <span>城市风光 · 海岸自驾 · 大堡礁</span>
        </div>
        <div className="hero-route-strip" aria-label="行程阶段">
          {stages.map((stage) => <span key={stage.id}>{stage.title}</span>)}
        </div>
      </div>
      <aside className="hero-weather share-hero-retro">
        <span>{retro.headline.kicker}</span>
        <strong>{retro.headline.title}</strong>
        <p>{retro.stats[2].value} · {retro.stats[3].value}</p>
        <small>{retro.stats[2].note}；{retro.stats[3].note}</small>
      </aside>
    </header>
  );
}

function RetroSummary({ retro, mine }) {
  return (
    <section className="share-retro" aria-label="这一趟的总结">
      <div className="share-retro-head">
        <span className="section-kicker">{retro.headline.kicker}</span>
        <h2>{retro.headline.title}</h2>
        <p>{retro.headline.text}</p>
        {mine && <p className="share-retro-mine">下面每天的安排是你改过的样子，经验部分还是我们写的。</p>}
      </div>

      <div className="share-retro-stats">
        {retro.stats.map((stat) => (
          <article key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.note}</small>
          </article>
        ))}
      </div>

      <h3 className="share-retro-sub">我们的经验</h3>
      <div className="share-retro-lessons">
        {retro.lessons.map((lesson) => (
          <article key={lesson.title}>
            <strong>{lesson.title}</strong>
            <p>{lesson.text}</p>
          </article>
        ))}
      </div>

      <div className="share-retro-split">
        <section aria-label="行前时间线">
          <h3 className="share-retro-sub">行前时间线</h3>
          <ol className="share-retro-timeline">
            {retro.timeline.map(([when, what]) => <li key={when}><b>{when}</b><span>{what}</span></li>)}
          </ol>
        </section>
        <section aria-label="花了多少">
          <h3 className="share-retro-sub">花了多少</h3>
          <p className="share-retro-total">{retro.costs.total}</p>
          <table className="share-retro-table">
            <caption>{retro.costs.note}</caption>
            <tbody>
              {retro.costs.rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}
            </tbody>
          </table>
          <p className="share-retro-tip">{retro.costs.tip}</p>
        </section>
      </div>

      <p className="share-retro-more">
        攻略里有更细的：<Link href="/au2026/guide#s-出发前">出发前</Link> · <Link href="/au2026/guide#s-取车和上路">取车和上路</Link> · <Link href="/au2026/guide#s-花销">花销和要提前订的</Link> · <Link href="/au2026/guide#s-清单">出发前清单</Link>
      </p>
    </section>
  );
}

function RouteManifest({ days, stages }) {
  const bookendDays = days.filter((day) => BOOKENDS.includes(day.id));
  return (
    <section className="route-manifest" aria-label="路线总览">
      <div className="manifest-lead">
        <span>16 天路线</span>
        <h2>每天怎么走</h2>
        <p>按阶段看每天去哪、住哪、吃什么，每天都附了我们的经验。</p>
      </div>
      <div className="manifest-stages">
        <article className="manifest-stage manifest-bookends">
          <span>出发 / 返程</span>
          <h3>上海往返</h3>
          <p>{bookendDays.map((day) => day.city).join(" → ")}</p>
          <div className="manifest-days">
            {bookendDays.map((day) => (
              <a key={day.id} href={`#${day.id}`}><strong>{day.label}</strong><small>{formatShortDate(day)}</small></a>
            ))}
          </div>
        </article>
        {stages.map((stage, index) => {
          const stageDays = days.filter((day) => stage.dayIds.includes(day.id));
          if (!stageDays.length) return null;
          return (
            <article className={`manifest-stage stage-tone-${index + 1}`} key={stage.id}>
              <span>{formatStageRange(stageDays)}</span>
              <h3>{stage.title}</h3>
              <p>{stageDays[0].city} → {stageDays.at(-1).city}</p>
              <div className="manifest-days">
                {stageDays.map((day) => (
                  <a key={day.id} href={`#${day.id}`}><strong>{day.label}</strong><small>{formatShortDate(day)}</small></a>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StageSection({ stage, stageRetro, days, dayRetro, eagerImage }) {
  if (!days.length) return null;
  return (
    <section className="stage-section route-stage">
      <div className="stage-head">
        <div>
          <span>{formatStageRange(days)}</span>
          <h2>{stage.title}</h2>
          <p>{days.map((day) => day.city).join(" / ")}</p>
          <div className="stage-days">
            {days.map((day) => <a key={day.id} href={`#${day.id}`}>{day.label}</a>)}
          </div>
        </div>
        <div className="stage-image">
          {stage.imageUrl && <Image src={stage.imageUrl} alt={stage.title} fill loading={eagerImage ? "eager" : "lazy"} sizes="(max-width: 860px) 100vw, 430px" />}
        </div>
      </div>
      {stageRetro && <StageRetro retro={stageRetro} />}
      <div className="day-grid">
        {days.map((day) => <DayCard key={day.id} day={day} retro={dayRetro[day.id]} />)}
      </div>
    </section>
  );
}

function StageRetro({ retro }) {
  return (
    <section className="share-stage-retro" aria-label={`这一段的经验 · ${retro.title}`}>
      <span className="section-kicker">这一段的经验</span>
      <h3>{retro.title}</h3>
      {retro.facts?.length > 0 && (
        <dl>
          {retro.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
      {retro.notes?.length > 0 && <ul>{retro.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
    </section>
  );
}

function DayCard({ day, retro, compact = false }) {
  if (!day) return null;
  const keyStops = day.blocks.filter((block) => block.period !== "饮食").slice(0, 4);
  const foodBlock = day.blocks.find((block) => block.period === "饮食");
  const resourcesCount = day.blocks.reduce((total, block) => total + (block.resources?.length || 0), 0);
  const timeline = buildDayTimeline(day);
  const mapActions = collectMapActions(day);
  const meals = parseMealPlan(day);

  return (
    <article className={["day-card route-day-card", compact ? "compact" : "", retro ? "has-retro" : ""].filter(Boolean).join(" ")} id={day.id}>
      <div className="day-cover">
        {day.coverImageUrl && <Image className="day-cover-image" src={day.coverImageUrl} alt={day.coverImageAlt || ""} fill sizes="(max-width: 860px) 100vw, 560px" />}
        <div>
          <span>{day.label}</span>
          <strong>{formatShortDate(day)} {day.weekday}</strong>
        </div>
      </div>
      <div className="day-body">
        <div className="day-title-row">
          <div>
            <p>{day.city}</p>
            <h3>{day.title}</h3>
          </div>
          {day.lodging && <span>{day.lodging === "-" ? "返程" : day.lodging}</span>}
        </div>
        {day.focus && <p className="focus">{day.focus}</p>}
        <div className="day-brief-grid">
          <div className="weather-strip">
            <strong>天气参考</strong>
            <p>{day.climateNote}</p>
            <small>季节穿衣参考 · {day.clothingNote}</small>
          </div>
          <article className="day-brief-card">
            <span>这天去哪</span>
            <strong>{keyStops.length ? `${keyStops.length} 个地方` : "自由安排"}</strong>
            <small>{resourcesCount ? `${resourcesCount} 个地图和官网链接` : "没有链接"}</small>
          </article>
        </div>
        <div className="route-stop-list" aria-label={`${day.label} 主要停靠`}>
          {keyStops.map((block) => <span key={`${day.id}-stop-${block.id || block.sortOrder}`}>{block.place}</span>)}
        </div>
        {foodBlock && (
          <div className="food-brief" data-food-block="true">
            <span>饮食安排</span>
            <p>{foodBlock.activity}</p>
            {foodBlock.tip && <small>{foodBlock.tip}</small>}
          </div>
        )}
        {retro && (retro.notes?.length > 0 || retro.nav) && <DayRetro retro={retro} />}
        <LazyDayDetails>
          <div className="day-operational-details">
            <DayExecutionGrid timeline={timeline} />
            <DayDocket day={day} />
            <section className="day-map-actions" aria-label="每日地图快捷入口">
              <div>
                <span>地图</span>
                <strong>{meals.dinner}</strong>
              </div>
              {mapActions.map((action) => <a key={action.id} href={action.url} target="_blank" rel="noreferrer">{action.label}</a>)}
            </section>
            <div className="timeline">
              {day.blocks.map((block) => (
                <div className="time-block" key={`${day.id}-${block.id || block.sortOrder}`} data-food-block={block.period === "饮食" ? "true" : undefined}>
                  <span>{block.period}</span>
                  <div>
                    <h4>{block.place}</h4>
                    <p>{block.activity}</p>
                    {block.highlight && <small>{block.highlight}</small>}
                    {block.tip && <em>{block.tip}</em>}
                    <ResourceLinks resources={block.resources} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </LazyDayDetails>
      </div>
    </article>
  );
}

function DayRetro({ retro }) {
  return (
    <section className="share-day-retro" aria-label="我们的经验">
      <span>我们的经验</span>
      {retro.notes?.length > 0 && <ul>{retro.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      {retro.nav && <a className="share-retro-nav" href={retro.nav} target="_blank" rel="noreferrer">在 Google 地图里打开这天的路线</a>}
    </section>
  );
}

function DayExecutionGrid({ timeline }) {
  return (
    <section className="day-execution-grid" aria-label="每日时间轴">
      {timeline.map((slot) => (
        <article className={`slot-${slot.id}`} key={slot.id}>
          <span>{slot.label}</span>
          {slot.blocks.slice(0, 2).map((block) => (
            <div key={`${block.dayId}-${block.id || block.sortOrder}`}>
              <strong>{block.place}</strong>
              <p>{block.activity}</p>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}

// Where we slept, how we got around and what needed a ticket that day.
function DayDocket({ day }) {
  const items = [
    { id: "lodging", label: "住哪", title: day.lodging && day.lodging !== "-" ? day.lodging : "飞机上", detail: day.lodging && day.lodging !== "-" ? "点开看地图" : "这天回程", href: day.lodgingResource?.url || "" },
    { id: "transport", label: "怎么走", title: day.transport || "", detail: day.leaveBy || "", href: day.primaryResource?.url || "" },
    { id: "ticket", label: "门票和团", title: day.ticketResource && day.ticketResource.type !== "note" ? day.ticketResource.title : "这天不用买票", detail: day.ticketResource && day.ticketResource.type !== "note" ? "要提前订" : "到了再说", href: day.ticketResource?.type !== "note" ? day.ticketResource?.url || "" : "" },
  ];
  return (
    <section className="day-docket" aria-label="住哪、怎么走、门票">
      {items.map((item) => (
        <a className={[`docket-${item.id}`, !item.href ? "is-disabled" : ""].filter(Boolean).join(" ")} key={item.id} href={item.href || undefined} target={item.href ? "_blank" : undefined} rel={item.href ? "noreferrer" : undefined}>
          <span>{item.label}</span>
          <strong>{item.title}</strong>
          <small>{item.detail}</small>
        </a>
      ))}
    </section>
  );
}

function ResourceLinks({ resources }) {
  const linked = (resources || []).filter((resource) => resource.url);
  if (!linked.length) return null;
  return (
    <div className="resource-links">
      {linked.map((resource) => (
        <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer">{resourceLabels[resource.type] || "链接"} · {resource.title}</a>
      ))}
    </div>
  );
}

function formatShortDate(day) {
  return day.date.slice(5).replace("-", ".");
}

function formatStageRange(days) {
  if (!days.length) return "";
  return `${days[0].label}-${days.at(-1).label} · ${formatShortDate(days[0])}-${formatShortDate(days.at(-1))}`;
}
