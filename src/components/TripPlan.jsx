"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  MEAL_PERIOD,
  addBlock,
  addNote,
  exportFile,
  moveBlock,
  parseImport,
  removeBlock,
  removeNote,
  setMeals,
  updateBlock,
  updateDay,
  updateNote,
} from "@/lib/edits";
import { mealPairs, monthDay, shortDate, shortTransport, dayNumber } from "@/lib/format";
import { tripToMarkdown } from "@/lib/markdown";
import { download, useTripCopy } from "@/lib/useTripCopy";

const linkLabels = { map: "地图", official: "官网", booking: "预订", restaurant: "餐厅", photo: "图片" };

export default function TripPlan({ tripId, original, intro }) {
  const copy = useTripCopy(tripId, original);
  const [editing, setEditing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const data = copy.data;
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  const days = data.days;
  const edit = (change) => copy.apply(change);

  return (
    <>
      <Hero trip={data.trip} days={days} intro={intro} />
      <Tools tripId={tripId} copy={copy} editing={editing} setEditing={setEditing} />
      <CityStrip days={days} />

      {withEdgeDays(data.stages, days).map((stage) => (
        <section className="nz-stage" key={stage.id} aria-label={stage.title}>
          <header className="nz-stage-head">
            <h2>{stage.title}</h2>
            {stage.summary && <p>{stage.summary}</p>}
          </header>
          <ol className="nz-days">
            {days.filter((day) => stage.dayIds.includes(day.id)).map((day) => (
              <DayCard key={day.id} day={day} editing={editing} expanded={printing} edit={edit} />
            ))}
          </ol>
        </section>
      ))}

      {data.advice?.length > 0 && <Tips advice={data.advice} days={days} />}
      {data.lodgings?.length > 0 && <Stays lodgings={data.lodgings} />}
    </>
  );
}

// Days that belong to no stage (the flight out and the flight home) get their own small group so every day shows.
function withEdgeDays(stages, days) {
  const staged = new Set(stages.flatMap((stage) => stage.dayIds));
  const firstStaged = days.findIndex((day) => staged.has(day.id));
  const loose = days.filter((day) => !staged.has(day.id));
  const before = loose.filter((day) => days.indexOf(day) < firstStaged).map((day) => day.id);
  const after = loose.filter((day) => days.indexOf(day) > firstStaged).map((day) => day.id);
  return [
    ...(before.length ? [{ id: "edge-out", title: "出发", summary: "", dayIds: before }] : []),
    ...stages,
    ...(after.length ? [{ id: "edge-home", title: "回程", summary: "", dayIds: after }] : []),
  ];
}

function Hero({ trip, days, intro }) {
  return (
    <section className="nz-hero" aria-label="这次旅行">
      {trip.coverImageUrl
        ? <Image className="nz-hero-photo" src={trip.coverImageUrl} alt={trip.coverImageAlt || ""} fill priority sizes="(max-width: 640px) 100vw, 640px" />
        : <div className="nz-hero-photo nz-photo-fallback" aria-hidden="true" />}
      <div className="nz-hero-bar">
        <span>{days.length} 天 · {trip.travelers}</span>
      </div>
      <div className="nz-hero-copy">
        <p className="nz-eyebrow">{trip.dates}</p>
        <h1>{trip.title} · {trip.subtitle}</h1>
        <p className="nz-hero-sub"><span>{intro}</span></p>
        <a className="nz-hero-cta" href={`#day-${days[0].id}`}>从第一天看起</a>
      </div>
    </section>
  );
}

function Tools({ tripId, copy, editing, setEditing }) {
  const fileInput = useRef(null);
  const [message, setMessage] = useState("");
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      copy.replace(parseImport(await file.text()));
      setMessage("已经换成你导入的行程。");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const reset = () => {
    if (!window.confirm("恢复原版会丢掉你在这台设备上的所有修改，确定吗？")) return;
    copy.reset();
    setEditing(false);
    setMessage("已经恢复成原版。");
  };

  const status = editing
    ? "正在改：点开哪一天，就能改那一天的标题、每一步和提醒。改完点“改好了”。"
    : !copy.mine
    ? "这是我们的真实行程，可以直接改成你的：点“开始改”，改动只存在你这台设备的浏览器里，别人看不到。"
    : copy.stale
      ? "你看到的是你改过的版本。原版后来更新过，想看新原版就先导出你的版本，再恢复原版。"
      : "你看到的是你改过的版本，存在这个浏览器里。换设备前先导出文件，到那边再导入。";

  return (
    <section className={`share-tools${copy.stale ? " is-stale" : ""}`} aria-label="改成你的行程">
      <p role="status">{status}</p>
      {!copy.storageOk && <p className="share-warn" role="alert">这个浏览器不能保存修改（可能开了无痕模式），刷新后改动会丢。</p>}
      <div className="share-tool-buttons">
        <button type="button" className="is-primary" aria-pressed={editing} onClick={() => setEditing(!editing)}>
          {editing ? "改好了" : "开始改"}
        </button>
        <button type="button" onClick={() => download(`${copy.data.trip.title}-行程-${stamp}.md`, tripToMarkdown(copy.data), "text/markdown;charset=utf-8")}>导出文字版</button>
        <button type="button" onClick={() => download(`${tripId}-我的行程-${stamp}.json`, exportFile(copy.data, tripId), "application/json")}>导出文件</button>
        <button type="button" onClick={() => fileInput.current?.click()}>导入文件</button>
        <button type="button" onClick={() => window.print()}>打印</button>
        {copy.mine && <button type="button" className="is-danger" onClick={reset}>恢复原版</button>}
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} aria-label="选择导出的行程文件" />
      </div>
      {message && <p className="share-message" role="status">{message}</p>}
    </section>
  );
}

