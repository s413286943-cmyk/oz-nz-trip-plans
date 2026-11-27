export const MEALS = [
  { id: "breakfast", label: "早餐" },
  { id: "lunch", label: "午餐" },
  { id: "dinner", label: "晚餐" },
];

// Reads a day's "饮食" line ("早餐：…；午餐：…；晚餐：…") into { breakfast, lunch, dinner }.
export function parseMealPlan(text) {
  const plan = { breakfast: "", lunch: "", dinner: "" };
  const byLabel = Object.fromEntries(MEALS.map((meal) => [meal.label, meal.id]));
  for (const [label, value] of mealPairs(text)) {
    const id = byLabel[label];
    if (id) plan[id] = value;
  }
  return plan;
}

// "早餐：咖啡；晚餐：河边小馆 18:00" → [["早餐", "咖啡"], ["晚餐", "河边小馆 18:00"]]; only the first colon splits.
export function mealPairs(text) {
  return String(text || "")
    .split(/[；;]/)
    .map((part) => part.match(/^\s*([^：:]+)[：:]([\s\S]*)$/))
    .filter((match) => match && match[2].trim())
    .map((match) => [match[1].trim(), match[2].trim()]);
}

export function monthDay(date) {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
}

export function shortDate(date) {
  return date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : "";
}

// "D0" is day 0 (the 2026 route starts there), "D05" day 5.
export function dayNumber(day) {
  if (Number.isInteger(day.dayNumber)) return String(day.dayNumber);
  const digits = String(day.label || "").match(/\d+/);
  return digits ? String(Number(digits[0])) : String(day.label || "");
}

// A day with a calendar date shows it; any other day shows its number.
export function dayWhen(day) {
  return day.date ? `${monthDay(day.date)} ${day.weekday || ""}`.trim() : `第 ${dayNumber(day)} 天`;
}

export function stayEnds(stay) {
  return stay.checkIn ? [shortDate(stay.checkIn), shortDate(stay.checkOut)] : [`D${stay.fromDay}`, `D${stay.toDay}`];
}

const CURRENCY = { CNY: "¥", NZD: "NZ$", AUD: "A$" };

export function money(amount, currency) {
  const value = Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${CURRENCY[currency] || `${currency} `}${value}`;
}

export function shortTransport(day) {
  if (day.drive) {
    const hours = day.transport.match(/约?([\d.–]+)小时/);
    return hours ? `开车 ${hours[1]} 小时` : "当天开车";
  }
  return String(day.transport || "").split(" · ")[0];
}
