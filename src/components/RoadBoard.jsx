"use client";

import { useEffect, useState } from "react";

import DayRuler from "@/components/DayRuler";
import { shortDate } from "@/lib/format";
import { sunWords } from "@/lib/light";
import { daySun, dayWeather, firstStep, nextStep, placeOfDay, previewDay, todayOf, weatherLine, weatherShort } from "@/lib/tripDays";

// On the road: the local clock, today's light with "now" on it, what comes next, tonight and tomorrow.
// `preview` shows what it will look like, on day 1 at 10:00.
export default function RoadBoard({ library, data, forecasts, preview = false }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    Promise.resolve().then(tick);
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return null;
  const live = todayOf(library, data, now);
  const today = live || (preview ? previewDay(library, data) : null);
  if (!today) return null;

  const { day, index, time, minutes, clock } = today;
  const sun = daySun(library, data, day);
  const words = sunWords(minutes, sun);
  const { step, options, done, ticks } = nextStep(day, minutes);
  const weather = dayWeather(library, data, day, forecasts);
  const tomorrow = data.days[index + 1];
  const first = firstStep(tomorrow);
  const tomorrowWeather = tomorrow ? dayWeather(library, data, tomorrow, forecasts) : null;
  const navTarget = step && [String(step.place || "").split("→").pop().trim(), placeOfDay(library, data, day).name].filter(Boolean).join(", ");

  return (
    <section className="share-road" aria-label="路上">
      {!live && <p className="share-road-preview">预览：出发后，这里每天会是这样（按第 1 天上午 10 点）</p>}
      <div className="share-road-clock">
        <b aria-label={`${clock === "当地" ? "当地时间" : clock} ${time}`}>{time}</b>
        <span>
          {clock} · 第 {index + 1} 天 · {shortDate(day.date)} {day.weekday}
          {words && <strong>{words}</strong>}
        </span>
      </div>
      <DayRuler sun={sun} ticks={ticks} now={minutes} done={done} label={`今天的日光${words ? `，${words}` : ""}`} />
      {sun && <div className="share-rulerends"><span>日出 {sun.riseTime}</span><span>日落 {sun.setTime}</span></div>}
      {weather && <p className="share-road-weather">{weatherLine(weather)}</p>}

      {step ? (
        <div className="share-road-next">
          <small>接下来{step.period ? ` · ${step.period}` : ""}{options > 1 ? ` · ${options} 选 1` : ""}</small>
          <strong>{step.place || "下一步"}</strong>
          {step.activity && <span>{String(step.activity).split(/[。；]/)[0]}</span>}
          {navTarget && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navTarget)}`} target="_blank" rel="noreferrer">在地图里打开</a>}
        </div>
      ) : (
        <div className="share-road-next is-done">
          <small>今天的安排都过了</small>
          <strong>好好休息</strong>
        </div>
      )}

      <div className="share-road-pair">
        <div>
          <small>今晚住</small>
          <b>{day.lodging && day.lodging !== "-" ? day.lodging : day.lodgingStatus === "无需住宿" ? "飞机上或到家" : "看当天安排"}</b>
        </div>
        <div>
          <small>明天第一件事</small>
          <b>{first ? first.what : "好好睡一觉"}</b>
          {first?.when && <i>{first.when}</i>}
          {tomorrowWeather && <i>{tomorrowWeather.kind === "normal" ? "往年 " : ""}{weatherShort(tomorrowWeather)}</i>}
        </div>
      </div>
      <a className="share-road-all" href={`#day-${day.id}`}>看今天全部安排</a>
    </section>
  );
}
