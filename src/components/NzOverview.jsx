"use client";

import { useMemo, useState } from "react";

import RideChart, { rideRidge } from "@/components/RideChart";
import RouteMap, { StopCard } from "@/components/RouteMap";
import { dayNumber } from "@/lib/format";
import { overviewGeometry } from "@/lib/routeMap";

// The New Zealand reference route at a glance: the map with every stop, and how long each day's drive is.
export default function NzOverview({ overview, days }) {
  const geometry = useMemo(() => overviewGeometry(overview), [overview]);
  const [stopId, setStopId] = useState(geometry.stops[1]?.id || geometry.stops[0].id);
  const picked = geometry.stops.find((stop) => stop.id === stopId) || geometry.stops[0];
  const stay = picked.dayIds.map((id) => days.find((day) => day.id === id)).filter(Boolean);
  const nights = stay.filter((day) => day.lodgingStatus !== "无需住宿").length;
  const [first, last] = stay.length ? [dayNumber(stay[0]), dayNumber(stay.at(-1))] : [];
  // The days follow the visitor's edits: renumbered, or gone when every day of the stop was removed.
  const card = {
    ...picked,
    when: !stay.length ? "改过的行程里没有这一站的日子" : `${first === last ? `第 ${first} 天` : `第 ${first} 到 ${last} 天`}，住 ${nights} 晚`,
    image: stay[0]?.cityImageUrl || stay[0]?.coverImageUrl || picked.image,
  };
  const ridge = useMemo(() => rideRidge(days.map((day) => ({ ...day, driveHours: overview.driveHours[day.id] || 0 }))), [days, overview]);
  return (
    <section className="share-overview" aria-label="全程路线">
      <div className="share-map-wrap">
        <RouteMap geometry={geometry} activeId={picked.id} onPick={setStopId} label="全程路线示意图：点一站看那几天" />
        <p className="share-map-hint">点地图上的一站</p>
      </div>
      <StopCard stop={card} href={stay.length ? `#day-${stay[0].id}` : undefined} />
      {ridge && (
        <div className="share-overview-sect">
          <h2>这一路的起伏</h2>
          <p className="share-lede">{overview.rideNote}</p>
          <RideChart ridge={ridge} />
        </div>
      )}
    </section>
  );
}
