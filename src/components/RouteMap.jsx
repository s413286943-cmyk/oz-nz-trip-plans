"use client";

import { SHEETS } from "@/lib/routeMap";

const MAP = { sea: "#CFE2DF", land: "#E8E2C8", road: "#C8502B", casing: "#FFFFFF", flight: "#4F6B67", ink: "#17302F", halo: "#F4F7F2" };

// The South Island sketch with the route on it. Tap a stop to see it below the map.
export default function RouteMap({ geometry, activeId, onPick, label }) {
  return (
    <svg className="share-map" viewBox="0 0 390 536" preserveAspectRatio="xMidYMid slice" role="group" aria-label={label}>
      {sheetArt[geometry.sheet || "nz"]}
      {(geometry.sheet !== "au" || geometry.stops.some((stop) => stop.away)) && sheetCircles[geometry.sheet || "nz"]}
      {geometry.flights && <path d={geometry.flights} fill="none" stroke={MAP.flight} strokeWidth="2.4" strokeDasharray="1 6" strokeLinecap="round" />}
      {geometry.unknown && <path d={geometry.unknown} fill="none" stroke={MAP.flight} strokeWidth="1.6" strokeDasharray="7 5" />}
      {geometry.road && (
        <>
          <path d={`${geometry.road} ${geometry.spurs || ""}`} fill="none" stroke={MAP.casing} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d={geometry.road} fill="none" stroke={MAP.road} strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {geometry.spurs && <path d={geometry.spurs} fill="none" stroke={MAP.road} strokeWidth="2.8" strokeLinecap="round" />}
      {(geometry.pins || []).map((pin) => (
        <g key={pin.name}>
          <circle cx={pin.xy[0]} cy={pin.xy[1]} r="3.2" fill={MAP.casing} stroke={MAP.road} strokeWidth="1.8" />
          <text x={pin.xy[0] + pin.offset[0]} y={pin.xy[1] + pin.offset[1]} textAnchor="end" fill={MAP.ink} fontSize="13" fontWeight="600" paintOrder="stroke" stroke={MAP.halo} strokeWidth="3">{pin.name}</text>
        </g>
      ))}
      {geometry.stops.map((stop) => <StopPin key={stop.id} stop={stop} active={stop.id === activeId} onPick={onPick} />)}
    </svg>
  );
}

function StopPin({ stop, active, onPick }) {
  const [x, y] = stop.xy;
  const [dx, dy, anchor] = stop.label;
  return (
    <g
      className="share-map-pin"
      role="button"
      tabIndex={0}
      aria-label={stop.name}
      aria-pressed={active}
      onClick={() => onPick(stop.id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onPick(stop.id);
      }}
    >
      <circle cx={x} cy={y} r={stop.hit ?? 22} fill="transparent" />
      {active && <circle cx={x} cy={y} r="13" fill="none" stroke={MAP.road} strokeWidth="1.6" />}
      <circle cx={x} cy={y} r={active ? 8 : 6.5} fill={active ? MAP.road : MAP.casing} stroke={MAP.road} strokeWidth="2.6" />
      <text x={x + dx} y={y + dy} textAnchor={anchor} fill={MAP.ink} fontSize={active ? 16 : 14} fontWeight="700" paintOrder="stroke" stroke={MAP.halo} strokeWidth="3.4">{stop.name}</text>
    </g>
  );
}

// Coast, mountains and lakes never change, so each sheet renders once.
function insetCircles(key) {
  const base = SHEETS[key];
  return key === "nz"
    ? [
      { xy: base.insets.other, land: "M0,60 L60,62 C66,84 56,96 66,112 C72,126 60,140 66,158 L58,180 L0,180Z" },
      { xy: base.insets.north, land: "M280,70 C300,78 312,92 322,106 C332,104 346,92 362,88 L392,120 L392,190 L300,190 C306,168 318,152 326,136 C312,128 296,108 280,104Z" },
    ]
    : [{ xy: base.insets.other, land: "M318,140 C326,124 334,112 340,98 C346,86 352,76 360,66 L372,72 C366,88 356,100 350,114 C344,128 336,140 326,150Z" }];
}

function sheet(key) {
  const base = SHEETS[key];
  const id = (name) => `share-${key}-${name}`;
  const circles = insetCircles(key);
  return (
    <>
      <defs>
        <linearGradient id={id("sea")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFE2DF" />
          <stop offset=".62" stopColor="#DCE9E4" />
          <stop offset="1" stopColor="#F1F5F0" />
        </linearGradient>
        <clipPath id={id("land")}><path d={base.coast} /></clipPath>
        {circles.map((circle, index) => <clipPath key={index} id={id(`inset-${index}`)}><circle cx={circle.xy[0]} cy={circle.xy[1]} r="46" /></clipPath>)}
      </defs>
      <rect width="390" height="536" fill={`url(#${id("sea")})`} />
      {[[30, "#D6E7E2"], [16, "#E0EDE7"], [6, "#EAF2EC"]].map(([width, color]) => <path key={width} d={base.coast} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" />)}
      <path d={base.coast} fill={MAP.land} />
      <g clipPath={`url(#${id("land")})`}>
        <path d={base.ridge} fill="none" stroke="#DDD6B8" strokeWidth={key === "nz" ? 56 : 40} strokeLinecap="round" />
        <path d={base.ridge} fill="none" stroke="#CBC5A6" strokeWidth={key === "nz" ? 30 : 20} strokeLinecap="round" />
        <path d={base.ridge} fill="none" stroke="#AEAB93" strokeWidth={key === "nz" ? 12 : 7} strokeLinecap="round" />
        {base.peaks && <path d={base.peaks} fill="#FFFFFF" />}
      </g>
      {base.lakes.map((lake) => <path key={lake} d={lake} fill={key === "nz" ? "#4FB0AB" : MAP.sea} />)}
    </>
  );
}

// The corner circles for places in the other country (and Auckland on the South Island sheet).
function circlesOf(key) {
  return insetCircles(key).map((circle, index) => (
    <g key={index}>
      <circle cx={circle.xy[0]} cy={circle.xy[1]} r="48" fill="#FFFFFF" />
      <circle cx={circle.xy[0]} cy={circle.xy[1]} r="46" fill={MAP.sea} />
      <g clipPath={`url(#share-${key}-inset-${index})`}><path d={circle.land} fill={MAP.land} /></g>
    </g>
  ));
}

const sheetArt = { nz: sheet("nz"), au: sheet("au") };
const sheetCircles = { nz: circlesOf("nz"), au: circlesOf("au") };

// "Where am I": the stop the visitor tapped, with its days and a way into the first one.
export function StopCard({ stop, href, onOpen }) {
  return (
    <a className="share-stopcard" href={href} onClick={onOpen}>
      <span className="share-stopcard-photo">
        {stop.image ? <img src={stop.image} alt="" loading="lazy" /> : <span className="nz-photo-fallback" />}
      </span>
      <span className="share-stopcard-copy">
        <small>{stop.when}</small>
        <strong>{stop.name}</strong>
        <span>{stop.text}</span>
      </span>
    </a>
  );
}
