// Turns a trip (original or the visitor's own copy) into a plain-text Markdown itinerary.
import { MEAL_PERIOD } from "./edits.js";
import { mealPairs, monthDay } from "./format.js";

const line = (label, value) => (value ? `- **${label}**：${value}` : "");

export function tripToMarkdown(data) {
  const { trip, days } = data;
  const out = [`# ${trip.title}${trip.subtitle ? ` · ${trip.subtitle}` : ""}`, ""];
  const meta = [trip.dates, trip.route, trip.travelers].filter(Boolean).join(" · ");
  if (meta) out.push(meta, "");
  if (trip.summary) out.push(trip.summary, "");

  for (const day of days) {
    out.push(`## ${day.label} · ${monthDay(day.date)} ${day.weekday || ""} · ${day.title}`.trim(), "");
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
        ].filter(Boolean).join("<br>");
        out.push(`| ${cell(block.period)} | ${cell(block.place)} | ${cell(detail)} |`);
      }
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

  if (data.lodgings?.length) {
    out.push("## 住哪儿", "");
    for (const stay of data.lodgings) {
      out.push(`- **${stay.name}**（${stay.checkIn} – ${stay.checkOut}）${[stay.room, stay.detail].filter((value) => value && value !== "—").map((value) => ` · ${value}`).join("")}`);
    }
    out.push("");
  }

  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function cell(value) {
  return String(value || "").replace(/\|/g, "／").replace(/\n/g, "<br>");
}
