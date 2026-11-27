"use client";

import { useEffect, useMemo, useState } from "react";

import DayRuler from "@/components/DayRuler";
import RoadBoard from "@/components/RoadBoard";
import RideChart, { rideRidge } from "@/components/RideChart";
import RouteMap, { StopCard } from "@/components/RouteMap";
import { mapCardStop, stopCard } from "@/lib/mapCard";
import { shortDate } from "@/lib/format";
import { planGeometry, sheetsFor, SHEETS } from "@/lib/routeMap";
import { forecastLook, forecastStore, keepForecast, keptForecasts, lightRows, mapStops, weatherLine, weatherShort } from "@/lib/tripDays";

// The days are borrowed from the reference routes, which went in their own season.
export const SEASON_NOTE = "每天的安排借自参考路线，季节和星期几不一定和方案一样：每天的卡片里不写天气和穿衣，按这里按日子算的气温准备；只在某个季节或星期几才有的活动（夜市、观鲸之类），出发前查一下还有没有。";

const FORECAST_KEY = "trip-share:mine:weather";
const TIMEOUT = 10 * 1000;

// The kept forecasts, in this browser's storage when it allows, else for this visit only.
let memory = forecastStore(null);
function loadStore() {
  try {
    const raw = window.localStorage.getItem(FORECAST_KEY);
    if (raw) memory = forecastStore(JSON.parse(raw));
  } catch {
    // Storage blocked or damaged: keep what this visit has.
  }
  return memory;
}
function saveStore(store) {
  memory = store;
  try {
    window.localStorage.setItem(FORECAST_KEY, JSON.stringify(store));
  } catch {
    // Shown for this visit only.
  }
}

