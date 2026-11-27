"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { isDate, localToday } from "@/lib/dates";
import {
  MEAL_PERIOD,
  addBlock,
  addDay,
  addNote,
  canMoveDay,
  exportFile,
  moveBlock,
  moveDay,
  noteIdAt,
  readImport,
  removeBlock,
  removeDay,
  removeNote,
  renumberDays,
  restoreParked,
  setMeals,
  updateBlock,
  updateDay,
  updateNote,
} from "@/lib/edits";
import { mealPairs, monthDay, shortDate, shortTransport, dayNumber, stayEnds } from "@/lib/format";
import { tripToMarkdown } from "@/lib/markdown";
import { ROUTE_PAGES } from "@/lib/routes";
import { checksKey, emptyPrep, mergePrep, prepKey, readChecks, readPrep, writeOpenedSide } from "@/lib/sideStore";

import CopyNotes from "./CopyNotes";
import NzOverview from "./NzOverview";
import { OwnPlanTop } from "./PlanOverview";
import { download, useTripCopy } from "@/lib/useTripCopy";

const linkLabels = { map: "地图", official: "官网", booking: "预订", restaurant: "餐厅", photo: "图片" };

// `own`: the visitor's own plan (no original of ours behind it). `library` adds budget and bookings to the text export.
// `overview` is the route sketch (nz-overview.json); it is drawn from the days as the visitor has them now.
export default function TripPlan({ tripId, original, intro, library = null, own = false, overview = null }) {
  const copy = useTripCopy(tripId, original);
  const [editing, setEditing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [fresh, setFresh] = useState(false);
  const data = copy.data;
  useEffect(() => {
    // Straight from the question flow: open the editor on the new draft.
    if (new URLSearchParams(window.location.search).get("draft") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname);
    Promise.resolve().then(() => {
      setFresh(true);
      setEditing(true);
    });
  }, []);
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

  if (own && (!copy.mine || !days.length)) {
    return copy.ready ? <NoPlanYet copy={copy} tripId={tripId} /> : null;
  }

  return (
    <>
      <Hero trip={data.trip} days={days} intro={own ? data.trip.route : intro} />
      {own && library ? (
        <OwnPlanTop library={library} data={data}>
          {data.plan?.stops && <PlanBar tripId={tripId} data={data} edit={edit} fresh={fresh} />}
        </OwnPlanTop>
      ) : (
        <>
          {overview && <NzOverview overview={overview} days={days} />}
          {data.plan?.stops && <PlanBar tripId={tripId} data={data} edit={edit} fresh={fresh} />}
        </>
      )}
      <Tools tripId={tripId} copy={copy} editing={editing} setEditing={setEditing} library={library} own={own} />
      <CityStrip days={days} />

      {withEdgeDays(data.stages, days).map((stage) => (
        <section className="nz-stage" key={stage.id} aria-label={stage.title}>
          <header className="nz-stage-head">
            <h2>{stage.title}</h2>
            {stage.summary && <p>{stage.summary}</p>}
          </header>
          <ol className="nz-days">
            {days.filter((day) => stage.dayIds.includes(day.id)).map((day) => (
              <DayCard key={day.id} day={day} editing={editing} expanded={printing} edit={edit} first={day.id === days[0].id} last={day.id === days.at(-1).id} canBack={canMoveDay(data, day.id, -1)} canOn={canMoveDay(data, day.id, 1)} />
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
  // A departure day (D0) comes before day 1, so it is not counted in the trip's length.
  const departure = days.some((day) => day.label === "D0");
  const length = departure ? `${days.length - 1} 天（另有出发日）` : `${days.length} 天`;
  return (
    <section className="nz-hero" aria-label="这次旅行">
      {trip.coverImageUrl
        ? <><Image className="nz-hero-photo" src={trip.coverImageUrl} alt={trip.coverImageAlt || ""} fill priority sizes="(max-width: 640px) 100vw, 640px" /><span className="illustration-tag">示意图</span></>
        : <div className="nz-hero-photo nz-photo-fallback" aria-hidden="true" />}
      <div className="nz-hero-bar">
        <span>{length} · {trip.travelers}</span>
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

function NoPlanYet({ copy, tripId }) {
  const fileInput = useRef(null);
  const [message, setMessage] = useState(null);
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(openFile(await file.text(), tripId, copy));
  };
  return (
    <section className="share-empty" aria-label="还没有方案">
      <h1>还没有方案</h1>
      <p className="share-lede">排好去哪几个地方、每处住几晚，这里会参照参考路线排出每一天。</p>
      <Link className="share-cta" href="/plan">开始排路线</Link>
      <button type="button" className="share-link" onClick={() => fileInput.current?.click()}>打开存的文件</button>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} aria-label="选择存过的行程文件" />
      <CopyNotes copy={copy} tripId={tripId} />
      <FileMessage message={message} />
    </section>
  );
}

// Opens a saved file on this page. Returns what to tell the visitor: { text, page?, warn }.
// The route decides what the file replaces, whichever button opened it.
function openFile(text, tripId, copy) {
  const own = tripId === "mine";
  let opened;
  try {
    opened = readImport(text, tripId);
  } catch (error) {
    return { text: error.message, page: error.page || null, warn: true };
  }
  const prepChanged = !own && opened.prep && !emptyPrep(readPrep(window.localStorage, tripId));
  if ((copy.mine || prepChanged) && !window.confirm(own
    ? "打开这个文件会换掉现在的方案。想留着现在的，先点“存成文件”。确定打开吗？"
    : "打开这个文件会换掉这台设备上改过的行程和清单。想留着现在的，先点“存成文件”。确定打开吗？")) {
    return null;
  }
  // The route, its ticks and (on our routes) its checklist changes are replaced together or not at all.
  const result = copy.open(opened.data, opened.baseVersion, [checksKey(tripId), prepKey(tripId)], (storage) => writeOpenedSide(storage, tripId, opened));
  if (result === "conflict") return { text: "另一个页面刚改过，这里已经换成那边的版本，文件没有打开。要换成文件里的，再打开一次。", warn: true };
  if (result === "unsaved") return { text: "已经打开，但这里存不了（可能开了无痕模式），关掉页面就没了。", warn: true };
  if (result === "failed") return { text: "这里存不了（可能开了无痕模式或存满了），文件没有打开，这台设备上的内容没有变。", warn: true };
  if (result === "partial") return { text: "这里存满了，文件没有打开，原来的内容也没能全部放回：现在显示的是这台设备上还存着的。清单的勾选和自己加的事可能少了，先“存成文件”留一份。", warn: true };
  return { text: own ? "已经打开存的方案。" : "已经打开存的修改。", warn: false };
}

function FileMessage({ message }) {
  if (!message) return null;
  return (
    <p className={message.warn ? "share-warn" : "share-message"} role={message.warn ? "alert" : "status"}>
      {message.text}
      {message.page && <> <Link href={message.page.href}>{message.page.label}</Link></>}
    </p>
  );
}

// Ticks and (on our reference routes) the checklist changes go into the file too.
function fileExtras(tripId) {
  try {
    const checks = readChecks(window.localStorage, tripId);
    const hasPrep = tripId !== "mine" && window.localStorage.getItem(prepKey(tripId));
    return { checks, prep: hasPrep ? readPrep(window.localStorage, tripId) : null };
  } catch {
    return { checks: {}, prep: null };
  }
}

function Tools({ tripId, copy, editing, setEditing, library, own }) {
  const fileInput = useRef(null);
  const [message, setMessage] = useState(null);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(openFile(await file.text(), tripId, copy));
  };

  const reset = () => {
    if (!window.confirm(own ? "删掉这个方案？这台设备上就没有了，清单的勾选也一起清掉；想留着先存成文件。" : "恢复成参考路线会丢掉这台设备上的所有修改（含清单里删掉和新加的），确定吗？")) return;
    copy.reset();
    try {
      // A new plan starts with an empty checklist; our routes get their whole checklist back.
      window.localStorage.removeItem(own ? checksKey(tripId) : prepKey(tripId));
    } catch {
      // Nothing saved to clear.
    }
    setEditing(false);
    setMessage(own ? null : { text: "已经恢复成参考路线。", warn: false });
  };

  const textExport = () => {
    const extras = fileExtras(tripId);
    const prep = own ? copy.data.prep : mergePrep(copy.data.prep, extras.prep);
    return tripToMarkdown(copy.data, { library, checks: extras.checks, prep, today: localToday() });
  };

  // A reference route with dates of its own keeps them: say what adding, removing and moving does to them.
  const dated = !own && copy.data.days.some((day) => isDate(day.date));
  const status = editing
    ? `正在改：点开哪一天，就能改那一天的标题、每一步和提醒，也能加一天、删一天、在同一段里调换顺序。${dated ? "这条路线的日子带着当时的日期：加的一天日期待定，删掉的那天空出来，调换的两天互换日期。" : ""}改完点“改好了”。`
    : own
    ? "方案只存在这台手机或电脑上。换设备前先“存成文件”，到那边用“打开存的文件”接着改。"
    : !copy.mine
    ? "这是参考路线，点“开始改”就能改。改动只存在这台手机或电脑上，别人看不到。"
    : copy.stale
      ? "现在显示的是改过的版本。参考路线后来更新过，想看新版，先存成文件，再点“恢复成参考路线”。"
      : "现在显示的是改过的版本，只存在这台手机或电脑上。换设备前先“存成文件”，到那边用“打开存的文件”接着改。";

  return (
    <section className={`share-tools${copy.stale ? " is-stale" : ""}`} aria-label="改行程">
      <p role="status">{status}</p>
      <CopyNotes copy={copy} tripId={tripId} />
      <div className="share-tool-buttons">
        <button type="button" className="is-primary" aria-pressed={editing} onClick={() => setEditing(!editing)}>
          {editing ? "改好了" : "开始改"}
        </button>
        <button type="button" onClick={() => download(own ? `方案-${stamp}.md` : `${copy.data.trip.title}-行程-${stamp}.md`, textExport(), "text/markdown;charset=utf-8")}>导出文字版</button>
        <button type="button" onClick={() => download(own ? `方案-${stamp}.json` : `${tripId}-行程-${stamp}.json`, exportFile(copy.data, tripId, { baseVersion: copy.baseVersion, ...fileExtras(tripId) }), "application/json")}>存成文件</button>
        <button type="button" onClick={() => fileInput.current?.click()}>打开存的文件</button>
        <button type="button" onClick={() => window.print()}>打印</button>
        {copy.mine && <button type="button" className="is-danger" onClick={reset}>{own ? "删掉这个方案" : "恢复成参考路线"}</button>}
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} aria-label="选择存过的行程文件" />
      </div>
      <FileMessage message={message} />
    </section>
  );
}

// The visitor's own plan: when, who, how long, and where to find the budget and the booking list.
function PlanBar({ tripId, data, edit, fresh }) {
  const { plan, days } = data;
  const pages = ROUTE_PAGES[tripId] || {};
  const party = `${plan.adults} 个大人${plan.children ? `、${plan.children} 个小孩` : ""}`;
  const range = plan.startDate && days.at(-1)?.date
    ? `${monthDay(plan.startDate)} – ${monthDay(days.at(-1).date)}`
    : "日子还没定";
  const setStart = (value) => edit((current) => renumberDays({
    ...current,
    plan: { ...current.plan, startDate: isDate(value) ? value : "" },
    trip: { ...current.trip, dates: isDate(value) ? `${monthDay(value)}起 · ${current.days.length} 天` : `${current.days.length} 天` },
  }));
  return (
    <section className="share-planbar" aria-label="方案">
      {fresh && <p className="share-message" role="status">按排好的路线生成了，已经打开编辑。点开哪一天就能改。</p>}
      <p className="nz-eyebrow">方案</p>
      <p className="share-planbar-line"><b>{days.length} 天</b> · {range} · {party}</p>
      <label className="share-planbar-date">
        第 1 天
        <input type="date" value={plan.startDate || ""} min={localToday()} onChange={(event) => setStart(event.target.value)} />
      </label>
      {pages.budget && (
        <nav className="share-planbar-links" aria-label="方案的其他部分">
          <Link href={pages.budget}>预算</Link>
          <Link href={pages.prep}>什么时候订什么</Link>
          <Link href={pages.plan}>改路线</Link>
        </nav>
      )}
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
      stops.push({ base: day.base, nights: 1, id: day.id, start: day.date ? shortDate(day.date) : `D${dayNumber(day)}`, image: day.cityImageUrl || day.coverImageUrl });
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
              <small>{stop.start} · {stop.nights} 晚</small>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// `canBack` / `canOn`: the day can move that way without leaving its stage.
function DayCard({ day, editing, expanded, edit, first, last, canBack, canOn }) {
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
            ? <><Image src={day.coverImageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 640px" /><span className="illustration-tag" aria-hidden="true">示意图</span></>
            : <span className="nz-photo-fallback" />}
        </span>
        <span className="nz-day-cover">
          <small>DAY {dayNumber(day)}{day.date ? ` · ${monthDay(day.date)} ${day.weekday || ""}` : ""}</small>
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
              <div className="share-edit-actions share-day-actions">
                <button type="button" disabled={!canBack} onClick={() => edit((data) => moveDay(data, day.id, -1))}>这天往前挪</button>
                <button type="button" disabled={!canOn} onClick={() => edit((data) => moveDay(data, day.id, 1))}>这天往后挪</button>
                <button type="button" onClick={() => edit((data) => addDay(data, day.id))}>在后面加一天</button>
                <button
                  type="button"
                  className="is-danger"
                  disabled={first && last}
                  onClick={() => {
                    if (window.confirm(`删掉 DAY ${dayNumber(day)}「${day.title}」？后面的日子会往前挪。`)) edit((data) => removeDay(data, day.id));
                  }}
                >
                  删掉这一天
                </button>
              </div>
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
                  {day.lodgingResource?.url && <span className="nz-maplink"> · <a href={day.lodgingResource.url} target="_blank" rel="noreferrer">地图</a></span>}
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
                onRemove={() => {
                  if (!hasWords(block.place, block.activity, block.tip) || window.confirm(`删掉这一步「${block.place || String(block.activity || "").slice(0, 12)}」？`)) edit((data) => removeBlock(data, day.id, block.id));
                }}
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
          {day.parked?.length > 0 && (
            <div className="share-parked">
              <h3 className="nz-sub">收起来的「可加」</h3>
              <ul>
                {day.parked.map((block) => (
                  <li key={block.id}>
                    <span><b>{block.place}</b>{block.activity && ` · ${block.activity}`}</span>
                    <button type="button" onClick={() => edit((data) => restoreParked(data, day.id, block.id))}>放回来</button>
                  </li>
                ))}
              </ul>
            </div>
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
              {notes.map((note, index) => {
                const noteId = noteIdAt(day, index);
                return (
                  <li key={noteId}>
                    <input value={note.label} placeholder="标签" aria-label="提醒标签" onChange={(event) => edit((data) => updateNote(data, day.id, noteId, { label: event.target.value }))} />
                    <textarea rows={2} value={note.text} aria-label="提醒内容" onChange={(event) => edit((data) => updateNote(data, day.id, noteId, { text: event.target.value }))} />
                    <button type="button" className="is-danger" onClick={() => {
                      if (!hasWords(note.label, note.text) || window.confirm("删掉这条提醒？")) edit((data) => removeNote(data, day.id, noteId));
                    }}>删除提醒</button>
                  </li>
                );
              })}
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

const hasWords = (...values) => values.some((value) => String(value || "").trim());

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
        {drive.legs.map((leg, index) => (
          <div className="nz-leg" role="row" key={leg.sortOrder ?? `leg-${index}`}>
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
        {advice.map((item, index) => (
          <article key={item.sortOrder ?? `tip-${index}`} className="nz-tip">
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
        {lodgings.map((stay, index) => (
          <li key={stay.sortOrder ?? `stay-${index}`}>
            <span className="nz-stays-dates">{stayEnds(stay)[0]}<i>–</i>{stayEnds(stay)[1]}</span>
            <div>
              <strong>{stay.name}</strong>
              <small>{[stay.room, stay.detail].filter((value) => value && value !== "—").join(" · ")}</small>
              {stay.afterDeadline && <small>{stay.afterDeadline}</small>}
              {stay.resource?.url && <a className="nz-maplink" href={stay.resource.url} target="_blank" rel="noreferrer">地图</a>}
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
