// "Make your own plan": the visitor lays out the route (which places, in what order, how many nights);
// this turns it into days, using what we know about each place and each road from our two trips
// (data/places.json points at our own days in data/nz.json and data/au2026.json).

import { addDays, daysBetween, isDate } from "./dates.js";
import { MEAL_PERIOD, OPTIONAL, renumberDays } from "./edits.js";
import { monthDay } from "./format.js";

export const LONG_DRIVE = 4;

export function placeOf(library, id) {
  return library.places.find((place) => place.id === id) || null;
}

export function placeName(library, stop) {
  if (!stop) return "";
  const place = placeOf(library, stop.placeId);
  return place ? place.short || place.name : stop.name || "这一站";
}

// A road or flight we know between two places, in either direction.
export function legBetween(library, from, to) {
  if (!from || !to) return null;
  const leg = library.legs.find((item) => (item.from === from && item.to === to) || (item.from === to && item.to === from));
  return leg ? { ...leg, reversed: leg.from !== from } : null;
}

// A country of the place library by its code; a code that is not one of them (or names something every
// object has, such as "constructor") is none.
function countryInfo(library, code) {
  const countries = library.countries || {};
  return typeof code === "string" && Object.hasOwn(countries, code) ? countries[code] : null;
}

// Straight-line distance between two [lon, lat] points.
function distanceKm([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Within this straight-line distance in one country, a road we never drove is taken as a drive.
export const DRIVE_GUESS_KM = 500;

// A road we never drove that the visitor most likely drives: both ends in one of our countries
// ("other" is many countries, not one), close enough by road (across a strait or a continent it is not).
// A place of the visitor's own has no position: then the nearest of our places on each side of the road
// (from the whole route) stand in for it, and every stop between them must be in that same country.
// Without the route, or without one of our places on each side, the road stays unknown.
function drivable(library, prev, next, route) {
  const known = (stop) => placeOf(library, stop?.placeId);
  const countryOf = (stop) => known(stop)?.country || stop?.country || "";
  const from = countryOf(prev);
  if (!countryInfo(library, from) || countryOf(next) !== from) return false;
  const a = known(prev);
  const b = known(next);
  if (a?.ll && b?.ll) return distanceKm(a.ll, b.ll) <= DRIVE_GUESS_KM;
  const at = Array.isArray(route) ? route.indexOf(next) : -1;
  if (at < 1 || route[at - 1] !== prev) return false;
  let before = at - 1;
  while (before >= 0 && !known(route[before])?.ll) before -= 1;
  let after = at;
  while (after < route.length && !known(route[after])?.ll) after += 1;
  if (before < 0 || after >= route.length) return false;
  if (route.slice(before, after + 1).some((stop) => countryOf(stop) !== from)) return false;
  return distanceKm(known(route[before]).ll, known(route[after]).ll) <= DRIVE_GUESS_KM;
}

// Two stops in a row at the same place.
export function samePlace(a, b) {
  if (!a || !b) return false;
  if (a.placeId || b.placeId) return a.placeId === b.placeId;
  return Boolean(a.name) && a.name === b.name && (a.country || "") === (b.country || "");
}

// The same place twice in a row is one stop with the nights added up.
export function mergeRepeats(stops) {
  const out = [];
  for (const stop of stops) {
    const last = out.at(-1);
    if (samePlace(last, stop)) out[out.length - 1] = { ...last, nights: last.nights + stop.nights };
    else out.push(stop);
  }
  return out;
}

// How the visitor gets from one stop to the next: a road we drove, a flight, or something we never did.
// `route` (the whole list of stops holding prev and next) lets a place of the visitor's own count as a drive.
export function hop(library, prev, next, route) {
  if (!prev) return { mode: "home" };
  if (samePlace(prev, next)) return { mode: "stay" };
  const known = legBetween(library, prev.placeId, next.placeId);
  if (known) return known;
  const a = placeOf(library, prev.placeId);
  const b = placeOf(library, next.placeId);
  if (a && b && a.airport && b.airport && (a.country !== b.country || a.airport === "international" || b.airport === "international")) {
    return { mode: "flight", guessed: true };
  }
  return drivable(library, prev, next, route) ? { mode: "unknown", drivable: true } : { mode: "unknown" };
}

export function presetStops(library, presetId) {
  const preset = library.presets.find((item) => item.trip === presetId);
  return (preset?.stops || []).map(([placeId, nights], index) => ({ key: `s${index + 1}`, placeId, nights }));
}

// Places we drove to from here, for "where next?".
export function nextFrom(library, placeId) {
  return library.legs
    .filter((leg) => leg.from === placeId || leg.to === placeId)
    .map((leg) => ({ placeId: leg.from === placeId ? leg.to : leg.from, leg }));
}

// Chains of stops joined by roads are one car rental: the car is with you on every day of stops 2…n.
// A road we never drove counts when the visitor most likely drives it (see `drivable`).
export function carChains(library, stops) {
  const chains = [];
  let current = null;
  stops.forEach((stop, index) => {
    const way = index ? hop(library, stops[index - 1], stop, stops) : { mode: "home" };
    if (way.mode === "drive" || way.drivable) {
      if (!current) {
        current = { start: index - 1, end: index };
        chains.push(current);
      } else {
        current.end = index;
      }
    } else {
      current = null;
    }
  });
  return chains;
}

// Months (1–12) of the nights spent at each stop, counted from the first day.
function stopMonths(stops, startDate) {
  let offset = 0;
  return stops.map((stop) => {
    const months = new Set(range(0, stop.nights - 1).map((night) => Number(addDays(startDate, offset + night).slice(5, 7))));
    offset += Math.max(0, stop.nights);
    return months;
  });
}

// Things worth saying about the route before any day is written.
export function reviewRoute(library, stops, startDate = "") {
  const notes = [];
  const say = (level, text, at = null) => notes.push({ level, text, at });
  if (!stops.length) return notes;
  const first = placeOf(library, stops[0].placeId);
  const last = placeOf(library, stops.at(-1).placeId);
  // "tasman": an airport whose only international flights go to Australia (皇后镇).
  if (first?.airport === "tasman") say("tip", `${placeName(library, stops[0])}只有从澳洲飞来的国际航班：从国内去要在澳洲或奥克兰转机，经澳洲转机也要看澳洲的签证要求。`, 0);
  else if (first && first.airport !== "international") say("warn", `${placeName(library, stops[0])}没有国际航班，第一站一般放在有国际航班的城市，例如悉尼、墨尔本、基督城、奥克兰。`, 0);
  if (last?.airport === "tasman") say("tip", `${placeName(library, stops.at(-1))}只有飞澳洲的国际航班：回国要在澳洲或奥克兰转机，经澳洲转机也要看澳洲的签证要求。`, stops.length - 1);
  else if (last && last.airport !== "international") say("warn", `${placeName(library, stops.at(-1))}没有国际航班，回国前要先飞到或开到有国际航班的城市。`, stops.length - 1);

  // The same place twice in a row becomes one stop: its checks go by the nights added up.
  const merged = stops.map((stop, index) => {
    if (index > 0 && samePlace(stops[index - 1], stop)) return null;
    let nights = stop.nights;
    for (let next = index + 1; next < stops.length && samePlace(stop, stops[next]); next += 1) nights += stops[next].nights;
    return nights;
  });
  const total = (index) => merged.slice(0, index + 1).findLast((nights) => nights !== null);

  stops.forEach((stop, index) => {
    const place = placeOf(library, stop.placeId);
    const name = placeName(library, stop);
    if (merged[index] === null) {
      say("tip", `连着两站都是${name}：生成时合成一站，一共住 ${total(index)} 晚。`, index);
      return;
    }
    const nights = merged[index];
    if (index > 0) {
      const way = hop(library, stops[index - 1], stop, stops);
      const from = placeName(library, stops[index - 1]);
      if (way.mode === "unknown" && way.drivable) {
        say("warn", `${from} → ${name}：参考路线没走过这段，按接着开车算了用车天数，查好车程；改坐飞机或在${from}还车的话，预算里的租车跟着改。`, index);
      } else if (way.mode === "unknown") say("warn", `${from} → ${name}：参考路线没走过这段，查好怎么去、要多久。`, index);
      if (way.mode === "flight" && way.guessed) say("tip", `${from} → ${name}：参考路线没飞过这段，按航班算，查好有没有直飞。`, index);
      if (way.mode === "flight" && way.reversed) say("tip", `${from} → ${name}：参考路线是反方向飞的这段，航班时间自己查。`, index);
      if (way.mode === "drive" && way.hours >= LONG_DRIVE) {
        say("tip", `${from} → ${name} 是长途：${way.time}，连拍照、吃饭、加油按 1.5 倍留，大约 ${Math.round(way.hours * 1.5)} 小时，这天别再排别的。`, index);
      }
      if (way.mode === "drive" && way.reversed) say("tip", `${from} → ${name}：参考路线是反方向开的，路线和停靠点倒过来用。`, index);
      const before = stops[index - 1];
      const earlier = index > 1 ? hop(library, stops[index - 2], before, stops) : null;
      if (way.mode === "drive" && earlier?.mode === "drive" && way.hours >= 3 && earlier.hours >= 3 && total(index - 1) === 1) {
        say("warn", `连着两天开长途，中间在${placeName(library, before)}只住一晚：考虑在那里多住一晚。`, index - 1);
      }
      if (index === 1 && total(0) === 1 && way.mode === "drive" && way.hours >= 3) {
        say("tip", `落地第二天就开长途，时差可能还没倒过来：在${placeName(library, stops[0])}多住一晚会轻松很多。`, 0);
      }
    }
    if (index > 0 && nights === 1 && total(index - 1) === 1 && index - 1 > 0) {
      say("tip", `${placeName(library, stops[index - 1])}和${name}都只住一晚：搬家太频繁，每次都要退房、装车、入住。`, index);
    }
    const must = (place?.days || []).filter((item) => item.must);
    if (must.length && nights < 2) {
      say("warn", `${name}只住一晚，排不进「${must.map((item) => item.title).join("、")}」：至少住两晚。`, index);
    } else if (must.some((item) => item.weather) && nights === 2) {
      say("tip", `${name}的「${must.filter((item) => item.weather).map((item) => item.title).join("、")}」看天气：多住一晚，天气不好可以换一天。`, index);
    }
    if (place?.nights?.max && nights > place.nights.max) say("tip", `${name}住 ${nights} 晚比建议的多，可以考虑分出几晚给附近别的地方。`, index);
  });
  // Season notes (winter roads, stingers) once the first day is known: at the first stop whose nights fall in those months.
  if (isDate(startDate)) {
    const months = stopMonths(stops, startDate);
    for (const season of library.seasons || []) {
      const index = stops.findIndex((stop, at) => season.places.includes(stop.placeId) && season.months.some((month) => months[at].has(month)));
      if (index >= 0) say("tip", season.text, index);
    }
  }
  return notes;
}

const keyOf = (key) => {
  const [trip, id] = String(key).split(":");
  return { trip, id };
};

// "au:d7" points into our 2026 Australia trip, "nz:d5" into the New Zealand one.
const SOURCE = { au: "au2026", nz: "nz" };
const tripOf = (sources, trip) => sources[SOURCE[trip] || trip];

function sourceDay(sources, key) {
  const { trip, id } = keyOf(key);
  return tripOf(sources, trip)?.days.find((day) => day.id === id) || null;
}

function sourceNumber(sources, key) {
  const day = sourceDay(sources, key);
  if (!day) return null;
  if (Number.isInteger(day.dayNumber)) return day.dayNumber;
  const match = String(day.label || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function block(dayId, index, period, place, activity) {
  return { id: `${dayId}-${index}`, dayId, sortOrder: index * 10, period, place, activity, highlight: "", tip: "", choice: "", miss: "", resources: [] };
}

function blankDay(id, fields) {
  return {
    id,
    label: "",
    city: "",
    base: "",
    title: "",
    focus: "",
    lodging: "",
    lodgingStatus: "",
    climateNote: "",
    clothingNote: "",
    coverImageUrl: "",
    coverImageAlt: "",
    cityImageUrl: "",
    transport: "",
    leaveBy: "",
    notes: [],
    blocks: [],
    ...fields,
    coverImageUrl: fields.coverImageUrl || fields.cityImageUrl || "",
  };
}

let generations = 0;
// A name for one laying-out of the days, different every time (see `plan.generation`).
function newGeneration() {
  generations += 1;
  return `g${Date.now().toString(36)}${generations.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Builds the visitor's days. `sources` is { nz, au2026 }: our itineraries the library points into.
// Each plan made gets its own `plan.generation` (or `settings.generation`), and each reminder an id that
// carries it: a plan made again from the route, even with the same stops, shares no reminder with the old one.
export function composePlan(library, sources, settings) {
  const generation = typeof settings.generation === "string" && settings.generation ? settings.generation : newGeneration();
  const stops = mergeRepeats(settings.stops.filter((stop) => stop.nights >= 1));
  const chains = carChains(library, stops);
  const carStops = new Set(chains.flatMap((chain) => range(chain.start + 1, chain.end)));
  const used = new Set();
  const days = [];
  const stages = [];
  const leftOver = [];

  stops.forEach((stop, index) => {
    const place = placeOf(library, stop.placeId);
    const name = placeName(library, stop);
    const prev = stops[index - 1];
    const way = hop(library, prev, stop, stops);
    const fromId = index === 0 ? "home" : prev.placeId;
    const own = [];
    const base = {
      stopKey: stop.key,
      country: place?.country || stop.country || "",
      base: name,
      city: name,
      cityImageUrl: place?.image || "",
    };

    const arrival = place?.arrive?.find((item) => item.from === fromId && !used.has(item.day));
    if (arrival && sourceDay(sources, arrival.day)) {
      used.add(arrival.day);
      own.push(fromSource(sources, arrival.day, stop, own.length, base));
    } else {
      own.push(arrivalDay(library, stop, prev, way, own.length, base));
    }

    const firstSource = arrival ? keyOf(arrival.day).trip : "";
    const fillers = (place?.days || [])
      .filter((item) => !used.has(item.day) && sourceDay(sources, item.day))
      .sort((a, b) => Number(keyOf(b.day).trip === firstSource) - Number(keyOf(a.day).trip === firstSource));
    const taken = fillers.slice(0, stop.nights - 1);
    // A day of ours spent driving around here needs a car, whether or not the visitor drives in.
    const rented = new Set(taken.filter((item) => item.car === "day").map((item) => item.day));
    for (const item of taken) {
      used.add(item.day);
      own.push(fromSource(sources, item.day, stop, own.length, { ...base, car: item.car === "day" || (library.driveHours?.[item.day] || 0) > 0 }));
    }
    const spare = stop.nights - own.length;
    for (let nth = 0; own.length < stop.nights; nth += 1) own.push(freeDay(library, stop, own.length, base, nth, spare));
    const missed = fillers.slice(taken.length);
    if (missed.length) leftOver.push({ stop, titles: missed.map((item) => item.title) });

    // One place to sleep per stop: the first of our places there, on every night.
    const stay = own.find((day) => day.from && day.lodging && day.lodging !== "-");
    if (stay) {
      for (const day of own) {
        day.lodging = stay.lodging;
        day.lodgingStatus = stay.lodgingStatus || "";
        if (stay.lodgingResource) day.lodgingResource = stay.lodgingResource;
        else delete day.lodgingResource;
      }
    }

    for (const day of own) {
      day.car = Boolean(day.car || carStops.has(index));
      if (missed.length && day === own.at(-1)) {
        day.notes = [...(day.notes || []), { label: "这里还能做", text: `参考路线在${name}还安排过：${missed.map((item) => item.title).join("、")}。多住一晚就能排进来。` }];
      }
    }
    const note = (day, label, text) => {
      day.notes = [...(day.notes || []), { label, text }];
    };
    // Picking up the car: where a drive starts, or on a day here that needs one when the visitor came without.
    const chain = chains.find((item) => item.start === index);
    const firstCar = own.find((day) => day.car);
    if (chain) {
      note(firstCar || own.at(-1), "取车", place?.carPickup || "从这里开车出发：按租车合同的时间和地点取车，先查这里有没有租车门店。");
    } else if (firstCar && !carStops.has(index)) {
      // Our own pick-up on such a day was for our rental and is gone from the day (see withoutOurLease).
      note(firstCar, "取车", rented.has(firstCar.from)
        ? "这天要开车：在当地租车，当天取、当天还，或者改报一日游。"
        : "这天要开车，方案里到这里之前没有车：在当地租车，或者改报一日游。");
    }
    const chainEnd = chains.find((item) => item.end === index);
    if (chainEnd) note(own.at(-1), "还车", place?.carReturn || "开车这一段到这里结束：按租车合同的时间和地点还车，还车前加满油。");
    days.push(...own);
    stages.push({
      id: `stage-${stop.key}`,
      title: `${name} · ${stop.nights} 晚`,
      summary: place?.summary || "参考路线没到过这里，每天先空着。",
      imageUrl: place?.image || "",
      dayIds: own.map((day) => day.id),
    });
  });

  // Home: our own way home from the last stop, or a plain day.
  const last = stops.at(-1);
  const lastPlace = placeOf(library, last?.placeId);
  const lastName = placeName(library, last);
  const leave = lastPlace?.leave?.find((item) => item.to === "home");
  const homeDays = leave && leave.days.every((key) => sourceDay(sources, key) && !used.has(key))
    ? leave.days.map((key, at) => {
      used.add(key);
      const day = fromSource(sources, key, { key: "home" }, at, { stopKey: "home", country: lastPlace.country, base: "", city: "", cityImageUrl: "" });
      // Our own way home went through our own stopover to our own city: only the day's plan carries over.
      return { ...day, base: "", city: /→/.test(day.city) ? `${lastName} → 回国` : day.city };
    })
    : [homeDay(lastPlace, lastName, last?.country || "")];
  days.push(...homeDays);

  // "第 N 天" in our texts points at our numbering: point it at the visitor's day, or say it was ours.
  // Days, tips and meals all go through the same rewrite of the trip they came from.
  const newNumber = new Map(days.map((day, index) => [day.from, index + 1]).filter(([from]) => from));
  const rewrites = new Map();
  const pointAt = (trip) => {
    if (!rewrites.has(trip)) {
      const numbers = new Map(tripOf(sources, trip).days.map((ours) => [sourceNumber(sources, `${trip}:${ours.id}`), newNumber.get(`${trip}:${ours.id}`)]));
      // "连住三晚" was how long we stayed; the visitor's nights there may be fewer, so it reads as ours.
      const rewrite = (text) => text
        .replace(/第\s?(\d+)\s?天/g, (whole, digits) => {
          const mapped = numbers.get(Number(digits));
          return mapped ? `第 ${mapped} 天` : `参考路线的 D${digits}`;
        })
        .replace(/(参考路线)?连住([0-9一二两三四五六七八九十]+\s?晚)/g, (whole, said, nights) => `参考路线连住${nights}`);
      const walk = (value, key = "") => {
        if (typeof value === "string") return /url$|^id$|Id$|^from$|^label$/i.test(key) ? value : rewrite(value);
        if (Array.isArray(value)) return value.map((item) => walk(item, key));
        if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
        return value;
      };
      rewrites.set(trip, walk);
    }
    return rewrites.get(trip);
  };
  for (const day of days) {
    if (day.from) Object.assign(day, pointAt(keyOf(day.from).trip)(day));
  }

  // Hours at the wheel, for the ride chart: our own day's drive, or the road we know into a new stop.
  for (const day of days) {
    const hours = day.from ? library.driveHours?.[day.from] : day.driveHours;
    if (hours) day.driveHours = hours;
  }

  if (settings.pace === "easy") {
    for (const day of days) {
      const parked = day.blocks.filter((item) => OPTIONAL.test(item.choice || ""));
      if (parked.length) {
        // Each step remembers where it stood, so a step put back lands in its own place.
        const placed = day.blocks.map((item, index) => ({ ...item, origin: index }));
        day.parked = placed.filter((item) => OPTIONAL.test(item.choice || ""));
        day.blocks = placed.filter((item) => !OPTIONAL.test(item.choice || ""));
      }
    }
  }

  const ids = new Map(days.filter((day) => day.from).map((day) => [day.from, day.id]));
  const advice = [];
  const dining = [];
  for (const [name, data] of Object.entries(sources)) {
    const trip = Object.keys(SOURCE).find((key) => SOURCE[key] === name) || name;
    for (const item of data.advice || []) {
      const mapped = (item.dayIds || []).map((id) => ids.get(`${trip}:${id}`));
      if (mapped.length && mapped.every(Boolean)) advice.push({ ...pointAt(trip)(item), sortOrder: advice.length * 10, dayIds: mapped });
    }
    for (const row of data.dining || []) {
      const dayId = ids.get(`${trip}:${row.dayId}`);
      if (dayId) dining.push({ ...pointAt(trip)(row), dayId });
    }
  }

  for (const day of days) {
    if (day.notes?.length) day.notes = day.notes.map((item, index) => ({ ...item, id: `${generation}-${day.id}-n${index + 1}` }));
  }

  const start = isDate(settings.startDate) ? settings.startDate : "";
  const party = { adults: settings.adults, children: settings.children || 0 };
  const plan = {
    route: "mine",
    generation,
    startDate: start,
    adults: party.adults,
    children: party.children,
    rooms: settings.rooms,
    cars: settings.cars,
    pace: settings.pace === "easy" ? "easy" : "ours",
    stops: stops.map(({ key, placeId, name, country, nights, tz }) => ({ key, placeId: placeId || "", name: name || "", country: country || "", nights, ...(!placeId && typeof tz === "string" && tz ? { tz } : {}) })),
    leftOver: leftOver.map((item) => ({ stopKey: item.stop.key, titles: item.titles })),
  };
  const route = stops.map((stop) => `${placeName(library, stop)} ${stop.nights} 晚`).join(" → ");
  const draft = renumberDays({
    version: "mine",
    trip: {
      title: "方案",
      subtitle: stops.map((stop) => placeName(library, stop)).join(" · "),
      dates: start ? `${monthDay(start)}起 · ${days.length} 天` : `${days.length} 天`,
      travelers: `${party.adults}位成人${party.children ? `、${party.children}个小孩` : ""}`,
      route,
      summary: "",
      coverImageUrl: placeOf(library, stops[0]?.placeId)?.image || placeOf(library, stops.find((stop) => placeOf(library, stop.placeId)?.image)?.placeId)?.image || "",
      coverImageAlt: "",
    },
    stages,
    days,
    advice,
    dining,
    todos: [],
    plan,
    // Dates, nights and day numbers are filled in by renumberDays, now and after every change.
    lodgings: stays(library, stops, days),
  });
  return draft;
}

// How long the plan from this route is: its days (the way home included), nights and stops after repeats
// are merged. /plan shows these, so the numbers there are the plan's own.
export function planSize(library, sources, settings) {
  const plan = composePlan(library, sources, settings);
  return {
    days: plan.days.length,
    nights: plan.plan.stops.reduce((sum, stop) => sum + stop.nights, 0),
    stops: plan.plan.stops.length,
  };
}

function range(from, to) {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
}

// Where and when we picked our car up and returned it belong to our rental, not to the visitor's: the
// plan adds its own (see composePlan), which may start or end somewhere else, or not be there at all.
// A borrowed day loses them everywhere the page shows them: reminders, the lines on top, the steps,
// the drive to the rental desk, and the links to it.
const CAR_NOTES = new Set(["取车", "还车"]);
const LEASE = /取车|还车|收车|取还|提车|验车|机场还/;
const RENTAL_DESK = /(?:ACE|Sixt)[^→]*$/;
const RENTAL_LINK = /取车|还车|租车|ACE|Sixt/;

// Splits text into clauses, each with the mark that ends it (，；。 or " · " / " + " between parts of a
// line); a mark inside brackets does not end a clause.
function clauses(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "（" || char === "(") depth += 1;
    else if ((char === "）" || char === ")") && depth > 0) depth -= 1;
    else if (depth === 0) {
      const joint = /^ [·+] /.test(text.slice(index, index + 3)) ? 3 : /[，；。,;]/.test(char) ? 1 : 0;
      if (joint) {
        out.push(text.slice(start, index + joint));
        start = index + joint;
        index += joint - 1;
      }
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

// "取车时…" says what to do when picking a car up, whoever rents it, and a tram that "收车" has stopped
// running for the night: neither is our pick-up or return, so a clause with only these stays.
const NOT_LEASE = /[取还]车时(?!间)|电车[^，；。,;]*收车/g;
const aboutLease = (text) => LEASE.test(text.replace(NOT_LEASE, ""));

// The text without the clauses about picking up or returning our car.
export function withoutLease(text) {
  if (typeof text !== "string" || !aboutLease(text)) return text;
  const kept = clauses(text).filter((part) => !aboutLease(part)).join("").trim();
  if (!kept) return "";
  return kept.replace(/(?:[，；,;]| [·+])$/, /。$/.test(text) ? "。" : "");
}

// "A → rental desk → B": the rental desk becomes where the day starts (`origin`), or goes when there is none.
function withoutDesk(text, origin) {
  if (typeof text !== "string" || !/ACE|Sixt/.test(text)) return text;
  const points = text.split(" → ").map((point) => (RENTAL_DESK.test(point) ? (origin ? point.replace(RENTAL_DESK, origin) : "") : point)).filter((point) => point.trim());
  return points.filter((point, index) => point !== points[index - 1]).join(" → ");
}

const rentalLink = (resource) => RENTAL_LINK.test(`${resource?.title || ""} ${resource?.sourceNote || ""}`);

function withoutOurLease(day) {
  const origin = String(day.city || "").split(" → ")[0].trim();
  // The drive to or from the rental desk (its title says so) goes, and every link that pointed along it.
  const deskDrive = day.drive && LEASE.test(day.drive.title || "");
  const tag = deskDrive ? String(day.drive.title).match(/^导航\d+/)?.[0] || "" : "";
  const keepLink = (resource) => resource && !rentalLink(resource) && !(tag && resource.sourceNote === tag);
  const links = (list) => (Array.isArray(list) ? list.filter(keepLink) : list);
  const out = { ...day };
  for (const field of ["title", "focus", "transport", "coverImageAlt"]) out[field] = withoutLease(day[field]);
  if (LEASE.test(day.leaveBy || "") || /ACE|Sixt/.test(day.leaveBy || "")) out.leaveBy = "";
  if (Array.isArray(day.notes)) {
    out.notes = day.notes
      .filter((note) => !CAR_NOTES.has(note?.label))
      .map((note) => ({ ...note, text: withoutLease(note.text) }))
      .filter((note) => note.text);
  }
  out.blocks = (day.blocks || []).flatMap((item) => {
    if (item.period !== "饮食" && LEASE.test(item.highlight || "")) return [];
    const activity = withoutLease(item.activity);
    if (item.activity && !activity) return [];
    return [{ ...item, place: withoutDesk(item.place, origin), activity, tip: withoutLease(item.tip), resources: links(item.resources) || [] }];
  });
  for (const field of ["primaryResource", "ticketResource", "lodgingResource"]) {
    if (day[field] && !keepLink(day[field])) delete out[field];
  }
  if (deskDrive) out.drive = null;
  else if (day.drive) {
    out.drive = {
      ...day.drive,
      title: withoutDesk(day.drive.title, origin),
      duration: withoutLease(day.drive.duration),
      sequence: withoutDesk(day.drive.sequence, origin),
      notes: withoutLease(day.drive.notes),
      legs: (day.drive.legs || []).map((leg) => ({ ...leg, segment: withoutDesk(leg.segment, origin), stopNote: withoutLease(leg.stopNote) })),
      resources: links(day.drive.resources) || [],
    };
  }
  return out;
}

function fromSource(sources, key, stop, at, base) {
  const day = withoutOurLease(structuredClone(sourceDay(sources, key)));
  const id = `${stop.key}-${at + 1}`;
  delete day.date;
  delete day.weekday;
  delete day.dayNumber;
  delete day.lat;
  delete day.lon;
  return {
    ...day,
    // Our weather and what we wore were for the season we went; the visitor's month may be another.
    climateNote: "",
    clothingNote: "",
    coverImageAlt: String(day.coverImageAlt || "").replace(/^D\d+\s*/, ""),
    ...base,
    base: base.base || day.base,
    city: day.city || base.city,
    cityImageUrl: day.cityImageUrl || base.cityImageUrl,
    id,
    label: "",
    from: key,
    blocks: day.blocks.map((item, index) => ({ ...item, id: `${id}-${index + 1}`, dayId: id })),
  };
}

function arrivalDay(library, stop, prev, way, at, base) {
  const id = `${stop.key}-${at + 1}`;
  const name = placeName(library, stop);
  const from = prev ? placeName(library, prev) : "";
  const place = placeOf(library, stop.placeId);
  const lodging = { lodging: place ? `${name}的住处` : "", lodgingStatus: "" };
  if (way.mode === "home" && place?.airport === "international") {
    return blankDay(id, {
      ...base,
      ...lodging,
      title: `飞抵${name}`,
      focus: "落地后先进城放行李，第一天不排重的事。",
      transport: "国际航班",
      blocks: [
        block(id, 1, "落地后", `${name}机场`, "入境、取行李，打车或坐机场快线进城。"),
        block(id, 2, "下午", name, "住处附近走走，早点休息倒时差。"),
      ],
    });
  }
  if (way.mode === "flight") {
    return blankDay(id, {
      ...base,
      ...lodging,
      title: `从${from}飞${name}`,
      city: `${from} → ${name}`,
      transport: "航班",
      // Our note was written for the other direction.
      notes: way.reversed ? [{ label: "航班", text: "参考路线是反方向飞的这段，航班时间自己查。" }] : way.note ? [{ label: "航班", text: way.note }] : [],
      blocks: [
        block(id, 1, "按航班", `${from}机场`, "退房去机场，按航班时间提前到。"),
        block(id, 2, "落地后", name, "进城入住，傍晚在住处附近走走。"),
      ],
    });
  }
  if (way.mode === "drive") {
    return blankDay(id, {
      ...base,
      ...lodging,
      title: `从${from}开车到${name}`,
      city: `${from} → ${name}`,
      transport: `自驾 · ${way.time}`,
      driveHours: way.hours || 0,
      notes: [
        { label: "路上", text: way.note || "" },
        ...(way.reversed ? [{ label: "方向", text: "参考路线是反方向开的这段，停靠点倒过来用。" }] : []),
      ].filter((note) => note.text),
      blocks: [
        block(id, 1, "上午", from, "退房、装车出发。"),
        block(id, 2, "路上", `${from} → ${name}`, way.note || "按导航走，中途停下来吃饭、加油。"),
        block(id, 3, "傍晚", name, "入住，附近买好明天的早餐和路餐。"),
      ],
    });
  }
  return blankDay(id, {
    ...base,
    ...lodging,
    title: from ? `从${from}到${name}` : `到${name}`,
    city: from ? `${from} → ${name}` : name,
    transport: way.drivable ? "自驾 · 车程自己查" : "自己安排",
    notes: [{ label: "怎么去", text: !from
      ? (place ? `${name}没有国际航班：先飞到有国际航班的城市，再转机或开车过来，查好怎么接上。` : "参考路线没到过这里：查好从哪个机场进、落地后怎么过来。")
      : way.drivable
        ? "参考路线没走过这段：按接着开车算了用车，查好车程和路况。"
        : "参考路线没走过这段：查好开车要多久，或者有没有航班。" }],
    blocks: [block(id, 1, "全天", name, "到了先入住，剩下的时间自己安排。")],
  });
}

// The `nth` of `count` spare days at a stop: our ideas for the place are shared out, one set per day,
// and a day left without one stays open.
function freeDay(library, stop, at, base, nth = 0, count = 1) {
  const id = `${stop.key}-${at + 1}`;
  const name = placeName(library, stop);
  const place = placeOf(library, stop.placeId);
  const share = (place?.extra || []).filter((_, index) => index % Math.max(1, count) === nth);
  const ideas = share.length ? share : [{ place: name, activity: "这一天先空着：可以把这一段标了「可加」的事挪到这天，或者就休息。" }];
  return blankDay(id, {
    ...base,
    lodging: place ? `${name}的住处` : "",
    title: place ? `在${name}多留一天` : `${name}`,
    focus: !place ? "参考路线没到过这里，这一天先空着。" : share.length ? "参考路线在这里没有多住，这一天先空着，下面是值得做的事。" : "参考路线在这里没有多住，这一天先空着。",
    transport: "自己安排",
    blocks: ideas.map((idea, index) => block(id, index + 1, idea.period || (index === 0 ? "全天" : ""), idea.place || "", idea.activity || "")),
  });
}

// The day home when we never went home from here: from an international airport, or by way of one.
function homeDay(lastPlace, name, country) {
  const flies = lastPlace?.airport === "international";
  return blankDay("home-1", {
    stopKey: "home",
    country: lastPlace?.country || country,
    city: `${name} → 回国`,
    title: "回程",
    transport: flies ? "国际航班" : "自己安排 · 国际航班",
    lodging: "-",
    lodgingStatus: "无需住宿",
    blocks: [flies
      ? block("home-1", 1, "按航班", `${name}机场`, "按国际航班时间倒推，提前 3 小时到机场。")
      : block("home-1", 1, "按航班", name, `${lastPlace ? `${name}没有国际航班` : "参考路线没从这里回过国"}：先飞到或开到有国际航班的城市，按回国航班的时间倒推，提前 3 小时到机场。`)],
  });
}

// Where the visitor sleeps, one row per stop. renumberDays fills in the days, the nights and the dates.
function stays(library, stops, days) {
  return stops.map((stop, index) => {
    const own = days.filter((day) => day.stopKey === stop.key);
    const place = placeOf(library, stop.placeId);
    const stay = own.find((day) => day.from && day.lodging && day.lodging !== "-");
    // The place's note and price are for where we stayed on the trip it lists first; a stay from our other trip goes without.
    const noteTrip = keyOf(place?.arrive?.[0]?.day || place?.days?.[0]?.day || "").trip;
    const sameTrip = !stay || keyOf(stay.from).trip === noteTrip;
    return {
      sortOrder: (index + 1) * 10,
      stopKey: stop.key,
      name: stay?.lodging || own[0]?.lodging || `${placeName(library, stop)}的住处`,
      room: "",
      detail: sameTrip ? place?.lodging?.note || "" : "",
    };
  });
}

const round = (value) => Math.round(value * 100) / 100;

// Adds `amounts` × `times` into `target`; nothing to add leaves no line of zeros behind.
function add(target, amounts, times) {
  if (!times) return target;
  for (const [currency, value] of Object.entries(amounts || {})) target[currency] = round((target[currency] || 0) + value * times);
  return target;
}

// The budget follows the visitor's days as they are now: nights per stop, car days, days in each country.
export function estimateOwnBudget(library, data, party, overrides = {}) {
  const people = Math.max(1, (Number(party.adults) || 0) + (Number(party.children) || 0));
  const rooms = Math.max(1, Number(party.rooms) || 1);
  const cars = Math.max(1, Number(party.cars) || 1);
  const countryOf = (day) => day.country || "";
  const byCountry = {};
  const carDays = {};
  for (const day of data.days) {
    const country = countryOf(day);
    byCountry[country] = (byCountry[country] || 0) + 1;
    if (day.car) carDays[country] = (carDays[country] || 0) + 1;
  }
  const rate = (country, kind) => countryInfo(library, country)?.rates?.[kind];
  const countries = Object.keys(byCountry);
  const flightCountry = countries.includes("nz") ? "nz" : countries.includes("au") ? "au" : "";
  // Days somewhere we have no prices for ("other", or no country at all).
  const unpriced = countries.some((country) => !countryInfo(library, country));
  const flight = rate(flightCountry, "flight");

  const lodging = {};
  const lodgingNotes = [];
  for (const stop of data.plan?.stops || []) {
    const nights = data.days.filter((day) => day.stopKey === stop.key).length;
    const place = placeOf(library, stop.placeId);
    const country = place?.country || stop.country || "";
    const nightly = place?.lodging?.amounts || rate(country, "lodging")?.amounts || averageLodging(library);
    if (!place?.lodging) lodgingNotes.push(`${placeName(library, stop)}没有参考价格，按平均价算`);
    add(lodging, nightly, nights * rooms);
  }

  const lines = [
    flight
      ? { kind: "flight", label: "机票", amounts: add({}, flight.amounts, people), note: [flight.note, unpriced ? "参考路线没去过的地方，那几段机票没算进去。" : ""].filter(Boolean).join(" ") }
      : { kind: "flight", label: "机票", amounts: { CNY: 0 }, note: "参考路线没飞过这里，机票没有估价：点“改金额”填上查到的价格。" },
    { kind: "lodging", label: "住宿", amounts: lodging, note: ["每处按参考路线那家的每晚价格算，乘住几晚、几间房。", ...lodgingNotes].join("；") },
    { kind: "car", label: "租车", amounts: countries.reduce((sum, country) => add(sum, rate(country, "car")?.amounts, (carDays[country] || 0) * cars), {}), note: countries.filter((country) => carDays[country]).map((country) => rate(country, "car")?.note).join(" ") },
    { kind: "insurance", label: "租车全险", amounts: countries.reduce((sum, country) => add(sum, rate(country, "insurance")?.amounts, (carDays[country] || 0) * cars), {}), note: countries.filter((country) => carDays[country]).map((country) => rate(country, "insurance")?.note).filter(Boolean).join(" ") },
    { kind: "activity", label: "门票和活动", amounts: countries.reduce((sum, country) => add(sum, rate(country, "activity")?.amounts, byCountry[country] * people), {}), note: [...countries.map((country) => rate(country, "activity")?.note), unpriced ? "参考路线没去过的地方，门票和活动没算进去。" : ""].filter(Boolean).join(" ") },
    { kind: "food", label: "吃喝", amounts: add({}, library.daily.food.amounts, data.days.length * people), note: library.daily.food.note },
    { kind: "transport", label: "市内交通和油费", amounts: add({}, library.daily.transport.amounts, data.days.length * people), note: library.daily.transport.note },
  ];

  // Amounts typed in count even when there is no estimate for that line any more (no car days left, say).
  const result = lines.map((line) => {
    const own = overrides[line.kind];
    const edited = Boolean(own && Object.keys(own).length);
    return { ...line, estimate: line.amounts, amounts: edited ? own : line.amounts, edited };
  }).filter((line) => line.edited || Object.keys(line.estimate).length);
  const totals = {};
  for (const line of result) add(totals, line.amounts, 1);
  const allCarDays = Object.values(carDays).reduce((sum, value) => sum + value, 0);
  return { note: "按参考路线的价格和人数、天数估的。机票、住宿和活动的价格跟季节和预订早晚关系很大，用来心里有个数，不是报价。", lines: result, totals, counts: { days: data.days.length, carDays: allCarDays }, people, rooms, cars };
}

// Where we have no price for a stay: the average of our countries' nightly prices in yuan.
// Only CNY: a country priced in its own currency would otherwise give an average of that one country.
function averageLodging(library) {
  const values = Object.values(library.countries || {})
    .map((country) => country.rates?.lodging?.amounts?.CNY)
    .filter((value) => typeof value === "number" && value > 0);
  return values.length ? { CNY: round(values.reduce((sum, value) => sum + value, 0) / values.length) } : {};
}

const needsMet = (needs, data) => {
  if (!needs) return true;
  const [kind, country] = needs.split(":");
  if (kind !== "car") return true;
  return data.days.some((day) => day.car && (!country || day.country === country));
};

// What to book and get ready, on the visitor's calendar.
export function ownTimeline(library, data, startDate = "", today = "") {
  const position = new Map(data.days.map((day, index) => [day.from, index]).filter(([from]) => from));
  const countries = new Set(data.days.map((day) => day.country));
  const items = [];
  const push = (item, kind, offset, day) => {
    const relative = offset - item.before;
    const due = isDate(startDate) ? addDays(startDate, relative) : "";
    items.push({
      ...item,
      kind,
      relative,
      when: day ? `第 ${offset + 1} 天前 ${item.before} 天` : item.before >= 2 ? `出发前 ${item.before} 天` : "出发前",
      due,
      late: Boolean(due && isDate(today) && daysBetween(today, due) < 0),
      day: day ? { id: day.id, number: offset + 1, title: day.title } : null,
    });
  };
  for (const item of library.bookings) {
    if (!needsMet(item.needs, data)) continue;
    if (item.ref === "start") push(item, "book", 0, null);
    else if (position.has(item.ref)) push(item, "book", position.get(item.ref), data.days[position.get(item.ref)]);
  }
  for (const item of library.prep) {
    if (item.country && !countries.has(item.country)) continue;
    if (!needsMet(item.needs, data)) continue;
    // "country:nz": due before the first day in that country (an arrival card), not before the trip.
    const arrival = String(item.ref || "").startsWith("country:") ? data.days.findIndex((day) => day.country === item.ref.slice(8)) : -1;
    if (arrival > 0) push(item, "prep", arrival, data.days[arrival]);
    else push(item, "prep", 0, null);
  }
  return items.sort((a, b) => a.relative - b.relative || a.title.localeCompare(b.title, "zh"));
}
