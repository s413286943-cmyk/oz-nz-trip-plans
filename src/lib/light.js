// One day of light: the ruler runs 05:00–23:00 so every day lines up, coloured from sunrise to
// sunset, with a white mark for each step of the day.
import { MEAL_PERIOD } from "./edits.js";

const RULER_START = 300;
const RULER_SPAN = 1080;

export const rulerPercent = (minutes) => Math.max(0, Math.min(100, ((minutes - RULER_START) / RULER_SPAN) * 100));

export function skyGradient(sun) {
  const at = (minutes) => `${rulerPercent(minutes).toFixed(1)}%`;
  const { rise: r, set: s } = sun;
  return `linear-gradient(90deg,#24363F 0,#24363F ${at(r - 42)},#7A6A86 ${at(r - 18)},#EDBE92 ${at(r + 4)},#A9D3DC ${at(r + 40)},#5F9DB2 ${at(r + 130)},#5F9DB2 ${at(s - 130)},#A9D3DC ${at(s - 52)},#EDBE92 ${at(s - 10)},#CF7F80 ${at(s + 6)},#6B5673 ${at(s + 28)},#24363F ${at(s + 54)},#24363F 100%)`;
}

// Words our plans use instead of a clock, and roughly where they sit. Longest first.
const PERIOD_WORDS = [["上午后段", 690], ["午饭前后", 750], ["中午至下午", 800], ["下午后段", 930], ["早餐后", 540], ["清晨", 390], ["早上", 540], ["上午", 600], ["中午", 750], ["午后", 810], ["下午", 870], ["傍晚", 1080], ["晚上", 1200], ["深夜", 1290], ["饭后", 1230]];

// When a step starts: its clock ("09:30", "16:00 前后", "约 15:00–15:45"), else its time of day.
export function stepMinutes(period) {
  const text = String(period || "");
  const clock = text.match(/(\d{1,2}):(\d{2})/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return PERIOD_WORDS.find(([word]) => text.includes(word))?.[1] ?? null;
}

// The steps of a day, for the ruler and for "what's next": not meals, not what to do if something
// falls through (rain, a cancelled tour, a reminder), and a set of A/B/C options counts once, as its
// first, with how many there are.
const FALLBACK_CHOICE = /^(雨天)?备选/;
const FALLBACK_PERIOD = /取消|下雨|关闭|^提醒/;
const OPTION = /^(.*?)\s*[A-H]\s*·/;

export function daySteps(day) {
  const steps = [];
  const sets = new Map();
  for (const block of day?.blocks || []) {
    if (block.period === MEAL_PERIOD) continue;
    if (FALLBACK_CHOICE.test(String(block.choice || "")) || FALLBACK_PERIOD.test(String(block.period || ""))) continue;
    const option = String(block.choice || "").match(OPTION);
    if (option && sets.has(option[1])) {
      sets.get(option[1]).options += 1;
      continue;
    }
    const step = { block, options: 1 };
    if (option) sets.set(option[1], step);
    steps.push(step);
  }
  return steps;
}

// A mark for every step of the day: its time, else a little after the one before.
export function dayTicks(day) {
  const ticks = [];
  for (const { block } of daySteps(day)) {
    const at = stepMinutes(block.period);
    ticks.push(at ?? (ticks.length ? ticks.at(-1) + 45 : 480));
  }
  return ticks;
}

export function spanWords(minutes) {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  return hours ? `${hours} 小时 ${whole % 60} 分` : `${whole} 分钟`;
}

export function sunWords(minutes, sun) {
  if (!sun) return "";
  if (minutes < sun.rise) return `离日出 ${spanWords(sun.rise - minutes)}`;
  if (minutes <= sun.set) return `离日落 ${spanWords(sun.set - minutes)}`;
  return `日落过了 ${spanWords(minutes - sun.set)}`;
}
