// Turns a trip (original or the visitor's own copy) into a plain-text Markdown itinerary.
import { MEAL_PERIOD } from "./edits.js";
import { dayNumber, dayWhen, mealPairs, money, shortDate, stayEnds } from "./format.js";
import { estimateOwnBudget, ownTimeline } from "./compose.js";

const line = (label, value) => (value ? `- **${label}**：${value}` : "");
const LINK_LABELS = { map: "地图", official: "官网", booking: "预订", restaurant: "餐厅", photo: "图片" };

// With the place library, a visitor's own plan also gets its budget and its booking list.
// `checks` (ticked items), `prep` (checklist items removed and added) and `today` follow the checklist page.
export function tripToMarkdown(data, { library = null, checks = {}, prep = data.prep, today = "" } = {}) {
  const { trip, days } = data;
  const out = [`# ${trip.title}${trip.subtitle ? ` · ${trip.subtitle}` : ""}`, ""];
  const meta = [trip.dates, data.plan?.adults ? "" : trip.route, trip.travelers].filter(Boolean).join(" · ");
  if (meta) out.push(meta, "");
  if (trip.summary) out.push(trip.summary, "");

  for (const day of days) {
    out.push(`## ${day.date ? `${day.label} · ${dayWhen(day)}` : dayWhen(day)} · ${day.title}`, "");
    if (day.city) out.push(`*${day.city}*`, "");
    if (day.focus) out.push(day.focus, "");
    const facts = [
      line("出发", day.leaveBy),
      line("怎么走", day.transport),
      line("住哪儿", day.lodging && day.lodging !== "-" ? day.lodging : ""),
      line("天气", day.climateNote),
      line("穿什么", day.clothingNote),
    ].filter(Boolean);
    if (facts.length) out.push(...facts, "");

    const timeline = day.blocks.filter((block) => block.period !== MEAL_PERIOD);
    if (timeline.length) {
      out.push("| 时间 | 地点 | 安排 |", "|---|---|---|");
      for (const block of timeline) {
        const detail = [
          block.choice ? `**${block.choice}**` : "",
          block.activity,
          block.tip ? `提示：${block.tip}` : "",
          block.miss ? `选这个会错过：${block.miss}` : "",
          links(block.resources),
        ].filter(Boolean).join("<br>");
        out.push(`| ${cell(block.period)} | ${cell(block.place)} | ${cell(detail)} |`);
      }
      out.push("");
    }

    if (day.parked?.length) {
      out.push("**收起来的「可加」**", "");
      for (const block of day.parked) out.push(`- ${block.place || ""}${block.activity ? ` · ${block.activity}` : ""}`);
      out.push("");
    }

    const meals = mealPairs(day.blocks.find((block) => block.period === MEAL_PERIOD)?.activity);
    if (meals.length) out.push(`**吃什么**：${meals.map(([meal, place]) => `${meal} ${place}`).join("；")}`, "");

    if (day.notes?.length) {
      out.push("**提醒**", "");
      for (const note of day.notes) out.push(`- ${note.label ? `**${note.label}**：` : ""}${note.text}`);
      out.push("");
    }

    if (day.drive?.legs?.length) {
      out.push(`**开车**：${day.drive.duration || ""}`, "", "| 路段 | 开车 | 停车与停留 |", "|---|---|---|");
      for (const leg of day.drive.legs) out.push(`| ${cell(leg.segment)} | ${cell(leg.driveTime)} | ${cell(leg.stopNote)} |`);
      out.push("");
    }
  }

  if (data.advice?.length) {
    const labels = new Map(days.map((day) => [day.id, day.date ? day.label : `第 ${dayNumber(day)} 天`]));
    out.push("## 出行提示", "");
    for (const item of data.advice) {
      const when = (item.dayIds || []).map((id) => labels.get(id)).filter(Boolean).join("、");
      out.push(`- **${item.title}**${[item.verdict, when].filter(Boolean).length ? `（${[item.verdict, when].filter(Boolean).join(" · ")}）` : ""}：${[item.detail, item.action].filter(Boolean).join(" ")}${links(item.resources) ? ` ${links(item.resources)}` : ""}`);
    }
    out.push("");
  }

  if (data.lodgings?.length) {
    out.push("## 住哪儿", "");
    for (const stay of data.lodgings) {
      out.push(`- **${stay.name}**（${stayEnds(stay).join(" – ")}）${[stay.room, stay.detail].filter((value) => value && value !== "—").map((value) => ` · ${value}`).join("")}`);
    }
    out.push("");
  }

  const hidden = new Set(prep?.hidden || []);
  const added = (prep?.added || []).filter((item) => !hidden.has(item.id));
  if (library && data.plan?.stops) out.push(...planSections(data, library, { checks, hidden, today }));
  else {
    const todos = (data.todos || []).filter((todo) => !hidden.has(todo.id));
    if (todos.length) {
      out.push("## 出发前清单", "");
      for (const todo of todos) out.push(`${box(checks, todo.id)} ${todo.dueLabel ? `**${todo.dueLabel}** ` : ""}${todo.title}${todo.detail ? `：${todo.detail}` : ""}`);
      out.push("");
    }
  }
  if (added.length) {
    out.push("## 自己加的事", "");
    for (const item of added) out.push(`${box(checks, item.id)} ${item.title}${item.detail ? `：${item.detail}` : ""}`);
    out.push("");
  }

  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function planSections(data, library, { checks, hidden, today }) {
  const { plan } = data;
  const party = { adults: plan.adults, children: plan.children || 0, rooms: plan.rooms, cars: plan.cars };
  const budget = estimateOwnBudget(library, data, party, plan.budget || {});
  const out = ["## 预算（估算）", "", `按 ${budget.counts.days} 天、${budget.people} 个人、${budget.rooms} 间房、${budget.cars} 辆车。${budget.note}`, ""];
  for (const line of budget.lines) {
    const amounts = Object.entries(line.amounts).map(([currency, value]) => money(Math.round(value), currency)).join(" + ");
    out.push(`- **${line.label}**：${amounts || "—"}${line.edited ? "（自己填的）" : ""}`);
  }
  out.push(`- **合计**：${Object.entries(budget.totals).map(([currency, value]) => money(Math.round(value), currency)).join(" + ")}`, "");
  // Same ids as the checklist page, so its ticks and removed items carry over.
  const items = ownTimeline(library, data, plan.startDate || "", today).filter((item) => !hidden.has(`plan:${item.id}`));
  if (items.length) {
    out.push("## 什么时候订什么、办什么", "");
    for (const item of items) {
      const done = Boolean(checks[`plan:${item.id}`]);
      const when = item.due ? `${shortDate(item.due)} 前${item.late && !done ? "（已经过了，尽快）" : ""}` : item.when;
      out.push(`${box(checks, `plan:${item.id}`)} **${when}** ${item.title}${item.detail ? `：${item.detail}` : ""}`);
    }
    out.push("");
  }
  return out;
}

function box(checks, id) {
  return checks?.[id] ? "- [x]" : "- [ ]";
}

// Every web link of a step or tip, as Markdown links.
function links(resources) {
  return (resources || [])
    .filter((resource) => /^https?:\/\//i.test(resource?.url || ""))
    .map((resource) => `[${LINK_LABELS[resource.type] || "链接"} · ${String(resource.title || "").replace(/[[\]|]/g, " ")}](${resource.url.replace(/[()\s|]/g, encodeURIComponent)})`)
    .join(" ");
}

function cell(value) {
  return String(value || "").replace(/\|/g, "／").replace(/\n/g, "<br>");
}
