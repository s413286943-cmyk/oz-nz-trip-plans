// How the 2026 page lays out the days, so a copy with added, moved or undated days still shows every day.

// Days before the first stage (the flight out), each stage with its days, then every other day (the flight home,
// and days added after it).
export function atlasLayout(stages, days) {
  const staged = new Set((stages || []).flatMap((stage) => stage.dayIds));
  const firstStaged = days.findIndex((day) => staged.has(day.id));
  const loose = days.filter((day) => !staged.has(day.id));
  return {
    out: firstStaged < 0 ? [] : loose.filter((day) => days.indexOf(day) < firstStaged),
    stages: (stages || [])
      .map((stage) => ({ stage, days: days.filter((day) => stage.dayIds.includes(day.id)) }))
      .filter((item) => item.days.length),
    home: loose.filter((day) => firstStaged < 0 || days.indexOf(day) > firstStaged),
  };
}

// "07.28", or a plain note when the day has no date (a day the visitor added).
export function shortDay(day) {
  return typeof day?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day.date) ? day.date.slice(5).replace("-", ".") : "日期待定";
}

export function stageRange(days) {
  if (!days.length) return "";
  const [first, last] = [days[0], days.at(-1)];
  const labels = `${first.label}-${last.label}`;
  return first.date && last.date ? `${labels} · ${shortDay(first)}-${shortDay(last)}` : labels;
}
