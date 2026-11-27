"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { composePlan, hop, nextFrom, placeName, placeOf, planSize, presetStops, reviewRoute } from "@/lib/compose";
import { localToday } from "@/lib/dates";
import { loadCopy, readCopy, saveCopy, storageKey } from "@/lib/edits";
import { DRAFT_KEY, carryOver, draftStore, needsConfirm, readDraftFile, snapshot, startRoute } from "@/lib/routeDraft";
import { planGeometry, sheetsFor, SHEETS } from "@/lib/routeMap";
import { AU_ZONES, routeMapStops } from "@/lib/tripDays";

import { SheetTabs } from "./PlanOverview";
import RouteMap from "./RouteMap";
import Stepper from "./Stepper";

const COUNTRY = { nz: "新西兰", au: "澳洲", other: "其他地方" };

let counter = 0;
const newKey = () => {
  counter += 1;
  return `s${Date.now().toString(36)}${counter}`;
};

const EMPTY = { stops: [], startDate: "", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours" };

// Smooth scrolling, unless the visitor asked the system for less motion.
const scrollBehavior = () => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// The visitor lays out the route; we fill in the days from what we know.
export default function RouteBuilder({ library, sources }) {
  const [route, setRoute] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  // The stored plan the visitor agreed to replace ("" while not asked).
  const [confirming, setConfirming] = useState("");
  const [failed, setFailed] = useState(false);
  const [today, setToday] = useState("");
  // The stops just cleared or removed, until the next change: one tap puts them back.
  const [undo, setUndo] = useState(null);
  // Opened from a reference route while an earlier draft is still here.
  const [offer, setOffer] = useState("");
  // Said once after another tab changed the route, or after a file was opened.
  const [notice, setNotice] = useState(null);
  const confirmButton = useRef(null);
  const added = useRef(null);
  const drafts = useRef(null);
  // The form as it came from storage: shown, not written back.
  const fromStorage = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    let saved = null;
    let plan = null;
    try {
      drafts.current = draftStore(window.localStorage);
      saved = drafts.current.load();
    } catch {
      drafts.current = null;
      saved = null;
    }
    try {
      plan = loadCopy(window.localStorage, "mine")?.data?.plan || null;
    } catch {
      plan = null;
    }
    const asked = new URLSearchParams(window.location.search).get("from");
    // The plan's first day, party and stops win unless they were changed here since.
    let start = startRoute(saved, plan, EMPTY);
    const preset = library.presets.some((item) => item.trip === asked);
    if (preset && !start.stops.length) {
      start = { ...start, ...presetParty(asked), stops: freshKeys(presetStops(library, asked)) };
    }
    const offered = preset && start.stops.length && !sameStops(start.stops, presetStops(library, asked)) ? asked : "";
    Promise.resolve().then(() => {
      setOffer(offered);
      setRoute(start);
      setHasPlan(Boolean(plan?.stops));
      setToday(localToday());
      setReady(true);
    });
  }, [library]);

  // The form as storage holds it now, matched to the plan as storage holds it now.
  const storedRoute = (draft) => {
    let plan = null;
    try {
      plan = loadCopy(window.localStorage, "mine")?.data?.plan || null;
    } catch {
      plan = null;
    }
    setHasPlan(Boolean(plan?.stops));
    return startRoute(draft, plan, EMPTY);
  };

  // A tab writes only over the form it last read or wrote: another tab's newer form is shown instead.
  useEffect(() => {
    if (!ready || route === fromStorage.current || !drafts.current) return;
    try {
      const result = drafts.current.save(route);
      if (result.saved) return;
      Promise.resolve().then(() => {
        const next = storedRoute(result.draft);
        fromStorage.current = next;
        setUndo(null);
        setConfirming("");
        setRoute(next);
        setNotice({ text: "另一个页面刚改过路线，这里已经换成那边的，刚才这一下没有存，请再改一次。", warn: true });
      });
    } catch {
      // The route stays for this visit only.
    }
  }, [route, ready]);

  // Changed in another tab: show it here too, so this tab never works on an older form.
  useEffect(() => {
    if (!ready) return undefined;
    const onStorage = (event) => {
      if (event.key !== null && event.key !== DRAFT_KEY && event.key !== storageKey("mine")) return;
      if (event.key === storageKey("mine")) {
        storedRoute(null);
        return;
      }
      if (!drafts.current || drafts.current.current()) return;
      const next = storedRoute(drafts.current.load());
      fromStorage.current = next;
      setUndo(null);
      setConfirming("");
      setRoute(next);
      setNotice({ text: "另一个页面刚改过路线，这里已经换成那边的。", warn: false });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [ready]);

  useEffect(() => {
    if (!confirming) return;
    confirmButton.current?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    confirmButton.current?.focus({ preventScroll: true });
  }, [confirming]);

  // After a stop is added, the next choice stays in view.
  useEffect(() => {
    if (!ready) return;
    if (added.current !== null && route.stops.length === added.current + 1) {
      document.querySelector(".route-add")?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
    }
    added.current = route.stops.length;
  }, [route.stops.length, ready]);

  const change = (patch) => {
    setNotice(null);
    setRoute((current) => ({ ...current, ...patch }));
  };
  const setStops = (stops) => {
    setUndo(null);
    setOffer("");
    change({ stops });
  };
  const dropStops = (stops, text) => {
    const before = route.stops;
    setStops(stops);
    setUndo({ text, stops: before });
  };
  const notes = useMemo(() => reviewRoute(library, route.stops, route.startDate), [library, route.stops, route.startDate]);
  // Counted from the plan this route makes, so the numbers here are the plan's.
  const size = useMemo(() => (route.stops.length ? planSize(library, sources, route) : { days: 0, nights: 0, stops: 0 }), [library, sources, route]);

  const addPlace = (placeId) => {
    const place = placeOf(library, placeId);
    setStops([...route.stops, { key: newKey(), placeId, name: "", country: place.country, nights: place.nights?.suggest || 2 }]);
  };
  const addOwn = (name, country, tz) => setStops([...route.stops, { key: newKey(), placeId: "", name, country, nights: 2, ...(tz ? { tz } : {}) }]);
  const loadPreset = (trip) => {
    const before = route.stops;
    setOffer("");
    setNotice(null);
    setRoute((current) => ({ ...current, ...presetParty(trip), stops: freshKeys(presetStops(library, trip)) }));
    setUndo(before.length ? { text: "换成了参考路线。", stops: before } : null);
  };
  const move = (index, direction) => {
    const next = [...route.stops];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setStops(next);
  };

  // `confirmed`: the stored plan the visitor agreed to replace. The plan is read again here, not taken from
  // when the page opened: another tab may have made one since, and that one is not replaced unasked.
  const build = (confirmed = "") => {
    try {
      // Another tab changed the route since this one read it: show that one, make nothing yet.
      if (drafts.current && !drafts.current.current()) {
        const next = storedRoute(drafts.current.load());
        fromStorage.current = next;
        setConfirming("");
        setUndo(null);
        setRoute(next);
        setNotice({ text: "另一个页面刚改过路线，这里已经换成那边的。看一下再点“按这条路线排出每一天”。", warn: true });
        return;
      }
      const ask = needsConfirm(window.localStorage, confirmed);
      if (ask) {
        setHasPlan(true);
        setConfirming(ask);
        return;
      }
      // The checklist and budget changes of the plan being replaced come along (also from an empty copy an
      // older site version left with only a checklist in it).
      const saved = readCopy(window.localStorage, "mine");
      const draft = carryOver(saved.copy?.data || saved.leftover || null, composePlan(library, sources, route));
      saveCopy(window.localStorage, "mine", draft, "mine");
      const kept = { ...route, basis: snapshot(route) };
      if (drafts.current) drafts.current.save(kept);
      else window.localStorage.setItem(DRAFT_KEY, JSON.stringify(kept));
    } catch {
      setFailed(true);
      return;
    }
    window.location.assign("/mine?draft=1");
  };

  // A route saved as a file (the error page saves one): its stops, nights, first day and party come back.
  const openDraft = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let opened;
    try {
      opened = readDraftFile(await file.text(), EMPTY, (placeId) => Boolean(placeOf(library, placeId)));
    } catch (error) {
      setNotice({ text: error.message, page: error.page || null, warn: true });
      return;
    }
    if (route.stops.length && !window.confirm("打开草稿会换掉现在排的路线、出发日和人数。确定打开吗？")) return;
    setUndo(null);
    setOffer("");
    setConfirming("");
    setRoute({ ...opened, basis: route.basis ?? null });
    setNotice({ text: "已经打开存的草稿。", warn: false });
  };

  if (!ready) return null;
  const last = route.stops.at(-1);
  const nextPlaces = last?.placeId ? nextFrom(library, last.placeId).filter((item) => placeOf(library, item.placeId)) : [];

  return (
    <section className="route-builder" aria-labelledby="route-title">
      <header className="plan-head">
        <p className="nz-eyebrow">排路线</p>
        <h1 id="route-title">去哪儿、住几晚</h1>
        <p className="share-lede">定好去哪几个地方、顺序和每处住几晚，按参考路线里的路段和在每个地方的安排排出每一天，排得太赶的地方会提醒。</p>
        {hasPlan && <p className="share-fine">已经有一份方案：<Link href="/mine">去看看</Link>。改完路线再生成，会换成新的。</p>}
        <p className="share-fine route-open">
          <button type="button" className="share-link" onClick={() => fileInput.current?.click()}>打开存的草稿</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={openDraft} aria-label="选择存过的排路线草稿" />
        </p>
        {notice && (
          <p className={notice.warn ? "share-warn" : "share-message"} role={notice.warn ? "alert" : "status"}>
            {notice.text}
            {notice.page && <> <Link href={notice.page.href}>{notice.page.label}</Link></>}
          </p>
        )}
        {offer && (
          <p className="share-message route-offer" role="status">
            现在是之前排的路线。
            <button type="button" className="share-link" onClick={() => loadPreset(offer)}>换成{library.presets.find((item) => item.trip === offer)?.name}</button>
          </p>
        )}
      </header>

      {!route.stops.length ? (
        <div className="route-start">
          <h2>从哪儿开始</h2>
          {library.presets.map((preset) => (
            <button type="button" key={preset.trip} className="route-preset" onClick={() => loadPreset(preset.trip)}>
              <strong>载入{preset.name}</strong>
              <span>{preset.line}</span>
              <small>载入后可以删地方、加地方、改晚数和顺序</small>
            </button>
          ))}
          <p className="share-fine">或者直接在下面挑第一站，从空白开始。</p>
        </div>
      ) : (
        <>
        <LiveMap library={library} stops={route.stops} />
        <p className="route-clear">
          <button type="button" className="share-link" onClick={() => dropStops([], "路线已清空。")}>清空路线，重新开始</button>
        </p>
        <ol className="route-stops" aria-label="路线">
          {route.stops.map((stop, index) => (
            <StopCard
              key={stop.key}
              library={library}
              stop={stop}
              prev={route.stops[index - 1]}
              index={index}
              total={route.stops.length}
              notes={notes.filter((note) => note.at === index)}
              onNights={(value) => setStops(route.stops.map((item) => (item.key === stop.key ? { ...item, nights: value } : item)))}
              onMove={(direction) => move(index, direction)}
              onRemove={() => dropStops(route.stops.filter((item) => item.key !== stop.key), `删掉了${placeName(library, stop)}。`)}
            />
          ))}
        </ol>
        </>
      )}

      <AddStop library={library} first={!route.stops.length} last={last} nextPlaces={nextPlaces} onAdd={addPlace} onAddOwn={addOwn} />

      {route.stops.length > 0 && (
        <>
          <div className="plan-card">
            <h2>哪天出发，几个人</h2>
            <label className="plan-field">
              <span>第 1 天是哪天</span>
              <input type="date" value={route.startDate} min={today || undefined} onChange={(event) => change({ startDate: event.target.value })} />
              <small>第 1 天是落地第一站那天。还没定也可以先空着，之后在行程页补上。</small>
            </label>
            <Stepper label="大人" value={route.adults} min={1} max={9} onChange={(value) => change({ adults: value, rooms: Math.max(1, Math.ceil(value / 2)) })} />
            <Stepper label="小孩" value={route.children} min={0} max={6} onChange={(value) => change({ children: value })} />
            <Stepper label="住几间房" hint="按两个大人一间算，可以改" value={route.rooms} min={1} max={6} onChange={(value) => change({ rooms: value })} />
            <Stepper label="租几辆车" hint={route.adults + route.children >= 5 ? "5 个人以上要换 7 座车" : "开车的那几段用"} value={route.cars} min={1} max={3} onChange={(value) => change({ cars: value })} />
          </div>

          <div className="plan-card">
            <h2>节奏</h2>
            <div className="plan-choices" role="radiogroup" aria-label="节奏">
              <label className={route.pace !== "easy" ? "is-chosen" : ""}>
                <input type="radio" name="pace" checked={route.pace !== "easy"} onChange={() => change({ pace: "ours" })} />
                <strong>照参考路线</strong>
                <span>标了「可加」的都留在每天的安排里，有时间就去。</span>
              </label>
              <label className={route.pace === "easy" ? "is-chosen" : ""}>
                <input type="radio" name="pace" checked={route.pace === "easy"} onChange={() => change({ pace: "easy" })} />
                <strong>松一点</strong>
                <span>标了「可加」的先收起来，每天只留主要的，想做再放回来。</span>
              </label>
            </div>
          </div>

          <div className="route-summary">
            <p><b>{size.days}</b> 天 · {size.stops} 处 · 住 {size.nights} 晚</p>
            {notes.filter((note) => note.at === null).map((note) => <p key={note.text} className={`route-note is-${note.level}`}>{note.text}</p>)}
            {notes.length > 0 && <p className="share-fine">提醒只是建议，不改也能生成。</p>}
          </div>

          <div className="plan-nav">
            <span className="plan-nav-count">{size.days} 天 · {size.stops} 处</span>
            <button type="button" className="is-primary" onClick={() => build()}>按这条路线排出每一天</button>
          </div>
          {confirming && (
            <div className="plan-confirm" role="alertdialog" aria-labelledby="route-confirm">
              <p id="route-confirm"><b>已经有一份方案。</b>生成新的会重新排每一天：在方案页改过的每一天（标题、每一步、加的和删的天）都会换成新排的。上面的出发日和人数、清单里自己加和删掉的事、预算里自己填的数会带到新方案里。想留着现在的每一天，先去方案页存成文件。</p>
              <div className="share-tool-buttons">
                <button type="button" className="is-primary" ref={confirmButton} onClick={() => build(confirming)}>换成新的</button>
                <a className="plan-link-button" href="/mine">先去看现在的</a>
              </div>
            </div>
          )}
          {failed && <p className="share-warn" role="alert">这里存不了方案（可能开了无痕模式）。换个浏览器窗口再试。</p>}
        </>
      )}
      {undo && (
        <div className="nz-toast route-undo" role="status">
          <span>{undo.text}</span>
          <button type="button" onClick={() => { setStops(undo.stops); }}>撤销</button>
        </div>
      )}
    </section>
  );
}