// One request per place at a time, given up after ten seconds; the answer is kept whoever asked.
const pending = new Map();
function fetchPlace(request) {
  if (pending.has(request.url)) return pending.get(request.url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const job = fetch(request.url, { signal: controller.signal })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .then((body) => {
      clearTimeout(timer);
      pending.delete(request.url);
      saveStore(keepForecast(loadStore(), request.placeId, body, Date.now()));
    });
  pending.set(request.url, job);
  return job;
}

// Close to the trip, ask Open-Meteo for each place's forecast from this browser; keep it a few hours.
// Each place shows as soon as it arrives. Every look works the requests out again for today (see
// forecastLook) and sets the next one: the next day, a kept forecast running out, a failed place's retry;
// it also looks again whenever the page is shown again or the device comes back online, so an old
// forecast is taken down or replaced and days that came into range are asked for.
export function useForecasts(library, data) {
  const [forecasts, setForecasts] = useState({});
  const [look, setLook] = useState(0);
  useEffect(() => {
    let live = true;
    const again = () => {
      if (live) setLook((count) => count + 1);
    };
    const now = Date.now();
    const store = loadStore();
    const { toFetch, wakeIn } = forecastLook(library, data, store, now);
    Promise.resolve().then(() => {
      if (live) setForecasts(keptForecasts(store, now));
    });
    const timer = setTimeout(again, wakeIn + 1000);
    if (navigator.onLine) {
      for (const request of toFetch) fetchPlace(request).then(again);
    }
    const onShow = () => {
      if (document.visibilityState === "visible") again();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", again);
    return () => {
      live = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("online", again);
    };
  }, [library, data, look]);
  return forecasts;
}

// The visitor's plan at a glance: the route map, how long they drive, every day's light and weather.
export default function PlanOverview({ library, data, forecasts }) {
  const stops = useMemo(() => mapStops(library, data), [library, data]);
  const sheets = useMemo(() => sheetsFor(stops), [stops]);
  const [chosen, setChosen] = useState("");
  const sheet = sheets.includes(chosen) ? chosen : sheets[0];
  const geometry = useMemo(() => (sheet ? planGeometry(stops, sheet) : null), [stops, sheet]);
  const [stopId, setStopId] = useState("");
  const picked = mapCardStop(geometry, stopId);
  const shown = Boolean(geometry?.drawn && picked);
  const card = picked && stopCard(picked);
  const firstDay = picked?.visits.find((visit) => visit.dayIds?.length)?.dayIds[0];
  const ridge = useMemo(() => rideRidge(data.days), [data.days]);
  const rows = useMemo(() => lightRows(library, data, forecasts), [library, data, forecasts]);
  const dated = Boolean(data.plan?.startDate);
  const hasForecast = rows.some((row) => row.weather?.kind === "forecast");

  return (
    <section className="share-overview" aria-label="路线">
      {shown && (
        <>
          {sheets.length > 1 && <SheetTabs sheets={sheets} sheet={sheet} onPick={(key) => { setChosen(key); setStopId(""); }} />}
          <div className="share-map-wrap">
            <RouteMap geometry={geometry} activeId={picked.id} onPick={setStopId} label={`路线示意图（${SHEETS[sheet].name}）：点一站看那几天`} />
            <p className="share-map-hint">点地图上的一站</p>
          </div>
          <StopCard stop={card} href={firstDay ? `#day-${firstDay}` : undefined} />
          {geometry.left.length > 0 && <p className="share-fine share-map-left">图上画不下的：{[...new Set(geometry.left.map((stop) => stop.name))].join("、")}。</p>}
        </>
      )}

      {ridge && (
        <div className="share-overview-sect">
          <h2>这一路的起伏</h2>
          <p className="share-lede">山越高，那天开车越久。最累的两天标出来了，前后最好排得松一点。</p>
          <RideChart ridge={ridge} />
        </div>
      )}

      <div className="share-overview-sect">
        <h2>每天的光</h2>
        {dated ? (
          <>
            <p className="share-lede">每一条是那天当地的日出到日落，白点是当天的安排。点一行看那天怎么走。</p>
            <p className="share-fine">{hasForecast ? "临近的日子是天气预报，更远的是往年这个月的大概值。" : "气温是往年这个月的大概值，出发前 16 天内换成天气预报。"}</p>
            <div className="share-lightrows">
              {rows.map((row) => (
                <a key={row.day.id} href={`#day-${row.day.id}`} className={row.endsStop ? "share-lightrow is-stop-end" : "share-lightrow"} aria-label={`第 ${row.number} 天，${row.town}${row.sun ? `，日落 ${row.sun.setTime}` : ""}${row.weather ? `，${weatherLine(row.weather)}` : ""}`}>
                  <span className="share-lightrow-date">{shortDate(row.day.date)}<small>第 {row.number} 天</small></span>
                  <DayRuler sun={row.sun} ticks={row.ticks} label={`第 ${row.number} 天的日光`} />
                  <span className="share-lightrow-place">
                    {row.town}
                    {row.weather && <small className={row.weather.kind === "forecast" ? "is-forecast" : undefined}>{weatherShort(row.weather)}</small>}
                    {row.sun && <small>日落 {row.sun.setTime}</small>}
                  </span>
                </a>
              ))}
            </div>
            <p className="share-fine share-credit">天气来自 Open-Meteo（出发前 16 天内会把各地的位置发过去取接下来 16 天的预报，不发方案的日子）；日出日落按每个地方在这台设备上算。</p>
          </>
        ) : (
          <p className="share-lede">填上第 1 天，这里会按日子画出每天当地的日出到日落，并附上气温。</p>
        )}
        <p className="share-fine share-season">{SEASON_NOTE}</p>
      </div>
    </section>
  );
}

// Both parts of the visitor's own plan page that need the weather: on the road, and the overview.
export function OwnPlanTop({ library, data, children }) {
  const forecasts = useForecasts(library, data);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("preview") === "road";
    Promise.resolve().then(() => setPreview(asked));
  }, []);
  return (
    <>
      <RoadBoard library={library} data={data} forecasts={forecasts} preview={preview} />
      {children}
      <PlanOverview library={library} data={data} forecasts={forecasts} />
    </>
  );
}

// Two countries, two sheets: a switch above the map (a pair of toggle buttons).
export function SheetTabs({ sheets, sheet, onPick }) {
  return (
    <div className="share-sheet-tabs" role="group" aria-label="看哪一段">
      {sheets.map((key) => (
        <button key={key} type="button" aria-pressed={key === sheet} className={key === sheet ? "is-active" : undefined} onClick={() => onPick(key)}>
          {SHEETS[key].name}
        </button>
      ))}
    </div>
  );
}