function CityStrip({ days }) {
  const stops = [];
  for (const day of days) {
    if (day.lodgingStatus === "无需住宿" || !day.base) continue;
    const last = stops.at(-1);
    if (last && last.base === day.base) {
      last.nights += 1;
    } else {
      stops.push({ base: day.base, nights: 1, id: day.id, start: day.date, image: day.coverImageUrl });
    }
  }
  return (
    <nav className="nz-cities" aria-label="住哪儿">
      <ol>
        {stops.map((stop) => (
          <li key={stop.id}>
            <a href={`#day-${stop.id}`}>
              <span className="nz-city-photo">
                {stop.image ? <Image src={stop.image} alt="" fill sizes="104px" /> : <span className="nz-photo-fallback" />}
              </span>
              <b>{stop.base}</b>
              <small>{shortDate(stop.start)} · {stop.nights} 晚</small>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function DayCard({ day, editing, expanded, edit }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === `#day-${day.id}`) setOpen(true);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [day.id]);
  const shown = open || expanded;

  const timeline = day.blocks.filter((block) => block.period !== MEAL_PERIOD);
  const mealLine = day.blocks.find((block) => block.period === MEAL_PERIOD)?.activity || "";
  const meals = mealPairs(mealLine);
  const notes = day.notes || [];

  return (
    <li id={`day-${day.id}`} className={["nz-day", shown ? "is-open" : "", editing && shown ? "is-editing" : ""].filter(Boolean).join(" ")}>
      <button type="button" className="nz-day-head" aria-expanded={shown} onClick={() => setOpen((value) => !value)}>
        <span className="nz-day-photo">
          {day.coverImageUrl
            ? <Image src={day.coverImageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 640px" />
            : <span className="nz-photo-fallback" />}
        </span>
        <span className="nz-day-cover">
          <small>DAY {dayNumber(day)} · {monthDay(day.date)} {day.weekday}</small>
          <strong>{day.title}</strong>
          <span className="nz-day-route">{day.city}</span>
        </span>
      </button>
      <div className="nz-day-tags">
        {day.lodgingStatus !== "无需住宿" && day.base && <span>今晚 {day.base}</span>}
        {day.transport && <span>{shortTransport(day)}</span>}
      </div>

      {shown && (
        <div className="nz-day-body">
          {editing ? (
            <div className="share-edit-day">
              <label>这天的标题<input value={day.title} onChange={(event) => edit((data) => updateDay(data, day.id, { title: event.target.value }))} /></label>
              <label>一句话<textarea rows={2} value={day.focus || ""} onChange={(event) => edit((data) => updateDay(data, day.id, { focus: event.target.value }))} /></label>
            </div>
          ) : (
            day.focus && <p className="nz-day-focus">{day.focus}</p>
          )}

          <dl className="nz-facts">
            {day.leaveBy && <div><dt>出发</dt><dd>{day.leaveBy}</dd></div>}
            {day.transport && <div><dt>怎么走</dt><dd>{day.transport}</dd></div>}
            {day.climateNote && <div><dt>天气</dt><dd>{day.climateNote}</dd></div>}
            {day.clothingNote && <div><dt>穿什么</dt><dd>{day.clothingNote}</dd></div>}
            {day.lodging && (
              <div className="is-wide">
                <dt>住哪儿</dt>
                <dd>
                  {day.lodging === "-" ? "回家" : day.lodging}
                  {day.lodgingResource?.url && <> · <a href={day.lodgingResource.url} target="_blank" rel="noreferrer">地图</a></>}
                </dd>
              </div>
            )}
          </dl>

          <h3 className="nz-sub">时间线</h3>
          <ol className="nz-timeline" aria-label={`${day.label} 时间线`}>
            {timeline.map((block, index) => (editing ? (
              <BlockEditor
                key={block.id}
                block={block}
                first={index === 0}
                last={index === timeline.length - 1}
                onChange={(patch) => edit((data) => updateBlock(data, day.id, block.id, patch))}
                onMove={(direction) => edit((data) => moveBlock(data, day.id, block.id, direction))}
                onAddAfter={() => edit((data) => addBlock(data, day.id, block.id))}
                onRemove={() => edit((data) => removeBlock(data, day.id, block.id))}
              />
            ) : (
              <li key={block.id} className={block.choice ? "is-choice" : undefined}>
                <time>{block.period}</time>
                {block.choice && <span className="nz-choice">{block.choice}</span>}
                <strong>{block.place || "（还没填地点）"}</strong>
                {block.activity && <p>{block.activity}</p>}
                {block.tip && <small>{block.tip}</small>}
                {block.miss && <small className="nz-miss">选这个会错过：{block.miss}</small>}
                <Links resources={block.resources} />
              </li>
            )))}
          </ol>
          {editing && (
            <button type="button" className="share-add" onClick={() => edit((data) => addBlock(data, day.id))}>＋ 在最后加一步</button>
          )}

          {editing ? (
            <>
              <h3 className="nz-sub">吃什么</h3>
              <label className="share-edit-field">
                <span>按“早餐：…；午餐：…；晚餐：…”写</span>
                <textarea rows={2} value={mealLine} onChange={(event) => edit((data) => setMeals(data, day.id, event.target.value))} aria-label="这天吃什么" />
              </label>
            </>
          ) : meals.length > 0 && (
            <>
              <h3 className="nz-sub">吃什么</h3>
              <dl className="nz-meals" aria-label="吃什么">
                {meals.map(([meal, place]) => <div key={meal}><dt>{meal}</dt><dd>{place}</dd></div>)}
              </dl>
            </>
          )}

          {(notes.length > 0 || editing) && <h3 className="nz-sub">提醒</h3>}
          {editing ? (
            <ul className="share-edit-notes">
              {notes.map((note, index) => (
                <li key={index}>
                  <input value={note.label} placeholder="标签" aria-label="提醒标签" onChange={(event) => edit((data) => updateNote(data, day.id, index, { label: event.target.value }))} />
                  <textarea rows={2} value={note.text} aria-label="提醒内容" onChange={(event) => edit((data) => updateNote(data, day.id, index, { text: event.target.value }))} />
                  <button type="button" className="is-danger" onClick={() => edit((data) => removeNote(data, day.id, index))}>删除提醒</button>
                </li>
              ))}
              <li><button type="button" className="share-add" onClick={() => edit((data) => addNote(data, day.id))}>＋ 加一条提醒</button></li>
            </ul>
          ) : notes.length > 0 && (
            <ul className="nz-notes" aria-label="当天提醒">
              {notes.map((note, index) => <li key={index}>{note.label && <b>{note.label}</b>}{note.text}</li>)}
            </ul>
          )}

          {day.drive && <DriveGuide drive={day.drive} />}
        </div>
      )}
    </li>
  );
}

function BlockEditor({ block, first, last, onChange, onMove, onAddAfter, onRemove }) {
  const field = (key) => ({ value: block[key] || "", onChange: (event) => onChange({ [key]: event.target.value }) });
  return (
    <li className="share-edit-block">
      <div className="share-edit-row">
        <label>时间<input {...field("period")} /></label>
        <label>地点<input {...field("place")} /></label>
      </div>
      <label>做什么<textarea rows={3} {...field("activity")} /></label>
      <label>提示<input {...field("tip")} /></label>
      {(block.choice || block.miss) && (
        <div className="share-edit-row">
          <label>选项标签<input {...field("choice")} /></label>
          <label>会错过<input {...field("miss")} /></label>
        </div>
      )}
      <div className="share-edit-actions">
        <button type="button" disabled={first} onClick={() => onMove(-1)}>上移</button>
        <button type="button" disabled={last} onClick={() => onMove(1)}>下移</button>
        <button type="button" onClick={onAddAfter}>在下面加一步</button>
        <button type="button" className="is-danger" onClick={onRemove}>删除这一步</button>
      </div>
    </li>
  );
}

function DriveGuide({ drive }) {
  return (
    <section className="nz-drive" aria-label={drive.title}>
      <h3 className="nz-sub">开车</h3>
      <p className="nz-drive-title">{drive.title.replace(/^导航\d+ · /, "")}</p>
      <p className="nz-drive-time">{drive.duration}</p>
      <div className="nz-legs" role="table" aria-label="分段驾驶">
        <div className="nz-leg nz-leg-head" role="row">
          <span role="columnheader">路段</span>
          <span role="columnheader">开车</span>
          <span role="columnheader">停车与停留</span>
        </div>
        {drive.legs.map((leg) => (
          <div className="nz-leg" role="row" key={leg.sortOrder}>
            <strong role="cell">{leg.segment}</strong>
            <span role="cell">{leg.driveTime}</span>
            <small role="cell">{leg.stopNote}</small>
          </div>
        ))}
      </div>
      {drive.notes && <p className="nz-drive-notes">{drive.notes}</p>}
      <p className="nz-drive-roads">{drive.sequence}</p>
      <Links resources={drive.resources} />
    </section>
  );
}

function Tips({ advice, days }) {
  const dayFor = new Map(days.map((day) => [day.id, day]));
  return (
    <section className="nz-section" aria-label="出行提示">
      <h2>出行提示</h2>
      <div className="nz-tips">
        {advice.map((item) => (
          <article key={item.sortOrder} className="nz-tip">
            <p className="nz-tip-when">
              {item.verdict}
              {item.dayIds.length > 0 && ` · ${item.dayIds.map((id) => dayFor.get(id)?.label).filter(Boolean).join(" ")}`}
            </p>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            {item.action && <p className="nz-tip-do">{item.action}</p>}
            <Links resources={item.resources} />
          </article>
        ))}
      </div>
    </section>
  );
}

function Stays({ lodgings }) {
  return (
    <section className="nz-section" aria-label="住哪儿">
      <h2>住哪儿</h2>
      <ul className="nz-stays">
        {lodgings.map((stay) => (
          <li key={stay.sortOrder}>
            <span className="nz-stays-dates">{shortDate(stay.checkIn)}<i>–</i>{shortDate(stay.checkOut)}</span>
            <div>
              <strong>{stay.name}</strong>
              <small>{[stay.room, stay.detail].filter((value) => value && value !== "—").join(" · ")}</small>
              {stay.afterDeadline && <small>{stay.afterDeadline}</small>}
              {stay.resource?.url && <a href={stay.resource.url} target="_blank" rel="noreferrer">地图</a>}
            </div>
            {stay.status && <span className="nz-stays-status">{stay.status}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Links({ resources }) {
  const linked = (resources || []).filter((resource) => resource.url);
  if (!linked.length) return null;
  return (
    <span className="nz-links">
      {linked.map((resource) => (
        <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer">
          {linkLabels[resource.type] || "链接"} · {resource.title}
        </a>
      ))}
    </span>
  );
}