// The route as it stands, on the map of each country it goes through.
function LiveMap({ library, stops }) {
  const mapped = useMemo(() => routeMapStops(library, stops), [library, stops]);
  const sheets = useMemo(() => sheetsFor(mapped), [mapped]);
  const [chosen, setChosen] = useState("");
  const [active, setActive] = useState("");
  // On a phone the map starts as a strip, so the list of stops stays near the top.
  const [unfolded, setUnfolded] = useState(false);
  const sheet = sheets.includes(chosen) ? chosen : sheets.at(-1);
  if (!sheet) return null;
  const geometry = planGeometry(mapped, sheet);
  if (!geometry.drawn) return null;
  const pick = (id) => {
    setActive(id);
    document.getElementById(`route-stop-${id}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
  };
  return (
    <div className={unfolded ? "route-map" : "route-map is-folded"}>
      {sheets.length > 1 && <SheetTabs sheets={sheets} sheet={sheet} onPick={setChosen} />}
      <div className="share-map-wrap">
        <RouteMap geometry={geometry} activeId={active} onPick={pick} label={`排好的路线（${SHEETS[sheet].name}）`} />
      </div>
      <button type="button" className="share-link route-map-fold" aria-expanded={unfolded} onClick={() => setUnfolded(!unfolded)}>{unfolded ? "收起地图" : "展开地图"}</button>
      {geometry.left.length > 0 && <p className="share-fine">图上画不下的：{[...new Set(geometry.left.map((stop) => stop.name))].join("、")}。</p>}
    </div>
  );
}

function sameStops(stops, preset) {
  return stops.length === preset.length && stops.every((stop, index) => stop.placeId === preset[index].placeId && stop.nights === preset[index].nights);
}

function freshKeys(stops) {
  return stops.map((stop) => ({ ...stop, key: newKey() }));
}

function presetParty(trip) {
  return trip === "au2026" ? { adults: 4, children: 0, rooms: 2, cars: 1 } : { adults: 2, children: 0, rooms: 1, cars: 1 };
}

function hopLabel(way) {
  if (way.mode === "stay") return "同一个地方：生成方案时合成一站";
  if (way.mode === "drive") return `开车 · ${way.time}${way.reversed ? " · 参考路线里反方向开" : " · 参考路线里开车"}`;
  if (way.mode === "flight") return way.guessed ? "坐飞机 · 参考路线没飞过这段" : way.reversed ? "坐飞机 · 参考路线里反方向飞" : "坐飞机 · 参考路线里坐飞机";
  return "参考路线没走过这段，查一下怎么去";
}

function StopCard({ library, stop, prev, index, total, notes, onNights, onMove, onRemove }) {
  const place = placeOf(library, stop.placeId);
  const way = index ? hop(library, prev, stop) : null;
  return (
    <li className="route-stop" id={`route-stop-${stop.key}`}>
      {way && <p className={`route-hop is-${way.mode}${way.guessed ? " is-guessed" : ""}`}>{hopLabel(way)}</p>}
      <div className="route-stop-card">
        <span className="route-stop-photo">
          {place?.image ? <Image src={place.image} alt="" fill sizes="72px" /> : <span className="nz-photo-fallback" />}
        </span>
        <div className="route-stop-copy">
          <strong>{placeName(library, stop)}</strong>
          <small>{place ? place.summary : `${Object.hasOwn(COUNTRY, stop.country || "") ? COUNTRY[stop.country] : ""} · 参考路线没到过，每天先空着`}</small>
        </div>
        <Stepper label="住几晚" subject={placeName(library, stop)} value={stop.nights} min={1} max={Math.max(place?.nights?.max || 6, stop.nights, 6)} onChange={onNights} />
        <div className="share-edit-actions route-stop-actions">
          <button type="button" disabled={index === 0} aria-label={`${placeName(library, stop)}往前`} onClick={() => onMove(-1)}>往前</button>
          <button type="button" disabled={index === total - 1} aria-label={`${placeName(library, stop)}往后`} onClick={() => onMove(1)}>往后</button>
          <button type="button" className="is-danger" aria-label={`删掉${placeName(library, stop)}`} onClick={onRemove}>删掉</button>
        </div>
      </div>
      {notes.map((note) => <p key={note.text} className={`route-note is-${note.level}`}>{note.text}</p>)}
    </li>
  );
}

function AddStop({ library, first, last, nextPlaces, onAdd, onAddOwn }) {
  const [open, setOpen] = useState(first);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("nz");
  const [zone, setZone] = useState(AU_ZONES[0][0]);
  useEffect(() => {
    Promise.resolve().then(() => setOpen(first));
  }, [first]);
  const groups = ["au", "nz"].map((code) => ({ code, places: library.places.filter((place) => place.country === code) }));
  const submit = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    onAddOwn(name.trim(), country, country === "au" ? zone : "");
    setName("");
  };
  return (
    <section className="route-add" aria-label="加一站">
      <h2>{first ? "第一站" : "下一站"}</h2>
      {!first && nextPlaces.length > 0 && (
        <>
          <p className="share-fine">从{placeName(library, last)}出发，参考路线里接着去的：</p>
          <div className="route-chips">
            {nextPlaces.map(({ placeId, leg }) => (
              <button type="button" key={placeId} className="route-chip is-suggested" onClick={() => onAdd(placeId)}>
                <b>{placeName(library, { placeId })}</b>
                <span>{leg.mode === "drive" ? `开车 ${leg.time.replace(/^纯开车/, "")}` : "坐飞机"}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {!first && !open ? (
        <button type="button" className="share-add" onClick={() => setOpen(true)}>＋ 从全部地点里挑</button>
      ) : (
        <>
          {groups.map((group) => (
            <div key={group.code} className="route-group">
              <h3>{COUNTRY[group.code]}</h3>
              <div className="route-chips">
                {group.places.map((place) => (
                  <button type="button" key={place.id} className="route-chip" onClick={() => onAdd(place.id)}>
                    <b>{place.short || place.name}</b>
                    {place.airport === "international" && <span>国际航班</span>}
                    {place.airport === "tasman" && <span>飞澳洲的航班</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <form className="route-own" onSubmit={submit}>
            <h3>加参考路线以外的地方</h3>
            <div className="route-own-row">
              <input value={name} placeholder="比如：Dunedin" aria-label="地方的名字" onChange={(event) => setName(event.target.value)} />
              <select value={country} aria-label="在哪个国家" onChange={(event) => setCountry(event.target.value)}>
                <option value="nz">新西兰</option>
                <option value="au">澳洲</option>
                <option value="other">其他地方</option>
              </select>
              {country === "au" && (
                <select className="route-own-zone" value={zone} aria-label="在澳洲哪个州（定当地时间）" onChange={(event) => setZone(event.target.value)}>
                  {AU_ZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              )}
              <button type="submit" className="share-add">＋ 加上</button>
            </div>
            <small className="share-fine">参考路线以外的地方，每天先空着，车程要另外查。澳洲的地方选一下在哪个州，出发后“路上”按那里的时间走；其他地方按手机上的时间。</small>
          </form>
        </>
      )}
    </section>
  );
}
